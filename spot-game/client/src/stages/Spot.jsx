import React from "react";
import {IFrame} from "../components/IFrame";
import {useGame, usePlayer} from "@empirica/core/player/classic/react";
import {info} from "@empirica/core/console";

export function Spot() {
    const player = usePlayer();

    const checkGameEnd = (location) => {
        info("Current game location", location.target.src)
        if (location.target.src.toString().includes("gameEnd")) {
            info("Submit Game End", location.target.src)
            player.stage.set("submit", true);
        }
    };

    const game = useGame();
    const port = game.get("containerPort");

    return (
        <div>
            <IFrame id="1" src={"http://localhost:" + port + "/spot/start"} height="500" width="500"
                    onLoad={checkGameEnd}/>
            <IFrame id="2" src={"http://localhost:" + port + "/userchat/static/chat.html"} height="500" width="500"/>
        </div>
    );
}