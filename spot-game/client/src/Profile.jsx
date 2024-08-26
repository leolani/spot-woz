import {usePlayer,} from "@empirica/core/player/classic/react";
import React from "react";
import {Timer} from "./components/Timer";

export function Profile() {
  return (
    <div className="min-w-lg md:min-w-2xl mt-2 m-x-auto px-3 py-2 text-gray-500 rounded-md grid grid-cols-3 items-center border-.5">
      <div className="leading-tight ml-1">
        <div className="text-gray-600 font-semibold">
          Spotter
        </div>
      </div>

      <Timer />
    </div>
  );
}
