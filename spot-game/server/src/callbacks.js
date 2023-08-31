import {ClassicListenersCollector} from "@empirica/core/admin/classic";
import {handleStages} from "./spot/stages";

export const Empirica = new ClassicListenersCollector();

Empirica.onGameStart(({game}) => {
    const {scenes} = game.get("treatment");
    scenes.forEach((scene, idx, arr) => {
        const round = game.addRound({
            name: `Round` + idx
        });

        round.addStage({name: "spot", scene: scene, duration: 60});
        round.addStage({name: "result", duration: 60});
    });
});

Empirica.onRoundStart(({round}) => {
});

Empirica.onStageStart(({stage}) => {
});

Empirica.onStageEnded(({stage}) => {
    handleStages(stage);
});

Empirica.onRoundEnded(({round}) => {
});

Empirica.onGameEnded(({game}) => {
});