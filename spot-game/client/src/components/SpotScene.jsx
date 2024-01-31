 import React from "react";
import {SpotSelection} from "./SpotSelection";
import {usePlayer} from "@empirica/core/player/classic/react";


function formatId(id1, id2) {
    return  id1 + '_' + id2;
}


export function SpotScene({scene}) {
    const player = usePlayer();

    const sceneId = scene.id;
    const sceneImage = "images/scenes/" + scene.path;
    const positions = scene.positions;

    const checkSelections = (id, value) => {
        if (positions.every((pos) => player.get(formatId(sceneId, pos.id)))) {
            player.stage.set("submit", true);
        }
    }

    const spotSelections = positions.map(position => {
        const positionId = formatId(sceneId, position.id)
        const positionOptions = positions.map(e => ({value: formatId(sceneId, e.id), label: e.id}));

        return <SpotSelection id={positionId} key={positionId} label={position.id}
                              options={positionOptions} placement={position}
                              onSelection={checkSelections}/>;
    });

    return (
        <div className="image_container" style={{position: "relative"}}>
            <img src={sceneImage} className="hide" alt=""/>
            {spotSelections}
        </div>
    );
}