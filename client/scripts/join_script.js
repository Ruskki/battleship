const $playerIdInput = document.getElementById("player-id");
const $gameIdInput = document.getElementById("game-id");

const websocket = new WebSocket("ws://192.168.4.237:8000");

const onlineIndicator = document.getElementById("online-indicator");

document.getElementById("create-game-button").addEventListener("click", () => {
	createGame();
});

document.getElementById("join-button").addEventListener("click", () => {
	joinGame();
});

const feedbackMessages = document.getElementById("feedback-messages");

let feedbackTimeout = undefined;

const showError = (text) => {
	feedbackMessages.className = "error-message";
	feedbackMessages.innerText = text;
	if (feedbackTimeout) {
		clearTimeout(feedbackTimeout);
		feedbackTimeout = undefined;
	}
	feedbackTimeout = setTimeout(() => {
		feedbackMessages.innerText = "";
	}, 3000);
};

websocket.addEventListener("open", () => {
	onlineIndicator.className = "indicator-online";
	onlineIndicator.innerHTML = "•";
});

websocket.addEventListener("close", () => {
	onlineIndicator.className = "indicator-offline";
	onlineIndicator.innerHTML = "• Servers offline";
});

websocket.addEventListener("message", (event) => {
	let ev;
	try {
		ev = JSON.parse(event.data);
	} catch (e) {
		console.error(e);
		return;
	}

	if (ev.type === "error") showError(ev.text);
	if (ev.type === "instruction" && ev.instruction === "joinGame")
		window.location.href = `./fleet.html?playerId=${ev.playerId}&gameId=${ev.gameId}`;
});

const createGame = () => {
	const playerId = $playerIdInput.value;
	if (!websocket.OPEN) return;
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
