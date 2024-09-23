import {ClassicListenersCollector} from "@empirica/core/admin/classic";
import {exec, execSync} from "child_process";
import {debug, error, info, warn} from "@empirica/core";
import axios from "axios";
import fs from "fs";
import path from "path";

export const Empirica = new ClassicListenersCollector();

const GAME_TIMEOUT = 7200 // 2h


const httpClient = axios.create({ proxy: false });


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

function startContainer(image, basePath, port, storage, participantId, history) {
    const storagePath = path.resolve(path.join(storage, participantId));
    fs.mkdirSync(storagePath, { recursive: true });

    info("Created storage", storagePath);

    let output = "";
    for (i of Array(10).keys()) {
        try {
            let cmdArgs = `--participant ${participantId} --name participant --session 1 --turntaking none --conventions yes`;
            cmdArgs += ` --history ${history} --web`;
            cmdArgs += basePath ? ` --basepath "${basePath}/${port}"` : '';

            const storage_mount = `--mount type=bind,source=${storagePath},target=/spot-woz/spot-woz/py-app/storage`;
            output = execSync(`docker run -d -p ${port}:8000 ${storage_mount} --name app_${participantId} ${image} ${cmdArgs}`);
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

function getScenario(baseUrl, basePath, port, startTime) {
    const scenarioUrl = new URL('chatui/chat/current', getPath(baseUrl, basePath, port));

    return httpClient.get(scenarioUrl)
        .then(response => {
            if (!response.data) {
                throw new Error(`No scenario yet ${response.status}`);
            }

            return response.data.id;
        })
        .catch(error => {
            if (Date.now() - startTime > 120000) {
                throw new Error(`Timeout exceeded while waiting for Scenario on ${scenarioUrl}: ` + error);
            } else {
                debug("Await scenario", port);
                return new Promise((resolve) => {
                    setTimeout(() => resolve(getScenario(baseUrl, basePath, port, startTime)), 1000);
                });
            }
        });
}

function startGame(baseUrl, basePath, port, scenarioId) {
    return httpClient.post(new URL(`chatui/chat/${scenarioId}/start`, getPath(baseUrl, basePath, port)));
}

/**
 * Construct an URL of either baseURL:port/basePath or baseURL/basePath/port where basePath maybe empty.
 */
function getPath(baseUrl, basePath, port) {
    let pathUrl;
    if (baseUrl.endsWith(':')) {
        pathUrl = basePath ? new URL(basePath, baseUrl + port.toString()) : new URL(baseUrl + port.toString());
    } else {
        pathUrl = basePath ? new URL(path.join(basePath, port.toString()), baseUrl) : new URL(port.toString(), baseUrl);
    }

    return pathUrl.toString().endsWith('/') ? pathUrl.toString() : pathUrl.toString() + "/";
}

Empirica.onGameStart(async ({game}) => {
    let { image, storage, history, baseUrl, basePath, minPort, maxPort } = game.get("treatment");
    baseUrl = baseUrl || 'http://localhost:';
    basePath = basePath || '';
    minPort = minPort || 8000;
    maxPort = maxPort || 8100;

    info(`Starting game for ${game.players[0].id} with history ${history}, port range ${minPort}-${maxPort} on base url ${baseUrl} (${basePath})`);

    const participantId = game.players[0].id;
    const port = getFreePortFromDocker(game.id, minPort, maxPort);

    info(`Starting a new container for participant ${participantId} on port ${port}...`);

    let containerId = startContainer(image, basePath, port, storage, participantId, history);
    info(`Container (${image}) with ID: ${containerId} for participant ${participantId} started`);
    game.set("containerId", containerId);
    game.set("containerPort", port);

    await getScenario(baseUrl, basePath, port, Date.now())
        .then((scenarioId) => {
            info("Started scenario " + scenarioId);
            return new Promise((resolve) => {
                setTimeout(() => resolve(startGame(baseUrl, basePath, port, scenarioId)), 5000);
            });
        })
        .then(() => info("Started Game"));

    const round = game.addRound({
        name: "Round Spotter",
        task: "spotter",
    });

    const gameLocation = new URL('spot/start', getPath(baseUrl, basePath, port));
    const chatLocation = new URL('userchat/static/chat.html', getPath(baseUrl, basePath, port));

    round.addStage({
        name: "spotter",
        duration: GAME_TIMEOUT,
        gameLocation: gameLocation,
        chatLocation: chatLocation
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

function stopContainer(containerId, gameId, playerId) {
    const {exec} = require("child_process");
    exec(`docker container inspect ${containerId} || true && docker stop -t 60 ${containerId} && docker rm ${containerId}`, (error_, stdout, stderr) => {
        if (error_) {
            error(`Error stopping and removing container for player ${playerId}: ${error_}`);
            return;
        }
        info(`Container ${containerId} for player ${gameId} stopped and removed successfully.`);
    });
}

Empirica.onGameEnded(async ({game}) => {
    const containerId = game.get("containerId");
    if (containerId) {
        setTimeout(() => stopContainer(containerId, game.get("containerId"), game.players[0].id), 20000);
    }
});