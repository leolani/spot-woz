import React from "react";
import {SpotSelection} from "./SpotSelection";

export function SpotScene({scene, positions}) {
    const spotSelections = positions.map(position =>
        <SpotSelection key={JSON.stringify(position)} positions={positions.length} placement={position} />);

    return (
        <div className="image_container" style={{position: "relative"}}>
            <img src={scene} className="hide" alt=""/>
            {spotSelections}
        </div>
    );
}