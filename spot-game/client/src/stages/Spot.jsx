import React from "react";
import {IFrame} from "../components/IFrame";

export function Spot() {
    const checkGameEnd = (location) => {
        if (location.toString().search("gameEnd")) {
            player.stage.set("submit", true);
        }
    }

    return (
        <div>
            <IFrame src="http://localhost:8000/spot/start" height="500" width="500"/>
            <IFrame src="http://localhost:8000/userchat/static/chat.html" height="500" width="500"
                    onLoad="alert(this.contentWindow.location);"/>
        </div>
    );
}