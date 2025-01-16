const url = new URL(window.location.href);

const tourneyId = url.searchParams.get('tourneyId');
const tourneyIdEl = document.getElementById('tourneyId');
tourneyIdEl.innerText = tourneyId;

const playerId = url.searchParams.get('playerId');

const websocket = new WebSocket('ws://127.0.0.1:8000');

const playerListEl = document.getElementById('playerList');

const players = {};

const handleJoinTourney = ({ playerId }) => {
	if (playerId in players) return;

	const li = document.createElement('li');
	li.innerText = playerId;
	playerListEl.appendChild(li);

	players[playerId] = {
		$element: li
	};
};

const handleLeaveTourney = ({ playerId }) => {
	if (!playerId in players) return;

	players[playerId].$element.remove();
	delete players[playerId];
};

websocket.addEventListener('open', () => {
	// TODO: Change this to show in the html that we're connected
	console.log('Hello, Websocket!');

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
		return console.error(ev.text);
	if (ev.type === 'instruction') {
		if (ev.instruction === 'joinTourney') return handleJoinTourney(ev);
		if (ev.instruction === 'playerDisconnect') return handleLeaveTourney(ev);
	}
});

websocket.addEventListener('close', () => {
	// TODO: Change this to show in the html that we're disconnected
	console.log('Goodbye, Websocket!');
});
