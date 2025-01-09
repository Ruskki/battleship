const Boats = {
	destroyer: {
		name: "destroyer",
		size: 2,
	},
	submarine: {
		name: "submarine",
		size: 3,
	},
	cruise: {
		name: "cruise",
		size: 3,
	},
	battleship: {
		name: "battleship",
		size: 4,
	},
	aircraft: {
		name: "aircraft",
		size: 5,
	},
};

const gameList = {};

class Game {
	static websocketsInGames = new Set();

	static playerIdsInGames = new Set();

	static getGameFromPlayerId = (pId) =>
		Object.values(gameList).find((game) =>
			game.players.some((player) => player?.id === pId),
		);

	static getGameFromWebsocket = (ws) =>
		Object.values(gameList).find((game) =>
			game.players.some((player) => player.websocket === ws),
		);

	players = [];

	getPlayers = () => this.players.filter((x) => x);

	getIndexFromId = (id) => this.players.findIndex((x) => x.id === id);

	getPlayerCount = () => Object.values(this.players).filter((x) => x).length;
	turnNumber = 0;
	id = "";

	started = false;

	self_destroy_timer = undefined;

	getFreeSlot = () => this.players.length;

	getPlayerFromId = (id) =>
		Object.values(this.players).find((x) => x?.id === id);

	isPlayerHost = (id) => this.players.indexOf(this.getPlayerFromId(id)) === 0;

	canPlayerJoin = (id) => {
		const player = this.getPlayerFromId(id);
		if (player === undefined) return this.players.length < 4;
		return player.websocket === undefined;
	};

	addNewPlayer = (ws, id) => {
		const player = this.getPlayerFromId(id);
		if (player !== undefined) return this.reconnectPlayer(ws, player);

		const idx = this.getFreeSlot();
		if (idx >= 4) return;

		if (this.self_destroy_timer !== undefined) {
			console.log(`${id} rejoined game ${this.id}, stopping self destruction`);
			clearTimeout(this.self_destroy_timer);
			this.self_destroy_timer = undefined;
		}

		this.players[idx] = new Player(id, idx, ws);
		Game.websocketsInGames.add(ws);
		Game.playerIdsInGames.add(id);

		return this.players[idx];
	};

	reconnectPlayer = (newWebsocket, player) => {
		player.websocket = newWebsocket;
		Game.websocketsInGames.add(newWebsocket);

		if (this.self_destroy_timer !== undefined) {
			console.log(
				`${player.id} rejoined game ${this.id}, stopping self destruction`,
			);
			clearTimeout(this.self_destroy_timer);
			this.self_destroy_timer = undefined;
		}

		return player;
	};

	disconnectPlayer = (id) => {
		const idx = this.getIndexFromId(id);
		if (idx === -1) return;

		Game.websocketsInGames.delete(this.players[idx].websocket);
		this.players[idx].websocket = undefined;

		if (idx === 0) {
			this.players.push(this.players.shift());
			for (const player of this.players.slice(0, this.players.length - 2)) {
				if (player.websocket === undefined) continue;
				sendPlayerJoin(player.websocket, player.id);
			}
		}

		if (!this.players.some((x) => x.websocket)) {
			console.log(`INFO: Everyone dc'd from ${this.id}, self deleting...`);
			this.self_destroy_timer = setTimeout(() => {
				console.log(`Time's up! deleting ${this.id}`);
				this.deleteGame();
			}, 30000);
		}
	};

	removePlayer = (id, forced = false) => {
		const idx = this.getIndexFromId(id);
		if (idx === -1) return;

		Game.websocketsInGames.delete(this.players[idx].websocket);
		Game.playerIdsInGames.delete(id);

		if (!this.started || forced) this.players.splice(idx, 1);
		if (idx === 0) {
			this.players.push(this.players.shift());
			for (const player of this.players.slice(0, this.players.length - 2)) {
				if (player.websocket === undefined) continue;
				sendPlayerJoin(player.websocket, player.id);
			}
		}

		if (!this.started && this.getPlayerCount() === 0) {
			console.log("This game is empty, time to self destroy");
			this.self_destroy_timer = setTimeout(() => {
				console.log(`Time's up! deleting ${this.id}`);
				this.deleteGame();
			}, 5000);
		}
	};

	removeInactive = () => {
		const idx = this.players.findIndex((x) => x.websocket === undefined);
		if (idx === -1) return false;

		console.log("THIS PLAYER IS INACTIVE " + idx + " REMOVING THEM");
		this.removePlayer(this.players[idx].id);
		return true;
	};

	deleteGame = () => {
		this.players.forEach((i, idx) => {
			Game.websocketsInGames.delete(this.players[idx].websocket);
			Game.playerIdsInGames.delete(this.players[idx].id);
			delete this.players[idx];
		});

		delete gameList[this.id];
	};

	startGame = () => {
		this.started = true;
	};

	attackPlayer = (slotFrom, slotTo, row, col) => {
		const user = this.players[slotFrom];
		const target = this.players[slotTo];

		const pos = target.board.getPosition(row, col);

		if (pos.hasMine) {
			pickRandom(user.board.getAdyacentsPositions(row, col)).destroy();
			target.points += 5;
			return;
		}

		if (pos.hasShield) {
			sendSuccess(user.websocket, "Your attack was blocked");
			sendSuccess(target.websocket, "You blocked an attack");
			return;
		}

		pos.destroy();
		if (pos.boat === undefined) return console.log("Miss!");

		user.points += 5;
	};
}

class BoardPosition {
	placeBoat = (boatName, slot, vertical) => {
		this.boat = boatName;
		this.vertical = vertical;
		this.slot = slot;
	};

	removeBoat = (boatName, slot, vertical) => {
		this.boat = undefined;
		this.vertical = undefined;
		this.slot = undefined;
	};

	destroy = () => {
		this.destroyed = true;
		sendDestroyPosition(
			this.owner.websocket,
			this.owner.playerSlot,
			this.row,
			this.col,
		);
	};

	heal = () => {
		this.destroyed = false;
		this.boat.wasHealed = true;
		sendHealPosition(
			this.owner.websocket,
			this.owner.playerSlot,
			this.row,
			this.col,
		);
	};

	reveal = () => {
		this.revealed = true;
		sendRevealPosition(this.owner.websocket, this.owner.id, this.row, this.col);
	};

	placeShield = () => {
		this.hasShield = true;
		sendPlaceShield(this.owner.websocket, this.row, this.col);
	};

	plantMine = () => {
		if (this.boat !== undefined)
			return sendError(this.owner.websocket, "Cannot place mine where boat is");

		this.hasMine = true;
		sendPlaceMine(this.owner.websocket, this.row, this.col);
	};

	constructor(row, col, owner) {
		this.row = row; // Row A - J
		this.col = col; // Col 1 - 10
		this.owner = owner; // Player object
		this.revealed = false; // If is public
		this.hasShield = false; // If has shield
		this.hasMine = false; // If has mine
		this.destroyed = false; // If position was attacked

		this.boat = undefined; // Boat object
		this.vertical = undefined; // If boat is vertical
		this.boatSlot = undefined; // 0 - 5 depending on boat
	}
}

class Board {
	static rows = "ABCDEFGHIJ";
	static cols = "123456789".split("").concat(["10"]);

	positions = {}; // 'A,1' - 'J,10'

	getPosition = (row, col) => this.positions[`${row},${col}`];

	getSliceHorizontal = (row, col, size) =>
		Board.cols
			.slice(Board.cols.indexOf(col), Board.cols.indexOf(col) + size)
			.map((x) => this.getPosition(row, x));

	getSliceVertical = (row, col, size) =>
		Board.rows
			.slice(Board.rows.indexOf(row), Board.rows.indexOf(row) + size)
			.split("")
			.map((x) => this.getPosition(x, col));

	getArea = (row, col) => {
		const minRow = Math.max(0, Board.rows.indexOf(row) - 1);
		const maxRow = Math.min(Board.rows.length, Board.rows.indexOf(row) + 2);
		const minCol = Math.max(0, Board.cols.indexOf(col) - 1);
		const maxCol = Math.min(Board.cols.length, Board.cols.indexOf(col) + 2);

		return Board.rows
			.slice(minRow, maxRow)
			.split("")
			.map((r) =>
				Board.cols.slice(minCol, maxCol).map((c) => this.getPosition(r, c)),
			)
			.flat(); // Transforms from 3 arrays of 3 to 1 array of 9
	};

	getAdyacentPositions = (row, col) => {
		const minRow = Math.max(0, Board.rows.indexOf(row) - 1);
		const maxRow = Math.min(Board.cols.length, Board.rows.indexOf(row) + 2);
		const minCol = Math.max(0, Board.cols.indexOf(col) - 1);
		const maxCol = Math.min(Board.cols.length, Board.cols.indexOf(col) + 2);

		return Board.rows
			.slice(minRow, maxRow)
			.split("")
			.map((r) =>
				Board.cols.slice(minCol, maxCol).map((c) => {
					if (r === row && c === col) return;
					return this.getPosition(r, c);
				}),
			)
			.flat() // Transforms from 3 arrays of 3 to 1 array of 9
			.filter((x) => x); // This last step filters the undefined out
	};

	createBoard = () => {
		for (let r of Board.rows)
			for (let c of Board.cols)
				this.positions[`${r},${c}`] = new BoardPosition(r, c, this.owner);
	};

	constructor(playerObj) {
		this.owner = playerObj;
		this.createBoard();
	}
}

class Boat {
	positions = [];
	getSize = () => this.positions.length;
	wasHealed = false;
	placed = false;
}

class Player {
	placeBoat = (boatEnum, row, col, vertical) => {
		const positions = vertical
			? this.board.getSliceVertical(row, col, boatEnum.size)
			: this.board.getSliceHorizontal(row, col, boatEnum.size);

		if (positions.length !== boatEnum.size)
			return sendError(this.websocket, "boat too big");
		if (positions.some((pos) => pos.boat !== undefined))
			return sendError(this.websocket, "boat in the way");

		const boat = this.boats[boatEnum.name];
		if (boat.placed)
			return sendError(
				this.websocket,
				`${boatEnum.name} already placed for ${this.id}`,
			);

		boat.positions = positions;
		boat.positions.forEach((pos, idx) =>
			pos.placeBoat(boatEnum.name, idx + 1, vertical),
		);
		boat.placed = true;
	};

	refreshBoard = () => {
		for (let pos of Object.values(this.board.positions)) {
			// Refresh boats
			if (pos.boat && pos.boatSlot === 0)
				for (let player of Game.getGameFromPlayerId(this.id).players)
					sendPlaceBoat(
						player.websocket,
						this.id,
						pos.boat,
						pos.row,
						pos.col,
						pos.vertical,
					);

			// Refresh revealed slots
			if (pos.revealed)
				for (let player of Game.getGameFromPlayerId(this.id).players)
					sendRevealPosition(player.websocket, this.id, pos.row, pos.col);
		}
	};

	constructor(id, playerSlot, websocket) {
		this.id = id;
		this.board = new Board(this);
		this.websocket = websocket;
		this.playerSlot = playerSlot;
		this.points = 0;
		this.ready = false;

		this.boats = {
			destroyer: new Boat(),
			submarine: new Boat(),
			cruise: new Boat(),
			battleship: new Boat(),
			aircraft: new Boat(),
		};
	}
}

// Instructions library

// Placing a boat in a slot - Sent only to player that placed it
// instruction: 'placeBoat'
// playerId: string,
// boatName: string
// vertical: bool,
// row: string A - J
// col: string 1 - 10
const sendPlaceBoat = (ws, playerId, boatName, row, col, vertical) => {
	ws.send(
		JSON.stringify({
			type: "instruction",
			instruction: "placeBoat",
			playerId: playerId,
			boatName: boatName,
			vertical: vertical,
			row: row,
			col: col,
		}),
	);
};

// Handing the placement of a boat
// playerId: string
// boatName: from enum Boats[string]
// row: string A - J
// col: string 0 - 10
const handlePlaceBoat = (ws, playerId, boatName, row, col, vertical) => {
	const game = Game.getGameFromPlayerId(playerId);
	if (game === undefined)
		return sendError(ws, `player ${playerId} is not currently in a game`);

	const player = game.getPlayerFromId(playerId);

	if (!game.started) {
		player.placeBoat(Boats[boatName], row, col, vertical);
		return sendSuccess(
			ws,
			`placed ${boatName} at ${row},${col} in player's ${playerId} board`,
		);
	}
	sendError(
		ws,
		`game ${game.id} started, unable to place boat for player ${playerId}`,
	);
};

// Placing Shield - Sent to every player
// instruction: 'destroyPosition'
// playerSlot: number 0 - 3
// row: string A - J
// col: string 1 - 10
const sendDestroyPosition = (ws, playerSlot, row, col) => {
	const game = Game.getGameFromWebsocket(ws);
	assert(game !== undefined);
	game.players.forEach((player) => {
		player.websocket.send(
			JSON.stringify({
				type: "instruction",
				instruction: "destroyPosition",
				playerSlot: playerSlot,
				row: row,
				col: col,
			}),
		);
	});
};

// Handles destruction of a boat
// attackerId: string Player who's beating ass
// victimId: string Player who got their ass beat
// boatName: Boats[string]
// row: string A - J
// col: string 0 - 10
const handleDestroyPosition = (attackerId, victimId, row, col) => {
	const game = Game.getGameFromPlayerId(attackerId);
	const attacker = game.getPlayerFromId(attackerId);
	const victim = game.getGameFromPlayerId(victimId);

	game.attackPlayer(
		game.players.indexOf(attacker),
		game.players.indexOf(victim),
		row,
		col,
	);
};

// Placing Shield - Sent to every player
// instruction: 'healPosition'
// playerSlot: number 0 - 3
// row: string A - J
// col: string 1 - 10
const sendHealPosition = (ws, slot, row, col) => {
	const game = Game.getGameFromWebsocket(ws);
	assert(game !== undefined);
	game.players.forEach((player) => {
		player.websocket.send(
			JSON.stringify({
				type: "instruction",
				instruction: "destroyPosition",
				playerSlot: playerSlot,
				row: row,
				col: col,
			}),
		);
	});
};

// Placing Shield - Sent to every player
// instruction: 'revealPosition'
// playerId: number 0 - 3
// row: string A - J
// col: string 1 - 10
const sendRevealPosition = (ws, playerId, row, col) => {
	const game = Game.getGameFromWebsocket(ws);
	console.assert(game !== undefined);
	game.players.forEach((player) => {
		player.websocket.send(
			JSON.stringify({
				type: "instruction",
				instruction: "revealPosition",
				playerId: playerId,
				row: row,
				col: col,
			}),
		);
	});
};

// Placing Shield - Sent to the player that placed it
// instruction: 'placeShield'
// row: string A - J
// col: string 1 - 10
const sendPlaceShield = (ws, row, col) => {
	ws.send(
		JSON.stringify({
			type: "instruction",
			instruction: "placeShield",
			row: row,
			col: col,
		}),
	);
};

// Placing Mines - Sent to the player that placed it
// instruction: 'placeMine'
// gameId: string
// playerId: string
// row: string A - J
// col: string 1 - 10
const sendPlaceMine = (ws, row, col) => {
	ws.send(
		JSON.stringify({
			type: "instruction",
			instruction: "placeMine",
			row: row,
			col: col,
		}),
	);
};

const sendPlayerJoin = (ws, playerId) => {
	const game = Game.getGameFromPlayerId(playerId);
	ws.send(
		JSON.stringify({
			type: "instruction",
			instruction: "joinGame",
			gameId: game.id,
			playerId: playerId,
			gameHostId: game.players[0].id,
		}),
	);
};

const sendPlayerDisconnect = (ws, playerId) => {
	ws.send(
		JSON.stringify({
			type: "instruction",
			instruction: "playerDisconnect",
			playerId: playerId,
		}),
	);
};

const sendPlayerReady = (ws, playerId) => {
	ws.send(
		JSON.stringify({
			type: "instruction",
			instruction: "playerReady",
			playerId: playerId,
		}),
	);
};

const sendPlayerUnready = (ws, playerId) => {
	ws.send(
		JSON.stringify({
			type: "instruction",
			instruction: "playerUnready",
			playerId: playerId,
		}),
	);
};

const sendStartGame = (ws) => {
	ws.send(
		JSON.stringify({
			type: "instruction",
			instruction: "startGame",
		}),
	);
};

const sendSuccess = (ws, text) => {
	console.log(`SUCCESS: ${text}`);
	ws.send(
		JSON.stringify({
			type: "success",
			text: text,
		}),
	);
};

const sendError = (ws, text) => {
	console.log(`ERROR: ${text}`);
	ws.send(
		JSON.stringify({
			type: "error",
			text: text,
		}),
	);
};

const generateGameId = () => {
	let id = undefined;
	while (id === undefined || gameList[id] !== undefined)
		id = Math.random().toString(32).slice(2, 8).toString();
	return id;
};

const handleCreateGame = (ws, playerId, gameId = undefined) => {
	console.log(`INFO: The player ${playerId} is creating a game... ${gameId}`);

	console.assert(ws, "Websocket somehow not here");

	if (playerId === undefined) return sendError(ws, "playerId is undefined");
	if (playerId === "") return sendError(ws, "playerId is empty");
	if (Game.playerIdsInGames.has(playerId)) {
		const game = Game.getGameFromPlayerId(playerId);
		handleLeaveGame(ws, game.id, playerId);
	}

	if ((gameId !== undefined || gameId === "") && gameList[gameId] !== undefined)
		return sendError(ws, `game with id ${gameId} already exists`);

	const newGame = new Game();
	if (gameId === undefined || gameId === "") newGame.id = generateGameId();
	else newGame.id = gameId;

	gameList[newGame.id] = newGame;
	sendSuccess(ws, `created game with id of ${newGame.id}`);

	handleJoinGame(ws, newGame.id, playerId);
};

const handleJoinGame = (ws, gameId, playerId) => {
	console.log(`INFO: The player ${playerId} is joining ${gameId}`);

	console.assert(ws, "Websocket somehow not here");

	if (playerId === undefined) return sendError(ws, "playerId is undefined");
	if (playerId === "") return sendError(ws, "playerId is empty");

	if (gameId === undefined) return sendError(ws, "gameId is undefined");
	if (gameId === "") return sendError(ws, "gameId is empty");

	const game = gameList[gameId];
	if (game === undefined) return sendError(ws, `no game ${gameId} found`);
	if (game.started)
		return sendError(
			ws,
			`Cannot join game ${gameId} because it already started`,
		);
	if (
		game.getPlayerFromId(playerId) === undefined && // The player is NOT here
		game.getPlayerCount() === 4 && // We reached the max
		!game.removeInactive() // We can remove someone
	)
		return sendError(ws, `Cannot join game ${gameId} because it's full`);

	const otherGame = Game.getGameFromPlayerId(playerId);
	if (otherGame && otherGame.id !== game.id)
		otherGame.removePlayer(playerId, true);

	const player = game.getPlayerFromId(playerId);
	if (player?.websocket)
		return sendError(
			`player ${playerId} already connected from somewhere else`,
		);

	const newPlayer = game.addNewPlayer(ws, playerId);

	// Send notification to the player that's joining, that he joined
	// Send a notification to every player about this player joining
	// Send a notification to the new player about every other player that's in the game
	sendPlayerJoin(newPlayer.websocket, newPlayer.id);
	game.getPlayers().forEach((player) => {
		if (player === newPlayer || player.websocket === undefined) return;
		sendPlayerJoin(player.websocket, newPlayer.id);
		sendPlayerJoin(newPlayer.websocket, player.id);
	});

	Object.keys(newPlayer.boats)
		.filter((boat) => newPlayer.boats[boat].placed)
		.forEach((boat) => {
			const boatPos = newPlayer.boats[boat].positions[0];
			const [row, col, vertical] = [boatPos.row, boatPos.col, boatPos.vertical];
			sendPlaceBoat(
				newPlayer.websocket,
				newPlayer.id,
				boat,
				row,
				col,
				vertical,
			);
		});

	// Now if the player is ready and game hasnt started, send a IM READY message
	if (!game.started) {
		if (newPlayer.ready) sendPlayerReady(newPlayer.websocket, newPlayer.id);
		game.getPlayers().forEach((player) => {
			if (player === newPlayer || player.websocket === undefined) return;
			if (newPlayer.ready) sendPlayerReady(player.websocket, newPlayer.id);
			if (player.ready) sendPlayerReady(newPlayer.websocket, player.id);
		});
	}

	sendSuccess(ws, `player ${playerId} joined game ${gameId}`);
};

const handleLeaveGame = (ws, gameId, playerId) => {
	console.log(`INFO: The player ${playerId} is leaving ${gameId}`);
	console.assert(ws, "ERROR: websocket somehow not here");

	if (playerId === undefined) return sendError(ws, "playerId is undefined");
	if (playerId === "") return sendError(ws, "playerId is empty");
	if (!Game.playerIdsInGames.has(playerId))
		return sendError(ws, `player ${playerId} not in a game`);

	if (gameId === undefined) return sendError(ws, "gameId is undefined");
	if (gameId === "") return sendError(ws, "gameId is empty");

	const game = gameList[gameId];
	if (game === undefined) return sendError(ws, `no game ${gameId} found`);
	if (game.getPlayerFromId(playerId) === undefined)
		return sendError(ws, `${playerId} not found in ${gameId}`);

	game.removePlayer(playerId);

	game.getPlayers().forEach((player) => {
		if (player.websocket === undefined) return;
		sendPlayerDisconnect(player.websocket, playerId);
	});

	sendSuccess(ws, `removed ${playerId} from game ${gameId}`);
};

const handleDisconnectGame = (ws, gameId, playerId) => {
	console.log(`INFO: The player ${playerId} is disconnecting from ${gameId}`);
	console.assert(ws, "ERROR: websocket somehow not here");

	if (playerId === undefined) return sendError(ws, "playerId is undefined");
	if (playerId === "") return sendError(ws, "playerId is empty");
	if (!Game.playerIdsInGames.has(playerId))
		return sendError(ws, `player ${playerId} not in a game`);

	if (gameId === undefined) return sendError(ws, "gameId is undefined");
	if (gameId === "") return sendError(ws, "gameId is empty");

	const game = gameList[gameId];
	if (game === undefined) return sendError(ws, `no game ${gameId} found`);
	if (game.getPlayerFromId(playerId) === undefined)
		return sendError(ws, `${playerId} not found in ${gameId}`);

	// Tell the players the player is being disconnected
	game
		.getPlayers()
		.filter(
			(player) => player.id !== playerId && player.websocket !== undefined,
		)
		.forEach((player) => sendPlayerDisconnect(player.websocket, playerId));

	// Then disconnect the player
	game.disconnectPlayer(playerId);

	sendSuccess(ws, `disconnected ${playerId} from game ${gameId}`);
};

const handleDeleteGame = (ws, gameId, playerId) => {
	console.log(`INFO: The player ${playerId} is deleting ${gameId}`);

	console.assert(ws, "Websocket somehow not here");

	if (playerId === undefined) return sendError(ws, "playerId is undefined");
	if (playerId === "") return sendError(ws, "playerId is empty");
	if (!Game.playerIdsInGames.has(playerId))
		return sendError(ws, `player ${playerId} not in a game`);

	if (gameId === undefined) return sendError(ws, "gameId is undefined");
	if (gameId === "") return sendError(ws, "gameId is empty");

	const game = gameList[gameId];
	if (game === undefined) return sendError(ws, `no game ${gameId} found`);
	if (!game.isPlayerHost(playerId))
		return sendError(ws, `${playerId} is not host of ${gameId}`);

	game.deleteGame();
	sendSuccess(ws, `${playerId} has deleted ${gameId}`);
};

const handleStartGame = (ws, gameId, playerId) => {
	console.log(`INFO: The player ${playerId} is starting ${gameId}`);

	console.assert(ws, "Websocket somehow not here");

	if (playerId === undefined) return sendError(ws, "playerId is undefined");
	if (playerId === "") return sendError(ws, "playerId is empty");
	if (!Game.playerIdsInGames.has(playerId))
		return sendError(ws, `player ${playerId} not in a game`);

	if (gameId === undefined) return sendError(ws, "gameId is undefined");
	if (gameId === "") return sendError(ws, "gameId is empty");

	const game = gameList[gameId];
	if (game === undefined) return sendError(ws, `no game ${gameId} found`);
	if (!game.isPlayerHost(playerId))
		return sendError(ws, `${playerId} is not host of ${gameId}`);

	if (game.players.some((player) => !player.ready))
		return sendError(ws, `cannot start ${gameId} not everyone is ready`);

	game.startGame();

	game.players.forEach((player) => sendStartGame(player.websocket));

	sendSuccess(ws, `${playerId} has started ${gameId}`);
};

const handlePlayerReady = (ws, playerId) => {
	console.log(`INFO: The player ${playerId} is readying up`);

	console.assert(ws, "Websocket somehow not here");

	if (playerId === undefined) return sendError(ws, "playerId is undefined");
	if (playerId === "") return sendError(ws, "playerId is empty");
	if (!Game.playerIdsInGames.has(playerId))
		return sendError(ws, `player ${playerId} not in a game`);

	const game = Game.getGameFromPlayerId(playerId);
	const player = game.getPlayerFromId(playerId);

	if (Object.values(player.boats).some((boat) => !boat.placed))
		return sendError(ws, `player ${playerId} has not placed all their boats`);
	player.ready = true;

	for (const p of game.players) sendPlayerReady(p.websocket, playerId);

	sendSuccess(ws, `${playerId} has readied up`);
};

const handlePlayerUnready = (ws, playerId) => {
	console.log(`INFO: The player ${playerId} unreadying`);

	console.assert(ws, "Websocket somehow not here");

	if (playerId === undefined) return sendError(ws, "playerId is undefined");
	if (playerId === "") return sendError(ws, "playerId is empty");
	if (!Game.playerIdsInGames.has(playerId))
		return sendError(ws, `player ${playerId} not in a game`);

	const game = Game.getGameFromPlayerId(playerId);
	const player = game.getPlayerFromId(playerId);

	Object.values(player.boats).forEach((boat) => {
		boat.positions.forEach((pos) => pos.removeBoat());
		boat.placed = false;
	});

	player.ready = false;

	for (const p of game.players) sendPlayerUnready(p.websocket, playerId);

	sendSuccess(ws, `${playerId} has unreadied`);
};

const handleWebsocketDisconnect = (ws) => {
	console.log("INFO: A client is disconnecting...");

	if (!Game.websocketsInGames.has(ws))
		return console.log(
			"INFO: a websocket disconnected without being in a game",
		);

	for (let game of Object.values(gameList)) {
		for (let player of game.players) {
			if (player === undefined) continue;
			if (player.websocket === ws) {
				handleDisconnectGame(ws, game.id, player.id);
				console.log(`INFO: ${player.id} disconnected from ${game.id}`);
			}
		}
	}
};

Deno.serve({ port: "8000", hostname: "0.0.0.0" }, (req) => {
	if (req.headers.get("upgrade") != "websocket") {
		return new Response(null, { status: 501 });
	}

	const { socket: ws, response } = Deno.upgradeWebSocket(req);
	ws.addEventListener("open", () => {
		console.log("CONNECTION: A new client connected!");
	});

	ws.addEventListener("message", (event) => {
		let ev;
		try {
			ev = JSON.parse(event.data);
		} catch {
			return console.log("data not valid json\ndata:" + event.data);
		}

		if (ev.type === "gameInstruction") {
			if (ev.instruction === "placeBoat")
				return handlePlaceBoat(
					ws,
					ev.playerId,
					ev.boatName,
					ev.row,
					ev.col,
					ev.vertical,
				);
		}

		if (ev.type === "lobbyInstruction") {
			if (ev.instruction === "createGame")
				return handleCreateGame(ws, ev.playerId, ev?.gameId);
			if (ev.instruction === "joinGame")
				return handleJoinGame(ws, ev.gameId, ev.playerId);
			if (ev.instruction === "leaveGame")
				return handleLeaveGame(ws, ev.gameId, ev.playerId);
			if (ev.instruction === "deleteGame")
				return handleDeleteGame(ws, ev.gameId, ev.playerId);
			if (ev.instruction === "startGame")
				return handleStartGame(ws, ev.gameId, ev.playerId);
			if (ev.instruction === "playerReady")
				return handlePlayerReady(ws, ev.playerId);
			if (ev.instruction === "playerUnready")
				return handlePlayerUnready(ws, ev.playerId);
			return sendError(ws, "malformed instruction");
		}
	});

	ws.addEventListener("close", () => handleWebsocketDisconnect(ws));

	return response;
});
