const headRows = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J'];
const headCols = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10'];

const $logMessagesEl = document.getElementById('log-messages');

/**
 * @param {string} text
 * @returns {void}
 */
function showSuccess(text) {
	$logMessagesEl.className = 'success-message';
	$logMessagesEl.innerText = text;
};

/**
 * @param {string} text
 * @returns {void}
 */
function showError(text) {
	$logMessagesEl.className = 'error-message';
	$logMessagesEl.innerText = text;
};

const Boats = {
	aircraft: {
		size: 5,
		positions: [], // ['A,1', 'A,2'] ...
		$positions: [], // The actual HTML elements
		placed: false,
		vertical: undefined,
		$element: undefined,
	},
	battleship: {
		size: 4,
		positions: [],
		$positions: [],
		placed: false,
		vertical: undefined,
		$element: undefined,
	},
	submarine: {
		size: 3,
		positions: [],
		$positions: [],
		placed: false,
		vertical: undefined,
		$element: undefined,
	},
	cruise: {
		size: 3,
		positions: [],
		$positions: [],
		placed: false,
		vertical: undefined,
		$element: undefined,
	},
	destroyer: {
		size: 2,
		positions: [],
		$positions: [],
		placed: false,
		vertical: undefined,
		$element: undefined,
	},
};

let isPlayerReady = false;

let draggedElement = undefined;

document.onmousemove = (e) => {
	if (draggedElement) moveDraggableElement(e);
};

document.body.addEventListener('dragover', (e) => e.preventDefault());
document.body.addEventListener('drop', (e) => {
	if (draggedElement) destroyDraggedElement();
});
document.body.addEventListener('mouseup', () => {
	if (draggedElement) destroyDraggedElement();
});

 /**
  * @param {HTMLElement} from
  * @returns {void}
  */
function createDraggedElement (from)  {
	if (draggedElement) return;

	const clone = from.cloneNode(true);
	clone.style.position = 'absolute';
	clone.style.pointerEvents = 'none';
	document.body.appendChild(clone);

	draggedElement = clone;
};

 /**
  * @param {MouseEvent} e
  * @returns {void}
  */
 function moveDraggableElement  (e)  {
	draggedElement.style.left = e.clientX + 'px';
	draggedElement.style.top = e.clientY + 'px';
};

/** @returns {void} */
function destroyDraggedElement ()  {
	draggedElement.remove();
	draggedElement = undefined;
	document.body.style.cursor = 'default';
};

const ships = document.querySelectorAll('.source');
let isRotated = false;
let savedShipId = undefined;

/** @returns {void} */
function rotateShips ()  {
	for (const ship of ships)
		ship.style.transform = isRotated ? 'rotate(0deg)' : 'rotate(90deg)';
	isRotated = !isRotated;
};

/**
 * @param {string} shipId
 * @param {HTMLElement} $ship
 * @returns {void}
 */
function handleDragStartShip (shipId, $ship)  {
	if (isPlayerReady) return;
	savedShipId = shipId;
	createDraggedElement($ship);
};

/** @returns {void} */
function addDragListenerToShips ()  {
	for (const ship of ships) {
		ship.addEventListener('dragstart', (e) =>
			handleDragStartShip(e.target.id, ship),
		);
		Boats[ship.id].$element = ship;
	}
};
addDragListenerToShips();

document
	.getElementById('rotate-button')
	.addEventListener('click', () => rotateShips());

const gridPositions = document.querySelectorAll('.board-position');

gridPositions.forEach((position) => {
	position.addEventListener('dragover', (e) => e.preventDefault());
	position.addEventListener('drop', (e) => handleDrop(e, position));
	position.addEventListener('mouseup', (e) => handleDrop(e, position));
});

/**
 * @type {object} _
 * @type {HTMLElement} pos
 * @returns {void}
 */
function handleDrop(_, pos) {
	if (!savedShipId) return;

	const [row, col] = pos.id.split(',');
	const shipId = savedShipId;
	const ship = Boats[shipId];

	if (ship.placed) {
		ship.$positions.forEach((x) => {
			x.removeAttribute('data-boat');
		});
		ship.$positions = [];
		ship.positions = [];
		ship.placed = false;
		ship.$element.classList.remove('boat-placed');
	}

	const positions = getCosecutivePositions(row, col, ship.size, isRotated);

	if (positions.some((x) => x.getAttribute('data-boat') !== null))
		return showError(`Boat ${shipId} clashes with another boat`);
	if (positions.length !== ship.size)
		return showError(`Boat ${shipId} doesn't fit here`);

	positions.forEach((x, idx) => {
		x.setAttribute('data-boat', `${shipId}-${isRotated ? 'v' : 'h'}${idx + 1}`);
		x.className += ' draggable-boat';
		ship.positions.push(x.id);
		ship.$positions.push(x);
	});

	positions.forEach((x) => {
		x.addEventListener('mousedown', (e) =>
			handleDragStartShip(shipId, ship.$element),
		);
	});

	ship.placed = true;
	ship.$element.className += ' boat-placed';
	ship.vertical = isRotated;

	savedShipId = undefined;
	document.body.style.cursor = 'default';

	showSuccess(`Placed ${shipId} in position ${positions[0].id}`);
};

/**
 * @param {string} row
 * @param {string} col
 * @param {number} size
 * @param {boolean} vertical
 * @returns {void}
 */
function getCosecutivePositions (row, col, size, vertical)  {
	const rows = headRows.slice(
		headRows.indexOf(row),
		headRows.indexOf(row) + size,
	);
	const cols = headCols.slice(
		headCols.indexOf(col),
		headCols.indexOf(col) + size,
	);

	const res = [];
	for (let i = 0; i < size; i++)
		res.push(
			document.getElementById(
				`${vertical ? rows[i] : rows[0]},${vertical ? cols[0] : cols[i]}`,
			),
		);
	return res.filter((x) => x);
};

///////////////////////////////////////////////////////
////////////////////// Websocket //////////////////////
///////////////////////////////////////////////////////

const urlString = window.location.href;
const url = new URL(urlString);

const gameId = url.searchParams.get('gameId');
const playerId = url.searchParams.get('playerId');

document.getElementById('room-id').innerText = gameId;

/**
 * @param {WebSocket} ws
 * @returns {void}
 */
function websocketOnOpen (ws)  {
	const joinMsg = JSON.stringify({
		type: 'instruction',
		instruction: 'joinGame',
		gameId,
		playerId,
	});
	ws.send(joinMsg);

	const boatMsg = JSON.stringify({
		type: 'instruction',
		instruction: 'getBoats',
		playerId,
	});
	ws.send(boatMsg);

};

/**
 * @param {Event} event
 * @returns {void}
 */
function websocketOnMessage(event) {
	let ev;
	try {
		ev = JSON.parse(event.data);
	} catch (e) {
		console.error(e);
		return;
	}

	if (ev.type === 'error') showError(ev.text);

	if (ev.type === 'instruction') {
		if (ev.instruction === 'joinGame') handleJoinGame(ev.playerId);
		if (ev.instruction === 'playerDisconnect') handleLeaveGame(ev.playerId);

		if (ev.instruction === 'playerReady') handlePlayerReady(ev.playerId);
		if (ev.instruction === 'playerUnready') handlePlayerUnready(ev.playerId);

		if (ev.instruction === 'gameReady') readyButtonToPlayButton();
		if (ev.instruction === 'gameUnready') readyButtonOriginalState();

		if (ev.instruction === 'getHost') handleGetHost(ev.hostId);

		if (ev.instruction === 'startGame') handleGameStart();
		if (ev.instruction === 'placeBoat') handlePlaceBoat(ev.boatName.name, ev.row, ev.col, ev.vertical);
	}
};

/** @returns {void} */
function websocketOnClose () {
	showError('You\'ve been disconnected from the match! Check your internet connection');
}

const websocket = new WebSocket('ws://127.0.0.1:8000');
websocket.addEventListener('open', _ => websocketOnOpen(websocket));
websocket.addEventListener('message', websocketOnMessage);
websocket.addEventListener('close', websocketOnClose);

const players = [];

/**
 * @param {string} id
 * @returns {void}
 */
function isPlayerHere (id) {
	players.some((p) => p.id === id);
}

const $currentPlayers = document.getElementById('current-players');


/**
 * @param {string} joiningPlayerId
 * @returns {void}
 */
function handleJoinGame(joiningPlayerId) {
	if (isPlayerHere(joiningPlayerId)) return;

	const player = {
		id: joiningPlayerId,
		$element: document.createElement('span'),
		$readyElement: document.createElement('span'),
		$playerParentElement: document.createElement('div'),
	};

	player.$readyElement.innerText = '❌';
	player.$element.innerText = joiningPlayerId;
	player.$playerParentElement.appendChild(player.$readyElement);
	player.$playerParentElement.appendChild(player.$element);
	$currentPlayers.appendChild(player.$playerParentElement);

	players.push(player);

	showSuccess(`Player ${joiningPlayerId} has joined the game!`);

	if (playerId === joiningPlayerId) {
		const getBoatsMsg = JSON.stringify({
			type: 'instruction',
			instruction: 'getBoats',
			playerId: joiningPlayerId,
		});
		websocket.send(getBoatsMsg);
	}

	const readyMsg = JSON.stringify({
		type: 'instruction',
		instruction: 'getReadyStatus',
		playerId: joiningPlayerId,
	});
	websocket.send(readyMsg);

	const hostMsg = JSON.stringify({
		type: 'instruction',
		instruction: 'getHost',
		gameId,
	});
	websocket.send(hostMsg);
};

/**
 * @param {string} hostId
 * @returns {void}
 */
function handleGetHost(hostId) {
	console.log(hostId);
	for (const player of players)
		if (player.id !== hostId) player.$element.innerText = player.id;
		else player.$element.innerText = '👑 ' + player.id;
};

/**
 * @param {string} disconnectingPlayerId
 * @returns {void}
 */
function handleLeaveGame(disconnectingPlayerId) {
	const player = players.find((x) => x.id === disconnectingPlayerId);
	player.$playerParentElement.remove();
	players.splice(players.indexOf(player), 1);
	showError(`Player ${disconnectingPlayerId} has left the game`);

	const hostMsg = JSON.stringify({
		type: 'instruction',
		instruction: 'getHost',
		gameId,
	});
	websocket.send(hostMsg);
};

const $readyButton = document.getElementById('ready-button');

/**
 * @param {string} readyPlayerId
 * @returns {void}
 */
function handlePlayerReady(readyPlayerId) {
	if (readyPlayerId === playerId && !isPlayerReady) {
		isPlayerReady = true;
		$readyButton.innerText = 'Unready';
	}

	players.find((x) => x.id === readyPlayerId).$readyElement.innerText = '✅';
};

/**
 * @returns {void}
 */
function handleGameReady() {
	readyButtonToPlayButton();
};

/**
 * @param {string} readyPlayerId
 * @returns {void}
 */
function handlePlayerUnready(readyPlayerId) {
	if (readyPlayerId === playerId) {
		isPlayerReady = false;
		$readyButton.innerText = 'Ready';
	}
	players.find((x) => x.id === readyPlayerId).$readyElement.innerText = '❌';
};

/**
 * @returns {void}
 */
function handleGameUnready() {
	readyButtonOriginalState();
};

/**
 * @returns {void}
 */
function handleGameStart() {
	window.location.href = `./game.html?playerId=${playerId}&gameId=${gameId}`;
}

/**
 * @type {string} boatName
 * @type {string} row
 * @type {string} col
 * @type {boolean} vertical
 * @returns {void}
 */
function handlePlaceBoat(boatName, row, col, vertical) {
	savedShipId = boatName;
	isRotated = vertical;
	handleDrop(undefined, document.getElementById(`${row},${col}`));
};

/** @returns {void} */
function startGameListener ()  {
	const startMsg = JSON.stringify({
		type: 'lobbyInstruction',
		instruction: 'startGame',
		playerId,
		gameId,
	});
	websocket.send(startMsg);
};

/** @returns {void} */
function readyUpListener () {
	if (isPlayerReady) {
		const msg = JSON.stringify({
			type: 'lobbyInstruction',
			instruction: 'playerUnready',
			playerId,
		});
		websocket.send(msg);
		return;
	}

	if (Object.values(Boats).some((x) => !x.placed))
		return showError('All the boats need to be placed!');

	for (const shipId of Object.keys(Boats)) {
		const [row, col] = Boats[shipId].positions[0].split(',');
		const msg = JSON.stringify({
			type: 'lobbyInstruction',
			instruction: 'placeBoat',
			playerId,
			boatName: shipId,
			row,
			col,
			vertical: Boats[shipId].vertical,
		});
		websocket.send(msg);
	}

	const readyMsg = JSON.stringify({
		type: 'lobbyInstruction',
		instruction: 'playerReady',
		playerId,
	});
	websocket.send(readyMsg);
};

/** @returns {void} */
function readyButtonOriginalState  ()  {
	$readyButton.className = 'ready-button';
	$readyButton.innerText = isPlayerReady ? 'Unready' : 'Ready';

	$readyButton.addEventListener('click', readyUpListener);
	$readyButton.removeEventListener('click', startGameListener);
};

/** @returns {void} */
function readyButtonToPlayButton ()  {
	console.log($readyButton);
	$readyButton.className = 'play-button';
	$readyButton.innerText = 'Start Game';

	$readyButton.removeEventListener('click', readyUpListener);
	$readyButton.addEventListener('click', startGameListener);
};

$readyButton.addEventListener('click', readyUpListener);
