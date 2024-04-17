import argparse
import enum
import logging.config
import os
from typing import Optional, List, Tuple

import cltl.chatui.api
import cltl.chatui.memory
import cltl_service.chatui.service
import requests as requests
import time
from cltl.backend.api.backend import Backend
from cltl.backend.api.camera import CameraResolution, Camera
from cltl.backend.api.gestures import GestureType
from cltl.backend.api.microphone import Microphone
from cltl.backend.api.storage import AudioStorage, ImageStorage
from cltl.backend.api.text_to_speech import TextToSpeech
from cltl.backend.impl.cached_storage import CachedAudioStorage, CachedImageStorage
from cltl.backend.impl.image_camera import ImageCamera
from cltl.backend.impl.sync_microphone import SynchronizedMicrophone
from cltl.backend.impl.sync_tts import SynchronizedTextToSpeech, TextOutputTTS
from cltl.backend.server import BackendServer
from cltl.backend.source.client_source import ClientAudioSource, ClientImageSource
from cltl.backend.source.console_source import ConsoleOutput
from cltl.backend.source.remote_tts import AnimatedRemoteTextOutput
from cltl.backend.spi.audio import AudioSource
from cltl.backend.spi.image import ImageSource
from cltl.backend.spi.text import TextOutput
from cltl.combot.event.bdi import IntentionEvent, Intention
from cltl.combot.infra.config.k8config import K8LocalConfigurationContainer
from cltl.combot.infra.di_container import singleton, DIContainer
from cltl.combot.infra.event import Event
from cltl.combot.infra.event.memory import SynchronousEventBusContainer
from cltl.combot.infra.event_log import LogWriter
from cltl.combot.infra.resource.threaded import ThreadedResourceContainer
from cltl.emissordata.api import EmissorDataStorage
from cltl.emissordata.file_storage import EmissorDataFileStorage
from cltl.vad.api import VAD
from cltl.vad.controller_vad import ControllerVAD
from cltl.vad.webrtc_vad import WebRtcVAD
from cltl_service.asr.service import AsrService
from cltl_service.backend.backend import BackendService
from cltl_service.backend.storage import StorageService
from cltl_service.bdi.service import BDIService
from cltl_service.combot.event_log.service import EventLogService
from cltl_service.emissordata.client import EmissorDataClient
from cltl_service.emissordata.service import EmissorDataService
from cltl_service.intentions.init import InitService
from cltl_service.vad.controller_service import ControllerVadService
from cltl_service.vad.service import VadService
from emissor.representation.util import serializer as emissor_serializer
from flask import Flask
from spot.dialog.dialog_manager import DialogManager
from spot.pragmatic_model.model_ambiguity import Disambiguator
from spot.pragmatic_model.world_short_phrases_nl import ak_characters, ak_robot_scene
from spot_service.dialog.service import SpotDialogService
from werkzeug.middleware.dispatcher import DispatcherMiddleware
from werkzeug.serving import run_simple

from spot.chatui.api import Chats
from spot.chatui.memory import MemoryChats
from spot.emissor.storage import SpotterScenarioStorage
from spot_service.chatui.service import ChatUiService
from spot_service.context.service import ContextService
from spot_service.spot_game.service import SpotGameService
from spot_service.turntaking.service import SpotTurnTakingService

logging.config.fileConfig(os.environ.get('CLTL_LOGGING_CONFIG', default='config/logging.config'),
                          disable_existing_loggers=False)
logger = logging.getLogger(__name__)


class DisambiguationCondition(enum.Enum):
    HIGH = 'high'
    LOW = 'low'

    def __str__(self):
        return self.value

class TurnTakingCondition(enum.Enum):
    AUTO = 'auto'
    CONTROL = 'control'

    def __str__(self):
        return self.value

class EnvironmentContainer(DIContainer):
    def start(self):
        pass

    def stop(self):
        pass

    @property
    def participant_id(self) -> str:
        raise NotImplementedError()
    @property
    def participant_name(self) -> str:
        raise NotImplementedError()

    @property
    def turn_taking_condition(self) -> TurnTakingCondition:
        raise NotImplementedError()

    @property
    def disambiguation_level(self) -> DisambiguationCondition:
        raise NotImplementedError()


class InfraContainer(SynchronousEventBusContainer, K8LocalConfigurationContainer, ThreadedResourceContainer):
    def start(self):
        pass

    def stop(self):
        pass


class TurnTakingTextOutput(AnimatedRemoteTextOutput):
    def __init__(self, remote_url: str,
                 gestures: List[GestureType] = None,
                 color_talk: Tuple[float, float, float] = (0.8, 0.0, 0.8),
                 color_listen: Tuple[float, float, float] = (0.7, 1.0, 0.4)):
        super().__init__(remote_url, gestures)
        self._led_talk = ("^mode(disabled) " if not gestures or gestures == [GestureType.DO_NOTHING] else "") + self._color_command(color_talk)
        self._led_listen = " ^pCall(ALLeds.rotateEyes(11730790, 0.5, 0.5)) " + self._color_command(color_listen)


        try:
            requests.delete(f"{remote_url}/behaviour/autonomous_visual_feedback")
        except:
            logger.exception("Failed to set autonomous_visual_feedback behaviour")

    def consume(self, text: str, language: Optional[str] = None):
        super().consume(f"{self._led_talk} {text} {self._led_listen}", language)

    @staticmethod
    def _color_command(color: Tuple[float, float, float]):
        return f"^pCall(ALLeds.fadeRGB(\"FaceLeds\", {color[0]}, {color[1]}, {color[2]}, 0.1))"


class BackendContainer(InfraContainer):
    @property
    @singleton
    def audio_storage(self) -> AudioStorage:
        return CachedAudioStorage.from_config(self.config_manager)

    @property
    @singleton
    def image_storage(self) -> ImageStorage:
        return CachedImageStorage.from_config(self.config_manager)

    @property
    @singleton
    def audio_source(self) -> AudioSource:
        return ClientAudioSource.from_config(self.config_manager)

    @property
    @singleton
    def image_source(self) -> ImageSource:
        return ClientImageSource.from_config(self.config_manager)

    @property
    @singleton
    def text_output(self) -> TextOutput:
        config = self.config_manager.get_config("cltl.backend.text_output")
        remote_url = config.get("remote_url")

        if remote_url:
            gestures = config.get_enum("gestures", GestureType, multi=True) if "gestures" in config else None
            color_talk = tuple(float(col) for col  in config.get("color_talk", multi=True))
            color_listen = tuple(float(col) for col  in config.get("color_listen", multi=True))

            return TurnTakingTextOutput(remote_url, gestures, color_talk, color_listen)
        else:
            implementation = config.get("implementation")
            if implementation == "console":
                return ConsoleOutput()
            elif implementation == "tts":
                from cltl.backend.source.local_tts import LocalTTSOutput
                return LocalTTSOutput()

    @property
    @singleton
    def microphone(self) -> Microphone:
        return SynchronizedMicrophone(self.audio_source, self.resource_manager)

    @property
    @singleton
    def camera(self) -> Camera:
        config = self.config_manager.get_config("cltl.backend.image")

        return ImageCamera(self.image_source, config.get_float("rate"))

    @property
    @singleton
    def tts(self) -> TextToSpeech:
        config = self.config_manager.get_config("cltl.backend.tts")
        language = config.get("language")

        return SynchronizedTextToSpeech(TextOutputTTS(self.text_output, language), self.resource_manager)

    @property
    @singleton
    def backend(self) -> Backend:
        return Backend(self.microphone, self.camera, self.tts)

    @property
    @singleton
    def backend_service(self) -> BackendService:
        return BackendService.from_config(self.backend, self.audio_storage, self.image_storage,
                                          self.event_bus, self.resource_manager, self.config_manager)

    @property
    @singleton
    def storage_service(self) -> StorageService:
        return StorageService(self.audio_storage, self.image_storage)

    @property
    @singleton
    def server(self) -> Flask:
        if not self.config_manager.get_config('cltl.backend').get_boolean("run_server"):
            # Return a placeholder
            return ""

        audio_config = self.config_manager.get_config('cltl.audio')
        video_config = self.config_manager.get_config('cltl.video')

        return BackendServer(audio_config.get_int('sampling_rate'), audio_config.get_int('channels'),
                             audio_config.get_int('frame_size'),
                             video_config.get_enum('resolution', CameraResolution),
                             video_config.get_int('camera_index'))

    def start(self):
        logger.info("Start Backend")
        super().start()
        if self.server:
            self.server.start()
        self.storage_service.start()
        self.backend_service.start()

    def stop(self):
        logger.info("Stop Backend")
        self.storage_service.stop()
        self.backend_service.stop()
        if self.server:
            self.server.stop()
        super().stop()


class EmissorStorageContainer(InfraContainer):
    @property
    @singleton
    def emissor_storage(self) -> EmissorDataStorage:
        config = self.config_manager.get_config("cltl.emissor-data")

        return EmissorDataFileStorage.from_config(self.config_manager, SpotterScenarioStorage(config.get("path")))

    @property
    @singleton
    def emissor_data_service(self) -> EmissorDataService:
        return EmissorDataService.from_config(self.emissor_storage,
                                              self.event_bus, self.resource_manager, self.config_manager)

    @property
    @singleton
    def emissor_data_client(self) -> EmissorDataClient:
        return EmissorDataClient("http://0.0.0.0:8000/emissor")

    def start(self):
        logger.info("Start Emissor Data Storage")
        super().start()
        self.emissor_data_service.start()

    def stop(self):
        logger.info("Stop Emissor Data Storage")
        self.emissor_data_service.stop()
        super().stop()


class VADContainer(InfraContainer, EnvironmentContainer):
    @property
    @singleton
    def vad(self) -> VAD:
        service_config = self.config_manager.get_config("cltl.vad")

        implementation = service_config.get('implementation', multi=True)
        if 'webrtc' in implementation:
            config = self.config_manager.get_config("cltl.vad.webrtc")
            activity_window = config.get_int("activity_window")
            activity_threshold = config.get_float("activity_threshold")
            allow_gap = config.get_int("allow_gap")
            padding = config.get_int("padding")
            min_duration = config.get_int("min_duration")
            storage = None
            # DEBUG
            # storage = f"{os.getcwd()}/storage/audio/debug/vad"

            return WebRtcVAD(activity_window, activity_threshold, allow_gap, padding, min_duration, mode=3,
                             storage=storage)

        return False

    @property
    @singleton
    def vad_service(self) -> VadService:
        service_config = self.config_manager.get_config("cltl.vad.service")

        implementation = service_config.get('implementation')
        if (self.turn_taking_condition == TurnTakingCondition.CONTROL
                or (not self.turn_taking_condition and implementation == 'controller')):
            config = self.config_manager.get_config("cltl.vad.controller")
            padding = config.get_int("padding")
            min_duration = config.get_int("min_duration")

            vad = ControllerVAD(self.vad, padding, min_duration)

            logger.info("Controller VAD service configured (%s)", implementation)

            return ControllerVadService.from_ctrl_config(vad, self.event_bus, self.resource_manager, self.config_manager)
        elif (self.turn_taking_condition == TurnTakingCondition.AUTO
                or (not self.turn_taking_condition and implementation == 'auto')):
            logger.info("VAD service configured (%s)", implementation)
            return VadService.from_config(self.vad, self.event_bus, self.resource_manager, self.config_manager)

        logger.info("No VAD service configured (%s)", implementation)

        return False


    def start(self):
        super().start()
        if self.vad_service:
            logger.info("Start VAD")
            self.vad_service.start()

    def stop(self):
        super().stop()
        if self.vad_service:
            logger.info("Stop VAD")
            self.vad_service.stop()


class ASRContainer(EmissorStorageContainer, InfraContainer):
    @property
    @singleton
    def asr_service(self) -> AsrService:
        config = self.config_manager.get_config("cltl.asr")
        sampling_rate = config.get_int("sampling_rate")
        implementation = config.get("implementation")
        storage = config.get("storage") if "storage" in config else None

        if implementation == "google":
            from cltl.asr.google_asr import GoogleASR
            impl_config = self.config_manager.get_config("cltl.asr.google")
            asr = GoogleASR(impl_config.get("language"), impl_config.get_int("sampling_rate"),
                            hints=impl_config.get("hints", multi=True))
        elif implementation == "whisper":
            from cltl.asr.whisper_asr import WhisperASR
            impl_config = self.config_manager.get_config("cltl.asr.whisper")
            asr = WhisperASR(impl_config.get("model"), impl_config.get("language"), storage=storage)
        elif implementation == "whisper_cpp":
            from cltl.asr.whisper_cpp_asr import WhisperCppASR
            impl_config = self.config_manager.get_config("cltl.asr.whisper_cpp")
            asr = WhisperCppASR(impl_config.get("url"), impl_config.get("language"), storage=storage)
        elif implementation == "whisper_api":
            from cltl.asr.whisper_api_asr import WhisperApiASR
            impl_config = self.config_manager.get_config("cltl.asr.whisper_api")
            credentials_config = self.config_manager.get_config("cltl.asr.whisper_api.credentials")
            asr = WhisperApiASR(credentials_config.get("api_key"), impl_config.get("model"), impl_config.get("language"), storage=storage)
        elif implementation == "speechbrain":
            from cltl.asr.speechbrain_asr import SpeechbrainASR
            impl_config = self.config_manager.get_config("cltl.asr.speechbrain")
            model = impl_config.get("model")
            asr = SpeechbrainASR(model, storage=storage)
        elif implementation == "wav2vec":
            from cltl.asr.wav2vec_asr import Wav2Vec2ASR
            impl_config = self.config_manager.get_config("cltl.asr.wav2vec")
            model = impl_config.get("model")
            asr = Wav2Vec2ASR(model, sampling_rate=sampling_rate, storage=storage)
        elif not implementation:
            asr = False
        else:
            raise ValueError("Unsupported implementation " + implementation)

        if asr:
            return AsrService.from_config(asr, self.emissor_data_client,
                                          self.event_bus, self.resource_manager, self.config_manager)
        else:
            logger.warning("No ASR implementation configured")
            return False

    def start(self):
        super().start()
        if self.asr_service:
            logger.info("Start ASR")
            self.asr_service.start()

    def stop(self):
        if self.asr_service:
            logger.info("Stop ASR")
            self.asr_service.stop()
        super().stop()


class ElizaComponentsContainer(EmissorStorageContainer, InfraContainer):
    @property
    @singleton
    def context_service(self) -> ContextService:
        return ContextService.from_config(self.event_bus, self.resource_manager, self.config_manager)

    @property
    @singleton
    def bdi_service(self) -> BDIService:
        bdi_model = {"init":
                         {"initialized": ["spot"]},
                     "spot":
                         {"quit": ["init"]}
                     }

        return BDIService.from_config(bdi_model, self.event_bus, self.resource_manager, self.config_manager)

    @property
    @singleton
    def init_intention(self) -> InitService:
        return InitService.from_config(self.emissor_data_client,
                                       self.event_bus, self.resource_manager, self.config_manager)

    def start(self):
        logger.info("Start Eliza services")
        super().start()
        self.bdi_service.start()
        self.context_service.start()
        self.init_intention.start()

    def stop(self):
        logger.info("Stop Eliza services")
        self.init_intention.stop()
        self.bdi_service.stop()
        self.context_service.stop()
        super().stop()


class ChatUIContainer(InfraContainer, EnvironmentContainer):
    @property
    @singleton
    def chats(self) -> Chats:
        return MemoryChats()

    @property
    @singleton
    def chatui_service(self) -> ChatUiService:
        return ChatUiService.from_config(self.chats, self.participant_id, self.participant_name,
                                         self.event_bus, self.resource_manager, self.config_manager)

    def start(self):
        logger.info("Start Chat UI")
        super().start()
        self.chatui_service.start()

    def stop(self):
        logger.info("Stop Chat UI")
        self.chatui_service.stop()
        super().stop()


class UserChatUIContainer(InfraContainer):
    @property
    @singleton
    def user_chats(self) -> cltl.chatui.api.Chats:
        return cltl.chatui.memory.MemoryChats()

    @property
    @singleton
    def user_chatui_service(self) ->  cltl_service.chatui.service.ChatUiService:
        return cltl_service.chatui.service.ChatUiService.from_config(self.user_chats, self.event_bus, self.resource_manager, self.config_manager)

    def start(self):
        logger.info("Start User Chat UI")
        super().start()
        self.user_chatui_service.start()

    def stop(self):
        logger.info("Stop User Chat UI")
        self.user_chatui_service.stop()
        super().stop()


class SpotGameContainer(InfraContainer):
    @property
    @singleton
    def spot_game_service(self) -> ChatUiService:
        return SpotGameService.from_config(self.event_bus, self.resource_manager, self.config_manager)

    def start(self):
        logger.info("Start Chat UI")
        super().start()
        self.spot_game_service.start()

    def stop(self):
        logger.info("Stop Chat UI")
        self.spot_game_service.stop()
        super().stop()


class SpotDialogContainer(EmissorStorageContainer, InfraContainer):
    @property
    @singleton
    def dialog_manager(self) -> DialogManager:
        config = self.config_manager.get_config("spot.dialog")
        disambigutator = Disambiguator(ak_characters, ak_robot_scene)

        return DialogManager(disambigutator, config.get("storage"))

    @property
    @singleton
    def dialog_service(self) -> SpotDialogService:
        return SpotDialogService.from_config(self.dialog_manager,self.emissor_data_client,
                                             self.event_bus, self.resource_manager, self.config_manager)

    def start(self):
        logger.info("Start Dialog Service")
        super().start()
        self.dialog_service.start()

    def stop(self):
        logger.info("Stop Dialog Service")
        self.dialog_service.stop()
        super().stop()


class SpotTurnTakingContainer(InfraContainer):
    @property
    @singleton
    def spot_turn_taking_service(self) -> SpotTurnTakingService:
        return SpotTurnTakingService.from_config(self.event_bus, self.resource_manager, self.config_manager)

    def start(self):
        logger.info("Start Turn Taking Service")
        super().start()
        self.spot_turn_taking_service.start()

    def stop(self):
        logger.info("Stop Turn Taking Service")
        self.spot_turn_taking_service.stop()
        super().stop()


class ApplicationContainer(ElizaComponentsContainer, ChatUIContainer, UserChatUIContainer,
                           SpotGameContainer, SpotDialogContainer, SpotTurnTakingContainer,
                           ASRContainer, VADContainer,
                           EmissorStorageContainer, BackendContainer, EnvironmentContainer):
    def __init__(self, participant_id: str, participant_name: str, turn_taking_condition: TurnTakingCondition, disambiguation_level: DisambiguationCondition):
        self._participant_id = participant_id
        self._participant_name = participant_name
        self._turn_taking_condition = turn_taking_condition
        self._disambiguation_level = disambiguation_level

    @property
    def participant_id(self) -> str:
        return self._participant_id

    @property
    def participant_name(self) -> str:
        return self._participant_name

    @property
    def turn_taking_condition(self) -> TurnTakingCondition:
        return self._turn_taking_condition

    @property
    def disambiguation_level(self) -> DisambiguationCondition:
        return self._disambiguation_level

    @property
    @singleton
    def log_writer(self):
        config = self.config_manager.get_config("cltl.event_log")

        return LogWriter(config.get("log_dir"), serializer)

    @property
    @singleton
    def event_log_service(self):
        return EventLogService.from_config(self.log_writer, self.event_bus, self.config_manager)

    def start(self):
        logger.info("Start EventLog")
        super().start()
        self.event_log_service.start()

    def stop(self):
        try:
            logger.info("Stop EventLog")
            self.event_log_service.stop()
        finally:
            super().stop()


def serializer(obj):
    try:
        return emissor_serializer(obj)
    except Exception:
        try:
            return vars(obj)
        except Exception:
            return str(obj)


def main(participant: str, name: str, turntaking: TurnTakingCondition, disamb: DisambiguationCondition):
    ApplicationContainer.load_configuration()
    logger.info("Initialized Application")
    application = ApplicationContainer(participant, name, turntaking, disamb)

    with application as started_app:
        intention_topic = started_app.config_manager.get_config("cltl.bdi").get("topic_intention")
        started_app.event_bus.publish(intention_topic, Event.for_payload(IntentionEvent([Intention("init", None)])))

        routes = {
            '/storage': started_app.storage_service.app,
            '/emissor': started_app.emissor_data_service.app,
            '/chatui': started_app.chatui_service.app,
            '/userchat': started_app.user_chatui_service.app,
            '/spot': started_app.spot_game_service.app,
        }

        if started_app.vad_service and started_app.vad_service.app:
            logger.info("VAD endpoint added at /vad")
            routes['/vad'] = started_app.vad_service.app

        if started_app.server:
            logger.info("Backend Server endpoint added at /host")
            routes['/host'] = started_app.server.app

        web_app = DispatcherMiddleware(Flask("Eliza app"), routes)

        run_simple('0.0.0.0', 8000, web_app, threaded=True, use_reloader=False, use_debugger=False, use_evalex=True)

        intention_topic = started_app.config_manager.get_config("cltl.bdi").get("topic_intention")
        started_app.event_bus.publish(intention_topic, Event.for_payload(IntentionEvent([Intention("terminate", None)])))
        time.sleep(1)


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description='Spotter game')
    parser.add_argument('--participant', type=str, required=True,
                        help="Participant ID")
    parser.add_argument('--name', type=str, required=True,
                        help="Participant name")
    parser.add_argument('--turntaking', type=TurnTakingCondition, choices=list(TurnTakingCondition), required=False,
                        help="Turn taking condition, either 'auto' or 'control'")
    parser.add_argument('--disamb', type=DisambiguationCondition, choices=list(DisambiguationCondition), required=False,
                        help="Disambiguation condition, either 'high' or 'low'")
    args, _ = parser.parse_known_args()

    main(args.participant, args.name, args.turntaking, args.disamb)
