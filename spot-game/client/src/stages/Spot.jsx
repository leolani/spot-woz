import React from "react";


import {usePlayer, usePlayers} from "@empirica/core/player/classic/react";
import {SpotScene} from "../components/SpotScene";
import {SpotExposure} from "../components/SpotExposure";

export function Spot() {
    const player = usePlayer();
    const players = usePlayers();

    const sceneImage = "images/scenes/Ronde_Strand_Human_Adult.png";
    const positions = [{
        top: 15,
        left: 21
    }, {
        top: 15,
        left: 41
    }];

    return (
        <div>
            <div className='center' id="scene_title">
                <h1>Op het Strand</h1>
            </div>
            <SpotExposure duration={5000}>
                <SpotScene scene={sceneImage} positions={positions} />
            </SpotExposure>
        </div>
    );
}