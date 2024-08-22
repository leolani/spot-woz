import React from "react";

export function IFrame({id, src, height, width, onLoad}) {
    return  (
        <iframe id={id} src={src} height={height} width={width} onLoad={onLoad} />
    );
}
