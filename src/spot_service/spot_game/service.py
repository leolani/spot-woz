import logging
import uuid

import flask
from cltl.combot.event.emissor import TextSignalEvent, ScenarioStopped, ImageSignalEvent, AnnotationEvent
from cltl.combot.infra.config import ConfigurationManager
from cltl.combot.infra.event import Event, EventBus
from cltl.combot.infra.resource import ResourceManager
from cltl.combot.infra.topic_worker import TopicWorker
from cltl.combot.infra.time_util import timestamp_now
from cltl.backend.api.camera import Bounds
from emissor.representation.scenario import ImageSignal, Annotation, class_type, Mention, MultiIndex
from flask import Response

logger = logging.getLogger(__name__)


class SpotGameService:
    @classmethod
    def from_config(cls, event_bus: EventBus,
                    resource_manager: ResourceManager, config_manager: ConfigurationManager):
        config = config_manager.get_config("cltl.spot-game.events")
        scenario_topic = config.get("topic_scenario")
        image_topic = config.get("topic_image")

        return cls(scenario_topic, image_topic, event_bus, resource_manager)

    def __init__(self, scenario_topic: str, image_topic: str, event_bus: EventBus, resource_manager: ResourceManager):
        self._scenario_topic = scenario_topic
        self._image_topic = image_topic

        self._scenario_id = None

        self._event_bus = event_bus
        self._resource_manager = resource_manager

        self._app = None
        self._topic_worker = None

    def start(self, timeout=30):
        self._topic_worker = TopicWorker([self._scenario_topic],
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

        @self._app.route('/rest/scenario', methods=['GET'])
        def current_scenario():
            if not self._scenario_id:
                return Response(status=404)

            return self._scenario_id

        @self._app.route('/rest/<scenario_id>/image/<image_id>', methods=['PUT'])
        def put_image(scenario_id: str, image_id: str):
            signal = ImageSignal.for_scenario(scenario_id, timestamp_now(), timestamp_now(), None, (0, 0, 4000, 2500), signal_id=image_id)
            signal_event = ImageSignalEvent.create(signal)
            self._event_bus.publish(self._image_topic, Event.for_payload(signal_event))

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

    def _process(self, event: Event[TextSignalEvent]) -> None:
        if event.metadata.topic == self._scenario_topic:
            self._scenario_id = event.payload.scenario.id

            if event.payload.type == ScenarioStopped.__name__:
                self._scenario_id = None

            logger.info("Updated spot game with scenario %s", self._scenario_id)
