const $playerIdInput = document.getElementById("player-id");
const $gameIdInput = document.getElementById("room-code");

const websocket = new WebSocket("ws://192.168.4.237:8000");

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
	if (ev.type === "instruction")
		window.location.href = `./fleet.html?playerId=${ev.playerId}`;
});

const createGame = () => {
	const playerId = $playerIdInput.value;
	console.log(`Creating game for player $${playerId}`);
	websocket.send(
		JSON.stringify({
			type: "message",
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
			type: "message",
			instruction: "joinGame",
			gameId: gameId,
			playerId: playerId,
		}),
	);
};
