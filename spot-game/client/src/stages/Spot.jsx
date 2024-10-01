import React from "react";
import {IFrame} from "../components/IFrame";
import {useGame, usePlayer} from "@empirica/core/player/classic/react";
import {debug, info} from "@empirica/core/console";

export function Spot() {
    const player = usePlayer();
    const game = useGame();

    const getRoundNumber = (location) => {
        const regex1 = RegExp('.*round_(\\d+).html.*', 'g');
        const result = regex1.exec(location);

        return (result && result.length > 1) ? result[1] : "-";
    }

    const checkGameLoc = (location) => {
        document.getElementById('SpotterGameFrame').contentWindow.postMessage('requestHref', '*');
    };

    window.addEventListener("message", (mess) => {
        const location = mess.data;

        debug("Set gameLocation", location);
        game.stage.set("gameLocation", location);

        // let step = ((location.split('/').slice(-1)[0]).split('.html')[0]).split('_').slice(-1)[0];
        let step = getRoundNumber(location);
        game.stage.set("step", step)

        if (location.includes("finish.html")) {
            info("Submit Game End", location);
            setTimeout(() => player.stage.set("submit", true), 3000);
        }
    });

    return (
        <div id="Spotter">
            <IFrame id="SpotterGameFrame" src={game.stage.get("gameLocation")} height="500" width="500"
                    onLoad={checkGameLoc}/>
            <IFrame id="SpotterChatFrame" src={game.stage.get("chatLocation")} height="500" width="500"/>
        </div>
    );
}