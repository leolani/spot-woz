import React, {useState} from "react";
import Select from 'react-select'
import {usePlayer} from "@empirica/core/player/classic/react";

export function SpotSelection({id, label, options, placement, onSelection}) {
    const player = usePlayer();
    const [selected, setSelected] = useState(options.find(option => option.value === (player.get(id))));

    const style = {
        top: placement.top + '%',
        left: placement.left + '%',
        position: "absolute"
    };

    const updateSelection = (selection) => {
        player.set(id, selection.value);
        setSelected(selection);
        onSelection && onSelection(id, selection.value);
    };

    return (
        <div style={style} className="positions">
            <span>{selected ? '\u2714' : ""}</span>
            <label htmlFor="drop2">{label}</label>
            <Select options={options} value={selected} onChange={updateSelection} isDisabled={!!selected}/>
        </div>
    );
}
