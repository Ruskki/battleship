const websocket = new WebSocket('ws://127.0.0.1:8000');

let feedbackTimeout;

const $feedbackMessages = document.getElementById('feedback-messages');

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
 * @param {object} ev
 * @param {script} ev.playerId
 * @param {script} ev.tourneyId
 * @returns {void}
 */
function handleJoinGame ({ playerId, tourneyId })  {
	window.location.href = `./tourney_lobby.html?playerId=${playerId}&tourneyId=${tourneyId}`;
};

const onlineIndicator = document.getElementById('online-indicator');

websocket.addEventListener('open', () => {
	onlineIndicator.className = 'indicator-online';
	onlineIndicator.innerHTML = '•';
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
	if (ev.type === 'instruction')
		if (ev.instruction === 'joinTourney')
			return handleJoinGame(ev);
});

websocket.addEventListener('close', () => {
	onlineIndicator.className = 'indicator-offline';
	onlineIndicator.innerHTML = '• Servers offline';
});

const createUsernameEl = document.getElementById('createUsername');
const createTourneyBtnEl = document.getElementById('createTourneyBtn');

createTourneyBtnEl.addEventListener('click', () => {
	const playerId = createUsernameEl.value;

	if (!websocket.OPEN) return;

	const msg = JSON.stringify({
		type: 'instruction',
		instruction: 'createTourney',
		playerId,
	});
	websocket.send(msg);
});

const joinUsernameEl = document.getElementById('createUsername');
const joinTourneyNameEl = document.getElementById('joinTourneyName');
const joinTourneyBtnEl = document.getElementById('joinTourneyBtn');

joinTourneyBtnEl.addEventListener('click', () => {
	const playerId = joinUsernameEl.value;
	const tourneyId = joinTourneyNameEl.value;

	if (!websocket.OPEN) return;

	const msg = JSON.stringify({
		type: 'instruction',
		instruction: 'joinTourney',
		playerId,
		tourneyId,
	});
	websocket.send(msg);
});
