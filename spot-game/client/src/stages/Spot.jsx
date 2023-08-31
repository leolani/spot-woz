import React from "react";


import {usePlayer} from "@empirica/core/player/classic/react";
import {SpotScene} from "../components/SpotScene";
import {SpotExposure} from "../components/SpotExposure";
import {Button} from "../components/Button";

export function Spot({scene}) {
    const player = usePlayer();

    console.log("Display scene ", scene.id);

    return (
        <div>
            <div className='center' id="scene_title">
                <h1>Op het Strand</h1>
            </div>
            <SpotExposure duration={5000}>
                <SpotScene scene={scene} />
            </SpotExposure>
            <Button className="m-5" handleClick={() => player.stage.set("submit", true)}>Klcik</Button>
        </div>
    );
}