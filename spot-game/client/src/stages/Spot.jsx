
import React from "react";
import {IFrame} from "../components/IFrame";
import {useGame} from "@empirica/core/player/classic/react";

export function Spot() {
    const checkGameEnd = (location) => {
        if (location.toString().search("gameEnd")) {
            player.stage.set("submit", true);
        }
    }

    const game = useGame();
    const port = game.get("containerPort");

    console.log("XXX", port);

    return (
        <div>
            <IFrame id="1" src={"http://localhost:" + port + "/spot/start"} height="500" width="500"/>
            <IFrame id="2" src={"http://localhost:" + port + "/userchat/static/chat.html"} height="500" width="500"/>
        </div>
    );
}