import enum
import logging

from cltl.combot.event.emissor import AudioSignalStarted
from cltl.combot.infra.config import ConfigurationManager
from cltl.combot.infra.event import Event, EventBus
from cltl.combot.infra.resource import ResourceManager
from cltl.combot.infra.topic_worker import TopicWorker
from emissor.representation.container import Index

logger = logging.getLogger(__name__)


class TurnState(enum.Enum):
    AGENT = enum.auto()
    AGENT_PENDING = enum.auto()
    PARTICIPANT = enum.auto()
    PARTICIPANT_PENDING = enum.auto()


class SpotTurnTakingService:
    @classmethod
    def from_config(cls, event_bus: EventBus, resource_manager: ResourceManager, config_manager: ConfigurationManager):
        config = config_manager.get_config("spot.turntaking")
        vad_topic = config.get("topic_vad")
        asr_topic = config.get("topic_asr")
        mic_topic = config.get("topic_mic")
        game_topic = config.get("topic_game")
        vad_control_topic = config.get("topic_vad_control")

        return cls(vad_topic, asr_topic, mic_topic, game_topic, vad_control_topic,
                   event_bus, resource_manager)

    def __init__(self, vad_topic: str, asr_topic: str,
                 mic_topic: str, game_topic: str, vad_control_topic: str,
                 event_bus: EventBus, resource_manager: ResourceManager):
        self._event_bus = event_bus
        self._resource_manager = resource_manager

        self._vad_topic = vad_topic
        self._asr_topic = asr_topic
        self._mic_topic = mic_topic
        self._game_topic = game_topic
        self._vad_control_topic = vad_control_topic

        self._topic_worker = None
        self._turn_state = TurnState.AGENT

    @property
    def app(self):
        return None

    def start(self, timeout=30):
        topics = [self._vad_topic, self._asr_topic, self._mic_topic, self._game_topic]
        self._topic_worker = TopicWorker(topics, self._event_bus, provides=[self._vad_control_topic],
                                         buffer_size=32, processor=self._process,
                                         resource_manager=self._resource_manager,
                                         name=self.__class__.__name__)
        self._topic_worker.start().wait()

    def stop(self):
        if not self._topic_worker:
            pass

        self._topic_worker.stop()
        self._topic_worker.await_stop()
        self._topic_worker = None

    def _process(self, event: Event):
        activate = False
        if event.metadata.topic == self._game_topic:
            expect_reply = event.payload.signal.value.input and event.payload.signal.value.input.lower() == "reply"
            self._turn_state = TurnState.PARTICIPANT_PENDING if expect_reply else TurnState.AGENT
            logger.debug("Received game event (%s), turn state %s", event.payload.signal, self._turn_state)
        elif event.metadata.topic == self._vad_topic:
            payload = event.payload
            if not payload.mentions or not payload.mentions[0].segment:
                self._turn_state = TurnState.PARTICIPANT
                activate = True
                logger.debug("Received empty VAD event, turn state %s", self._turn_state)
            else:
                segment: Index = payload.mentions[0].segment[0]
                self._turn_state = TurnState.PARTICIPANT if segment.stop == segment.start else TurnState.AGENT_PENDING
                activate = self._turn_state == TurnState.PARTICIPANT
                logger.debug("Received VAD event (%s), turn state %s", segment, self._turn_state)
        elif event.metadata.topic == self._asr_topic:
            self._turn_state = TurnState.PARTICIPANT if not event.payload.signal.text else TurnState.AGENT
            activate = self._turn_state == TurnState.PARTICIPANT
            logger.debug("Received text input (%s), turn state %s", event.payload.signal.text, self._turn_state)
        elif event.metadata.topic == self._mic_topic and event.payload.type == AudioSignalStarted.__name__:
            self._turn_state = TurnState.PARTICIPANT if self._turn_state == TurnState.PARTICIPANT_PENDING else TurnState.AGENT
            activate = self._turn_state == TurnState.PARTICIPANT
            logger.debug("Received audio signal started event (%s), turn state %s", event.id, self._turn_state)

        if activate:
            logger.info("Activated controller VAD: %s", event.id)
            self._event_bus.publish(self._vad_control_topic, Event.for_payload(True))
