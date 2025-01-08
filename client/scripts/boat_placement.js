const head_rows = "ABCDEFGHIJ".split("");
const head_cols = "123456789".split("").concat("10");
const Boats = {
	aircraft: {
		size: 5,
		positions: [], // ["A,1", "A,2"] ...
		placed: false,
		vertical: undefined,
	},
	battleship: {
		size: 4,
		positions: [],
		placed: false,
		vertical: undefined,
	},
	submarine: {
		size: 3,
		positions: [],
		placed: false,
		vertical: undefined,
	},
	cruise: {
		size: 3,
		positions: [],
		placed: false,
		vertical: undefined,
	},
	destroyer: {
		size: 2,
		positions: [],
		placed: false,
		vertical: undefined,
	},
};

const ships = document.querySelectorAll(".source");
const gridPositions = document.querySelectorAll(".board-position");

let isRotated = false;
document.getElementById("clickme").addEventListener("click", () => {
	for (const ship of ships)
		ship.style.transform = isRotated ? "rotate(0deg)" : "rotate(-90deg)";
	isRotated = !isRotated;
});

ships.forEach((ship) =>
	ship.addEventListener("dragstart", (e) =>
		e.dataTransfer.setData("text/plain", e.target.id),
	),
);

const drop = (e) => {
	e.preventDefault();

	const [row, col] = Object.values(
		document.getElementById("board").getElementsByClassName("board-position"),
	)
		.find((x) => x.matches(":hover"))
		.id.split(",");
	const shipId = e.dataTransfer.getData("text/plain");

	if (Boats[shipId].placed) return console.error(`Already placed ${shipId}`);

	const positions = getCosecutivePositions(
		row,
		col,
		Boats[shipId].size,
		isRotated,
	);

	if (positions.some((x) => x.getAttribute("data-boat") !== null))
		return console.error(`Boat ${shipId} clashes with another boat`);
	if (positions.length !== Boats[shipId].size)
		return console.error(`Boat ${shipId} doesn't fit here`);

	positions.forEach((x, idx) => {
		x.setAttribute("data-boat", `${shipId}-${isRotated ? "v" : "h"}${idx + 1}`);
		Boats[shipId].positions.push(x.id);
	});

	Boats[shipId].placed = true;
	Boats[shipId].vertical = isRotated;
};

gridPositions.forEach((position) => {
	position.addEventListener("dragover", (e) => e.preventDefault());
	position.addEventListener("drop", drop);
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

document.getElementById(gameId).innerText = gameId;

const websocket = new WebSocket("ws://192.168.4.237:8000");

websocket.addEventListener("open", () => {
	console.log("Connected to the server!");

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
		console.error("A boat is yet to be placed");

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
