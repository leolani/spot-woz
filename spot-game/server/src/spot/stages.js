import fetch from "node-fetch";


function formatId(id1, id2) {
    return id1 + "_" + id2;
}


function handleSpotStage(stage) {
    const players = stage.currentGame.players;

    for (const player of players) {
        console.log("computing score for player ", player.id);
        const scene = stage.get("scene");

        console.log("scene", scene.positions
            .map(pos => player.get(formatId(scene.id, pos.id)) + " " + formatId(scene.id, pos.expected)));

        let score = scene.positions
            .map(pos => player.get(formatId(scene.id, pos.id)) == formatId(scene.id, pos.expected))
            .reduce((a, b) => a + b, 0);

        console.log("score", score);

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


export function handleStages(stage) {
    switch (stage.get("name")) {
        case "spot":
            handleSpotStage(stage);
            break;
        default:
            console.log("End of stage ", stage.get("name"));
    }
}

