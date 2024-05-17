import enum
import logging
from concurrent.futures import ThreadPoolExecutor, Future
from typing import Tuple

import time
from cltl.backend.source.remote_tts import RemoteTextOutput
from cltl.backend.spi.text import TextOutput
from cltl.combot.event.emissor import AudioSignalStarted, TextSignalEvent
from cltl.combot.infra.config import ConfigurationManager
from cltl.combot.infra.event import Event, EventBus
from cltl.combot.infra.resource import ResourceManager
from cltl.combot.infra.time_util import timestamp_now
from cltl.combot.infra.topic_worker import TopicWorker
from cltl_service.emissordata.client import EmissorDataClient
from emissor.representation.container import Index
from emissor.representation.scenario import TextSignal

logger = logging.getLogger(__name__)


class TurnState(enum.Enum):
    AGENT_PENDING = enum.auto()
    AGENT = enum.auto()
    PARTICIPANT_PENDING = enum.auto()
    PARTICIPANT = enum.auto()


class SpotTurnTakingService:
    @classmethod
    def from_config(cls, tts: TextOutput, emissor_data: EmissorDataClient,
                    event_bus: EventBus, resource_manager: ResourceManager, config_manager: ConfigurationManager):
        config = config_manager.get_config("spot.turntaking")
        vad_topic = config.get("topic_vad")
        asr_topic = config.get("topic_asr")
        mic_topic = config.get("topic_mic")
        text_out_topic = config.get("topic_text_out")
        game_topic = config.get("topic_game")
        vad_control_topic = config.get("topic_vad_control")
        text_forward_topic = config.get("topic_text_forward")
        listen_color = tuple(float(c) for c in config.get("color_listen", multi=True))
        rotate_color_rgb = [float(c) for c in config.get("color_rotate", multi=True)] if "color_rotate" in config else None
        if rotate_color_rgb:
            rotate_color = int(65536 * 255 * rotate_color_rgb[0] + 256 * 255 * rotate_color_rgb[1] + 255 * rotate_color_rgb[2])
        else:
            rotate_color = None
        min_samples = config.get_int("min_samples")

        return cls(vad_topic, asr_topic, mic_topic, text_out_topic, game_topic, vad_control_topic, text_forward_topic,
                   listen_color, rotate_color, min_samples, tts, emissor_data, event_bus, resource_manager)

    def __init__(self, vad_topic: str, asr_topic: str, mic_topic: str, text_out_topic: str, game_topic: str,
                 vad_control_topic: str, text_forward_topic: str,
                 listen_color: Tuple[float, float, float], rotate_color: int, min_samples: int,
                 tts: TextOutput, emissor_data: EmissorDataClient, event_bus: EventBus, resource_manager: ResourceManager):
        self._event_bus = event_bus
        self._resource_manager = resource_manager
        self._tts = tts if isinstance(tts, RemoteTextOutput) else None
        logger.debug("Set tts %s", self._tts)
        self._emissor_data = emissor_data

        self._vad_topic = vad_topic
        self._asr_topic = asr_topic
        self._mic_topic = mic_topic
        self._text_out_topic = text_out_topic
        self._text_forward_topic = text_forward_topic
        self._game_topic = game_topic
        self._vad_control_topic = vad_control_topic

        self._listen_color = ", ".join(str(c) for c in listen_color)
        self._rotate_color = str(rotate_color)
        self._min_samples = min_samples

        self._topic_worker = None
        self._executor = None
        self._turn_state = TurnState.AGENT
        self._turn_signal: Future = None

    @property
    def app(self):
        return None

    def start(self, timeout=30):
        topics = [self._vad_topic, self._asr_topic, self._mic_topic, self._text_out_topic, self._game_topic]
        self._topic_worker = TopicWorker(topics, self._event_bus, provides=[self._vad_control_topic, self._text_forward_topic],
                                         buffer_size=32, processor=self._process,
                                         resource_manager=self._resource_manager,
                                         name=self.__class__.__name__)
        self._topic_worker.start().wait()
        self._executor = ThreadPoolExecutor(max_workers=1)

    def stop(self):
        if not self._topic_worker:
            pass

        self._topic_worker.stop()
        self._topic_worker.await_stop()
        self._topic_worker = None

    def _process(self, event: Event):
        activate = False
        previous = self._turn_state
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
                if segment.stop - segment.start > self._min_samples:
                    self._turn_state = TurnState.AGENT_PENDING
                    if (self._rotate_color and self._tts and not self._turn_signal):
                        self._turn_signal = self._executor.submit(self._signal_turn)
                    logger.debug("Received VAD event (%s), turn state %s", segment, self._turn_state)
                else:
                    logger.debug("Received too short VAD event (%s), turn state %s", segment, self._turn_state)
        elif event.metadata.topic == self._asr_topic:
            if event.payload.signal.text:
                self._turn_state = TurnState.AGENT_PENDING
            else:
                self._turn_state = TurnState.PARTICIPANT
                if self._turn_signal:
                    self._turn_signal.cancel()
                    self._turn_signal = None
            activate = self._turn_state == TurnState.PARTICIPANT
            logger.debug("Received text input (%s), turn state %s", event.payload.signal.text, self._turn_state)
        elif event.metadata.topic == self._text_out_topic:
            self._turn_state = TurnState.PARTICIPANT_PENDING
            if self._turn_signal:
                self._turn_signal.cancel()
                self._turn_signal = None
            self._event_bus.publish(self._text_forward_topic, Event.for_payload(event.payload))
            logger.info("Forwarded text signal event: %s", event.payload.signal.text)
        elif event.metadata.topic == self._mic_topic and event.payload.type == AudioSignalStarted.__name__:
            self._turn_state = TurnState.PARTICIPANT if self._turn_state == TurnState.PARTICIPANT_PENDING else TurnState.AGENT
            activate = self._turn_state == TurnState.PARTICIPANT
            logger.debug("Received audio signal started event (%s), turn state %s", event.id, self._turn_state)

        if self._vad_control_topic and activate:
            if previous not in [TurnState.AGENT, TurnState.PARTICIPANT_PENDING]:
                self._turn_state = TurnState.PARTICIPANT_PENDING
                scenario_id = self._emissor_data.get_current_scenario_id()
                text_signal = TextSignal.for_scenario(scenario_id, timestamp_now(), timestamp_now(), None, "Ik heb dat niet goed gehoord")
                self._event_bus.publish(self._text_out_topic, Event.for_payload(TextSignalEvent.for_agent(text_signal)))
            else:
                logger.info("Activated controller VAD: %s", event.id)
                self._event_bus.publish(self._vad_control_topic, Event.for_payload(True))

    def _signal_turn(self):
        start = timestamp_now()
        logger.debug("Start Rotating eyes")

        while self._turn_state == TurnState.AGENT_PENDING:
            self._tts.consume(f"^mode(disabled) ^pCall(ALLeds.rotateEyes({self._rotate_color}, 0.5, 0.5)) ", "nl")
            time.sleep(0.5)

        if self._turn_state != TurnState.PARTICIPANT:
            self._tts.consume(f"^mode(disabled) ^pCall(ALLeds.fadeRGB(\"FaceLeds\", {self._listen_color}, 0.1)) ", "nl")


        logger.debug("Rotated eyes for %s ms", timestamp_now() - start)
