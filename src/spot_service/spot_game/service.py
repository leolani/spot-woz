import enum
import logging
import uuid
from typing import Union

import flask
from cltl.combot.event.emissor import TextSignalEvent, ScenarioStopped, ImageSignalEvent, AnnotationEvent, \
    ScenarioStarted, ScenarioEvent, SignalEvent
from cltl.combot.infra.config import ConfigurationManager
from cltl.combot.infra.event import Event, EventBus
from cltl.combot.infra.resource import ResourceManager
from cltl.combot.infra.time_util import timestamp_now
from cltl.combot.infra.topic_worker import TopicWorker
from emissor.representation.scenario import ImageSignal, Annotation, class_type, Mention, MultiIndex, Modality
from flask import Response, redirect, url_for
from spot.dialog.dialog_manager import ConvState

from spot_service.dialog.api import GameSignal, GameEvent

logger = logging.getLogger(__name__)


FOLDER_MAP = {1: 'first_interaction', 2: 'second_interaction', 3: 'third_interaction'}
PREFERENCE_MAP = {
    1: {},
    2: {'berg': 'start_berg.html',
        'stad': 'start_stad.html',
        'strand': 'start_strand.html'},
    3: {'duik': 'start_duik.html',
        'maan': 'start_maan.html',
        'woestijn': 'start_woestijn.html'}
}


class Part(enum.Enum):
    INTRODUCTION = ["Druk maar op de knop om door te gaan naar de oefenronde", "Druk maar op de knop om naar de eerste ronde te gaan.",
                    "Na een paar seconden verschijnt er een knop waar je op moet drukken, en dan gaan we weer beginnen met ons spel."]
    PRACTICE = ["Klik maar op de knop Ga door op het scherm om te beginnen."]
    ROUND = None


class SpotGameService:
    @classmethod
    def from_config(cls, session: int, preference: str,
                    event_bus: EventBus, resource_manager: ResourceManager, config_manager: ConfigurationManager):
        config = config_manager.get_config("spot.game.events")
        scenario_topic = config.get("topic_scenario")
        image_topic = config.get("topic_image")
        game_topic = config.get("topic_game")
        game_state_topic = config.get("topic_game_state")
        text_out_topic = config.get("topic_text_out")

        return cls(session, preference, scenario_topic, image_topic, game_topic, game_state_topic, text_out_topic,
                   event_bus, resource_manager)

    def __init__(self, session: int, preference: str,
                 scenario_topic: str, image_topic: str, game_topic: str, game_state_topic: str,
                 text_out_topic: str, event_bus: EventBus, resource_manager: ResourceManager):
        self._scenario_topic = scenario_topic
        self._image_topic = image_topic
        self._game_topic = game_topic
        self._game_state_topic = game_state_topic
        self._text_out_topic = text_out_topic

        self._session = session
        self._preference = preference

        self._scenario_id = None

        self._event_bus = event_bus
        self._resource_manager = resource_manager

        self._app = None
        self._topic_worker = None

        self._finished_parts = None

    def start(self, timeout=30):
        self._topic_worker = TopicWorker([self._scenario_topic, self._game_state_topic, self._text_out_topic],
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

        @self._app.route('/start', methods=['GET'])
        def start_page():
            start = (PREFERENCE_MAP[self._session][self._preference]
                     if self._preference in PREFERENCE_MAP[self._session]
                     else "start.html")
            filename = f"{FOLDER_MAP[self._session]}/{start}"

            return redirect(url_for('static', filename=filename))

        @self._app.route('/rest/scenario', methods=['GET'])
        def current_scenario():
            if not self._scenario_id:
                return Response(status=404)

            return self._scenario_id

        @self._app.route('/rest/<scenario_id>/part/<part>/continue', methods=['GET'])
        def is_part_finished(scenario_id: str, part: str):
            if Part[part.upper()] in self._finished_parts:
                return "true"
            else:
                return "false"

        @self._app.route('/rest/<scenario_id>/image/<image_id>', methods=['POST'])
        def put_image(scenario_id: str, image_id: str):
            signal = ImageSignal.for_scenario(scenario_id, timestamp_now(), timestamp_now(), None, (0, 0, 4000, 2500), signal_id=image_id)
            signal_event = ImageSignalEvent.create(signal)
            self._event_bus.publish(self._image_topic, Event.for_payload(signal_event))

            event = GameEvent(round=image_id)
            game_signal = GameSignal.for_scenario(scenario_id, timestamp_now(), event)
            game_signal_event = SignalEvent(class_type(GameSignal), Modality.VIDEO, game_signal)
            self._event_bus.publish(self._game_topic, Event.for_payload(game_signal_event))

            self._finished_parts = tuple(p for p in self._finished_parts if p != Part.ROUND)

            return Response(status=200)

        @self._app.route('/rest/<scenario_id>/image/<image_id>/choice', methods=['POST'])
        def choices(scenario_id: str, image_id: str):
            data = flask.request.args
            annotation = Annotation("SpotResult", dict(data), class_type(self), timestamp_now())
            mention = Mention(str(uuid.uuid4()), [MultiIndex(image_id, (0, 0, 4000, 2500))], [annotation])
            annotation_event = AnnotationEvent.create([mention])
            self._event_bus.publish(self._image_topic, Event.for_payload(annotation_event))

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

    def _process(self, event: Event[Union[ScenarioEvent, TextSignalEvent, SignalEvent[GameSignal]]]) -> None:
        if event.metadata.topic == self._scenario_topic:
            self._scenario_id = event.payload.scenario.id

            if event.payload.type == ScenarioStopped.__name__:
                self._scenario_id = None
                self._finished_parts = None
            if event.payload.type == ScenarioStarted.__name__:
                self._finished_parts = ()

            logger.info("Updated spot game with scenario %s", self._scenario_id)
        elif event.metadata.topic == self._text_out_topic:
            if self._finished_parts is not None:
                logger.debug("Handling text event %s", event.payload.signal.text)
                text = event.payload.signal.text
                for part in Part:
                    if part.value and any(phrase in text for phrase in part.value):
                        self._finished_parts += (part,)
                        logger.info("Finished part %s", part)
        elif event.metadata.topic == self._game_state_topic:
            logger.debug("Handling game event %s", event.payload.signal.value)
            if self._finished_parts is not None and event.payload.signal.value.state == ConvState.QUESTIONNAIRE.name:
                self._finished_parts += (Part.ROUND,)
                logger.info("Finished part %s", Part.ROUND)