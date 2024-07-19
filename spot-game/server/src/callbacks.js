import {ClassicListenersCollector} from "@empirica/core/admin/classic";
// import {exec} from "child_process";

export const Empirica = new ClassicListenersCollector();


function getFreePort(gameId) {
    return 3000;
}

function getFreePortFromDocker(gameId) {
    exec("docker ps --format \"{{.Ports}}\"", (error, stdout, stderr) => {
        if (error) {
            console.error(`Error fetching Docker port information: ${error}`);
            return;
        }
        if (stderr) {
            console.error(`Docker Error: ${stderr}`);
            return;
        }
        // Process stdout to parse the port information
        const ports = stdout.split('\n')
            .filter(line => line)  // Remove empty lines
            .map(portInfo => {
                // Assuming portInfo format "0.0.0.0:32768->80/tcp"
                const match = portInfo.match(/:(\d+)->/);
                return match ? parseInt(match[1], 10) : null;
            })
            .filter(port => port != null);  // Remove nulls if no match was found

        console.log("Used ports:", ports);
    });

    return 3000;
}


Empirica.onGameStart(({game}) => {
    const participantId = game.players[0].id;

    const port = getFreePort(game.id);

    console.log(`Starting a new container for participant ${participantId} on port ${port}...`);

    exec(`docker run -d -p ${port}:3000 --name app_${participantId} myappimage`, (error, stdout, stderr) => {
        if (error) {
            console.error(`Error launching Docker container for participant ${participantId}: ${error}`);
            return;
        }

        const containerId = stdout.trim();  // Docker returns the new container ID in stdout
        game.set("containerId", containerId);
        console.log(`Container with ID: ${containerId} for participant ${participantId} started.`);
    });

    const {scenes} = game.get("treatment");
    scenes.forEach((scene, idx, arr) => {
        const round = game.addRound({
            name: scene.id
        });

        round.addStage({name: "spot", scene: scene, duration: 60});
        round.addStage({name: "result", duration: 60});
    });
});

Empirica.onRoundStart(({round}) => {
});

Empirica.onStageStart(({stage}) => {
});

Empirica.onStageEnded(({stage}) => {
});

Empirica.onRoundEnded(({round}) => {
});

Empirica.onGameEnded(({game}) => {
    const containerId = game.get("containerId");
    if (containerId) {
        const { exec } = require("child_process");
        exec(`docker stop ${containerId} && docker rm ${containerId}`, (error, stdout, stderr) => {
            if (error) {
                console.error(`Error stopping and removing container for player ${player.id}: ${error}`);
                return;
            }
            console.log(`Container ${containerId} for player ${game.id} stopped and removed successfully.`);
        });
    }
});