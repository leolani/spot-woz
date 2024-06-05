import logging
import uuid

import flask
from cltl.combot.event.bdi import DesireEvent
from cltl.combot.event.emissor import TextSignalEvent, ScenarioStopped, SignalEvent
from cltl.combot.infra.config import ConfigurationManager
from cltl.combot.infra.event import Event, EventBus
from cltl.combot.infra.resource import ResourceManager
from cltl.combot.infra.time_util import timestamp_now
from cltl.combot.infra.topic_worker import TopicWorker
from emissor.representation.scenario import TextSignal, Annotation, Mention, class_type, Modality
from flask import Response
from flask import jsonify

from spot.chatui.api import Chats, Utterance
from spot_service.dialog.api import GameSignal, GameEvent

logger = logging.getLogger(__name__)


class ChatUiService:
    @classmethod
    def from_config(cls, chats: Chats, participant_id: str, participant_name: str, interaction: int,
                    event_bus: EventBus, resource_manager: ResourceManager, config_manager: ConfigurationManager):
        config = config_manager.get_config("spot.chat-ui")
        name = config.get("name")
        external_input = config.get_boolean("external_input")

        config = config_manager.get_config("spot.chat-ui.events")
        utterance_topic = config.get("topic_utterance")
        response_topic = config.get("topic_response")
        speaker_topic = config.get("topic_speaker")
        game_topic = config.get("topic_game")
        scenario_topic = config.get("topic_scenario")
        desire_topic = config.get("topic_desire")

        return cls(participant_id, participant_name, interaction, name, external_input, utterance_topic, response_topic, speaker_topic,
                   game_topic, scenario_topic, desire_topic, chats,
                   event_bus, resource_manager)

    def __init__(self, participant_id: str, participant_name: str, interaction: int, name: str, external_input: bool, utterance_topic: str, response_topic: str,
                 speaker_topic: str, game_topic: str, scenario_topic: str, desire_topic: str,
                 chats: Chats, event_bus: EventBus, resource_manager: ResourceManager):
        self._participant_id = participant_id
        self._participant_name = participant_name
        self._interaction = interaction
        self._name = name
        self._external_input = external_input

        self._response_topic = response_topic
        self._utterance_topic = utterance_topic
        self._speaker_topic = speaker_topic
        self._game_topic = game_topic
        self._scenario_topic = scenario_topic
        self._desire_topic = desire_topic
        self._chats = chats

        self._scenario_id = None
        self._agent = None
        self._speaker = None

        self._event_bus = event_bus
        self._resource_manager = resource_manager

        self._app = None
        self._topic_worker = None

    def start(self, timeout=30):
        self._topic_worker = TopicWorker([self._utterance_topic, self._response_topic, self._scenario_topic],
                                         self._event_bus, resource_manager=self._resource_manager,
                                         processor=self._process, buffer_size=256,
                                         name=self.__class__.__name__)
        self._topic_worker.start().wait()

    def stop(self):
        if not self._topic_worker:
            return

        self._topic_worker.stop()
        self._topic_worker.await_stop()
        self._topic_worker = None

    @property
    def app(self):
        if self._app:
            return self._app

        self._app = flask.Flask(__name__)

        @self._app.route('/chat/current', methods=['GET'])
        def current_chat():
            if not self._scenario_id:
                return Response(status=404)

            return {
                "id": self._scenario_id,
                "agent": self._agent.name if self._agent and self._agent.name else "SpotteRobot",
                "participantId": self._participant_id,
                "participantName": self._participant_name
            }

        @self._app.route('/chat/<chat_id>', methods=['GET', 'POST'])
        def utterances(chat_id: str):
            if not chat_id:
                return Response("Missing chat id", status=400)

            if flask.request.method == 'GET':
                return get_utterances(chat_id)
            if flask.request.method == 'POST':
                return post_utterances(chat_id)

        def get_utterances(chat_id: str):
            from_sequence = flask.request.args.get('from', default=0, type=int)
            agent_name = self._agent.name if self._agent and self._agent.name else "Leolani"
            speaker = flask.request.args.get('speaker', default=None if self._external_input else agent_name, type=str)
            try:
                utterances = self._chats.get_utterances(chat_id, from_sequence=from_sequence)
                responses = [utterance for utterance in utterances if not speaker or utterance.speaker == speaker]

                return jsonify(responses)
            except ValueError:
                return Response(status=404)

        def post_utterances(chat_id: str):
            speaker = flask.request.args.get('speaker', default=None, type=str)
            text = flask.request.get_data(as_text=True)
            utterance = Utterance.for_chat(chat_id, speaker, timestamp_now(), text)
            self._chats.append(utterance)
            payload = self._create_payload(utterance)
            self._event_bus.publish(self._utterance_topic, Event.for_payload(payload))

            return Response(utterance.id, status=200)

        @self._app.route('/chat/<chat_id>/start', methods=['POST'])
        def start_game(chat_id: str):
            if not chat_id:
                return Response("Missing chat id", status=400)

            event = GameEvent(participant_id=self._participant_id, participant_name=self._participant_name, interaction=self._interaction)
            game_signal = GameSignal.for_scenario(self._scenario_id, timestamp_now(), event)
            game_signal_event = SignalEvent(class_type(GameSignal), Modality.VIDEO, game_signal)
            self._event_bus.publish(self._game_topic, Event.for_payload(game_signal_event))
            self._event_bus.publish(self._speaker_topic, Event.for_payload(game_signal_event))

            return Response(status=200)

        @self._app.route('/chat/<chat_id>/stop', methods=['POST'])
        def stop_scenario(chat_id: str):
            if not chat_id:
                return Response("Missing chat id", status=400)

            self._event_bus.publish(self._desire_topic, Event.for_payload(DesireEvent(['quit'])))

            return Response(status=200)

        @self._app.route('/urlmap')
        def url_map():
            return str(self._app.url_map)

        @self._app.after_request
        def set_cache_control(response):
            response.headers['Cache-Control'] = 'no-cache, no-store, must-revalidate'
            response.headers['Pragma'] = 'no-cache'
            response.headers['Expires'] = '0'

            return response

        return self._app

    def _create_payload(self, utterance: Utterance) -> TextSignalEvent:
        if not self._scenario_id:
            raise ValueError("No active scenario in chat UI for utterance %" + utterance.text)

        signal = TextSignal.for_scenario(self._scenario_id, utterance.timestamp, utterance.timestamp,
                                         None, utterance.text, signal_id=utterance.id)

        return TextSignalEvent.for_agent(signal)

    def _create_participant_id_payload(self, id: str):
        if not self._scenario_id:
            raise ValueError("No active scenario in chat UI for participant id %" + id)

        ts = timestamp_now()
        signal = TextSignal.for_scenario(self._scenario_id, ts, ts, None, id)

        offset = signal.ruler
        id_annotations = [Annotation("ParticipantID", id, __name__, ts)]
        signal.mentions = [Mention(str(uuid.uuid4()), [offset], id_annotations)]

        return TextSignalEvent.for_agent(signal)

    def _process(self, event: Event[TextSignalEvent]) -> None:
        if event.metadata.topic == self._scenario_topic:
            self._scenario_id = event.payload.scenario.id
            if event.payload.scenario.context and event.payload.scenario.context.agent:
                self._agent = event.payload.scenario.context.agent
            if event.payload.scenario.context and event.payload.scenario.context.speaker:
                self._speaker = event.payload.scenario.context.speaker

            if event.payload.type == ScenarioStopped.__name__:
                self._scenario_id = None
                self._agent = None
                self._speaker = None

            logger.info("Updated Chat UI for scenario %s with agent %s, speaker %s",
                          self._scenario_id, self._agent, self._speaker)

            return

        if not self._scenario_id:
            logger.warning("Dropped event outside scenario: %s", event)
            return

        chat_id = self._scenario_id

        if event.metadata.topic == self._response_topic:
            agent_name = self._agent.name if self._agent and self._agent.name else "Leolani"
            response = Utterance.for_chat(chat_id, agent_name, event.payload.signal.time.start,
                                          event.payload.signal.text)
            self._chats.append(response)
        elif event.metadata.topic == self._utterance_topic:
            speaker_name = self._speaker.name if self._speaker and self._speaker.name else "Stranger"
            utterance = Utterance.for_chat(chat_id, speaker_name, event.payload.signal.time.start,
                                           event.payload.signal.text, id=event.payload.signal.id)
            self._chats.append(utterance)
