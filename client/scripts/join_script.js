const $playerIdInput = document.getElementById("player-id");
const $gameIdInput = document.getElementById("game-id");

const websocket = new WebSocket("ws://192.168.4.237:8000");

document.getElementById("create-game-button").addEventListener("click", () => {
	createGame();
});

document.getElementById("join-button").addEventListener("click", () => {
	joinGame();
});

websocket.addEventListener("open", () => {
	console.log("Connected to the game servers :)");
});

websocket.addEventListener("message", (event) => {
	let ev;
	try {
		ev = JSON.parse(event.data);
	} catch (e) {
		console.error(e);
		return;
	}

	if (ev.type === "error") console.error(ev.text);
	if (ev.type === "instruction" && ev.instruction === "joinGame")
		window.location.href = `./fleet.html?playerId=${ev.playerId}&gameId=${ev.gameId}`;
});

const createGame = () => {
	const playerId = $playerIdInput.value;
	console.log(`Creating game for player $${playerId}`);
	websocket.send(
		JSON.stringify({
			type: "lobbyInstruction",
			instruction: "createGame",
			playerId: playerId,
		}),
	);
};

const joinGame = () => {
	const playerId = $playerIdInput.value;
	const gameId = $gameIdInput.value;
	websocket.send(
		JSON.stringify({
			type: "lobbyInstruction",
			instruction: "joinGame",
			gameId: gameId,
			playerId: playerId,
		}),
	);
};
