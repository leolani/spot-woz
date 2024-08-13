import {ClassicListenersCollector} from "@empirica/core/admin/classic";
import {exec, execSync} from "child_process";
import {debug, error, info, warn} from "@empirica/core";
import axios from "axios";
import fs from "fs";
import path from "path";

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

function startContainer(image, port, storage, participantId, conventions) {
    const storagePath = path.resolve(path.join(storage, participantId));
    fs.mkdirSync(storagePath, { recursive: true });

    info("Created storage", storagePath);

    let output = "";
    for (i of Array(10).keys()) {
        try {
            const cmd_args = `--participant ${participantId} --name participant --session 1 --turntaking none --conventions ${conventions}`;
            const storage_mount = `--mount type=bind,source=${storagePath},target=/spot-woz/spot-woz/py-app/storage`;
            output = execSync(`timeout -s 9 ${docker_timeout} docker run -d -p ${port}:8000 ${storage_mount} --name app_${participantId} spot-game ${cmd_args}`);
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
    return axios.get(`http://localhost:${port}/chatui/chat/current`)
        .then(response => {
            if (!response.data) {
                throw new Error(`No scenario yet ${response.status}`);
            }

            return response.data.id;
        })
        .catch(error => {
            if (Date.now() - startTime > 120000) {
                throw new Error('Timeout exceeded while waiting for Scenario');
            } else {
                debug("Await scenario", port);
                return new Promise((resolve) => {
                    setTimeout(() => resolve(getScenario(port, startTime)), 1000);
                });
            }
        });
}

function startGame(port, scenarioId) {
    return axios.post(`http://localhost:${port}/chatui/chat/${scenarioId}/start`);
}

Empirica.onGameStart(async ({game}) => {
    const participantId = game.players[0].id;

    const port = getFreePortFromDocker(game.id);

    info(`Starting a new container for participant ${participantId} on port ${port}...`);

    let { image, storage, conventions } = game.get("treatment");
    let containerId = startContainer(image, port, storage, participantId, conventions);
    info(`Container (${image}) with ID: ${containerId} for participant ${participantId} started`);
    game.set("containerId", containerId);
    game.set("containerPort", port);

    await getScenario(port, Date.now())
        .then((scenarioId) => {
            info("Started scenario " + scenarioId);
            return new Promise((resolve) => {
                setTimeout(() => resolve(startGame(port, scenarioId)), 5000);
            });
        })
        .then(() => info("Started Game"));

    const round = game.addRound({
        name: "Round Spotter",
        task: "spotter",
    });
    round.addStage({
        name: "spotter",
        duration: 600,
        gameLocation: `http://localhost:${port}/spot/start`,
        chatLocation: `http://localhost:${port}/userchat/static/chat.html`
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
        exec(`docker stop ${containerId} && docker rm ${containerId}`, (error_, stdout, stderr) => {
            if (error_) {
                error(`Error stopping and removing container for player ${player.id}: ${error_}`);
                return;
            }
            info(`Container ${containerId} for player ${game.id} stopped and removed successfully.`);
        });
    }
});