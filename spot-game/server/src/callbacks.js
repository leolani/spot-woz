import {ClassicListenersCollector} from "@empirica/core/admin/classic";
import {exec, execSync} from "child_process";
import { info, warn, error } from "@empirica/core/console";

export const Empirica = new ClassicListenersCollector();


function getFreePortFromDocker(gameId) {
    // Process stdout to parse the port information
    const docker_out = execSync("docker ps --format \"{{.Ports}}\"");
    const ports =  new Set(docker_out.toString().split('\n')
        .filter(line => line)  // Remove empty lines
        .map(portInfo => {
            // Assuming portInfo format "0.0.0.0:32768->80/tcp"
            const match = portInfo.match(/:(\d+)->/);
            return match ? parseInt(match[1], 10) : null;
        })
        .filter(port => port != null));  // Remove nulls if no match was found

    info("Used ports: ", ports);
    const available = [...Array(100).keys()].map(i => 8000 + i).filter(i => !ports.has(i));

    if (!available) {
        throw new Error(`No free port available for ${gameId}`);
    }

    return available[Math.floor(Math.random() * available.length)];
}


function startContainer(port, participantId) {
    let output = "";
    for (i of Array(10).keys()) {
        try {
            // output = execSync(`timeout -s 9 7200 docker run -d -p ${port}:8000 --name app_${participantId} spot-game`);
            // output = execSync(`timeout -s 9 7200 docker run -d -p ${port}:8000 spot-game`);
            output = execSync(`timeout -s 9 7200 docker run -d -p 8000:8000 spot-game`);
            break;
        } catch (error_) {
            warn(`Error launching Docker container for participant ${participantId} on port ${port}: ${error_}, retrying (${i})`);
        }
    }

    if (!output.toString()) {
        throw new Error("Could not start a docker container");
    }

    return output.toString().trim();  // Docker returns the new container ID in stdout
}

Empirica.onGameStart(({game}) => {
    const participantId = game.players[0].id;

    const port = 2;
    // const port = getFreePortFromDocker(game.id);

    info(`Starting a new container for participant ${participantId} on port ${port}...`);

    // let containerId = startContainer(port, participantId);
    let containerId = "123"
    info(`Container with ID: ${containerId} for participant ${participantId} started.`);
    game.set("containerId", containerId);

    const round = game.addRound({
        name: "Round Spotter",
        task: "spotter",
    });
    round.addStage({name: "spotter", duration: 60});
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
        exec(`docker stop ${containerId} && docker rm ${containerId}`, (error_, stdout, stderr) => {
            if (error_) {
                error(`Error stopping and removing container for player ${player.id}: ${error_}`);
                return;
            }
            info(`Container ${containerId} for player ${game.id} stopped and removed successfully.`);
        });
    }
});