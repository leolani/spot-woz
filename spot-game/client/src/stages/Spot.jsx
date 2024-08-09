import React from "react";
import {IFrame} from "../components/IFrame";
import {useGame, usePlayer} from "@empirica/core/player/classic/react";
import {debug, info} from "@empirica/core/console";

export function Spot() {
    const player = usePlayer();

    const game = useGame();
    const port = game.get("containerPort");

    const checkGameLoc = (location) => {
        document.getElementById('SpotGameFrame').contentWindow.postMessage('requestHref', '*');
    };

    window.addEventListener("message", (mess) => {
        const location = mess.data;

        debug("Set gameLocation", location);
        player.stage.set("gameLocation", location);

        if (location.includes("gameEnd")) {
            info("Submit Game End", location);
            player.stage.set("submit", true);
        }
    });

    return (
        <div>
            <IFrame id="SpotGameFrame" src={player.stage.get("gameLocation")} height="500" width="500"
                    onLoad={checkGameLoc}/>
            <IFrame id="SpotChatFrame" src={"http://localhost:" + port + "/userchat/static/chat.html"} height="500" width="500"/>
        </div>
    );
}