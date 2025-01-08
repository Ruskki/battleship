const headRows = "ABCDEFGHIJ".split("");
const headCols = "123456789".split("").concat("10");

// Log messages

const $logMessagesEl = document.getElementById("log-messages");

const showSuccess = (text) => {
	$logMessagesEl.className = "success-message";
	$logMessagesEl.innerText = text;
};

const showError = (text) => {
	$logMessagesEl.className = "error-message";
	$logMessagesEl.innerText = text;
};

const Boats = {
	aircraft: {
		size: 5,
		positions: [], // ["A,1", "A,2"] ...
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

document.body.addEventListener("dragover", (e) => e.preventDefault());
document.body.addEventListener("drop", (e) => {
	if (draggedElement) destroyDraggedElement();
});
document.body.addEventListener("mouseup", () => {
	if (draggedElement) destroyDraggedElement();
});

const createDraggedElement = (from) => {
	if (draggedElement) return;

	const clone = from.cloneNode(true);
	clone.style.position = "absolute";
	clone.style.pointerEvents = "none";
	document.body.appendChild(clone);

	draggedElement = clone;
};

const moveDraggableElement = (e) => {
	draggedElement.style.left = e.clientX + "px";
	draggedElement.style.top = e.clientY + "px";
};

const destroyDraggedElement = () => {
	draggedElement.remove();
	draggedElement = undefined;
	document.body.style.cursor = "default";
};

const ships = document.querySelectorAll(".source");
let isRotated = false;
let savedShipId = undefined;

const rotateShips = () => {
	for (const ship of ships)
		ship.style.transform = isRotated ? "rotate(0deg)" : "rotate(90deg)";
	isRotated = !isRotated;
};

const handleDragStartShip = (shipId, $ship) => {
	if (isPlayerReady) return;
	savedShipId = shipId;
	createDraggedElement($ship);
};

const addDragListenerToShips = () => {
	for (const ship of ships) {
		ship.addEventListener("dragstart", (e) =>
			handleDragStartShip(e.target.id, ship),
		);
		Boats[ship.id].$element = ship;
	}
};
addDragListenerToShips();

document
	.getElementById("rotate-button")
	.addEventListener("click", () => rotateShips());

const gridPositions = document.querySelectorAll(".board-position");

gridPositions.forEach((position) => {
	position.addEventListener("dragover", (e) => e.preventDefault());
	position.addEventListener("drop", (e) => handleDrop(e, position));
	position.addEventListener("mouseup", (e) => handleDrop(e, position));
});

const handleDrop = (e, pos) => {
	e.preventDefault();
	if (!savedShipId) return;

	const [row, col] = pos.id.split(",");
	const shipId = savedShipId;
	const ship = Boats[shipId];

	if (ship.placed) {
		ship.$positions.forEach((x) => {
			x.removeAttribute("data-boat");
		});
		ship.$positions = [];
		ship.positions = [];
		ship.placed = false;
		ship.$element.classList.remove("boat-placed");
	}

	const positions = getCosecutivePositions(row, col, ship.size, isRotated);

	if (positions.some((x) => x.getAttribute("data-boat") !== null))
		return showError(`Boat ${shipId} clashes with another boat`);
	if (positions.length !== ship.size)
		return showError(`Boat ${shipId} doesn't fit here`);

	positions.forEach((x, idx) => {
		x.setAttribute("data-boat", `${shipId}-${isRotated ? "v" : "h"}${idx + 1}`);
		x.className += " draggable-boat";
		ship.positions.push(x.id);
		ship.$positions.push(x);
	});

	positions.forEach((x) => {
		x.addEventListener("mousedown", (e) =>
			handleDragStartShip(shipId, ship.$element),
		);
	});

	ship.placed = true;
	ship.$element.className += " boat-placed";
	ship.vertical = isRotated;

	savedShipId = undefined;
	document.body.style.cursor = "default";

	showSuccess(`Placed ${shipId} in position ${positions[0].id}`);
};

const getCosecutivePositions = (row, col, size, vertical) => {
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

const url_string = window.location.href;
const url = new URL(url_string);

const gameId = url.searchParams.get("gameId");
let hostId = undefined;
const playerId = url.searchParams.get("playerId");

document.getElementById("room-id").innerText = gameId;

const websocket = new WebSocket("ws://192.168.4.237:8000");

websocket.addEventListener("open", () => {
	const msg = JSON.stringify({
		type: "lobbyInstruction",
		instruction: "joinGame",
		gameId: gameId,
		playerId: playerId,
	});
	websocket.send(msg);
});

websocket.addEventListener("close", () => {
	showError(
		"You've been disconnected from the match! Check your internet connection",
	);
});

const players = [];
const $currentPlayers = document.getElementById("current-players");

const handleJoinGame = (joiningPlayerId, _hostId) => {
	if (!hostId && _hostId) hostId = _hostId; // Asign hostId if it's unasigned and _hostId is valid

	const $playerParentElement = document.createElement("div");
	const $readyElement = document.createElement("span");
	$readyElement.innerText = "❌";
	const $player = document.createElement("span");
	$player.innerText =
		(hostId === joiningPlayerId ? "👑" : "") + joiningPlayerId;

	const player = {
		id: joiningPlayerId,
		ready: false,
		$element: $player,
		$readyElement: $readyElement,
		$playerParentElement: $playerParentElement,
	};

	if (joiningPlayerId === playerId) players.unshift(player);
	else players.push(player);

	$playerParentElement.appendChild($readyElement);
	$playerParentElement.appendChild($player);
	$currentPlayers.appendChild($playerParentElement);

	showSuccess(`Player ${joiningPlayerId} has joined the game!`);
};

const handleLeaveGame = (disconnectingPlayerId) => {
	if (disconnectingPlayerId === playerId) return;

	handlePlayerUnready(disconnectingPlayerId);

	players
		.find((x) => x.id === disconnectingPlayerId)
		?.$playerParentElement.remove();

	players.splice(
		players.findIndex((x) => x.id === disconnectingPlayerId),
		1,
	);

	showError(`Player ${disconnectingPlayerId} has left the game`);
};

const readyButton = document.getElementById("ready-button");

const handlePlayerReady = (readyPlayerId) => {
	if (readyPlayerId === playerId) {
		isPlayerReady = true;
		readyButton.innerText = "Unready";
	}
	const player = players.find((x) => x.id === readyPlayerId);
	player.ready = true;
	player.$readyElement.innerText = "✅";

	if (playerId !== hostId || players.some((player) => !player.ready)) return;
	readyButtonToPlayButton();
};

const handlePlayerUnready = (readyPlayerId) => {
	if (readyPlayerId === playerId) {
		isPlayerReady = false;
		readyButton.innerText = "Ready";
	}
	const player = players.find((x) => x.id === readyPlayerId);
	player.ready = false;
	player.$readyElement.innerText = "❌";

	console.log(players);
	if (readyButton.innerText === "Start Game") readyButtonOriginalState();
};

const handleGameStart = () => {
	window.location.href = "./game.html";
};

websocket.addEventListener("message", (event) => {
	let ev;
	try {
		ev = JSON.parse(event.data);
	} catch (e) {
		console.error(e);
		return;
	}

	if (ev.type === "instruction") {
		if (ev.instruction === "joinGame")
			handleJoinGame(ev.playerId, ev.gameHostId);
		if (ev.instruction === "playerDisconnect") handleLeaveGame(ev.playerId);
		if (ev.instruction === "playerReady") handlePlayerReady(ev.playerId);
		if (ev.instruction === "playerUnready") handlePlayerUnready(ev.playerId);
		if (ev.instruction === "startGame") handleGameStart(ev.playerId);
	}
});

const startGameListener = () => {
	const startMsg = JSON.stringify({
		type: "lobbyInstruction",
		instruction: "startGame",
		playerId: playerId,
		gameId: gameId,
	});
	websocket.send(startMsg);
};

const readyUpListener = () => {
	if (isPlayerReady) {
		const msg = JSON.stringify({
			type: "lobbyInstruction",
			instruction: "playerUnready",
			playerId: playerId,
		});
		websocket.send(msg);
		return;
	}

	if (Object.values(Boats).some((x) => !x.placed))
		return showError("All the boats need to be placed!");

	for (const shipId of Object.keys(Boats)) {
		const [row, col] = Boats[shipId].positions[0].split(",");
		const msg = JSON.stringify({
			type: "gameInstruction",
			instruction: "placeBoat",
			playerId: playerId,
			boatName: shipId,
			row: row,
			col: col,
			vertical: Boats[shipId].vertical,
		});
		websocket.send(msg);
	}

	const readyMsg = JSON.stringify({
		type: "lobbyInstruction",
		instruction: "playerReady",
		playerId: playerId,
	});
	websocket.send(readyMsg);
};

const readyButtonOriginalState = () => {
	readyButton.className = "ready-button";
	readyButton.innerText = "Unready";

	readyButton.addEventListener("click", readyUpListener);
	readyButton.removeEventListener("click", startGameListener);
};

const readyButtonToPlayButton = () => {
	readyButton.className = "play-button";
	readyButton.innerText = "Start Game";

	readyButton.removeEventListener("click", readyUpListener);
	readyButton.addEventListener("click", startGameListener);
};

readyButton.addEventListener("click", readyUpListener);
