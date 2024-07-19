import {
  usePlayer,
  useStage,
} from "@empirica/core/player/classic/react";
import { Loading } from "@empirica/core/player/react";
import React from "react";
import { Spot } from "./stages/Spot";

export function Stage() {
  const player = usePlayer();
  const stage = useStage();

  if (player.stage.get("submit")) {
    return <Loading />;
  }

  switch (stage.get("name")) {
    case "spot":
      return <Spot />;
    default:
      return <Loading />;
  }
}