import React from "react";
import {IFrame} from "../components/IFrame";
import {useGame, usePlayer} from "@empirica/core/player/classic/react";
import {debug, info} from "@empirica/core/console";

export function Spot() {
    const player = usePlayer();
    const game = useGame();

    const checkGameLoc = (location) => {
        document.getElementById('SpotGameFrame').contentWindow.postMessage('requestHref', '*');
    };

    window.addEventListener("message", (mess) => {
        const location = mess.data;

        debug("Set gameLocation", location);
        game.stage.set("gameLocation", location);

        if (location.includes("gameEnd")) {
            info("Submit Game End", location);
            player.stage.set("submit", true);
        }
    });

    info("XXXX 1", game.stage.get("gameLocation"), game.stage.get("gameLocation"));

    return (
        <div>
            <IFrame id="SpotGameFrame" src={game.stage.get("gameLocation")} height="500" width="500"
                    onLoad={checkGameLoc}/>
            <IFrame id="SpotChatFrame" src={game.stage.get("chatLocation")} height="500" width="500"/>
        </div>
    );
}