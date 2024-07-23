import React from "react";

export function IFrame({src, height, width, onLoad}) {
    return  (
      <div>
        <iframe src={src} height={height} width={width} onLoad={onLoad} />
      </div>
    );
}
