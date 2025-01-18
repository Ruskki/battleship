const websocket = new WebSocket('ws://127.0.0.1:8000');

/**
 * @param {object} ev
 * @param {script} ev.playerId
 * @param {script} ev.tourneyId
 * @returns {void}
 */
function handleJoinGame ({ playerId, tourneyId })  {
	window.location.href = `./tourney_lobby.html?playerId=${playerId}&tourneyId=${tourneyId}`;
};

websocket.addEventListener('open', () => {
	// TODO: Change this to show in the html that we're connected
	console.log('Hello, Websocket!');
});

websocket.addEventListener('message', (event) => {
	let ev;
	try {
		ev = JSON.parse(event.data);
	} catch (e) {
		console.error(`Unable to parse JSON\n${e}`);
	}

	if (ev.type === 'error')
		return console.error(ev.text);
	if (ev.type === 'instruction')
		if (ev.instruction === 'joinTourney')
			return handleJoinGame(ev);
});

websocket.addEventListener('close', () => {
	// TODO: Change this to show in the html that we're disconnected
	console.log('Goodbye, Websocket!');
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

const joinUsernameEl = document.getElementById('joinUsername');
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
