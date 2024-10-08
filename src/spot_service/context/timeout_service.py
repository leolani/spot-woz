import enum
import logging

from cltl.combot.event.bdi import DesireEvent
from cltl.combot.event.emissor import ScenarioStarted, TextSignalEvent
from cltl.combot.infra.config import ConfigurationManager
from cltl.combot.infra.event import Event, EventBus
from cltl.combot.infra.resource import ResourceManager
from cltl.combot.infra.time_util import timestamp_now
from cltl.combot.infra.topic_worker import TopicWorker
from emissor.representation.scenario import TextSignal

logger = logging.getLogger(__name__)


class Status(enum.Enum):
    CONFIRMED = enum.auto()
    TERMINATED = enum.auto()


class TimeoutService:
    @classmethod
    def from_config(cls, event_bus: EventBus, resource_manager: ResourceManager, config_manager: ConfigurationManager):
        config = config_manager.get_config("spot.timeout")
        scenario_topic = config.get("topic_scenario")
        text_in_topic = config.get("topic_text_in")
        text_out_topic = config.get("topic_text_out")
        desire_topic = config.get("topic_desire")
        timeout = config.get_int("timeout")

        return cls(scenario_topic, text_in_topic, text_out_topic, desire_topic, timeout,
                   event_bus, resource_manager)

    def __init__(self, scenario_topic: str, text_in_topic: str, text_out_topic: str, desire_topic: str, timeout: int,
                 event_bus: EventBus, resource_manager: ResourceManager):
        self._event_bus = event_bus
        self._resource_manager = resource_manager

        self._scenario_topic = scenario_topic
        self._text_in_topic = text_in_topic
        self._text_out_topic = text_out_topic
        self._desire_topic = desire_topic

        self._timeout = timeout * 1000
        self._scenario_id = None
        self._last_utterance = None
        self._status = None

        self._topic_worker = None

    @property
    def app(self):
        return None

    def start(self, timeout=30):
        self._topic_worker = TopicWorker([self._scenario_topic, self._text_in_topic],
                                         self._event_bus, provides=[self._desire_topic, self._text_out_topic],
                                         buffer_size=8, processor=self._process,
                                         resource_manager=self._resource_manager,
                                         scheduled=60,
                                         name=self.__class__.__name__)
        self._topic_worker.start().wait()

    def stop(self):
        if not self._topic_worker:
            pass

        self._topic_worker.stop()
        self._topic_worker.await_stop()
        self._topic_worker = None

    def _process(self, event: Event):
        if event is None:
            if (self._status == Status.TERMINATED
                    or not self._last_utterance
                    or timestamp_now() - self._last_utterance < self._timeout):
                pass
            elif self._status == Status.CONFIRMED:
                self._event_bus.publish(self._text_out_topic, Event.for_payload(self._create_payload("Sad you left, Goodbye!")))
                self._event_bus.publish(self._desire_topic, Event.for_payload(DesireEvent(['quit'])))
                self._status = Status.TERMINATED
                logger.info("Quit due to timeout")
            else:
                self._event_bus.publish(self._text_out_topic, Event.for_payload(self._create_payload("Are you still there?")))
                self._status = Status.CONFIRMED
        elif event.metadata.topic == self._scenario_topic:
            if event.payload.type == ScenarioStarted.__name__:
                self._scenario_id = event.payload.scenario.id
                self._last_utterance = timestamp_now()
                self._status = None
        elif event.metadata.topic == self._text_in_topic:
            self._last_utterance = timestamp_now()
            self._status = None
        else:
            logger.warning("Unhandled event: %s", event)

    def _create_payload(self, utterance: str) -> TextSignalEvent:
        signal = TextSignal.for_scenario(self._scenario_id, timestamp_now(), timestamp_now(), None, utterance)

        return TextSignalEvent.for_speaker(signal)
