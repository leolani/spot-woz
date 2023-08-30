import { ClassicListenersCollector } from "@empirica/core/admin/classic";
import {handleStages} from "./spot/stages";

export const Empirica = new ClassicListenersCollector();

Empirica.onGameStart(({ game }) => {
  const round = game.addRound({
    name: `Round`,
  });
  round.addStage({ name: "spot", duration: 10000 });
  round.addStage({ name: "choice", duration: 10000 });
  round.addStage({ name: "result", duration: 10000 });
});

Empirica.onRoundStart(({ round }) => {});

Empirica.onStageStart(({ stage }) => {});

Empirica.onStageEnded(({ stage }) => {
  handleStages(stage);
});

Empirica.onRoundEnded(({ round }) => {});

Empirica.onGameEnded(({ game }) => {});