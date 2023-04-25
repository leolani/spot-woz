import logging

import flask
from cltl.combot.event.emissor import TextSignalEvent, ScenarioStopped
from cltl.combot.infra.config import ConfigurationManager
from cltl.combot.infra.event import Event, EventBus
from cltl.combot.infra.resource import ResourceManager
from cltl.combot.infra.topic_worker import TopicWorker
from flask import Response

logger = logging.getLogger(__name__)


class SpotGameService:
    @classmethod
    def from_config(cls, event_bus: EventBus,
                    resource_manager: ResourceManager, config_manager: ConfigurationManager):
        config = config_manager.get_config("cltl.spot-game.events")
        scenario_topic = config.get("topic_scenario")

        return cls(scenario_topic, event_bus, resource_manager)

    def __init__(self, scenario_topic: str, event_bus: EventBus, resource_manager: ResourceManager):
        self._scenario_topic = scenario_topic

        self._scenario_id = None
        self._agent = None
        self._speaker = None

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

        @self._app.route('/spot/current', methods=['GET'])
        def current_scenario():
            if not self._scenario_id:
                return Response(status=404)

            return self._scenario_id

        @self._app.route('/spot/<scenario_id>', methods=['GET', 'POST'])
        def post_data(scenario_id: str):
            print(scenario_id)

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
