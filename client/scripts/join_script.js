const $playerIdInput = document.getElementById("player-id");
const $gameIdInput = document.getElementById("game-id");

const websocket = new WebSocket("ws://100.93.129.57:8000");

const onlineIndicator = document.getElementById("online-indicator");

const creteGameButton = () => {
	if (!websocket.OPEN) return;
	const msg = JSON.stringify({
		type: "lobbyInstruction",
		instruction: "createGame",
		playerId: $playerIdInput.value,
	});
	websocket.send(msg);
};

document
	.getElementById("create-game-button")
	.addEventListener("click", creteGameButton);

const joinGameButton = () => {
	if (!websocket.OPEN) return;
	const msg = JSON.stringify({
		type: "lobbyInstruction",
		instruction: "joinGame",
		gameId: $gameIdInput.value,
		playerId: $playerIdInput.value,
	});
	websocket.send(msg);
};

document
	.getElementById("join-button")
	.addEventListener("click", joinGameButton);

const feedbackMessages = document.getElementById("feedback-messages");
let feedbackTimeout = undefined;

const clearFeedbackTimeout = () => {
	clearTimeout(feedbackTimeout);
	feedbackTimeout = undefined;
};

const showError = (text) => {
	feedbackMessages.className = "error-message";
	feedbackMessages.innerText = text;
	if (feedbackTimeout) clearFeedbackTimeout(feedbackTimeout);
	feedbackTimeout = setTimeout(() => (feedbackMessages.innerText = ""), 3000);
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
	if (ev.type === "lobbyInstruction" && ev.instruction === "joinGame")
		window.location.href = `./fleet.html?playerId=${$playerIdInput.value}&gameId=${ev.gameId}`;
});
