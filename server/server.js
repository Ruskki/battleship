const sendInstruction = (ws, instruction, data) => {
	console.log(`SEND: ${instruction}, data: ${JSON.stringify(data)}`);
	const msg = JSON.stringify({
		type: 'instruction',
		instruction,
		...data
	});
	ws.send(msg);
};

const sendCreateGame = (ws, gameId) => sendInstruction(ws, 'createGame', { gameId });

const handleCreateGame = (ws) => {
	const newGame = GAME_LIST.createGame();
	sendCreateGame(ws, newGame.id);
};

const sendPlayerJoin = (ws, playerId, gameId) => sendInstruction(ws, 'joinGame', { playerId, gameId });

const handleJoinGame = (ws, gameId, playerId) => {
	if (!isValidString(playerId)) return sendError(ws, 'playerId is empty');
	if (!isValidString(gameId)) return sendError(ws, 'gameId is empty');

	const game = GAME_LIST.getGame(gameId);
	if (!game) return sendError(ws, `no game ${gameId} found`);
	if (game.isFull())
		return sendError(ws, `Cannot join game ${gameId} because it's full`);

	const otherGame = GAME_LIST.getPlayerGame(playerId);
	if (otherGame && otherGame !== game)
		otherGame.removePlayer(playerId);

	if (game.isPlayerOnline(playerId))
		return sendError(ws, `Player ${playerId} already connected to ${gameId} from somewhere else`);

	const newPlayer = game.addNewPlayer(ws, playerId);

	sendPlayerJoin(newPlayer.websocket, newPlayer.id, game.id); // Hey me, I joined
	for (const player of game.getOnlinePlayers().filter((x) => x !== newPlayer)) {
		sendPlayerJoin(player.websocket, newPlayer.id, game.id); // Hey old, new joined
		sendPlayerJoin(newPlayer.websocket, player.id, game.id); // Hey new, old is here
	}

	// If game can begin, notify the host
	if (game.canStart()) sendGameReady(game.getHost().websocket);
	else if (!game.started) sendGameUnready(game.getHost().websocket);

	sendSuccess(ws, `Player ${playerId} joined game ${gameId}`);
};

const handleGetBoats = (ws, playerId) => {
	const player = GAME_LIST.getPlayer(playerId);
	if (!player) return sendError(ws, `Player ${playerId} not found in a game`);

	for (const boat of player.getBoats().filter((x) => x.placed))
		sendPlaceBoat(
			ws,
			boat.name,
			boat.positions[0].row,
			boat.positions[0].col,
			boat.positions[0].vertical,
		);
};

const handleGetReadyPlayers = (ws, gameId) => {
	const game = GAME_LIST.getGame(gameId);
	if (!game) return sendError(ws, `Game ${gameId} not found`);
	for (const p of game.getReadyPlayers())
		sendPlayerReady(ws, p.id);
};

const sendPlayerReady = (ws, playerId) => sendInstruction(ws, 'playerReady', { playerId });

const handlePlayerReady = (ws, playerId) => {
	console.assert(ws, 'Websocket somehow not here');

	if (!isValidString(playerId)) return sendError(ws, 'playerId is empty');
	if (!GAME_LIST.getPlayerGame(playerId))
		return sendError(ws, `player ${playerId} not in a game`);

	const game = GAME_LIST.getPlayerGame(playerId);

	const player = game.getPlayer(playerId);
	if (!player.canReady())
		return sendError(ws, `player ${playerId} has not placed all their boats`);
	player.readyUp();

	for (const p of game.getOnlinePlayers())
		sendPlayerReady(p.websocket, playerId);

	if (game.canStart()) sendGameReady(game.players[0].websocket);

	sendSuccess(ws, `${playerId} has readied up`);
};

const sendPlayerUnready = (ws, playerId) => sendInstruction(ws, 'playerUnready', { playerId });

const handlePlayerUnready = (ws, playerId) => {

	if (!isValidString(playerId)) return sendError(ws, 'playerId is empty');
	if (!GAME_LIST.isPlayerInGame(playerId))
		return sendError(ws, `Player ${playerId} not in a game`);

	const game = GAME_LIST.getPlayerGame(playerId);
	const player = game.getPlayer(playerId);

	player.getBoats().forEach((boat) => {
		boat.positions.forEach((pos) => pos.removeBoat());
		boat.placed = false;
	});

	player.ready = false;

	for (const player of game.players) sendPlayerUnready(player.websocket, playerId);
	if (!game.canStart()) sendGameUnready(game.getHost().websocket);

	sendSuccess(ws, `${playerId} has unreadied`);
};

const sendGameReady = (ws) => sendInstruction(ws, 'gameReady');

const sendGameUnready = (ws) => sendInstruction(ws, 'gameUnready');

const sendTurnOfPlayer = (ws, playerId, turnNumber) => sendInstruction(ws, 'turnOfPlayer', { playerId, turnNumber });

const handleGetTurnOf = (ws, gameId) => {
	const game = GAME_LIST.getGame(gameId);
	sendTurnOfPlayer(ws, game.turnOf.id);
};

const sendStartGame = (ws) => sendInstruction(ws, 'startGame');

const handleStartGame = (ws, gameId, playerId) => {

	if (!isValidString(playerId)) return sendError(ws, 'playerId is empty');
	if (!isValidString(gameId)) return sendError(ws, 'gameId is empty');
	if (!GAME_LIST.isPlayerInGame(playerId))
		return sendError(ws, `player ${playerId} not in a game`);

	const game = GAME_LIST.getGame(gameId);
	if (!game) return sendError(ws, `no game ${gameId} found`);
	if (!game.isPlayerHost(playerId))
		return sendError(ws, `${playerId} is not host of ${gameId}`);

	if (!game.canStart())
		return sendError(ws, `cannot start ${gameId} not everyone is ready`);

	game.startGame();

	for (const player of game.getOnlinePlayers())
		sendStartGame(player.websocket);

	sendSuccess(ws, `${playerId} has started ${gameId}`);
};

const handleAttackPosition = (ws, userId, targetId, row, col) => {
	if (!isValidString(userId)) return sendError(ws, 'ERROR: userId is empty');
	if (!GAME_LIST.isPlayerInGame(userId))
		return sendError(ws, `ERROR: ${userId} is not in a game`);

	if (!isValidString(targetId)) return sendError(ws, 'ERROR: targetId is empty');
	if (!GAME_LIST.isPlayerInGame(targetId))
		return sendError(ws, `ERROR: ${targetId} is not in a game`);

	const game = GAME_LIST.getPlayerGame(userId);
	if (!game.getPlayer(targetId))
		return sendError(ws, `${targetId} is not in the same game as ${userId}`);

	game.attackPlayer(userId, targetId, row, col);
};

class InstructionHandler {
	#instructions = {
		'createGame': {
			handle: (ws, _) => handleCreateGame(ws),
		},
		'joinGame': {
			handle: (ws, ev) => handleJoinGame(ws, ev.gameId, ev.playerId),
		},
		'getBoats': {
			handle: (ws, ev) => handleGetBoats(ws, ev.playerId),
		},
		'getReadyPlayers': {
			handle: (ws, ev) => handleGetReadyPlayers(ws, ev.gameId),
		},
		'playerReady': {
			handle: (ws, ev) => handlePlayerReady(ws, ev.playerId)
		},
		'playerUnready': {
			handle: (ws, ev) => handlePlayerUnready(ws, ev.playerId)
		},
		'startGame': {
			handle: (ws, ev) => handleStartGame(ws, ev.gameId, ev.playerId)
		},
		'getTurnOf': {
			handle: (ws, ev) => handleGetTurnOf(ws, ev.gameId)
		},
		'attackPosition': {
			handle: (ws, ev) => handleAttackPosition(ws, ev.userId, ev.targetId, ev.row, ev.col)
		},
		'placeBoat': {
			handle: (ws, ev) => handlePlaceBoat(
				ws,
				ev.playerId,
				ev.boatName,
				ev.row,
				ev.col,
				ev.vertical,
			)
		}
	};

	handleInstruction = (ws, ev) => {
		const instruction = this.#instructions[ev.instruction];
		if (!instruction)
			return sendError(ws, `Instruction ${ev.instruction} not found`);
		console.log(`HANDLE: ${ev.instruction} data: ${JSON.stringify(ev)}`);
		instruction.handle(ws, ev);
	};
};

const INSTRUCTION_HANDLER = new InstructionHandler();

const Boats = {
	destroyer: {
		name: 'destroyer',
		size: 2,
	},
	submarine: {
		name: 'submarine',
		size: 3,
	},
	cruise: {
		name: 'cruise',
		size: 3,
	},
	battleship: {
		name: 'battleship',
		size: 4,
	},
	aircraft: {
		name: 'aircraft',
		size: 5,
	},
};

const isValidString = (str) => (str ?? '').length;

const gameList = {};

class GameList {
	#websockets = [];
	isWebsocketInGame = (ws) =>
		this.#websockets.some(x => x.socket === ws);
	getWebsocketGame = (ws) =>
		this.#websockets.find(x => x.socket === ws).game;
	addWebsocket = (ws, gameObj) =>
		this.#websockets.push({ socket: ws, game: gameObj });
	removeWebsocket = (ws) =>
		this.#websockets.splice(this.#websockets.findIndex(x => x.socket === ws), 1);

	#players = {};
	isPlayerInGame = (id) =>
		id in this.#players;
	getPlayerGame = (id) =>
		this.#players[id];
	addPlayer = (id, gameObj) =>
		this.#players[id] = gameObj;
	removePlayer = (id) =>
		delete this.#players[id];
	getPlayer = (id) =>
		this.getPlayerGame(id)?.getPlayer(id);

	#generateGameId = () => {
		let id;
		while (!id || !!this.#gameList[id])
			id = Math.random().toString(32).slice(2, 8).toString();
		return id;
	};

	#gameList = {};
	createGame = () => {
		const game = new Game();
		game.id = this.#generateGameId();
		this.#gameList[game.id] = game;
		return game;
	};

	getGameList = () => Object.values(this.#gameList);

	getGame = (id) => this.#gameList[id];

	static #instance;

	constructor() {
		if (GameList.#instance)
			return GameList.#instance;
		GameList.#instance = this;
		return this;
	}
}

const GAME_LIST = new GameList();

class Game {
	players = [];

	getPlayer = (id) => this.players.find((p) => p.id === id);

	getPlayers = () => this.players.filter((p) => p);

	getReadyPlayers = () => this.players.filter(p => p.ready);

	getOnlinePlayers = () =>
		this.players.filter((x) => x.websocket ?? undefined !== undefined);

	isPlayerOnline = (id) => this.getPlayer(id)?.websocket;

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
			sendTurnOfPlayer(player.websocket, this.turnOf.id, this.turnNumber);
	};

	turnNumber = 0;

	id = '';

	started = false;

	// If someone isn't ready OR cannot Ready, don't start
	canStart = () => (
		!this.started &&
		this.getOnlinePlayers().length > 1 &&
		this.getOnlinePlayers().every((p) => p.ready)
	);

	selfDestroyTimer = undefined;

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

		if (this.isFull()) return;

		if (this.selfDestroyTimer) {
			clearTimeout(this.selfDestroyTimer);
			this.selfDestroyTimer = undefined;
		}

		const idx = this.getFreeSlot(id);
		this.players[idx] = new Player(id, idx, ws);
		GAME_LIST.addWebsocket(ws, this);
		GAME_LIST.addPlayer(id, this);
		return this.players[idx];
	};

	reconnectPlayer = (newWebsocket, player) => {
		player.websocket = newWebsocket;
		GAME_LIST.addWebsocket(newWebsocket, this);

		if (this.selfDestroyTimer !== undefined) {
			clearTimeout(this.selfDestroyTimer);
			this.selfDestroyTimer = undefined;
		}

		return player;
	};

	disconnectPlayer = (id) => {
		const player = this.getPlayer(id);

		GAME_LIST.removeWebsocket(player.websocket);
		player.websocket = undefined;

		if (this.getPlayerIndex(id) === 0) this.players.push(this.players.shift());

		if (!this.players.some((x) => x.websocket)) 
			this.selfDestroyTimer = setTimeout(() => {
				this.deleteGame();
			}, 30000);
		
	};

	removePlayer = (id) => {
		const idx = this.getPlayerIndex(id);
		if (idx === -1) return;

		const player = this.getPlayer(id);
		GAME_LIST.removeWebsocket(player.websocket);
		GAME_LIST.removePlayer(player.id);

		this.players.splice(this.getPlayerIndex(id), 1);

		if (this.getPlayerCount() > 0) return;

		this.selfDestroyTimer = setTimeout(() => {
			this.deleteGame();
		}, 5000);
	};

	removeInactive = () => {
		const idx = this.players.findIndex((x) => x.websocket === undefined);
		if (idx === -1) return false;

		this.removePlayer(this.players[idx].id);
		return true;
	};

	deleteGame = () => {
		this.players.forEach((_, idx) => {
			Game.websocketsInGames.delete(this.players[idx]?.websocket);
			Game.playersInGames.delete(this.players[idx].id);
			delete this.players[idx];
		});

		delete gameList[this.id];
	};

	isFull = () => {
		if (this.started) return this.getPlayers().length === 4;
		return this.getOnlinePlayers().length === 4;
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
			sendAttack(player.websocket, target.id, pos.row, pos.col, !!pos.boat);
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
			return sendError(user.websocket, 'Can\'t attack own board!');
		if (user !== this.turnOf)
			return sendError(user.websocket, 'It\'s not your turn');

		const pos = target.board.getPosition(row, col);

		if (pos.hasMine) {
			pickRandom(user.board.getAdyacentsPositions(row, col)).destroy();
			target.setPoints(target.points + 5);
			this.nextTurn();
			return;
		}

		if (pos.hasShield) {
			sendSuccess(user.websocket, 'Your attack was blocked');
			sendSuccess(target.websocket, 'You blocked an attack');
			this.nextTurn();
			return;
		}

		if (pos.destroyed) {
			sendError(user.websocket, 'This position is already destroyed!');
			return;
		}

		this.destroyPosition(target.id, pos.row, pos.col);
		this.nextTurn();

		if (pos.boat === undefined) return;

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

	removeBoat = () => {
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
			return sendError(this.owner.websocket, 'Cannot place mine where boat is');

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
	static rows = 'ABCDEFGHIJ';
	static cols = '123456789'.split('').concat(['10']);

	positions = {}; // 'A,1' - 'J,10'

	getPosition = (row, col) => this.positions[`${row},${col}`];

	getSliceHorizontal = (row, col, size) =>
		Board.cols
			.slice(Board.cols.indexOf(col), Board.cols.indexOf(col) + size)
			.map((x) => this.getPosition(row, x));

	getSliceVertical = (row, col, size) =>
		Board.rows
			.slice(Board.rows.indexOf(row), Board.rows.indexOf(row) + size)
			.split('')
			.map((x) => this.getPosition(x, col));

	getArea = (row, col) => {
		const minRow = Math.max(0, Board.rows.indexOf(row) - 1);
		const maxRow = Math.min(Board.rows.length, Board.rows.indexOf(row) + 2);
		const minCol = Math.max(0, Board.cols.indexOf(col) - 1);
		const maxCol = Math.min(Board.cols.length, Board.cols.indexOf(col) + 2);

		return Board.rows
			.slice(minRow, maxRow)
			.split('')
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
			.split('')
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
		for (const r of Board.rows)
			for (const c of Board.cols)
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
			return sendError(this.websocket, 'boat too big');
		if (positions.some((pos) => pos.boat !== undefined))
			return sendError(this.websocket, 'boat in the way');

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
		for (const pos of Object.values(this.board.positions)) {
			// Refresh boats
			if (pos.boat && pos.boatSlot === 0)
				for (const player of Game.getGameFromPlayer(this.id).players)
					sendPlaceBoat(
						player.websocket,
						pos.boat,
						pos.row,
						pos.col,
						pos.vertical,
					);

			// Refresh revealed slots
			if (pos.revealed)
				for (const player of Game.getGameFromPlayer(this.id).players)
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
			destroyer: new Boat('destroyer'),
			submarine: new Boat('submarine'),
			cruise: new Boat('cruise'),
			battleship: new Boat('battleship'),
			aircraft: new Boat('aircraft'),
		};
	}
}

const sendPlaceBoat = (ws, boatName, row, col, vertical) => sendInstruction(ws, 'placeBoat', { boatName, vertical, row, col });

const handlePlaceBoat = (ws, playerId, boatName, row, col, vertical) => {
	const game = GAME_LIST.getPlayerGame(playerId);
	if (!game)
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

const sendDestroyPosition = (ws, playerId, row, col, success) => {
	const msg = JSON.stringify({
		type: 'gameInstruction',
		instruction: 'destroyPosition',
		playerId,
		row,
		col,
		success
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
		type: 'gameInstruction',
		instruction: 'revealPosition',
		playerId,
		boatName,
		slot,
		row,
		col,
		vertical,
		hasMine,
		hasShield,
		isDestroyed,
	});
	ws.send(msg);
};

const sendAttack = (ws, playerId, row, col, success) => sendInstruction(ws, 'attack', { playerId, row, col, success });

const sendPlayerWin = (ws, playerId) => {
	const msg = JSON.stringify({
		type: 'gameInstruction',
		instruction: 'playerWin',
		playerId,
	});
	ws.send(msg);
};

const sendPointsUpdate = (ws, points) => {
	const msg = JSON.stringify({
		type: 'gameInstruction',
		instruction: 'pointsUpdate',
		points,
	});
	ws.send(msg);
};

// Placing Shield - Sent to every player
// instruction: 'healPosition'
// playerSlot: number 0 - 3
// row: string A - J
// col: string 1 - 10
const sendHealPosition = (ws, row, col) => {
	const game = Game.getGameFromWebsocket(ws);
	assert(game !== undefined);
	game.players.forEach((player) => {
		player.websocket.send(
			JSON.stringify({
				type: 'instruction',
				instruction: 'destroyPosition',
				playerSlot,
				row,
				col,
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
			type: 'instruction',
			instruction: 'placeShield',
			row,
			col,
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
			type: 'instruction',
			instruction: 'placeMine',
			row,
			col,
		}),
	);
};



const sendNewHost = (ws, playerId) => {
	const msg = JSON.stringify({
		type: 'lobbyInstruction',
		instruction: 'newHost',
		playerId,
	});
	ws.send(msg);
};



const sendSuccess = (ws, text) => {
	console.log(`SUCCESS: ${text}`);
	ws.send(
		JSON.stringify({
			type: 'success',
			text,
		}),
	);
};

const sendError = (ws, text) => {
	console.log(`ERROR: ${text}`);
	ws.send(
		JSON.stringify({
			type: 'error',
			text,
		}),
	);
};

const handleLeaveGame = (ws, gameId, playerId) => {
	console.assert(ws, 'ERROR: websocket somehow not here');

	// Validate playerId & gameId
	if (!isValidString(playerId)) return sendError(ws, 'playerId is empty');
	if (!isValidString(gameId)) return sendError(ws, 'gameId is empty');

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

const sendPlayerDisconnect = (ws, playerId) => sendInstruction(ws, 'playerDisconnect', { playerId });

const handleDisconnectGame = (ws, gameId, playerId) => {
	if (!isValidString(playerId)) return sendError(ws, 'playerId is empty');
	if (!isValidString(gameId)) return sendError(ws, 'gameId is empty');
	if (!GAME_LIST.isPlayerInGame(playerId))
		return sendError(ws, `player ${playerId} not in a game`);

	const game = GAME_LIST.getGame(gameId);
	if (!game) return sendError(ws, `No game ${gameId} found`);
	if (!game.getPlayer(playerId))
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
	console.assert(ws, 'Websocket somehow not here');

	if (!isValidString(playerId)) return sendError(ws, 'playerId is empty');
	if (!isValidString(gameId)) return sendError(ws, 'gameId is empty');

	if (!Game.isPlayerInGame(playerId))
		return sendError(ws, `player ${playerId} not in a game`);

	const game = gameList[gameId];
	if (game === undefined) return sendError(ws, `no game ${gameId} found`);
	if (!game.isPlayerHost(playerId))
		return sendError(ws, `${playerId} is not host of ${gameId}`);

	game.deleteGame();
	sendSuccess(ws, `${playerId} has deleted ${gameId}`);
};

const handleWebsocketDisconnect = (ws) => {
	if (!GAME_LIST.isWebsocketInGame(ws))
		return console.log('INFO: a websocket disconnected without being in a game',);

	const game = GAME_LIST.getWebsocketGame(ws);
	for (const player of game.getOnlinePlayers())
		if (player.websocket === ws)
			return handleDisconnectGame(ws, game.id, player.id);
};

const BASE_PATH = './client';

const reqHandler = async (req) => {
	let filePath = BASE_PATH + new URL(req.url).pathname;
	let fileSize;
	try {
		fileSize = (await Deno.stat(filePath)).size;
	} catch (e) {
		if (e instanceof Deno.errors.NotFound) {
			filePath = './client/index.html';
			fileSize = (await Deno.stat(filePath)).size;
		} else
			return new Response(null, { status: 500 });

	}
	if (filePath === './client/') {
		filePath = './client/index.html';
		fileSize = (await Deno.stat(filePath)).size;
	}
	const body = (await Deno.open(filePath)).readable;
	let fileType;
	if (filePath.endsWith('html')) fileType = 'text/html';
	if (filePath.endsWith('css')) fileType = 'text/css';
	if (filePath.endsWith('js')) fileType = 'text/javascript';
	if (filePath.endsWith('png')) fileType = 'image/png';
	return new Response(body, {
		headers: {
			'content-length': fileSize.toString(),
			'content-type': fileType || 'application/octet-stream',
		},
	});
};

Deno.serve({ port: '8000', hostname: '127.0.0.1' }, (req) => {
	if (req.headers.get('upgrade') !== 'websocket')
		return reqHandler(req);

	const { socket, response } = Deno.upgradeWebSocket(req);
	socket.addEventListener('open', () => {
		console.log('CONNECTION: A new client connected!');
	});

	socket.addEventListener('message', (event) => {
		let ev;
		try {
			ev = JSON.parse(event.data);
		} catch {
			return console.log('data not valid jsondata:' + event.data);
		}

		return INSTRUCTION_HANDLER.handleInstruction(socket, ev);
	});

	socket.addEventListener('close', () => handleWebsocketDisconnect(socket));

	return response;
});
