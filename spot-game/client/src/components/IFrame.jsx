import React from "react";

export function IFrame({id, src, height, width, onLoad}) {
    return  (
      <div>
        <iframe id={id} src={src} height={height} width={width} onLoad={onLoad} />
      </div>
    );
}
