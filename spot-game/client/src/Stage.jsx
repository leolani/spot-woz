import {
  usePlayer,
  useStage,
} from "@empirica/core/player/classic/react";
import { Loading } from "@empirica/core/player/react";

import React from "react";
import { Spot } from "./stages/Spot";

export function Stage() {
  // TODO need stages?
  const player = usePlayer();
  const stage = useStage();

  if (player.stage.get("submit")) {
    return <Loading />;
  }

  switch (stage.get("name")) {
    case "spotter":
      return <Spot />;
    default:
      return <Loading />;
  }
}