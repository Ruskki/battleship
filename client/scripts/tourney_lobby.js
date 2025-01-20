const url = new URL(window.location.href);
const playerId = url.searchParams.get('playerId');

const tourneyId = url.searchParams.get('tourneyId');
const tourneyIdEl = document.getElementById('tourneyId');
tourneyIdEl.innerText = tourneyId;

const websocket = new WebSocket('ws://127.0.0.1:8000');

let feedbackTimeout;

const $feedbackMessages = document.getElementById('feedback-messages');

const onlineIndicator = document.getElementById('online-indicator');


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

const tourneyStartBtn = document.getElementById('tourneyStartBtn');
tourneyStartBtn.addEventListener('click', () => {
	const msg = JSON.stringify({
		type: 'instruction',
		instruction: 'startTourney',
		playerId,
		tourneyId,
	});

	websocket.send(msg);
});

const playerListEl = document.getElementById('playerList');

const players = {};

/**
 * @param {object} ev
 * @param {string} ev.playerId
 * @returns {void}
 */
function handleJoinTourney({ playerId }) {
	if (playerId in players) return;

	const li = document.createElement('li');
	li.innerText = playerId;
	playerListEl.appendChild(li);

	players[playerId] = {
		$element: li
	};
};

/**
 * @param {object} ev
 * @param {string} ev.playerId
 * @returns {void}
 */
function handleLeaveTourney({ playerId }) {
	if (!playerId in players) return;

	players[playerId].$element.remove();
	delete players[playerId];
};

/**
 * @param {object} ev
 * @param {string} ev.playerId
 * @param {string} ev.gameId
 * @returns {void}
 */
function handleJoinGame({ playerId, gameId }) {
	window.location.href = `./fleet.html?playerId=${playerId}&gameId=${gameId}`;
}

websocket.addEventListener('open', () => {
	onlineIndicator.className = 'indicator-online';
	onlineIndicator.innerHTML = '•';

	const msg = JSON.stringify({
		type: 'instruction',
		instruction: 'joinTourney',
		playerId,
		tourneyId,
	});
	websocket.send(msg);
});

websocket.addEventListener('message', (event) => {
	let ev;
	try {
		ev = JSON.parse(event.data);
	} catch (e) {
		console.error(`Unable to parse JSON\n${e}`);
	}

	if (ev.type === 'error')
		return showError(ev.text);
	if (ev.type === 'instruction') {
		if (ev.instruction === 'joinTourney') return handleJoinTourney(ev);
		if (ev.instruction === 'joinGame') return handleJoinGame(ev);
		if (ev.instruction === 'playerDisconnect') return handleLeaveTourney(ev);
	}
});

websocket.addEventListener('close', () => {
	onlineIndicator.className = 'indicator-offline';
	onlineIndicator.innerHTML = '• Servers offline';
});
