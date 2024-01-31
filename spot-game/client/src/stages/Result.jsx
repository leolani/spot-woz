import React from "react";
import {usePlayer} from "@empirica/core/player/classic/react";
import {Button} from "../components/Button";

export function Result() {
    const player = usePlayer();

    return (
        <div>
            <h2>
                Goed gedaan!
            </h2>
            <br></br>
                <h2>
                    Je score voor deze ronde is:
                </h2>
                <p id="score">
                    {player.round.get("score")}
                </p>
                <h2>
                    Hoe vaak heb je het plaatje laten zien?
                </h2>
                <p id="shown">

                </p>
                <h2>
                    Klik op 'Ga door' om door te gaan naar de volgende ronde van het spel:
                </h2>
                <Button handleClick={() => player.stage.set("submit", true)}>
                    Ga door
                </Button>
        </div>
    );
}