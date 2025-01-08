const head_rows = "ABCDEFGHIJ".split("");
const head_cols = "123456789".split("").concat("10");

const logMessages = document.getElementById("log-messages");

const showSuccess = (text) => {
	logMessages.className = "success-message";
	logMessages.innerText = text;
};

const showError = (text) => {
	logMessages.className = "error-message";
	logMessages.innerText = text;
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

const ships = document.querySelectorAll(".source");
const gridPositions = document.querySelectorAll(".board-position");

let isRotated = false;
document.getElementById("clickme").addEventListener("click", () => {
	for (const ship of ships)
		ship.style.transform = isRotated ? "rotate(0deg)" : "rotate(90deg)";
	isRotated = !isRotated;
});

let savedShipId = undefined;
for (const ship of ships) {
	ship.addEventListener("dragstart", (e) => (savedShipId = e.target.id));
	Boats[ship.id].$element = ship;
}

const drop = (e, pos) => {
	e.preventDefault();
	if (!savedShipId) return;

	const [row, col] = pos.id.split(",");
	const shipId = savedShipId;

	if (Boats[shipId].placed) {
		Boats[shipId].$positions.forEach((x) => x.removeAttribute("data-boat"));
		Boats[shipId].$positions = [];
		Boats[shipId].positions = [];
		Boats[shipId].placed = false;
		Boats[shipId].$element.classList.remove("boat-placed");
	}

	const positions = getCosecutivePositions(
		row,
		col,
		Boats[shipId].size,
		isRotated,
	);

	if (positions.some((x) => x.getAttribute("data-boat") !== null))
		return showError(`Boat ${shipId} clashes with another boat`);
	if (positions.length !== Boats[shipId].size)
		return showError(`Boat ${shipId} doesn't fit here`);

	positions.forEach((x, idx) => {
		x.setAttribute("data-boat", `${shipId}-${isRotated ? "v" : "h"}${idx + 1}`);
		x.className += " draggable-boat";
		Boats[shipId].positions.push(x.id);
		Boats[shipId].$positions.push(x);
	});

	positions.forEach((x) => {
		x.addEventListener("mousedown", (e) => {
			savedShipId = shipId;
			document.body.style.cursor = "grabbing";
		});
	});

	Boats[shipId].placed = true;
	Boats[shipId].$element.className += " boat-placed";
	Boats[shipId].vertical = isRotated;

	savedShipId = undefined;
	document.body.style.cursor = "default";

	showSuccess(`Placed ${shipId} in position ${positions[0].id}`);
};

gridPositions.forEach((position) => {
	position.addEventListener("dragover", (e) => e.preventDefault());
	position.addEventListener("drop", (e) => drop(e, position));
	position.addEventListener("mouseup", (e) => drop(e, position));
});

const getCosecutivePositions = (row, col, size, vertical) => {
	const rows = head_rows.slice(
		head_rows.indexOf(row),
		head_rows.indexOf(row) + size,
	);
	const cols = head_cols.slice(
		head_cols.indexOf(col),
		head_cols.indexOf(col) + size,
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

const url_string = window.location.href;
const url = new URL(url_string);

const gameId = url.searchParams.get("gameId");
const playerId = url.searchParams.get("playerId");

document.getElementById("room-id").innerText = gameId;

const websocket = new WebSocket("ws://192.168.4.237:8000");

websocket.addEventListener("open", () => {
	websocket.send(
		JSON.stringify({
			type: "lobbyInstruction",
			instruction: "joinGame",
			gameId: gameId,
			playerId: playerId,
		}),
	);
});

const players = [];

const $currentPlayers = document.getElementById("current-players");
const handleJoinGame = (joiningPlayerId) => {
	const $player = document.createElement("div");
	$player.innerText = joiningPlayerId;

	const player = {
		id: joiningPlayerId,
		element: $player,
	};

	if (joiningPlayerId === playerId) players.unshift(player);
	else players.push(player);

	$currentPlayers.appendChild($player);

	showSuccess(`Player ${joiningPlayerId} has joined the game!`);
};

const handleLeaveGame = (disconnectingPlayerId) => {
	if (disconnectingPlayerId === playerId) return;

	Object.values(players)
		.find((x) => x.id === disconnectingPlayerId)
		?.element.remove();

	players.splice(
		players.findIndex((x) => x.id === disconnectingPlayerId),
		1,
	);
};

websocket.addEventListener("message", (event) => {
	let ev;
	try {
		ev = JSON.parse(event.data);
	} catch (e) {
		console.error(e);
		return;
	}

	console.log(event.data);

	if (ev.type === "instruction")
		if (ev.instruction === "joinGame") handleJoinGame(ev.playerId);
	if (ev.instruction === "playerDisconnect") handleLeaveGame(ev.playerId);
});

document.getElementById("play-button").addEventListener("click", () => {
	if (Object.values(Boats).some((x) => !x.placed))
		return console.error("A boat is yet to be placed");

	for (const shipId of Object.keys(Boats)) {
		const [row, col] = Boats[shipId].positions[0].split(",");
		websocket.send(
			JSON.stringify({
				type: "gameInstruction",
				instruction: "placeBoat",
				playerId: playerId,
				boatName: shipId,
				row: row,
				col: col,
				vertical: Boats[shipId].vertical,
			}),
		);
	}
});
