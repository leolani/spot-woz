import React from "react";
import {SpotScene} from "../components/SpotScene";
import {SpotExposure} from "../components/SpotExposure";

export function Spot({scene}) {
    return (
        <div>
            <div className='center' id="scene_title">
                <h1>{scene.title}</h1>
            </div>
            <SpotExposure duration={5000}>
                <SpotScene scene={scene} />
            </SpotExposure>
        </div>
    );
}