import React from "react";

export function IFrame({src, height, width}) {
    return  (
      <div>
        <iframe src={src} height={height} width={width}/>
      </div>
    );
}
