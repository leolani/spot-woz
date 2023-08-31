import React from "react";
import {SpotSelection} from "./SpotSelection";

export function SpotScene({scene}) {
    const sceneId = scene.id;
    const sceneImage = "images/scenes/" + scene.path;
    const positions = scene.positions;

    const formatId = (id1, id2) => id1 + '_' + id2;

    const spotSelections = positions.map(position => {
        const positionId = formatId(sceneId, position.id)
        const positionOptions = positions.filter(e => e !== position)
            .map(e => ({value: formatId(sceneId, e.id), label: e.id}));

        return <SpotSelection id={positionId} key={positionId} label={position.id}
                              options={positionOptions} placement={position}/>;
    });

    return (
        <div className="image_container" style={{position: "relative"}}>
            <img src={sceneImage} className="hide" alt=""/>
            {spotSelections}
        </div>
    );
}