from emissor.persistence import ScenarioStorage
from emissor.representation.scenario import Modality
from emissor.representation.util import marshal
from spot_service.dialog.api import GameSignal


class SpotterScenarioStorage(ScenarioStorage):
    def _save_signals(self, path, signals, modality: Modality):
        if modality != Modality.VIDEO:
            return super()._save_signals(path, signals, modality)

        with open(path, 'w') as json_file:
            json_file.write(marshal(signals, cls=GameSignal))

