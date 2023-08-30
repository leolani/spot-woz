import React from "react";
import Select from 'react-select'

export function SpotSelection({positions, placement}) {
    const options = [...Array(positions).keys()].map(i => ({value: 'option' + i, label: i}));
    const style = {
        top: placement.top + '%',
        left: placement.left + '%',
        position: "absolute"
    };

    return (
        <div style={style} className="positions">
            <span id="check2" style={{display: "none"}}>&#10004</span>
            <label htmlFor="drop2">2</label>
            <Select options={options}/>
        </div>
    );
}
