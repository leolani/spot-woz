import React from "react";
import { usePlayer, usePlayers } from "@empirica/core/player/classic/react";
import { Button } from "../components/Button";

export function Result() {
  const player = usePlayer();
  const players = usePlayers();

  return (
    <div>
      <p>You chose: {player.round.get("decision")}</p>
      <br />
      <p>You get {player.round.get("score") || "TBD"} months in jail!</p>

      <Button handleClick={() => player.stage.set("submit", true)}>
        Continue
      </Button>
    </div>
  );
}