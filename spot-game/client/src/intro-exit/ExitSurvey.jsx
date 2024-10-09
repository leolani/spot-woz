import React from "react";
import {Button} from "../components/Button";
import {useGame} from "@empirica/core/player/classic/react";
import {info} from "@empirica/core/console";

export function ExitSurvey({next}) {
    const game = useGame();
    const tokenLink = game.get("treatment") && game.get("treatment")["tokenLink"];

    info("Retrieved token link:", tokenLink);

    const claim = (e) => {
        e.preventDefault();
        window.location.href = tokenLink;
    };

    const showClaim = game.get("token");

    return (
        <div className="exit">
            <p className="intropara">Thank you for playing this game!</p>
            { showClaim && (<p> You will now be led back to Prolific to receive your payment.</p>) }
            { showClaim && (<Button handleClick={claim} autoFocus ><p>Claim your payment</p></Button>) }
        </div>
    );
}
