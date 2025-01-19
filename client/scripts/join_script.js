document
	.getElementById('create-game-button')
	.addEventListener('click', createGameButton);

document
	.getElementById('join-button')
	.addEventListener('click', joinGameButton);

const $playerIdInput = document.getElementById('player-id');

const $gameIdInput = document.getElementById('game-id');

let feedbackTimeout;

const $feedbackMessages = document.getElementById('feedback-messages');

const websocket = new WebSocket('ws://127.0.0.1:8000');

const onlineIndicator = document.getElementById('online-indicator');

/** @returns {void} */
function getPlayerId() { return $playerIdInput.value.trim(); }

/** @returns {boolean} */
function canConnect() { return websocket.OPEN && getPlayerId(); }

/**
 * @param {string} text
 * @returns {void}
 */
function showError(text) {
	$feedbackMessages.className = 'error-message';
	$feedbackMessages.innerText = text;
	if (feedbackTimeout) clearFeedbackTimeout(feedbackTimeout);
	feedbackTimeout = setTimeout(() => ($feedbackMessages.innerText = ''), 3000);
};

/**
 * @param {WebSocket} ws
 * @param {string} instruction
 * @param {any} data
 * @returns {void}
 */
function sendInstruction(ws, instruction, data) {
	if (!ws) return;
	const msg = JSON.stringify({
		type: 'instruction',
		instruction,
		...data,
	});
	ws.send(msg);
}

/** @returns {void} */
function createGameButton() {
	if (!canConnect())
		return showError('You must enter a name first');
	sendInstruction(websocket, 'createGame');
};

/** @returns {void} */
function joinGameButton() {
	if (!canConnect())
		return showError('You must enter a name first');
	sendInstruction(websocket, 'joinGame', {
		gameId: $gameIdInput.value,
		playerId: getPlayerId()
	});
};

/** @returns {void} */
function clearFeedbackTimeout() {
	clearTimeout(feedbackTimeout);
	feedbackTimeout = undefined;
};


websocket.addEventListener('open', () => {
	onlineIndicator.className = 'indicator-online';
	onlineIndicator.innerHTML = '•';
});

websocket.addEventListener('close', () => {
	onlineIndicator.className = 'indicator-offline';
	onlineIndicator.innerHTML = '• Servers offline';
});

websocket.addEventListener('message', (event) => {
	let ev;
	try { ev = JSON.parse(event.data); }
	catch (e) { console.error(e); return; }

	if (ev.type === 'error') showError(ev.text);
	if (ev.instruction === 'createGame')
		return window.location.href = `./fleet.html?playerId=${getPlayerId()}&gameId=${ev.gameId}`;
	if (ev.instruction === 'joinGame')
		return window.location.href = `./fleet.html?playerId=${getPlayerId()}&gameId=${ev.gameId}`;
});
