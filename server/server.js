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

const isValidString = (str) => (str ?? "").length;

const gameList = {};

class Game {
	static websocketsInGames = new Set();

	static isWebsocketInGame = (ws) => Game.websocketsInGames.has(ws);

	static playersInGames = new Set();

	static isPlayerInGame = (id) => Game.playersInGames.has(id);

	static getGameFromPlayer = (pId) =>
		Object.values(gameList).find((game) =>
			game.players.some((player) => player.id === pId),
		);

	static getGameFromWebsocket = (ws) =>
		Object.values(gameList).find((game) =>
			game.players.some((player) => player.websocket === ws),
		);

	players = [];

	getPlayer = (id) => this.players.find((p) => p.id === id);

	getPlayers = () => this.players.filter((p) => p);

	getOnlinePlayers = () =>
		this.players.filter((x) => x.websocket ?? undefined !== undefined);

	isPlayerOnline = (id) => this.getPlayer(id).websocket;

	getPlayerIndex = (id) => this.players.findIndex((x) => x.id === id);

	getPlayerCount = () => this.players.length;

	turnOf = undefined;

	nextTurn = () => {
		this.turnNumber += 1;

		let idx = (this.getPlayerIndex(this.turnOf.id) + 1) % this.getPlayerCount();
		// Skip turn of offline players
		while (this.players[idx].websocket === undefined)
			idx = (idx + 1) % this.getPlayers().length;
		this.turnOf = this.players[idx];

		for (const player of this.getOnlinePlayers())
			sendTurnOfPlayer(player.websocket, this.turnOf.id);
	};

	turnNumber = 0;

	id = "";

	started = false;

	// If someone isn't ready OR cannot Ready, don't start
	canStart = () => {
		return (
			this.getOnlinePlayers().length > 1 &&
			this.getOnlinePlayers().every((p) => p.ready)
		);
	};

	self_destroy_timer = undefined;

	getFreeSlot = () => this.players.length;

	isPlayerHost = (id) => this.players.indexOf(this.getPlayer(id)) === 0;

	getHost = () => this.players[0];

	canPlayerJoin = (id) => {
		const player = this.getPlayer(id);
		if (player === undefined) return this.players.length < 4;
		return player.websocket === undefined;
	};

	addNewPlayer = (ws, id) => {
		const player = this.getPlayer(id);
		if (player) return this.reconnectPlayer(ws, player);

		const idx = this.getFreeSlot();
		if (idx >= 4) return;

		if (this.self_destroy_timer !== undefined) {
			console.log(
				`INFO: ${id} joined game ${this.id}, stopping self destruction`,
			);
			clearTimeout(this.self_destroy_timer);
			this.self_destroy_timer = undefined;
		}

		this.players[idx] = new Player(id, idx, ws);
		Game.websocketsInGames.add(ws);
		Game.playersInGames.add(id);

		return this.players[idx];
	};

	reconnectPlayer = (newWebsocket, player) => {
		player.websocket = newWebsocket;
		Game.websocketsInGames.add(newWebsocket);

		if (this.self_destroy_timer !== undefined) {
			console.log(
				`INFO: ${player.id} reconnected game ${this.id}, stopping self destruction`,
			);
			clearTimeout(this.self_destroy_timer);
			this.self_destroy_timer = undefined;
		}

		return player;
	};

	disconnectPlayer = (id) => {
		const idx = this.getPlayerIndex(id);
		if (idx === -1) return;

		Game.websocketsInGames.delete(this.players[idx].websocket);
		this.players[idx].websocket = undefined;

		if (idx === 0) this.players.push(this.players.shift());

		if (!this.players.some((x) => x.websocket)) {
			console.log(`INFO: Everyone dc'd from ${this.id}, self deleting...`);
			this.self_destroy_timer = setTimeout(() => {
				console.log(`Time's up! deleting ${this.id}`);
				this.deleteGame();
			}, 30000);
		}
	};

	removePlayer = (id, forced = false) => {
		const idx = this.getPlayerIndex(id);
		if (idx === -1) return;

		const player = this.getPlayer(id);
		Game.websocketsInGames.delete(player?.websocket);
		Game.playersInGames.delete(player?.id);
		this.players.splice(this.getPlayerIndex(id), 1);

		if (this.getPlayerCount() !== 0) return;
		console.log(`INFO: game ${this.id} is empty, selfdestroying...`);
		this.self_destroy_timer = setTimeout(() => {
			console.log(`INFO: permanently deleting ${this.id}`);
			this.deleteGame();
		}, 5000);
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
			Game.websocketsInGames.delete(this.players[idx]?.websocket);
			Game.playersInGames.delete(this.players[idx].id);
			delete this.players[idx];
		});

		delete gameList[this.id];
	};

	startGame = () => {
		this.started = true;

		// Remove offline, but not removed players
		this.players = this.getOnlinePlayers();

		this.turnOf = this.players[0];
	};

	destroyPosition = (id, row, col) => {
		const target = this.getPlayer(id);
		const pos = target.board.getPosition(row, col);

		pos.destroy();
		for (const player of this.getOnlinePlayers())
			sendDestroyPosition(player.websocket, target.id, pos.row, pos.col);
		this.revealPositionToAll(target.id, pos.row, pos.col);
	};

	revealPositionToAll = (id, row, col) => {
		const target = this.getPlayer(id);
		const pos = target.board.getPosition(row, col);
		pos.reveal();

		for (const player of this.getOnlinePlayers())
			sendRevealPosition(
				player.websocket,
				target.id,
				pos.boat,
				pos.slot,
				pos.row,
				pos.col,
				pos.vertical,
				pos.hasMine,
				pos.hasShield,
				pos.destroyed,
			);
	};

	attackPlayer = (idFrom, idTo, row, col) => {
		const user = this.getPlayer(idFrom);
		const target = this.getPlayer(idTo);

		if (user === target)
			return sendError(user.websocket, `Can't attack own board!`);
		if (user !== this.turnOf)
			return sendError(user.websocket, `It's not your turn`);

		const pos = target.board.getPosition(row, col);

		if (pos.hasMine) {
			pickRandom(user.board.getAdyacentsPositions(row, col)).destroy();
			target.setPoints(target.points + 5);
			this.nextTurn();
			return;
		}

		if (pos.hasShield) {
			sendSuccess(user.websocket, "Your attack was blocked");
			sendSuccess(target.websocket, "You blocked an attack");
			this.nextTurn();
			return;
		}

		if (pos.destroyed) {
			sendError(user.websocket, "This position is already destroyed!");
			return;
		}

		this.destroyPosition(target.id, pos.row, pos.col);
		this.nextTurn();

		if (pos.boat === undefined) return console.log("Miss!");
		else console.log("HIT");

		user.setPoints(user.points + 5);

		if (!target.getBoats().some((boat) => !boat.isDestroyed())) {
			target.defeated = true;
			if (this.getPlayers().filter((p) => !p.defeated).length === 1) {
				for (const player of this.getOnlinePlayers())
					sendPlayerWin(player.websocket, user.id);
				handleDeleteGame(this.getHost().websocket, this.id, this.getHost().id);
			}
		}
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
	isDestroyed = () => !this.positions.some((pos) => !pos.destroyed);

	constructor(name) {
		this.name = name;
	}
}

class Player {
	getBoats = () => Object.values(this.boats);

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
				for (let player of Game.getGameFromPlayer(this.id).players)
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
				for (let player of Game.getGameFromPlayer(this.id).players)
					sendRevealPosition(player.websocket, this.id, pos.row, pos.col);
		}
	};

	canReady = () => !this.getBoats().some((b) => !b.placed);

	readyUp = () => (this.ready = true);

	setPoints = (points) => {
		this.points = points;
		sendPointsUpdate(this.websocket, this.points);
	};

	constructor(id, playerSlot, websocket) {
		this.id = id;
		this.board = new Board(this);
		this.websocket = websocket;
		this.playerSlot = playerSlot;
		this.points = 0;
		this.ready = false;
		this.defeated = false;

		this.boats = {
			destroyer: new Boat("destroyer"),
			submarine: new Boat("submarine"),
			cruise: new Boat("cruise"),
			battleship: new Boat("battleship"),
			aircraft: new Boat("aircraft"),
		};
	}
}

const sendPlaceBoat = (ws, playerId, boatName, row, col, vertical) => {
	ws.send(
		JSON.stringify({
			type: "lobbyInstruction",
			instruction: "placeBoat",
			playerId: playerId,
			boatName: boatName,
			vertical: vertical,
			row: row,
			col: col,
		}),
	);
};

const handlePlaceBoat = (ws, playerId, boatName, row, col, vertical) => {
	const game = Game.getGameFromPlayer(playerId);
	if (game === undefined)
		return sendError(ws, `player ${playerId} is not currently in a game`);

	const player = game.getPlayer(playerId);

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

const sendDestroyPosition = (ws, playerId, row, col) => {
	const msg = JSON.stringify({
		type: "gameInstruction",
		instruction: "destroyPosition",
		playerId: playerId,
		row: row,
		col: col,
	});
	ws.send(msg);
};

const sendRevealPosition = (
	ws,
	playerId,
	boatName,
	slot,
	row,
	col,
	vertical,
	hasMine,
	hasShield,
	isDestroyed,
) => {
	const msg = JSON.stringify({
		type: "gameInstruction",
		instruction: "revealPosition",
		playerId: playerId,
		boatName: boatName,
		slot: slot,
		row: row,
		col: col,
		vertical: vertical,
		hasMine: hasMine,
		hasShield: hasShield,
		isDestroyed: isDestroyed,
	});
	ws.send(msg);
};

const handleAttackPosition = (ws, userId, targetId, row, col) => {
	if (!isValidString(userId)) return sendError(ws, "ERROR: userId is empty");
	if (!Game.isPlayerInGame(userId))
		return sendError(ws, `ERROR: ${userId} is not in a game`);

	if (!isValidString(targetId)) return console.log("ERROR: targetId is empty");
	if (!Game.isPlayerInGame(targetId))
		return sendError(ws, `ERROR: ${targetId} is not in a game`);

	const game = Game.getGameFromPlayer(userId);
	if (!game.getPlayer(targetId))
		return sendError(
			ws,
			`ERROR: ${targetId} is not in the same game as ${userId}`,
		);

	game.attackPlayer(userId, targetId, row, col);
};

const sendTurnOfPlayer = (ws, playerId) => {
	const msg = JSON.stringify({
		type: "gameInstruction",
		instruction: "turnOfPlayer",
		playerId: playerId,
		turnNumber: Game.getGameFromPlayer(playerId).turnNumber,
	});
	ws.send(msg);
};

const sendPlayerWin = (ws, playerId) => {
	const msg = JSON.stringify({
		type: "gameInstruction",
		instruction: "playerWin",
		playerId: playerId,
	});
	ws.send(msg);
};

const sendPointsUpdate = (ws, points) => {
	const msg = JSON.stringify({
		type: "gameInstruction",
		instruction: "pointsUpdate",
		points: points,
	});
	ws.send(msg);
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
	const game = Game.getGameFromPlayer(playerId);
	const msg = JSON.stringify({
		type: "lobbyInstruction",
		instruction: "joinGame",
		gameId: game.id,
		playerId: playerId,
	});
	ws.send(msg);
};

const sendPlayerDisconnect = (ws, playerId) => {
	ws.send(
		JSON.stringify({
			type: "lobbyInstruction",
			instruction: "playerDisconnect",
			playerId: playerId,
		}),
	);
};

const sendNewHost = (ws, playerId) => {
	const msg = JSON.stringify({
		type: "lobbyInstruction",
		instruction: "newHost",
		playerId: playerId,
	});
	ws.send(msg);
};

const sendPlayerReady = (ws, playerId) => {
	const msg = JSON.stringify({
		type: "lobbyInstruction",
		instruction: "playerReady",
		playerId: playerId,
	});
	ws.send(msg);
};

const sendGameReady = (ws, playerId) => {
	const msg = JSON.stringify({
		type: "lobbyInstruction",
		instruction: "gameReady",
	});
	ws.send(msg);
};

const sendPlayerUnready = (ws, playerId) => {
	const msg = JSON.stringify({
		type: "lobbyInstruction",
		instruction: "playerUnready",
		playerId: playerId,
	});
	ws.send(msg);
};

const sendGameUnready = (ws, playerId) => {
	const msg = JSON.stringify({
		type: "lobbyInstruction",
		instruction: "gameUnready",
	});
	ws.send(msg);
};

const sendStartGame = (ws) => {
	ws.send(
		JSON.stringify({
			type: "lobbyInstruction",
			instruction: "startGame",
		}),
	);
};

const sendSuccess = (ws, text) => {
	console.log(`SUCCESS: ${text}\n`);
	ws.send(
		JSON.stringify({
			type: "success",
			text: text,
		}),
	);
};

const sendError = (ws, text) => {
	console.log(`ERROR: ${text}\n`);
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

const handleCreateGame = (ws, playerId, gameId = "") => {
	console.log(`INFO: The player ${playerId} is creating a game... ${gameId}`);

	console.assert(ws, "Websocket somehow not here");

	if (!isValidString(playerId)) return sendError(ws, "playerId is empty");
	if (Game.isPlayerInGame(playerId)) {
		const game = Game.getGameFromPlayer(playerId);
		handleLeaveGame(ws, game.id, playerId);
	}

	if (isValidString(gameId) && gameList[gameId] !== undefined)
		return sendError(ws, `game with id ${gameId} already exists`);

	const newGame = new Game();
	if (isValidString(gameId)) newGame.id = gameId;
	else newGame.id = generateGameId();

	gameList[newGame.id] = newGame;
	sendSuccess(ws, `created game with id of ${newGame.id}`);

	handleJoinGame(ws, newGame.id, playerId);
};

const handleJoinGame = (ws, gameId, playerId) => {
	console.log(`INFO: The player ${playerId} is joining ${gameId}`);
	console.assert(ws, "Websocket somehow not here");

	if (!isValidString(playerId)) return sendError(ws, "playerId is empty");
	if (!isValidString(gameId)) return sendError(ws, "gameId is empty");

	const game = gameList[gameId];
	if (!game) return sendError(ws, `no game ${gameId} found`);
	if (game.started && !game.getPlayer(playerId))
		return sendError(
			ws,
			`Cannot join game ${gameId} because it already started`,
		);

	if (
		!game.getPlayer(playerId) && // The player is NOT here
		game.getPlayerCount() === 4 && // We reached the max
		!game.removeInactive() // We cannot remove someone
	)
		return sendError(ws, `Cannot join game ${gameId} because it's full`);

	// If the player is on a game different than the one he's trying to join
	// remove him from that other game
	const otherGame = Game.getGameFromPlayer(playerId);
	if (otherGame && otherGame !== game) otherGame.removePlayer(playerId, true);

	// If the player is on the game he's trying to join
	// check his online status
	const player = game.getPlayer(playerId);
	if (player && game.isPlayerOnline(player.id))
		return sendError(
			ws,
			`player ${playerId} already connected to ${gameId} from somewhere else`,
		);

	// All checks passed, add player to this new game
	const newPlayer = game.addNewPlayer(ws, playerId);

	sendPlayerJoin(newPlayer.websocket, newPlayer.id); // Hey me, I joined
	for (const player of game.getOnlinePlayers().filter((x) => x !== newPlayer)) {
		sendPlayerJoin(player.websocket, newPlayer.id); // Hey old, new joined
		sendPlayerJoin(newPlayer.websocket, player.id); // Hey new, old is here
	}

	for (const boat of newPlayer.getBoats().filter((x) => x.placed))
		sendPlaceBoat(
			newPlayer.websocket,
			newPlayer.id,
			boat.name,
			boat.positions[0].row,
			boat.positions[0].col,
			boat.positions[0].vertical,
		);

	// Player lobby signals
	if (!game.started) {
		if (newPlayer.ready) {
			sendPlayerJoin(newPlayer.websocket, newPlayer.id); // Hey me, I joined
			for (const player of game
				.getOnlinePlayers()
				.filter((x) => x !== newPlayer))
				sendPlayerJoin(player.websocket, newPlayer.id); // Hey old, new joined
		}

		for (const player of game.getOnlinePlayers().filter((p) => p.ready))
			sendPlayerReady(newPlayer.websocket, player.id);

		if (game.canStart()) sendGameReady(game.getHost().websocket);
		else sendGameUnready(game.getHost().websocket);
	}

	if (game.started) {
		sendTurnOfPlayer(newPlayer.websocket, game.turnOf.id);

		for (const player of game.getPlayers())
			Object.values(player.board.positions)
				.filter((pos) => pos.revealed)
				.forEach((pos) =>
					sendRevealPosition(
						newPlayer.websocket,
						player.id,
						pos.boat,
						pos.slot,
						pos.row,
						pos.col,
						pos.vertical,
						pos.hasMine,
						pos.hasShield,
						pos.destroyed,
					),
				);

		sendPointsUpdate(newPlayer.websocket, newPlayer.points);
	}

	sendNewHost(newPlayer.websocket, game.getHost().id);

	console.log(`player ${playerId} joined game ${gameId}`);
};

const handleLeaveGame = (ws, gameId, playerId) => {
	console.log(`INFO: The player ${playerId} is leaving ${gameId}`);
	console.assert(ws, "ERROR: websocket somehow not here");

	// Validate playerId & gameId
	if (!isValidString(playerId)) return sendError(ws, "playerId is empty");
	if (!isValidString(gameId)) return sendError(ws, "gameId is empty");

	// Check if player is in a game
	if (!Game.isPlayerInGame(playerId))
		return sendError(ws, `player ${playerId} not in a game`);

	const game = gameList[gameId];
	if (!game) return sendError(ws, `no game ${gameId} found`);

	const player = game.getPlayer(playerId);
	if (!player) return sendError(ws, `${playerId} not found in ${gameId}`);

	game.removePlayer(playerId);

	for (const player of game.getOnlinePlayers()) {
		sendPlayerDisconnect(player.websocket, playerId);
		sendNewHost(player.websocket, game.getHost().id);
	}

	sendSuccess(ws, `removed ${playerId} from game ${gameId}`);
};

const handleDisconnectGame = (ws, gameId, playerId) => {
	console.log(`INFO: The player ${playerId} is disconnecting from ${gameId}`);
	console.assert(ws, "ERROR: websocket somehow not here");

	if (!isValidString(playerId)) return sendError(ws, "playerId is empty");
	if (!isValidString(gameId)) return sendError(ws, "gameId is empty");
	if (!Game.isPlayerInGame(playerId))
		return sendError(ws, `player ${playerId} not in a game`);

	const game = gameList[gameId];
	if (game === undefined) return sendError(ws, `no game ${gameId} found`);
	if (game.getPlayer(playerId) === undefined)
		return sendError(ws, `${playerId} not found in ${gameId}`);

	// Then disconnect the player
	game.disconnectPlayer(playerId);

	// Tell the players the player is being disconnected
	for (const player of game.getOnlinePlayers()) {
		sendPlayerDisconnect(player.websocket, playerId);
		sendNewHost(player.websocket, game.getHost().id);
	}

	// If game hasn't started refresh the readyness
	if (game.canStart()) {
		const p = game.players[0];
		if (p.websocket) sendGameReady(p.websocket);
	} else {
		const p = game.players[0];
		if (p.websocket) sendGameUnready(p.websocket);
	}

	sendSuccess(ws, `disconnected ${playerId} from game ${gameId}`);
};

const handleDeleteGame = (ws, gameId, playerId) => {
	console.log(`INFO: The player ${playerId} is deleting ${gameId}`);

	console.assert(ws, "Websocket somehow not here");

	if (!isValidString(playerId)) return sendError(ws, "playerId is empty");
	if (!isValidString(gameId)) return sendError(ws, "gameId is empty");

	if (!Game.isPlayerInGame(playerId))
		return sendError(ws, `player ${playerId} not in a game`);

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

	if (!isValidString(playerId)) return sendError(ws, "playerId is empty");
	if (!isValidString(playerId)) return sendError(ws, "gameId is empty");
	if (!Game.isPlayerInGame(playerId))
		return sendError(ws, `player ${playerId} not in a game`);

	const game = gameList[gameId];
	if (game === undefined) return sendError(ws, `no game ${gameId} found`);
	if (!game.isPlayerHost(playerId))
		return sendError(ws, `${playerId} is not host of ${gameId}`);

	if (!game.canStart())
		return sendError(ws, `cannot start ${gameId} not everyone is ready`);

	game.startGame();

	game.players.forEach((player) => {
		if (!player.websocket) return;
		sendStartGame(player.websocket);
	});

	sendSuccess(ws, `${playerId} has started ${gameId}`);
};

const handlePlayerReady = (ws, playerId) => {
	console.log(`INFO: The player ${playerId} is readying up`);
	console.assert(ws, "Websocket somehow not here");

	if (!isValidString(playerId)) return sendError(ws, "playerId is empty");
	if (!Game.isPlayerInGame(playerId))
		return sendError(ws, `player ${playerId} not in a game`);

	const game = Game.getGameFromPlayer(playerId);

	const player = game.getPlayer(playerId);
	if (!player.canReady())
		return sendError(ws, `player ${playerId} has not placed all their boats`);
	player.readyUp();

	for (const p of game.getOnlinePlayers())
		sendPlayerReady(p.websocket, playerId);

	if (game.canStart()) sendGameReady(game.players[0].websocket);

	sendSuccess(ws, `${playerId} has readied up`);
};

const handlePlayerUnready = (ws, playerId) => {
	console.log(`INFO: The player ${playerId} unreadying`);
	console.assert(ws, "Websocket somehow not here");

	if (!isValidString(playerId)) return sendError(ws, "playerId is empty");
	if (!Game.isPlayerInGame(playerId))
		return sendError(ws, `player ${playerId} not in a game`);

	const game = Game.getGameFromPlayer(playerId);
	const player = game.getPlayer(playerId);

	player.getBoats().forEach((boat) => {
		boat.positions.forEach((pos) => pos.removeBoat());
		boat.placed = false;
	});

	player.ready = false;

	for (const p of game.players) sendPlayerUnready(p.websocket, playerId);
	if (!game.canStart()) sendGameUnready(game.players[0].websocket);

	sendSuccess(ws, `${playerId} has unreadied`);
};

const handleWebsocketDisconnect = (ws) => {
	console.log("INFO: A client is disconnecting...");

	if (!Game.isWebsocketInGame(ws))
		return console.log(
			"INFO: a websocket disconnected without being in a game",
		);

	for (let game of Object.values(gameList))
		for (let player of game.getOnlinePlayers())
			if (player.websocket === ws)
				return handleDisconnectGame(ws, game.id, player.id);
};

const BASE_PATH = "./client";

const reqHandler = async (req) => {
	const filePath = BASE_PATH + new URL(req.url).pathname;
	let fileSize;
	try {
		fileSize = (await Deno.stat(filePath)).size;
	} catch (e) {
		if (e instanceof Deno.errors.NotFound) filePath = "./client/index.html";
	}
	const body = (await Deno.open(filePath)).readable;
	let fileType;
	if (filePath.endsWith("html")) fileType = "text/html";
	if (filePath.endsWith("css")) fileType = "text/css";
	return new Response(body, {
		headers: {
			"content-length": fileSize.toString(),
			"content-type": fileType || "application/octet-stream",
		},
	});
};

Deno.serve({ port: "8000", hostname: "127.0.0.1" }, (req) => {
	if (req.headers.get("upgrade") != "websocket") {
		return reqHandler(req);
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
			if (ev.instruction === "attackPosition")
				handleAttackPosition(ws, ev.userId, ev.targetId, ev.row, ev.col);
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
			if (ev.instruction === "placeBoat")
				return handlePlaceBoat(
					ws,
					ev.playerId,
					ev.boatName,
					ev.row,
					ev.col,
					ev.vertical,
				);
			return sendError(ws, "malformed instruction");
		}
	});

	ws.addEventListener("close", () => handleWebsocketDisconnect(ws));

	return response;
});
