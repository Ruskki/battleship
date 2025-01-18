/**
 * @param {Array} array
 * @returns {any}
 */
function pickRandom(array) {
	return array[Math.floor(Math.random() * array.length)];
}

/**
 * @param {WebSocket} ws
 * @param {string} instruction
 * @param {any} data
 * @returns {void}
 */
function sendInstruction(ws, instruction, data) {
	console.log(`SEND: ${instruction}, data: ${JSON.stringify(data)}`);
	const msg = JSON.stringify({
		type: 'instruction',
		instruction,
		...data,
	});
	ws.send(msg);
}

/**
 * @param {WebSocket} ws
 * @param {string} gameId
 * @returns {void}
 */
function sendCreateGame(ws, gameId) {
	sendInstruction(ws, 'createGame', { gameId });
}

/**
 * @param {WebSocket} ws
 * @returns {void}
 */
function handleCreateGame(ws) {
	const newGame = GAME_LIST.createGame();
	sendCreateGame(ws, newGame.id);
}

/**
 * @param {WebSocket} ws
 * @param {string} playerId
 * @param {string} gameId
 * @returns {void}
 */
function sendPlayerJoin(ws, playerId, gameId) {
	sendInstruction(ws, 'joinGame', { playerId, gameId });
}

/**
 * @param {WebSocket} ws
 * @param {object} ev
 * @param {string} ev.playerId
 * @param {string} ev.gameId
 * @returns {void}
 */
function handleJoinGame(ws, { playerId, gameId }) {
	if (!isValidString(playerId)) return sendError(ws, 'playerId is empty');
	if (!isValidString(gameId)) return sendError(ws, 'gameId is empty');

	const game = GAME_LIST.getGame(gameId);
	if (!game) return sendError(ws, `no game ${gameId} found`);
	if (game.isFull())
		return sendError(ws, `Cannot join game ${gameId} because it's full`);

	const otherGame = GAME_LIST.getPlayerGame(playerId);
	if (otherGame && otherGame !== game) otherGame.removePlayer(playerId);

	if (
		GAME_LIST.getPlayerGame(playerId) &&
		GAME_LIST.getPlayer(playerId).isOnline()
	)
		return sendError(
			ws,
			`Player ${playerId} already connected to ${gameId} from somewhere else`,
		);

	const newPlayer = game.addNewPlayer(ws, playerId);

	sendPlayerJoin(newPlayer.websocket, newPlayer.id, game.id); // Hey me, I joined
	for (const player of game
		.getOnlinePlayers()
		.filter((/** @type {Player} */ x) => x !== newPlayer)) {
		sendPlayerJoin(player.websocket, newPlayer.id, game.id); // Hey old, new joined
		sendPlayerJoin(newPlayer.websocket, player.id, game.id); // Hey new, old is here
	}

	if (game.canStart()) sendGameReady(game.getHost().websocket);

	sendSuccess(ws, `Player ${playerId} joined game ${gameId}`);
}

/**
 * @param {WebSocket} ws
 * @param {object} ev
 * @param {string} ev.playerId
 * @returns {void}
 */
function handleGetBoats(ws, { playerId }) {
	const player = GAME_LIST.getPlayer(playerId);
	if (!player) return sendError(ws, `Player ${playerId} not found in a game`);

	for (const boat of player.boats.filter(
		(/** @type {Boat} */ boat) => boat.placed,
	))
		sendPlaceBoat(
			ws,
			boat,
			boat.positions[0].row,
			boat.positions[0].col,
			boat.positions[0].vertical,
		);
}

/**
 * @param {WebSocket} ws
 * @param {object} ev
 * @param {string} ev.gameId
 * @returns {void}
 */
function handleGetReadyPlayers(ws, { gameId }) {
	const game = GAME_LIST.getGame(gameId);
	if (!game) return sendError(ws, `Game ${gameId} not found`);
	for (const p of game.getReadyPlayers()) sendPlayerReady(ws, p.id);
}

/**
 * @param {WebSocket} ws
 * @param {object} ev
 * @param {string} ev.playerId
 * @returns {void}
 */
function handleGetReadyStatus(ws, { playerId }) {
	const player = GAME_LIST.getPlayer(playerId);
	if (!player) return sendError(ws, `Player ${playerId} not found`);

	if (player.ready) return sendPlayerReady(ws, playerId);
	sendPlayerUnready(ws, playerId);
}

/**
 * @param { WebSocket} ws
 * @param {string} playerId
 * @returns {void}
 */
function sendPlayerReady(ws, playerId) {
	sendInstruction(ws, 'playerReady', { playerId });
}

/**
 * @param {WebSocket} ws
 * @param {object} ev
 * @param {string} ev.playerId
 * @returns {void}
 */
function handlePlayerReady(ws, { playerId }) {
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

	if (game.canStart()) sendGameReady(game.getHost().websocket);

	sendSuccess(ws, `${playerId} has readied up`);
}

/**
 * @param {WebSocket} ws
 * @param {string} playerId
 * @returns {void}
 */
function sendPlayerUnready(ws, playerId) {
	sendInstruction(ws, 'playerUnready', { playerId });
}

/**
 * @param {WebSocket} ws
 * @param {object} ev
 * @param {string} ev.playerId
 * @returns {void}
 */
function handlePlayerUnready(ws, { playerId }) {
	if (!isValidString(playerId)) return sendError(ws, 'playerId is empty');
	if (!GAME_LIST.isPlayerInGame(playerId))
		return sendError(ws, `Player ${playerId} not in a game`);

	const game = GAME_LIST.getPlayerGame(playerId);
	const player = game.getPlayer(playerId);

	player.boats.forEach((/** @type {Boat} */ boat) => {
		boat.positions.forEach((pos) => pos.removeBoat());
	});

	player.ready = false;

	for (const player of game.players)
		sendPlayerUnready(player.websocket, playerId);
	if (!game.canStart()) sendGameUnready(game.getHost().websocket);

	sendSuccess(ws, `${playerId} has unreadied`);
}

/**
 * @param {WebSocket} ws
 * @returns {void}
 */
function sendGameReady(ws) {
	sendInstruction(ws, 'gameReady');
}

/**
 * @param {WebSocket} ws
 * @returns {void}
 */
function sendGameUnready(ws) {
	sendInstruction(ws, 'gameUnready');
}

/**
 * @param {WebSocket} ws
 * @param {string} playerId
 * @param {number} turnNumber
 * @returns {void}
 */
function sendTurnOfPlayer(ws, playerId, turnNumber) {
	sendInstruction(ws, 'turnOfPlayer', { playerId, turnNumber });
}

/**
 * @param {WebSocket} ws
 * @param {object} ev
 * @param {string} ev.gameId
 * @returns {void}
 */
function handleGetTurnOf(ws, { gameId }) {
	const game = GAME_LIST.getGame(gameId);
	sendTurnOfPlayer(ws, game.turnOf.id, game.turnNumber);
}

/**
 * @param {WebSocket} ws
 * @returns {void}
 */
function sendStartGame(ws) {
	sendInstruction(ws, 'startGame');
}

/**
 * @param {WebSocket} ws
 * @param {object} ev
 * @param {string} ev.gameId
 * @param {string} ev.playerId
 * @returns {void}
 */
function handleStartGame(ws, { gameId, playerId }) {
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

	for (const player of game.getOnlinePlayers()) sendStartGame(player.websocket);

	sendSuccess(ws, `${playerId} has started ${gameId}`);
}

/**
 * @param {WebSocket} ws
 * @param {object} ev
 * @param {string} ev.userId
 * @param {string} ev.targetId
 * @param {string} ev.row
 * @param {string} ev.col
 * @returns {void}
 */
function handleAttackPosition(ws, { userId, targetId, row, col }) {
	if (!isValidString(userId)) return sendError(ws, 'ERROR: userId is empty');
	if (!GAME_LIST.isPlayerInGame(userId))
		return sendError(ws, `ERROR: ${userId} is not in a game`);

	if (!isValidString(targetId))
		return sendError(ws, 'ERROR: targetId is empty');
	if (!GAME_LIST.isPlayerInGame(targetId))
		return sendError(ws, `ERROR: ${targetId} is not in a game`);

	const game = GAME_LIST.getPlayerGame(userId);
	if (!game.getPlayer(targetId))
		return sendError(ws, `${targetId} is not in the same game as ${userId}`);

	game.attackPlayer(userId, targetId, row, col);
}

/**
 * @param {WebSocket} ws
 * @param {string} playerId
 * @param {string} tourneyId
 * @returns {void}
 */
function sendJoinTourney(ws, playerId, tourneyId) {
	sendInstruction(ws, 'joinTourney', { playerId, tourneyId });
}

/**
 * @param {WebSocket} ws
 * @param {string} playerId
 * @param {string} tourneyId
 * @returns {void}
 */
function sendLeaveTourney(ws, playerId, tourneyId) {
	sendInstruction(ws, 'leaveTourney', { playerId, tourneyId });
}

/**
 * @param {WebSocket} ws
 * @param {object} ev
 * @param {string} ev.playerId
 * @returns {void}
 */
function handleCreateTourney(ws, { playerId }) {
	const tourney = TOURNEY_LIST.createTourney();
	sendJoinTourney(ws, playerId, tourney.id);
}

/**
 * @param {WebSocket} ws
 * @param {object} ev
 * @param {string} ev.playerId
 * @param {string} ev.tourneyId
 * @returns {void}
 */
function handleJoinTourney(ws, { playerId, tourneyId }) {
	const tourney = TOURNEY_LIST.getTourney(tourneyId);
	if (!tourney) return sendError(ws, `No tourney ${tourneyId} found`);

	if (tourney.getOnlinePlayers().length >= Tourney.playerLimit)
		return sendError(ws, `Cannot join ${tourneyId} because it's full!`);

	tourney.addPlayer(ws, playerId);
	sendJoinTourney(ws, playerId, tourney.id);
	for (const player of tourney.getOnlinePlayers()) {
		sendJoinTourney(ws, player.id, tourney.id);
		sendJoinTourney(player.websocket, playerId, tourney.id);
	}
}

/**
 * @param {WebSocket} ws
 * @param {object} ev
 * @param {string} ev.playerId
 * @param {string} ev.tourneyId
 * @returns {void}
 */
function handleDisconnectTourney(ws, { playerId, tourneyId }) {
	const tourney = TOURNEY_LIST.getTourney(tourneyId);
	if (!tourney) return sendError(ws, `Tourney ${tourneyId} not found`);

	const disconnectingPlayer = tourney.findPlayer(playerId);
	if (!disconnectingPlayer)
		return sendError(ws, `Player ${playerId} not found in ${tourneyId}`);

	tourney.disconnectPlayer(playerId);

	for (const player of tourney.getOnlinePlayers())
		sendPlayerDisconnect(player.websocket, disconnectingPlayer.id);
}

/**
 * @param {WebSocket} ws
 * @param {object} ev
 * @param {string} ev.playerId
 * @param {string} ev.tourneyId
 * @returns {void}
 */
function handleStartTourney(ws, { playerId, tourneyId }) {
	const tourney = TOURNEY_LIST.getTourney(tourneyId);
	if (!tourney) return sendError(ws, `Tourney ${tourneyId} not found`);

	const startPlayer = tourney.findPlayer(playerId);
	if (!startPlayer)
		return sendError(ws, `Player ${playerId} not found in ${tourneyId}`);

	if (tourney.playersInGames.length > 0)
		return sendError(ws, 'Some players are still in games');

	tourney.start();
}

/**
 * @param {WebSocket} ws
 * @param {object} ev
 * @param {string} ev.userId
 * @param {string} ev.targetId
 * @returns {void}
 */
function handleUseSonar(ws, {userId, targetId}) {
	if (!isValidString(userId)) return sendError(ws, 'ERROR: userId is empty');
	if (!GAME_LIST.isPlayerInGame(userId))
		return sendError(ws, `ERROR: ${userId} is not in a game`);

	if (!isValidString(targetId)) return sendError(ws, 'ERROR: targetId is empty');
	if (!GAME_LIST.isPlayerInGame(targetId))
		return sendError(ws, `ERROR: ${targetId} is not in a game`);

	const game = GAME_LIST.getPlayerGame(userId);
	if (!game.getPlayer(targetId))
		return sendError(ws, `${targetId} is not in the same game as ${userId}`);

	game.sonar(userId, targetId);
};

/**
 * @param {WebSocket} ws
 * @param {object} ev
 * @param {string} ev.userId
 * @param {string} ev.targetId
 * @returns {void}
 */
function handleUseAirplane(ws, {userId, targetId}) {
	if (!isValidString(userId)) return sendError(ws, 'ERROR: userId is empty');
	if (!GAME_LIST.isPlayerInGame(userId))
		return sendError(ws, `ERROR: ${userId} is not in a game`);

	if (!isValidString(targetId)) return sendError(ws, 'ERROR: targetId is empty');
	if (!GAME_LIST.isPlayerInGame(targetId))
		return sendError(ws, `ERROR: ${targetId} is not in a game`);

	const game = GAME_LIST.getPlayerGame(userId);
	if (!game.getPlayer(targetId))
		return sendError(ws, `${targetId} is not in the same game as ${userId}`);

	game.attackAirplane(userId, targetId);
};

/**
 * @param {WebSocket} ws
 * @param {object} ev
 * @param {string} ev.userId
 * @param {string} ev.row
 * @param {string} ev.col
 * @returns {void}
 */
function handleUseMine(ws, {userId, row, col}) {
	if (!isValidString(userId)) return sendError(ws, 'ERROR: userId is empty');
	if (!GAME_LIST.isPlayerInGame(userId))
		return sendError(ws, `ERROR: ${userId} is not in a game`);

	const game = GAME_LIST.getPlayerGame(userId);

	game.mine(userId, row, col);
};

/**
 * @param {WebSocket} ws
 * @returns {void}
 */
function handlePowerActivateQuickFix(ws) {
	const game = GAME_LIST.getWebsocketGame(ws);
	if (!game) return sendError(ws, 'Websocket not in a game :(');
	const player = GAME_LIST.getWebsocketPlayer(ws);
	if (!player) return sendError(ws, 'Websocket is not assigned to a player');
	if (!game.getPlayer(player.id))
		return sendError(ws, `${player.id} not in ${game.id}`);
	game.activateQuickFix(player.id);
}

/**
 * @param {WebSocket} ws
 * @param {object} ev
 * @param {string} ev.row
 * @param {string} ev.col
 * @returns {void}
 */
function handleUseQuickFix(ws, { row, col }) {
	const game = GAME_LIST.getWebsocketGame(ws);
	if (!game) return sendError(ws, 'Websocket not in a game :(');
	const player = GAME_LIST.getWebsocketPlayer(ws);
	if (!player) return sendError(ws, 'Websocket is not assigned to a player');
	if (!game.getPlayer(player.id))
		return sendError(ws, `${player.id} not in ${game.id}`);
	game.useQuickFix(player.id, row, col);
}

/**
 * @param {WebSocket} ws
 * @returns {void}
 */
function handlePowerEMP(ws) {
	const game = GAME_LIST.getWebsocketGame(ws);
	if (!game) return sendError(ws, 'Websocket not in a game :(');
	const player = GAME_LIST.getWebsocketPlayer(ws);
	if (!player) return sendError(ws, 'Websocket is not assigned to a player');
	if (!game.getPlayer(player.id))
		return sendError(ws, `${player.id} not in ${game.id}`);
	game.useEMP(player.id);
}

/**
 * @param {WebSocket} ws
 * @param {object} ev
 * @param {string} ev.row
 * @param {string} ev.col
 * @returns {void}
 */
function handlePowerShield(ws, { row, col }) {
	const game = GAME_LIST.getWebsocketGame(ws);
	if (!game) return sendError(ws, 'Websocket not in a game :(');
	const player = GAME_LIST.getWebsocketPlayer(ws);
	if (!player) return sendError(ws, 'Websocket is not assigned to a player');
	if (!game.getPlayer(player.id))
		return sendError(ws, `${player.id} not in ${game.id}`);
	game.usePowerShield(player.id, row, col);
}

/**
 * @param {WebSocket} ws
 * @param {object} ev
 * @param {string} ev.gameId
 * @returns {void}
 */
function handleGetHost(ws, { gameId }) {
	const game = GAME_LIST.getGame(gameId);
	if (!game) return sendError(ws, `No game ${gameId} found`);

	sendGetHost(ws, game.getHost().id);
}

/**
 * @param {WebSocket} ws
 * @param {string} row
 * @param {string} col
 * @returns {void}
 */
function sendPlaceShield(ws, row, col) {
	sendInstruction(ws, 'powerPlaceShield', { row, col });
}

/**
 * @param {WebSocket} ws
 * @param {string} row
 * @param {string} col
 * @returns {void}
 */
function sendRemoveShield(ws, row, col) {
	sendInstruction(ws, 'powerRemoveShield', { row, col });
}

/**
 * @param {WebSocket} ws
 * @returns {void}
 */
function sendActivatePowerups(ws) {
	sendInstruction(ws, 'activatePowerups');
}

/**
 * @param {WebSocket} ws
 * @returns {void}
 */
function sendDeactivatePowerups(ws) {
	sendInstruction(ws, 'deactivatePowerups');
}

/**
 * @param {WebSocket} ws
 * @returns {void}
 */
function sendActivateQuickFix(ws) {
	sendInstruction(ws, 'activateQuickFix');
}

/**
 * @param {WebSocket} ws
 * @returns {void}
 */
function sendDeactivateQuickFix(ws) {
	sendInstruction(ws, 'deactivateQuickFix');
}

/**
 * @param {WebSocket} ws
 * @param {string} playerId
 * @param {string} row
 * @param {string} col
 * @returns {void}
 */
function sendHealPosition(ws, playerId, row, col) {
	sendInstruction(ws, 'healPosition', { playerId, row, col });
}

class InstructionHandler {
	#instructions = {
		createGame: {
			handle: handleCreateGame,
		},
		joinGame: {
			handle: handleJoinGame,
		},
		getBoats: {
			handle: handleGetBoats,
		},
		getReadyPlayers: {
			handle: handleGetReadyPlayers,
		},
		getReadyStatus: {
			handle: handleGetReadyStatus,
		},
		playerReady: {
			handle: handlePlayerReady,
		},
		playerUnready: {
			handle: handlePlayerUnready,
		},
		startGame: {
			handle: handleStartGame,
		},
		getTurnOf: {
			handle: handleGetTurnOf,
		},
		getHost: {
			handle: handleGetHost,
		},
		attackPosition: {
			handle: handleAttackPosition,
		},
		createTourney: {
			handle: handleCreateTourney,
		},
		joinTourney: {
			handle: handleJoinTourney,
		},
		startTourney: {
			handle: handleStartTourney,
		},
		placeBoat: {
			handle: handlePlaceBoat,
		},
		'useSonar': {
			handle: handleUseSonar
		},
		'useAttackAirplanes': {
			handle: handleUseAirplane
		},
		'usePlantMine': {
			handle: handleUseMine
		},
		powerShield: {
			handle: handlePowerShield,
		},
		powerActivateQuickFix: {
			handle: handlePowerActivateQuickFix,
		},
		powerUseQuickFix: {
			handle: handleUseQuickFix,
		},
		powerEMP: {
			handle: handlePowerEMP,
		},
	};

	/**
	 *	@param {WebSocket} ws
	 *	@param {any} ev
	 *	@returns {void}
	 */
	handleInstruction = (ws, ev) => {
		const instruction = this.#instructions[ev.instruction];
		if (!instruction)
			return sendError(ws, `Instruction ${ev.instruction} not found`);
		console.log(`HANDLE: ${ev.instruction} data: ${JSON.stringify(ev)}`);
		instruction.handle(ws, ev);
	};
}

const INSTRUCTION_HANDLER = new InstructionHandler();

const BoatEnum = {
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

/**
 * @param {string} str
 * @returns {boolean}
 */
function isValidString(str) {
	return !!(str ?? '').length;
}

class TourneyList {
	/** @type {{[key: string]: Tourney}} #tourneys */
	#tourneys = {};
	get tourneys() {
		return Object.values(this.#tourneys);
	}

	/** @type {{[key: string]: number}} */
	#medals = {};

	/**
	 * @param {string} playerId
	 * @returns {void}
	 */
	registerWin(playerId) {
		if (playerId in this.#medals) this.#medals[playerId] += 1;
		else this.#medals[playerId] = 1;
	}

	/**
	 * @param {string} id
	 * @returns {Tourney}
	 */
	getTourney(id) {
		return this.#tourneys[id];
	}

	#generateTourneyId() {
		let id;
		while (!id || !!this.#tourneys[id])
			id = Math.random().toString(32).slice(2, 8).toString();
		return id;
	}

	createTourney = () => {
		const id = this.#generateTourneyId();
		const tourney = new Tourney(id);
		this.#tourneys[id] = tourney;
		return tourney;
	};
}

class Tourney {
	static playerLimit = 4;

	/** @type {string} id */
	#id;
	get id() {
		return this.#id;
	}

	/** @type {boolean} started */
	#started = false;
	get started() {
		return this.#started;
	}

	/** @type {Player[]} #playerList */
	#playerList = [];
	get players() {
		return this.#playerList;
	}

	/** @type {{ player: Player, game: Game }[]} */
	#playersInGames = [];
	get playersInGames() {
		return this.#playersInGames;
	}

	/**
	 * @param {string} id
	 * @returns {void}
	 */
	playerWin(id) {
		const p = this.#playersInGames
			.splice(
				this.#playersInGames.findIndex((p) => p.player.id === id),
				1,
			)
			.at(0);
		this.#playerList.push(p.player);
	}

	/**
	 * @param {string} id
	 * @returns {void}
	 */
	playerLose(id) {
		this.#playersInGames.splice(
			this.#playersInGames.findIndex((p) => p.player.id === id),
			1,
		);
	}

	/**
	 * @param {string} id
	 * @returns {Player}
	 */
	findPlayer(id) {
		return this.#playerList.find((p) => p.id === id);
	}

	/** @returns {Player[]} */
	getOnlinePlayers() {
		return this.#playerList.filter((p) => p.websocket);
	}

	/** @returns {void} */
	removeOfflinePlayer() {
		this.#playerList.forEach((_, i) => {
			if (this.#playerList[i].websocket) return;
			return this.#playerList.splice(i, 1);
		});
	}

	/**
	 * @param {string} id
	 * @returns {void}
	 */
	disconnectPlayer(id) {
		const player = this.findPlayer(id);
		if (!player) return;

		player.disconnect();
	}

	/**
	 * @param {WebSocket} ws
	 * @param {Player} player
	 * @returns {Player}
	 */
	reconnectPlayer(ws, player) {
		player.reconnect(ws);
		return player;
	}

	/**
	 * @param {WebSocket} ws
	 * @param {string} playerId
	 * @returns {Player}
	 */
	addPlayer(ws, playerId) {
		const p = this.findPlayer(playerId);
		if (p) return this.reconnectPlayer(ws, p);

		if (this.players.length !== this.getOnlinePlayers().length)
			this.removeOfflinePlayer();

		const player = new Player(playerId, ws);
		this.#playerList.push(player);
		console.log(this.#playerList.map((x) => x.id).length);
		return player;
	}

	/** @type {boolean} */
	#lastGame;
	get lastGame() {
		return this.#lastGame;
	}

	/** @returns {void} */
	nextRound() {
		while (this.players.length > 0) {
			const [playerOne, playerTwo] = this.#playerList.splice(0, 2);
			if (playerOne && playerTwo) {
				const game = GAME_LIST.createTourneyGame(
					`${this.id}-${playerOne.id}-${playerTwo.id}`,
					this,
				);
				game.addPlayer(playerOne);
				game.addPlayer(playerTwo);
				for (const player of game.players) {
					sendPlayerJoin(player.websocket, player.id, game.id);
					this.#playersInGames.push({ player, game });
				}

				if (this.players.length === 0 && this.playersInGames.length === 2) {
					console.log('LAST GAME');
					this.#lastGame = true;
				}
			} else {
				console.log('NOT ENOUGH PLAYERS');
				break;
			}
		}
	}

	/** @returns {void} */
	start() {
		this.#started = true;

		this.nextRound();
	}

	/** @param {string} id */
	constructor(id) {
		this.#id = id;
		this.#started = false;
	}
}

const TOURNEY_LIST = new TourneyList();

class GameList {
	/** @type {{socket: WebSocket, game: Game}[]} */
	#websockets = [];

	/**
	 * @param {WebSocket} ws
	 * @returns {boolean}
	 */
	isWebsocketInGame(ws) {
		return this.#websockets.some((x) => x.socket === ws);
	}

	/**
	 * @param {WebSocket} ws
	 * @returns {Game}
	 */
	getWebsocketGame(ws) {
		return this.#websockets.find((x) => x.socket === ws).game;
	}

	/**
	 * @param {WebSocket} ws
	 * @returns {Player}
	 */
	getWebsocketPlayer(ws) {
		return this.#websockets
			.find((x) => x.socket === ws)
			.game.players.find((x) => x.websocket === ws);
	}

	/**
	 * @param {WebSocket} ws
	 * @param {Game} gameObj
	 * @returns {void}
	 */
	registerWebsocket(ws, gameObj) {
		this.#websockets.push({ socket: ws, game: gameObj });
	}

	/**
	 * @param {WebSocket} ws
	 * @returns {void}
	 */
	removeWebsocket(ws) {
		this.#websockets.splice(
			this.#websockets.findIndex((x) => x.socket === ws),
			1,
		);
	}

	/** @type {{[key: string]: Game}} */
	#players = {};

	/**
	 * @param {string} id
	 * @returns {Player}
	 */
	getPlayer(id) {
		return this.getPlayerGame(id)?.getPlayer(id);
	}

	/**
	 * @param {string} id
	 * @returns {boolean}
	 */
	isPlayerInGame(id) {
		return id in this.#players;
	}

	/**
	 * @param {string} id
	 * @returns {Game}
	 */
	getPlayerGame(id) {
		return this.#players[id];
	}

	/**
	 * @param {string} id
	 * @param {Game} gameObj
	 * @returns {void}
	 */
	registerPlayer(id, gameObj) {
		this.#players[id] = gameObj;
	}

	/**
	 * @param {string} id
	 * @returns {void}
	 */
	deregisterPlayer(id) {
		delete this.#players[id];
	}

	/** @returns {string} */
	#generateGameId() {
		let id;
		while (!id || !!this.#gameList[id])
			id = Math.random().toString(32).slice(2, 8).toString();
		return id;
	}

	/** @type {{[key: string]: Game}} */
	#gameList = {};
	get gameList() {
		return Object.values(this.#gameList);
	}

	/** @returns {Game} */
	createGame() {
		const game = new Game(this.#generateGameId());
		this.#gameList[game.id] = game;
		return game;
	}

	/**
	 * @param {string} id
	 * @param {Tourney} tourney
	 * @returns {Game}
	 */
	createTourneyGame(id, tourney) {
		const game = new Game(id, tourney);
		this.#gameList[game.id] = game;
		return game;
	}

	/**
	 * @param {string} id
	 * @returns {Game}
	 */
	getGame(id) {
		return this.#gameList[id];
	}

	/**
	 * @param {string} id
	 * @returns {void}
	 */
	removeGame(id) {
		delete this.#gameList[id];
	}

	/** @type {GameList} */
	static #instance;

	constructor() {
		if (GameList.#instance) return GameList.#instance;
		GameList.#instance = this;
		return this;
	}
}

const GAME_LIST = new GameList();

class Game {
	/**
	 * @param {string} id
	 * @param {Tourney} tourney
	 */
	constructor(id, tourney = undefined) {
		this.#id = id;
		this.#tourney = tourney;
	}

	/** @type {string} */
	#id;
	get id() {
		return this.#id;
	}

	/** @type {Player[]} */
	#players = [];
	get players() {
		return this.#players;
	}

	/** @type {Tourney} */
	#tourney;
	get tourney() {
		return this.#tourney;
	}

	/**
	 * @param {string} id
	 * @returns {Player}
	 */
	getPlayer(id) {
		return this.players.find((p) => p.id === id);
	}

	/** @returns {Player[]} */
	getReadyPlayers() {
		return this.players.filter((p) => p.ready);
	}

	/** @returns {Player[]} */
	getOnlinePlayers() {
		return this.players.filter((x) => x.websocket ?? undefined !== undefined);
	}

	/**
	 * @param {string} id
	 * @returns {number}
	 */
	#playerIndex(id) {
		return this.players.findIndex((x) => x.id === id);
	}

	/** @type {Player} */
	#turnOf;
	get turnOf() {
		return this.#turnOf;
	}

	nextTurn = () => {
		this.turnNumber += 1;

		for (const pos of this.turnOf.board.getShieldPositions()) {
			pos.countDownShield();
			if (!pos.hasShield())
				sendRemoveShield(this.turnOf.websocket, pos.row, pos.col);
		}

		for (const player of this.players.filter((p) => p.disabled)) {
			player.disabledCountdown();
			if (!player.disabled && player.isOnline())
				sendActivatePowerups(player.websocket);
		}

		let idx = (this.#playerIndex(this.turnOf.id) + 1) % this.players.length;
		// Skip turn of offline players
		while (this.players[idx].websocket === undefined)
			idx = (idx + 1) % this.players.length;
		this.#turnOf = this.players[idx];

		for (const player of this.getOnlinePlayers())
			sendTurnOfPlayer(player.websocket, this.turnOf.id, this.turnNumber);
	};

	turnNumber = 0;

	#started = false;
	get started() {
		return this.#started;
	}

	/** @returns {boolean} */
	canStart() {
		return (
			!this.#started &&
			this.getOnlinePlayers().length > 1 &&
			this.getOnlinePlayers().every((p) => p.ready)
		);
	}

	/** @type {number} */
	#selfDestroyTimer;

	/**
	 * @param {string} id
	 * @returns {boolean}
	 */
	isPlayerHost(id) {
		return this.players.indexOf(this.getPlayer(id)) === 0;
	}

	/** @returns {Player} */
	getHost() {
		return this.players.at(0);
	}

	/**
	 * @param {Player} player
	 * @returns {void}
	 */
	addPlayer(player) {
		const p = this.getPlayer(player.id);
		if (p) {
			this.#reconnectPlayer(player.websocket, p);
			return;
		}

		if (this.isFull()) return;

		if (this.#selfDestroyTimer) {
			clearTimeout(this.#selfDestroyTimer);
			this.#selfDestroyTimer = undefined;
			console.log(`World Saved ${this.id}`);
		}

		this.players.push(player);
		GAME_LIST.registerWebsocket(player.websocket, this);
		GAME_LIST.registerPlayer(player.id, this);
	}

	/**
	 * @param {WebSocket} ws
	 * @param {string} id
	 * @returns {Player}
	 */
	addNewPlayer(ws, id) {
		const player = this.getPlayer(id);
		if (player) return this.#reconnectPlayer(ws, player);

		if (this.isFull()) return;

		if (this.#selfDestroyTimer) {
			clearTimeout(this.#selfDestroyTimer);
			this.#selfDestroyTimer = undefined;
			console.log(`World Saved ${this.id}`);
		}

		const newPlayer = new Player(id, ws);
		this.players.push(newPlayer);
		GAME_LIST.registerWebsocket(ws, this);
		GAME_LIST.registerPlayer(id, this);
		return newPlayer;
	}

	/**
	 * @param {WebSocket} newWebsocket
	 * @param {Player} player
	 * @returns {Player}
	 */
	#reconnectPlayer(newWebsocket, player) {
		player.reconnect(newWebsocket);
		GAME_LIST.registerWebsocket(newWebsocket, this);

		if (this.#selfDestroyTimer) {
			clearTimeout(this.#selfDestroyTimer);
			this.#selfDestroyTimer = undefined;
			console.log(`World Saved ${this.id}`);
		}

		return player;
	}

	/**
	 * @param {string} id
	 * @returns {void}
	 */
	disconnectPlayer(id) {
		const player = this.getPlayer(id);

		GAME_LIST.removeWebsocket(player.websocket);
		player.disconnect();

		if (this.#playerIndex(id) === 0) this.players.push(this.players.shift());

		if (!this.players.some((x) => x.websocket)) {
			this.#selfDestroyTimer = setTimeout(() => {
				this.deleteGame();
			}, 30000);
			console.log(`Everyone's gone from ${this.id}, self destroying...`);
		}
	}

	/**
	 * @param {string} id
	 * @returns {void}
	 */
	removePlayer(id) {
		const idx = this.#playerIndex(id);
		if (idx === -1) return;

		const player = this.getPlayer(id);
		GAME_LIST.removeWebsocket(player.websocket);
		GAME_LIST.deregisterPlayer(player.id);

		this.players.splice(this.#playerIndex(id), 1);

		if (this.players.length > 0) return;

		this.#selfDestroyTimer = setTimeout(() => {
			this.deleteGame();
		}, 5000);
	}

	/** @returns {void} */
	deleteGame() {
		this.players.forEach((_, idx) => {
			GAME_LIST.removeWebsocket(this.players[idx]?.websocket);
			GAME_LIST.deregisterPlayer(this.players[idx].id);
			delete this.players[idx];
		});

		GAME_LIST.removeGame(this.id);
	}

	/** @returns {boolean} */
	isFull() {
		if (this.#started) return this.players.length === 4;
		return this.getOnlinePlayers().length === 4;
	}

	/** @returns {void} */
	startGame() {
		this.#started = true;

		// Remove offline, but not removed players
		this.#players = this.getOnlinePlayers();

		this.#turnOf = this.players[0];
	}

	/**
	 * @param {string} id
	 * @param {string} row
	 * @param {string} col
	 * @returns {void}
	 */
	#destroyPosition(id, row, col) {
		const target = this.getPlayer(id);
		const pos = target.board.getPosition(row, col);

		pos.destroy();
		for (const player of this.getOnlinePlayers())
			sendAttack(player.websocket, target.id, pos.row, pos.col, !!pos.boatName);
	}

	/**
	 * @param {string} idFrom
	 * @param {string} idTo
	 * @param {string} row
	 * @param {string} col
	 * @returns {void}
	 */
	attackPlayer(idFrom, idTo, row, col) {
		const user = this.getPlayer(idFrom);
		const target = this.getPlayer(idTo);

		if (user === target)
			return sendError(user.websocket, 'Can\'t attack own board!');
		if (user !== this.turnOf)
			return sendError(user.websocket, 'It\'s not your turn');

		const pos = target.board.getPosition(row, col);

		if (pos.hasMine) {
			pickRandom(user.board.getAdyacentPositions(row, col)).destroy();
			target.points += 5;
			this.nextTurn();
			return;
		}

		if (pos.hasShield()) {
			sendSuccess(user.websocket, 'Your attack was blocked');
			sendSuccess(target.websocket, 'You blocked an attack');
			this.nextTurn();
			return;
		}

		if (pos.destroyed) {
			sendError(user.websocket, 'This position is already destroyed!');
			return;
		}

		this.#destroyPosition(target.id, pos.row, pos.col);
		this.nextTurn();

		if (pos.boatName === undefined) return;

		user.points += 5;

		if (!target.boats.some((boat) => !boat.destroyed)) {
			target.defeated = true;
			if (this.players.filter((p) => !p.defeated).length === 1) {
				if (this.tourney && this.tourney.lastGame) {
					TOURNEY_LIST.registerWin(user.id);
					for (const player of this.getOnlinePlayers())
						sendPlayerWin(player.websocket, user.id);
				} else if (this.tourney) {
					this.tourney.playerWin(user.id);
					user.reset();
					sendJoinTourney(user.websocket, user.id, this.tourney.id);

					this.tourney.playerLose(target.id);
					sendLeaveTourney(target.websocket, target.id, this.tourney.id);
				} else
					for (const player of this.getOnlinePlayers())
						sendPlayerWin(player.websocket, user.id);
				handleDeleteGame(this.getHost().websocket, {
					gameId: this.id,
					playerId: this.getHost().id,
				});
			}
		}
	}

	/**
	 * @param {string} idFrom
	 * @param {string} idTo
	 * @returns {void}
	 */
	sonar(idFrom, idTo) {
		const user = this.getPlayer(idFrom);

		if(user.points < 5)
			return sendError(user.websocket, 'You dont have enought points for this powerup!');
		if(user.getBoat('submarine').destroyed)
			return sendError(user.websocket, 'Submarine has been destroyed!');

		const target = this.getPlayer(idTo);
		pickRandom(Object.values(target.board.positions).filter((x) => !x.destroyed,))?.makeVisible();

		user.points = user.points - 5;
	}

	/**
	 * @param {string} idFrom
	 * @param {string} idTo
	 * @returns {void}
	 */
	attackAirplane(idFrom, idTo) {
		const user = this.getPlayer(idFrom);

		if(user.points < 10)
			return sendError(user.websocket, 'You dont have enought points for this powerup!');
		if(user.getBoat('aircraft').destroyed)
			return sendError(user.websocket, 'Aircraft has been destroyed!');

		const target = this.getPlayer(idTo);

		const validPositions = Object.values(target.board.positions).filter((x) => !x.destroyed,);

		for (let _ = 0; _ < 5; _++) {
			const pos = pickRandom(validPositions);
			this.attackPlayer(idFrom, idTo, pos.row, pos.col);
			validPositions.splice(validPositions.indexOf(pos), 1);
			if (validPositions.length === 0) break;
		}
		user.points = user.points - 10;
	}

	/**
	 * @param {string} idFrom
	 * @param {string} row
	 * @param {string} col
	 * @returns {void}
	 */
	mine(idFrom, row, col) {
		const user = this.getPlayer(idFrom);

		if(user.points < 5)
			return sendError(user.websocket, 'You dont have enought points for this powerup!');

		const pos = user.board.getPosition(row, col);
		if (pos.boatName !== undefined)
			return sendError(user.websocket, 'There is a boat in this spot.');
		if (pos.hasMine)
			return sendError(user.websocket, 'Position already has mine.');

		pos.plantMine();

		user.points = user.points - 5;
	}

	/**
	 * @param {string} id
	 * @param {string} row
	 * @param {string} col
	 * @returns {void}
	 */
	usePowerShield(id, row, col) {
		const player = this.getPlayer(id);
		if (!player) return;
		if (player.points < 15)
			return sendError(player.websocket, 'You don\'t have enough points to use the Shield :(');

		if (player.onQuickFix)
			return sendError(player.websocket, 'Finish using quickfix mode first!');
		if (player.disabled)
			return sendError(player.websocket, 'You\'re being disabled by an EMP attack!');

		if (!player.board.getPosition(row, col))
			return sendError(
				player.websocket,
				`${row},${col} is not a valid position`,
			);
		const area = player.board.getArea(row, col);
		for (const pos of area) {
			pos.placeShield();
			sendPlaceShield(player.websocket, pos.row, pos.col);
		}

		player.points -= 15;
	}

	/**
	 * @param {string} id
	 * @returns {void}
	 */
	activateQuickFix(id) {
		const player = this.getPlayer(id);
		if (!player) return;
		if (player.points < 10)
			return sendError(player.websocket, 'You don\'t have enough points to use the EMP :(');

		if (player.onQuickFix)
			return sendError(player.websocket, 'You\'re already using quick fix!');
		if (player.disabled)
			return sendError(player.websocket, 'You\'re being disabled by an EMP attack!');

		// Look for boats that haven't been destroyed or healed yet
		const boats = player.boats.filter(boat => !boat.destroyed && !boat.wasHealed);
		if (boats.length === 0)
			return sendError(player.websocket, 'All boats are either destroyed or already healed!');

		player.onQuickFix = true;

		sendActivateQuickFix(player.websocket);
	}

	/**
	 * @param {string} id
	 * @param {string} row
	 * @param {string} col
	 * @returns {void}
	 */
	useQuickFix(id, row, col) {
		const player = this.getPlayer(id);
		if (!player) return;
		if (player.points < 10)
			return sendError(player.websocket, 'You don\'t have enough points to use the EMP :(');

		if (!player.onQuickFix)
			return sendError(player.websocket, 'You\'re not currently using QuickFix!');
		if (player.disabled)
			return sendError(player.websocket, 'You\'re being disabled by an EMP attack!');

		const pos = player.board.getPosition(row, col);
		if (!pos)
			return sendError(player.websocket, `${row},${col} is not a valid position!`);

		const boat = player.getBoat(pos.boatName);
		if (pos.boatName === undefined)
			return sendError(player.websocket, `The position ${row},${col} doesn't have a boat!`);
		if (boat.destroyed)
			return sendError(player.websocket, `Cannot heal the ${boat.name} because it's completely destroyed!`);
		if (boat.wasHealed)
			return sendError(player.websocket, `Cannot heal the ${boat.name} because it's already been healed!`);
		if (!pos.destroyed)
			return sendError(player.websocket, `Cannot heal the ${row},${col} because it's not destroyed!`);
		if (player.healingBoat && player.healingBoat !== boat)
			return sendError(player.websocket, `Cannot heal two different boats (Keep healing the ${player.healingBoat.name})!`);

		pos.heal();

		// If the healing boat is already defined, it means this is the second usage of quickfix
		// on the other hand
		// If the boat we're healing does not have any more positions to heal, also end
		if (player.healingBoat || !boat.getDestroyedPositions().length) {
			player.finishQuickfix();
			sendDeactivateQuickFix(player.websocket);
		} else
			player.healingBoat = boat;

		for (const p of this.getOnlinePlayers())
			sendHealPosition(p.websocket, player.id, pos.row, pos.col);
	}

	/**
	 * @param {string} id
	 * @returns {void}
	 */
	useEMP(id) {
		const player = this.getPlayer(id);
		if (!player) return;
		if (player.points < 25)
			return sendError(
				player.websocket,
				'You don\'t have enough points to use the EMP :(',
			);

		if (player.onQuickFix)
			return sendError(player.websocket, 'Finish using quickfix mode first!');
		if (player.disabled)
			return sendError(player.websocket, 'You\'re being disabled by an EMP attack!');

		for (const p of this.players.filter((x) => x !== player)) p.disable();

		for (const p of this.getOnlinePlayers().filter((x) => x !== player))
			sendDeactivatePowerups(p.websocket);
		sendSuccess(player.websocket, 'Everyone is disabled now :)');

		player.points -= 25;
	}
}

class BoardPosition {
	/** @type {boolean} */
	#revealed = false;
	get revealed() {
		return this.#revealed;
	}

	/** @type {number} */
	#shieldCounter = 0;
	hasShield() {
		return this.#shieldCounter > 0;
	}

	/** @type {boolean} */
	#hasMine = false;
	get hasMine() {
		return this.#hasMine;
	}

	/** @type {boolean} */
	#destroyed = false;
	get destroyed() {
		return this.#destroyed;
	}

	/** @type {string} */
	#boat;
	get boatName() {
		return this.#boat;
	}

	/** @type {boolean} */
	#vertical;
	get vertical() {
		return this.#vertical;
	}

	/** @type {number} */
	#slot;
	get slot() {
		return this.#slot;
	}

	/**
	 * @param {string} boat
	 * @param {number} slot
	 * @param {boolean} vertical
	 * @returns {void}
	 */
	placeBoat(boat, slot, vertical) {
		this.#boat = boat;
		this.#vertical = vertical;
		this.#slot = slot;
	}

	/** @returns {void} */
	removeBoat() {
		this.#boat = undefined;
		this.#vertical = undefined;
		this.#slot = undefined;
	}

	/** @returns {void} */
	destroy() {
		this.#destroyed = true;
	}

	/** @returns {void} */
	heal() {
		this.#destroyed = false;
	}

	/** @returns {void} */
	reveal() {
		this.#revealed = true;
	}

	/** @returns {void} */
	placeShield() {
		this.#shieldCounter += 3;
	}

	/** @returns {void} */
	countDownShield() {
		this.#shieldCounter--;
	}

	/** @returns {void} */
	plantMine() {
		this.#hasMine = true;
	}

	/**
	 * @param {string} row
	 * @param {string} col
	 * @param {Player} owner
	 */
	constructor(row, col, owner) {
		this.row = row; // Row A - J
		this.col = col; // Col 1 - 10
		this.owner = owner; // Player object
	}
}

class Board {
	/** @type {string[]} */
	static #rows = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J'];
	/** @type {string[]} */
	static #cols = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10'];

	/** @type {{[key: string]: BoardPosition}} */
	#positions = {};
	get positions() {
		return Object.values(this.#positions);
	}

	/**
	 * @param {string} row
	 * @param {string} col
	 * @returns {BoardPosition}
	 */
	getPosition(row, col) {
		return this.#positions[`${row},${col}`];
	}

	/**
	 * @param {string} row
	 * @param {string} col
	 * @param {number} size
	 * @returns {BoardPosition[]}
	 */
	getSliceHorizontal(row, col, size) {
		return Board.#cols
			.slice(Board.#cols.indexOf(col), Board.#cols.indexOf(col) + size)
			.map((x) => this.getPosition(row, x));
	}

	/**
	 * @param {string} row
	 * @param {string} col
	 * @param {number} size
	 * @returns {BoardPosition[]}
	 */
	getSliceVertical(row, col, size) {
		return Board.#rows
			.slice(Board.#rows.indexOf(row), Board.#rows.indexOf(row) + size)
			.map((x) => this.getPosition(x, col));
	}

	/**
	 * @param {string} row
	 * @param {string} col
	 * @returns {BoardPosition[]}
	 */
	getArea(row, col) {
		const minRow = Math.max(0, Board.#rows.indexOf(row) - 1);
		const maxRow = Math.min(Board.#rows.length, Board.#rows.indexOf(row) + 2);
		const minCol = Math.max(0, Board.#cols.indexOf(col) - 1);
		const maxCol = Math.min(Board.#cols.length, Board.#cols.indexOf(col) + 2);

		return Board.#rows
			.slice(minRow, maxRow)
			.map((r) =>
				Board.#cols.slice(minCol, maxCol).map((c) => this.getPosition(r, c)),
			)
			.flat(); // Transforms from 3 arrays of 3 to 1 array of 9
	}

	/**
	 * @param {string} row
	 * @param {string} col
	 * @returns {BoardPosition[]}
	 */
	getAdyacentPositions(row, col) {
		const minRow = Math.max(0, Board.#rows.indexOf(row) - 1);
		const maxRow = Math.min(Board.#cols.length, Board.#rows.indexOf(row) + 2);
		const minCol = Math.max(0, Board.#cols.indexOf(col) - 1);
		const maxCol = Math.min(Board.#cols.length, Board.#cols.indexOf(col) + 2);

		return Board.#rows
			.slice(minRow, maxRow)
			.map((r) =>
				Board.#cols.slice(minCol, maxCol).map((c) => {
					if (r === row && c === col) return;
					return this.getPosition(r, c);
				}),
			)
			.flat() // Transforms from 3 arrays of 3 to 1 array of 9
			.filter((x) => x); // This last step filters the undefined out
	}

	getShieldPositions() {
		return this.positions.filter((p) => p.hasShield());
	}

	/** @returns {void} */
	#createBoard() {
		for (const r of Board.#rows)
			for (const c of Board.#cols)
				this.#positions[`${r},${c}`] = new BoardPosition(r, c, this.owner);
	}

	/** @param {Player} playerObj */
	constructor(playerObj) {
		this.owner = playerObj;
		this.#createBoard();
	}
}

class Boat {
	/** @type {BoardPosition[]} */
	#positions = [];
	get positions() {
		return this.#positions;
	}
	set positions(val) {
		this.#positions = val;
	}

	getDestroyedPositions() {
		return this.positions.filter(x => x.destroyed);
	}

	/** @type {boolean} */
	#wasHealed = false;
	get wasHealed() {
		return this.#wasHealed;
	}
	set wasHealed(val) {
		this.#wasHealed = this.#wasHealed || val;
	}

	get placed() {
		return this.#positions.length > 0;
	}

	get destroyed() {
		return this.#positions.every((pos) => pos.destroyed);
	}

	/** @param {string} name */
	constructor(name) {
		this.name = name;
	}
}

class Player {
	/** @type {{destroyer: Boat, submarine: Boat, cruise: Boat, battleship: Boat, aircraft: Boat}} */
	#boats;
	get boats() {
		return Object.values(this.#boats);
	}

	/**
	 * @param {string} name
	 * @returns {Boat}
	 */
	getBoat(name) {
		return this.#boats[name];
	}

	/**
	 * @param {BoatEnum} boatEnum
	 * @param {string} row
	 * @param {string} col
	 * @param {boolean} vertical
	 * @returns {void}
	 */
	placeBoat(boatEnum, row, col, vertical) {
		const positions = vertical
			? this.board.getSliceVertical(row, col, boatEnum.size)
			: this.board.getSliceHorizontal(row, col, boatEnum.size);

		if (positions.length !== boatEnum.size)
			return sendError(this.websocket, 'boat too big');
		if (positions.some((pos) => pos.boatName !== undefined))
			return sendError(this.websocket, 'boat in the way');

		const boat = this.getBoat(boatEnum.name);
		if (boat.placed)
			return sendError(
				this.websocket,
				`${boatEnum.name} already placed for ${this.id}`,
			);

		boat.positions = positions;
		boat.positions.forEach((pos, idx) =>
			pos.placeBoat(boatEnum.name, idx + 1, vertical),
		);
	}

	refreshBoard() {
		// TODO: Make a function that sends information about all modified slots
		// This includes ships, destroyed slots, etc
	}

	/** @returns {boolean} */
	canReady() {
		return !this.boats.some((b) => !b.placed);
	}

	/** @returns {void} */
	readyUp() {
		this.ready = true;
	}

	/** @returns {boolean} */
	isOnline() {
		return !!this.websocket;
	}

	/** @type {string} */
	#id;
	get id() {
		return this.#id;
	}

	/** @type {WebSocket} */
	#websocket;
	get websocket() {
		return this.#websocket;
	}

	/**
	 * @param {WebSocket} websocket
	 * @returns {void}
	 */
	reconnect(websocket) {
		this.#websocket = websocket;
	}

	/** @returns {void} */
	disconnect() {
		this.#websocket = undefined;
	}

	/** @type {Board} */
	#board;
	get board() {
		return this.#board;
	}

	/** @type {number} */
	#points = 0;
	get points() {
		return this.#points;
	}
	set points(val) {
		this.#points = val;
		sendPointsUpdate(this.websocket, this.#points);
	}

	/** @type {boolean} */
	#onQuickFix;
	get onQuickFix() {
		return this.#onQuickFix;
	}
	set onQuickFix(val) {
		this.#onQuickFix = val;
	}

	/** @type {Boat} */
	#healingBoat;
	get healingBoat() {
		return this.#healingBoat;
	}
	set healingBoat(val) {
		if (this.#healingBoat && val) console.warn('WARNING: Reassigning healing boat when NOT undefined');
		this.#healingBoat = val;
	}

	finishQuickfix() {
		this.#onQuickFix = false;
		this.#healingBoat.wasHealed = true;
		this.#healingBoat = undefined;
	}

	/** @type {number} */
	#disabled = 0;
	get disabled() {
		return this.#disabled > 0;
	}
	disable() {
		this.#disabled = 3;
	}
	disabledCountdown() {
		this.#disabled--;
	}

	reset() {
		this.#board = new Board(this);

		this.ready = false;
		this.defeated = false;

		this.#boats = {
			destroyer: new Boat('destroyer'),
			submarine: new Boat('submarine'),
			cruise: new Boat('cruise'),
			battleship: new Boat('battleship'),
			aircraft: new Boat('aircraft'),
		};
	}

	/**
	 * @param {string} id
	 * @param {WebSocket} websocket
	 */
	constructor(id, websocket) {
		this.#id = id;
		this.#websocket = websocket;
		this.#board = new Board(this);

		this.ready = false;
		this.defeated = false;

		this.#boats = {
			destroyer: new Boat('destroyer'),
			submarine: new Boat('submarine'),
			cruise: new Boat('cruise'),
			battleship: new Boat('battleship'),
			aircraft: new Boat('aircraft'),
		};
	}
}

/**
 * @param {WebSocket} ws
 * @param {Boat} boatName
 * @param {string} row
 * @param {string} col
 * @param {boolean} vertical
 * @returns {void}
 */
function sendPlaceBoat(ws, boatName, row, col, vertical) {
	sendInstruction(ws, 'placeBoat', { boatName, vertical, row, col });
}

/**
 * @param {WebSocket} ws
 * @param {object} ev
 * @param {string} ev.playerId
 * @param {string} ev.boatName
 * @param {string} ev.row
 * @param {string} ev.col
 * @param {boolean} ev.vertical
 * @returns {void}
 */
function handlePlaceBoat(ws, { playerId, boatName, row, col, vertical }) {
	const game = GAME_LIST.getPlayerGame(playerId);
	if (!game)
		return sendError(ws, `player ${playerId} is not currently in a game`);

	const player = game.getPlayer(playerId);

	if (!game.started) {
		player.placeBoat(BoatEnum[boatName], row, col, vertical);
		return sendSuccess(
			ws,
			`placed ${boatName} at ${row},${col} in player's ${playerId} board`,
		);
	}
	sendError(
		ws,
		`game ${game.id} started, unable to place boat for player ${playerId}`,
	);
}

/**
 * @param {WebSocket} ws
 * @param {string} playerId
 * @param {string} row
 * @param {string} col
 * @param {boolean} success
 * @returns {void}
 */
function sendDestroyPosition(ws, playerId, row, col, success) {
	const msg = JSON.stringify({
		type: 'gameInstruction',
		instruction: 'destroyPosition',
		playerId,
		row,
		col,
		success,
	});
	ws.send(msg);
}

/**
 * @param {WebSocket} ws
 * @param {string} playerId
 * @param {string} boatName
 * @param {number} slot
 * @param {string} row
 * @param {string} col
 * @param {boolean} vertical
 * @param {boolean} hasMine
 * @param {boolean} hasShield
 * @param {boolean} isDestroyed
 * @returns {void}
 */
function sendRevealPosition(
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
) {
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
}

/**
 * @param {WebSocket} ws
 * @param {string} playerId
 * @param {string} row
 * @param {string} col
 * @param {boolean} success
 * @returns {void}
 */
function sendAttack(ws, playerId, row, col, success) {
	sendInstruction(ws, 'attack', { playerId, row, col, success });
}

/**
 * @param {WebSocket} ws
 * @param {string} playerId
 * @returns {void}
 */
function sendPlayerWin(ws, playerId) {
	sendInstruction(ws, 'playerWin', { playerId });
}

/**
 * @param {WebSocket} ws
 * @param {number} points
 * @returns {void}
 */
function sendPointsUpdate(ws, points) {
	const msg = JSON.stringify({
		type: 'gameInstruction',
		instruction: 'pointsUpdate',
		points,
	});
	ws.send(msg);
}

/**
 * @param {WebSocket} ws
 * @param {string} hostId
 * @returns {void}
 */
function sendGetHost(ws, hostId) {
	sendInstruction(ws, 'getHost', { hostId });
}

/**
 * @param {WebSocket} ws
 * @param {string} text
 * @returns {void}
 */
function sendSuccess(ws, text) {
	console.log(`SUCCESS: ${text}`);
	ws.send(
		JSON.stringify({
			type: 'success',
			text,
		}),
	);
}

/**
 * @param {WebSocket} ws
 * @param {string} text
 * @returns {void}
 */
function sendError(ws, text) {
	console.log(`ERROR: ${text}`);
	ws.send(
		JSON.stringify({
			type: 'error',
			text,
		}),
	);
}

/**
 * @param {WebSocket} ws
 * @param {object} ev
 * @param {string} ev.gameId
 * @param {string} ev.playerId
 * @returns {void}
 */
function handleLeaveGame(ws, { gameId, playerId }) {
	// Validate playerId & gameId
	if (!isValidString(playerId)) return sendError(ws, 'playerId is empty');
	if (!isValidString(gameId)) return sendError(ws, 'gameId is empty');

	// Check if player is in a game
	if (!GAME_LIST.isPlayerInGame(playerId))
		return sendError(ws, `player ${playerId} not in a game`);

	const game = GAME_LIST.getGame(gameId);
	if (!game) return sendError(ws, `no game ${gameId} found`);

	const player = game.getPlayer(playerId);
	if (!player) return sendError(ws, `${playerId} not found in ${gameId}`);

	game.removePlayer(playerId);

	for (const player of game.getOnlinePlayers())
		sendPlayerDisconnect(player.websocket, playerId);

	sendSuccess(ws, `removed ${playerId} from game ${gameId}`);
}

/**
 * @param {WebSocket} ws
 * @param {string} playerId
 * @returns {void}
 */
function sendPlayerDisconnect(ws, playerId) {
	sendInstruction(ws, 'playerDisconnect', { playerId });
}

/**
 * @param {WebSocket} ws
 * @param {object} ev
 * @param {string} ev.gameId
 * @param {string} ev.playerId
 * @returns {void}
 */
function handleDisconnectGame(ws, { gameId, playerId }) {
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
	for (const player of game.getOnlinePlayers())
		sendPlayerDisconnect(player.websocket, playerId);

	sendSuccess(ws, `disconnected ${playerId} from game ${gameId}`);
}

/**
 * @param {WebSocket} ws
 * @param {object} ev
 * @param {string} ev.gameId
 * @param {string} ev.playerId
 * @returns {void}
 */
function handleDeleteGame(ws, { gameId, playerId }) {
	if (!isValidString(playerId)) return sendError(ws, 'playerId is empty');
	if (!isValidString(gameId)) return sendError(ws, 'gameId is empty');

	if (!GAME_LIST.isPlayerInGame(playerId))
		return sendError(ws, `player ${playerId} not in a game`);

	const game = GAME_LIST.getGame(gameId);
	if (game === undefined) return sendError(ws, `no game ${gameId} found`);
	if (!game.isPlayerHost(playerId))
		return sendError(ws, `${playerId} is not host of ${gameId}`);

	game.deleteGame();
	sendSuccess(ws, `${playerId} has deleted ${gameId}`);
}

/**
 * @param {WebSocket} ws
 * @returns {void}
 */
function handleWebsocketDisconnect(ws) {
	for (const tourney of TOURNEY_LIST.tourneys)
		for (const player of tourney.getOnlinePlayers())
			if (player.websocket === ws)
				return handleDisconnectTourney(ws, {
					tourneyId: tourney.id,
					playerId: player.id,
				});

	if (!GAME_LIST.isWebsocketInGame(ws))
		return console.log(
			'INFO: a websocket disconnected without being in a game',
		);

	const game = GAME_LIST.getWebsocketGame(ws);
	for (const player of game.getOnlinePlayers())
		if (player.websocket === ws)
			return handleDisconnectGame(ws, { gameId: game.id, playerId: player.id });
}

const BASE_PATH = './client';

/**
 * @param {Request} req
 * @returns {Promise<Response>}
 */
async function reqHandler(req) {
	let filePath = BASE_PATH + new URL(req.url).pathname;
	let fileSize;
	try {
		// @ts-ignore
		fileSize = (await Deno.stat(filePath)).size;
	} catch (e) {
		// @ts-ignore
		if (e instanceof Deno.errors.NotFound) {
			filePath = './client/index.html';
			// @ts-ignore
			fileSize = (await Deno.stat(filePath)).size;
		} else return new Response(null, { status: 500 });
	}
	if (filePath === './client/') {
		filePath = './client/index.html';
		// @ts-ignore
		fileSize = (await Deno.stat(filePath)).size;
	}
	// @ts-ignore
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
}

// @ts-ignore
Deno.serve(
	{ port: '8000', hostname: '127.0.0.1' },
	(/** @type {Request} */ req) => {
		if (req.headers.get('upgrade') !== 'websocket') return reqHandler(req);

		/** @type { {socket: WebSocket, response: Response} } */
		// @ts-ignore
		const { socket, response } = Deno.upgradeWebSocket(req);

		socket.addEventListener('open', (_) => {
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
	},
);
