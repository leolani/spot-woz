import {ClassicListenersCollector} from "@empirica/core/admin/classic";
import {exec, execSync} from "child_process";
import {debug, error, info, warn} from "@empirica/core";
import axios from "axios";
import fs from "fs";
import path from "path";

export const Empirica = new ClassicListenersCollector();

const GAME_TIMEOUT = 7200 // 2h


function getFreePortFromDocker(gameId, min_port, max_port) {
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
    const available = [...Array(max_port - min_port).keys()].map(i => min_port + i).filter(i => !ports.has(i));

    if (!available) {
        throw new Error(`No free port available for ${gameId}`);
    }

    return available[Math.floor(Math.random() * available.length)];
}

function startContainer(image, port, storage, participantId, history, base_path) {
    const storagePath = path.resolve(path.join(storage, participantId));
    fs.mkdirSync(storagePath, { recursive: true });

    info("Created storage", storagePath);

    let output = "";
    for (i of Array(10).keys()) {
        try {
            let cmd_args = `--participant ${participantId} --name participant --session 1 --turntaking none --conventions yes`;
            cmd_args += ` --history ${history} --web --basepath "${base_path}/${port}"`;

            const storage_mount = `--mount type=bind,source=${storagePath},target=/spot-woz/spot-woz/py-app/storage`;
            output = execSync(`docker run -d -p ${port}:8000 ${storage_mount} --name app_${participantId} ${image} ${cmd_args}`);
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

function getScenario(base_url, port, startTime) {
    return axios.get(`${base_url}${port}/chatui/chat/current`)
        .then(response => {
            if (!response.data) {
                throw new Error(`No scenario yet ${response.status}`);
            }

            return response.data.id;
        })
        .catch(error => {
            if (Date.now() - startTime > 120000) {
                throw new Error(`Timeout exceeded while waiting for Scenario on ${base_url}${port}/chatui/chat/current`);
            } else {
                debug("Await scenario", port);
                return new Promise((resolve) => {
                    setTimeout(() => resolve(getScenario(base_url, port, startTime)), 1000);
                });
            }
        });
}

function startGame(base_url, port, scenarioId) {
    return axios.post(`${base_url}${port}/chatui/chat/${scenarioId}/start`);
}

Empirica.onGameStart(async ({game}) => {
    let { image, storage, history, base_url, base_path, min_port, max_port } = game.get("treatment");
    base_url = base_url || 'http://localhost:';
    base_path = base_path || '';
    min_port = min_port || 8000;
    max_port = max_port || 8100;

    info(`Starting game for ${game.players[0].id} with history ${history}, port range ${min_port}-${max_port} on base url ${base_url} (${base_path})`);

    const participantId = game.players[0].id;
    const port = getFreePortFromDocker(game.id, min_port, max_port);

    info(`Starting a new container for participant ${participantId} on port ${port}...`);

    let containerId = startContainer(image, port, storage, participantId, history, base_path);
    info(`Container (${image}) with ID: ${containerId} for participant ${participantId} started`);
    game.set("containerId", containerId);
    game.set("containerPort", port);

    await getScenario(base_url, port, Date.now())
        .then((scenarioId) => {
            info("Started scenario " + scenarioId);
            return new Promise((resolve) => {
                setTimeout(() => resolve(startGame(base_url, port, scenarioId)), 5000);
            });
        })
        .then(() => info("Started Game"));

    const round = game.addRound({
        name: "Round Spotter",
        task: "spotter",
    });

    round.addStage({
        name: "spotter",
        duration: GAME_TIMEOUT,
        gameLocation: `${base_url}${port}/spot/start`,
        chatLocation: `${base_url}${port}/userchat/static/chat.html`
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