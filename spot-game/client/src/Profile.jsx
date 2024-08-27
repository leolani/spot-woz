import {useStage,} from "@empirica/core/player/classic/react";
import React from "react";
import {Timer} from "./components/Timer";

export function Profile() {
  const stage = useStage();

  return (
    <div className="min-w-lg md:min-w-2xl mt-2 m-x-auto px-3 py-2 text-gray-500 rounded-md grid grid-cols-3 items-center border-.5">
        <div className="flex space-x-3 items-center justify-end">
            <div className="flex flex-col items-center">
                <div className="text-xs font-semibold uppercase tracking-wide leading-none text-gray-400">
                    {stage ? stage.get("step") : ""}/15
                </div>
            </div>
        </div>

      <Timer />
    </div>
  );
}
