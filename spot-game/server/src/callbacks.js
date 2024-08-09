import {ClassicListenersCollector} from "@empirica/core/admin/classic";
import {exec, execSync} from "child_process";
import {debug, error, info, warn} from "@empirica/core";
import axios from "axios";

export const Empirica = new ClassicListenersCollector();

const docker_timeout = 7200 // 2h


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

    debug("Used ports: ", ports);
    const available = [...Array(1000).keys()].map(i => 8000 + i).filter(i => !ports.has(i));

    if (!available) {
        throw new Error(`No free port available for ${gameId}`);
    }

    return available[Math.floor(Math.random() * available.length)];
}


function startContainer(port, participantId) {
    let output = "";
    for (i of Array(10).keys()) {
        try {
            const cmd_args = `--participant ${participantId} --name participant --session 1 --turntaking rohu --conventions yes`
            output = execSync(`timeout -s 9 ${docker_timeout} docker run -d -p ${port}:8000 --name app_${participantId} spot-game ${cmd_args}`);
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

function getScenario(port, startTime) {
    return axios.get(`http://localhost:${port}/spot/rest/scenario`)
        .then(response => {
            if (!response.data) {
                throw new Error(`No scenario yet ${response.status}`);
            }

            return response.data.toString();
        })
        .catch(error => {
            if (Date.now() - startTime > 120000) {
                throw new Error('Timeout exceeded while waiting for Scenario');
            } else {
                debug("Await scenario");
                return new Promise((resolve) => {
                    setTimeout(() => resolve(getScenario(port, startTime)), 1000);
                });
            }
        });
}

Empirica.onGameStart(async ({game}) => {
    const participantId = game.players[0].id;

    const port = getFreePortFromDocker(game.id);

    info(`Starting a new container for participant ${participantId} on port ${port}...`);

    let containerId = startContainer(port, participantId);
    info(`Container with ID: ${containerId} for participant ${participantId} started.`);
    game.set("containerId", containerId);
    game.set("containerPort", port);

    await getScenario(port, Date.now()).then((scenarioId) => info("Started scenario " + scenarioId));

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