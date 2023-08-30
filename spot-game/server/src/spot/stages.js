import {Stage} from "@empirica/core";
import fetch from "node-fetch";

export function handleStages(stage) {
    if (stage.get("name") !== "choice") return;
    console.log("End of choice stage");

    const players = stage.currentGame.players;

    for (const player of players) {
        console.log("computing score for player ", player.id);
        const partner = players.filter((p) => p.id !== player.id)[0];
        const playerChoice = player.round.get("decision");
        const partnerChoice = partner.round.get("decision");

        let score;
        if (playerChoice === "testify" && partnerChoice === "testify") {
            score = 6;
        } else if (playerChoice === "testify" && partnerChoice === "silent") {
            score = 1;
        } else if (playerChoice === "silent" && partnerChoice === "testify") {
            score = 12;
        } else {
            score = 2;
        }
        player.round.set("score", score);

        fetch('https://httpbin.org/post', {
            method: 'POST',
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                firstParam: 'yourValue',
                secondParam: 'yourOtherValue',
            })
        }).then(console.log);
    }
}

