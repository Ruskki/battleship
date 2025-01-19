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

const websocket = new WebSocket('ws://127.0.0.1:8000');

const urlString = window.location.href;
const url = new URL(urlString);

const gameId = url.searchParams.get('gameId');
const playerId = url.searchParams.get('playerId');

document.addEventListener('keydown', function(e) {
	if (e.code === 'Enter')
		Game.webAttackPlayer(playerId, selectedPlayer, selectedRow, selectedCol);
});

websocket.addEventListener('open', () => {
	const msg = JSON.stringify({
		type: 'instruction',
		instruction: 'joinGame',
		gameId,
		playerId,
	});
	websocket.send(msg);
});

const attackBtn = document.getElementById('attack-button');
const sonarBtn = document.getElementById('sonar-button');
const airplanesBtn = document.getElementById('airplanes-button');
const mineBtn = document.getElementById('mine-button');
const shieldBtn = document.getElementById('shield-button');
const missileBtn = document.getElementById('missile-button');
const quickfixBtn = document.getElementById('quickfix-button');
const empBtn = document.getElementById('emp-button');

const powerupBtns = [
	sonarBtn,
	airplanesBtn,
	mineBtn,
	shieldBtn,
	missileBtn,
	quickfixBtn,
	empBtn,
];


/**
 * @param {object} ev
 * @param {string} ev.playerId
 * @returns {void}
 */
function handlePlayerWin({ playerId }) {
	window.location.href = `./winner.html?winnerId=${playerId}`;
}

/**
 * @param {string} playerId
 * @param {string} row
 * @param {string} col
 * @returns {void}
 */
function handleDestroyPosition(playerId, row, col) {
	const player = Game.getPlayer(playerId);
	if (!player) return;
	player.board.getPosition(row, col).destroy();
}

/**
 * @param {object} ev
 * @param {string} ev.playerId
 * @param {number} ev.turnNumber
 * @returns {void}
 */
function handleTurnOfPlayer({playerId, turnNumber}) {
	$turnOfPlayer.innerText = playerId;
	$turnNumber.innerText = turnNumber;
}

/**
 * @param {string} newPoints
 * @returns {void}
 */
function handleUpdatePoints(newPoints) {
	$pointsEl.innerText = newPoints;
}

/**
 * @param {string} pId
 * @returns {void}
 */
function handleJoinGame(pId) {
	const player = Game.getPlayer(pId);
	if (player) {
		player.connected = true;
		player.$playerName.innerText = pId;
	}

	const msg = JSON.stringify({
		type: 'instruction',
		instruction: 'refreshBoard',
		playerId,
		otherId: pId,
	});
	websocket.send(msg);

	showSuccess(`${pId} has connected!`);
	Game.addPlayer(pId);
}

/**
 * @param {string} playerId
 * @returns {void}
 */
function handleDisconnectGame(playerId) {
	const player = Game.getPlayer(playerId);
	if (!player) return;

	player.connected = false;
	player.$playerName.innerText = playerId + ' DISCONNECTED';
	showError(`${playerId} has disconnected!`);
}

/**
 * @param {string} boatName
 * @param {string} row
 * @param {string} col
 * @param {boolean} vertical
 * @returns {void}
 */
function handlePlaceBoat(boatName, row, col, vertical) {
	const player = Game.getPlayer(playerId);
	player.placeBoat(Boats[boatName], row, col, vertical);
}

/**
 * @param {string} playerId
 * @param {string} row
 * @param {string} col
 * @param {boolean} success
 * @returns {void}
 */
function handleAttackPosition(playerId, row, col, success) {
	const player = Game.getPlayer(playerId);
	if (!player) return;

	const pos = player.board.getPosition(row, col);
	if (!pos) return;

	pos.destroy(success);
}

/**
 * @param {object} ev
 * @param {string} ev.playerId
 * @param {string} ev.tourneyId
 * @returns {void}
 */
function handleJoinTourney({ playerId, tourneyId }) {
	window.location.href = `./tourney_lobby.html?playerId=${playerId}&tourneyId=${tourneyId}`;
}

/**
 * @returns {void}
 */
function handleLeaveTourney() {
	window.location.href = '/index.html';
}

/**
 * @param {object} ev
 * @param {string} ev.row
 * @param {string} ev.col
 * @returns {void}
 */
function handlePlaceMine({ row, col }) {
	const player = Game.getPlayer(playerId);
	if (!player) return;
	const pos = player.board.getPosition(row, col);
	if (!pos) return;
	pos.plantMine();
}

/**
 * @param {object} ev
 * @param {string} ev.row
 * @param {string} ev.col
 * @returns {void}
 */
function handleRemoveMine({ row, col }) {
	const player = Game.getPlayer(playerId);
	if (!player) return;
	const pos = player.board.getPosition(row, col);
	if (!pos) return;
	pos.removeMine();
}

/**
 * @param {object} ev
 * @param {string} ev.row
 * @param {string} ev.col
 * @returns {void}
 */
function handlePowerPlaceShield({ row, col }) {
	const player = Game.getPlayer(playerId);
	if (!player) return;
	const pos = player.board.getPosition(row, col);
	if (!pos) return;
	pos.shield();
}

/**
 * @param {object} ev
 * @param {string} ev.row
 * @param {string} ev.col
 * @returns {void}
 */
function handlePowerRemoveShield({ row, col }) {
	const player = Game.getPlayer(playerId);
	if (!player) return;
	const pos = player.board.getPosition(row, col);
	if (!pos) return;
	pos.unshield();
}

/**
 * @returns {void}
 */
function handleDeactivatePowerups() {
	sonarBtn.innerText = '[DISABLED] Sonar';
	airplanesBtn.innerText = '[DISABLED] Attack Airplanes';
	mineBtn.innerText = '[DISABLED] Marine Mine';
	shieldBtn.innerText = '[DISABLED] Defensive Shield';
	missileBtn.innerText = '[DISABLED] Cruise Missile';
	quickfixBtn.innerText = '[DISABLED] Quick Fix';
	empBtn.innerText = '[DISABLED] EMP Attack';

	for (const btn of powerupBtns) btn.classList.add('disabled');
}

/**
 * @returns {void}
 */
function handleActivateQuickFix() {
	attackBtn.innerText = 'Heal';
	attackBtn.removeEventListener('click', attackButtonListener);
	attackBtn.addEventListener('click', healButtonListener);
}

/**
 * @returns {void}
 */
function handleDeactivateQuickFix() {
	attackBtn.innerText = 'Attack';
	attackBtn.removeEventListener('click', healButtonListener);
	attackBtn.addEventListener('click', attackButtonListener);
}

/**
 * @param {object} ev
 * @param {string} ev.playerId
 * @param {string} ev.row
 * @param {string} ev.col
 * @returns {void}
 */
function handleHealPosition({ playerId, row, col }) {
	const player = Game.getPlayer(playerId);
	if (!player) return;
	const pos = player.board.getPosition(row, col);
	if (!pos) return;
	pos.heal();
}

/**
 * @param {object} ev
 * @param {string} ev.playerId
 * @param {string} ev.row
 * @param {string} ev.col
 * @returns {void}
 */
function handleRevealPosition({ playerId, row, col }) {
	const player = Game.getPlayer(playerId);
	if (!player) return;
	const pos = player.board.getPosition(row, col);
	if (!pos) return;
	pos.reveal();
}

/**
 * @param {object} ev
 * @param {number} ev.cooldown
 * @returns {void}
 */
function handleEmpCooldown({ cooldown }) {
	if (empBtn.classList.contains('disabled')) return;
	empBtn.innerText = `[${cooldown ? cooldown : 'Ready!'}] EMP Attack (25)`;
}

/**
 * @param {object} ev
 * @param {number} ev.cooldown
 * @returns {void}
 */
function handleCruiseCooldown({ cooldown }) {
	if (missileBtn.classList.contains('disabled')) return;
	missileBtn.innerText = `[${cooldown ? cooldown : 'Ready!'}] Cruise Missile (15)`;
}


/**
 * @param {object} ev
 * @param {number} ev.cruiseCooldown
 * @param {number} ev.empCooldown
 * @returns {void}
 */
function handleActivatePowerups({ cruiseCooldown, empCooldown }) {
	for (const btn of powerupBtns)
		btn.classList.remove('disabled');

	sonarBtn.innerText = 'Sonar (5)';
	airplanesBtn.innerText = 'Attack Airplanes (10)';
	mineBtn.innerText = 'Marine Mine (5)';
	shieldBtn.innerText = 'Defensive Shield (15)';
	quickfixBtn.innerText = 'Quick Fix (10)';
	handleCruiseCooldown({ cooldown: cruiseCooldown });
	handleEmpCooldown({ cooldown: empCooldown });
}

websocket.addEventListener('message', (event) => {
	let ev;
	try {
		ev = JSON.parse(event.data);
	} catch (e) {
		console.error(e);
		return;
	}

	if (ev.type === 'success') return showSuccess(ev.text);

	if (ev.type === 'error') return showError(ev.text);

	if (ev.type === 'instruction') {
		if (ev.instruction === 'playerWin') handlePlayerWin(ev);
		if (ev.instruction === 'destroyPosition')
			handleDestroyPosition(ev.playerId, ev.row, ev.col);
		if (ev.instruction === 'turnOfPlayer') handleTurnOfPlayer(ev);
		if (ev.instruction === 'attack')
			handleAttackPosition(ev.playerId, ev.row, ev.col, ev.success);
		if (ev.instruction === 'pointsUpdate') handleUpdatePoints(ev.points);

		if (ev.instruction === 'joinGame') handleJoinGame(ev.playerId);
		if (ev.instruction === 'playerDisconnect')
			handleDisconnectGame(ev.playerId);
		if (ev.instruction === 'placeBoat')
			handlePlaceBoat(ev.boatName, ev.row, ev.col, ev.vertical);
		if (ev.instruction === 'joinTourney') handleJoinTourney(ev);
		if (ev.instruction === 'leaveTourney') handleLeaveTourney(ev);

		if (ev.instruction === 'placeMine') handlePlaceMine(ev);
		if (ev.instruction === 'removeMine') handleRemoveMine(ev);

		if (ev.instruction === 'powerPlaceShield') handlePowerPlaceShield(ev);
		if (ev.instruction === 'powerRemoveShield') handlePowerRemoveShield(ev);

		if (ev.instruction === 'activatePowerups') handleActivatePowerups(ev);
		if (ev.instruction === 'deactivatePowerups') handleDeactivatePowerups(ev);

		if (ev.instruction === 'activateQuickFix') handleActivateQuickFix(ev);
		if (ev.instruction === 'deactivateQuickFix') handleDeactivateQuickFix(ev);
		if (ev.instruction === 'healPosition') handleHealPosition(ev);

		if (ev.instruction === 'revealPosition') handleRevealPosition(ev);

		if (ev.instruction === 'cruiseCooldown') handleCruiseCooldown(ev);
		if (ev.instruction === 'empCooldown') handleEmpCooldown(ev);
	}
});

/**
 * @param {Array} arr
 * @returns {any}
 */
function pickRandom(arr) {
	arr[Math.floor(Math.random() * arr.length)];
}

let selectedRow = 'A';
let selectedCol = '1';
let selectedPlayer = undefined;

const $turnNumber = document.getElementById('turn-number');
const $turnOfPlayer = document.getElementById('turn-of-player');
const $pointsEl = document.getElementById('player-points');

const $logMessagesEl = document.getElementById('log-messages');

/**
 *
 * @param {string} text
 * @returns {void}
 */
function showSuccess(text) {
	$logMessagesEl.className = 'success-message';
	$logMessagesEl.innerText = text;
}

/**
 * @param {string} text
 * @returns {void}
 */
function showInformation(text) {
	$logMessagesEl.className = 'information-message';
	$logMessagesEl.innerText = text;
}

/**
 * @param {string} text
 * @returns {void}
 */
function showError(text) {
	$logMessagesEl.className = 'error-message';
	$logMessagesEl.innerText = text;
}

/**
 * @returns {void}
 */
function attackButtonListener() {
	Game.webAttackPlayer(playerId, selectedPlayer, selectedRow, selectedCol);
}

/**
 * @returns {void}
 */
function healButtonListener() {
	Game.webUseQuickFix(selectedRow, selectedCol);
}

attackBtn.addEventListener('click', attackButtonListener);

sonarBtn.addEventListener('click', () => {
	Game.webSonar(playerId, selectedPlayer);
});

airplanesBtn.addEventListener('click', () => {
	Game.webAttackAirplanes(playerId, selectedPlayer);
});

mineBtn.addEventListener('click', () => {
	Game.webPlantMine(playerId, selectedRow, selectedCol);
});

shieldBtn.addEventListener('click', () => {
	Game.webShield(selectedRow, selectedCol);
});

missileBtn.addEventListener('click', () => {
	Game.webCruiseMissile(playerId, selectedPlayer, selectedRow, selectedCol);
});

quickfixBtn.addEventListener('click', () => {
	Game.webActivateQuickFix();
});

empBtn.addEventListener('click', () => {
	Game.webEMP();
});

class Game {
	/** @type {{[key: string]: Player}} */
	static #players = {};
	static get players() {
		return Object.values(this.#players);
	}

	/**
	 * @param {string} id
	 * @returns {Player}
	 */
	static getPlayer(id) {
		return Game.#players[id];
	}

	/**
	 * @param {string} id
	 * @returns {void}
	 */
	static addPlayer(id) {
		if (this.getPlayer(id)) return;
		const $div = document.getElementById(`player-${Game.players.length + 1}`);
		this.#players[id] = new Player(id, $div);
		return this.#players[id];
	};

	static webAttackPlayer(idFrom, idTo, row, col) {
		const user = this.#players[idFrom];
		const target = this.#players[idTo];

		const msg = JSON.stringify({
			type: 'instruction',
			instruction: 'attackPosition',
			userId: user.id,
			targetId: target.id,
			row,
			col,
		});
		websocket.send(msg);
	};

	static webSonar(idFrom, idTo) {
		const user = this.#players[idFrom];
		const target = this.#players[idTo];
		
		const msg = JSON.stringify({
			type: 'gameInstruction',
			instruction: 'useSonar',
			userId: user.id,
			targetId: target.id,
		});
		websocket.send(msg);
	};

	static webAttackAirplanes(idFrom, idTo) {
		const user = this.#players[idFrom];
		const target = this.#players[idTo];
	
		const msg = JSON.stringify({
			type: 'gameInstruction',
			instruction: 'useAttackAirplanes',
			userId: user.id,
			targetId: target.id,
		});
		websocket.send(msg);
	};

	static webPlantMine(idFrom, row, col) {
		const user = this.#players[idFrom];
	
		const msg = JSON.stringify({
			type: 'instruction',
			instruction: 'usePlantMine',
			userId: user.id,
			row,
			col,
		});
		websocket.send(msg);
	};
	
	static webShield(row, col) {
		const msg = JSON.stringify({
			type: 'instruction',
			instruction: 'powerShield',
			row,
			col,
		});
		websocket.send(msg);
	}

	static webCruiseMissile(idFrom, idTo, row, col) {
		const user = this.#players[idFrom];
		const target = this.#players[idTo];

		const msg = JSON.stringify({
			type: 'instruction',
			instruction: 'cruiseMissile',
			userId: user.id,
			targetId: target.id,
			row,
			col,
		});
		websocket.send(msg);
	};

	static webActivateQuickFix() {
		const msg = JSON.stringify({
			type: 'instruction',
			instruction: 'powerActivateQuickFix',
		});
		websocket.send(msg);
	}

	static webUseQuickFix(row, col) {
		const msg = JSON.stringify({
			type: 'instruction',
			instruction: 'powerUseQuickFix',
			row,
			col,
		});
		websocket.send(msg);
	}

	static webEMP() {
		const msg = JSON.stringify({
			type: 'instruction',
			instruction: 'powerEMP',
		});
		websocket.send(msg);
	}
}

class BoardPosition {
	/** @type {HTMLElement} */
	#cell;

	constructor(cell) {
		this.#cell = cell;
	}

	/**
	 * @param {string} boatName
	 * @param {number} slot
	 * @param {boolean} vertical
	 * @returns {void}
	 */
	placeBoat(boatName, slot, vertical) {
		this.#cell.setAttribute('data-boat', `${boatName}-${vertical ? 'v' : 'h'}${slot}`);
	};

	/** @returns {void} */
	plantMine() { this.#cell.setAttribute('data-mine', 'true'); };

	/** @returns {void} */
	removeMine() { this.#cell.removeAttribute('data-mine'); };

	/** @returns {void} */
	shield() { this.#cell.setAttribute('data-shield', 'true'); };

	/** @returns {void} */
	unshield() { this.#cell.removeAttribute('data-shield'); };

	/** @returns {void} */
	heal() { this.#cell.removeAttribute('data-destroyed'); };

	/** @returns {void} */
	reveal() { this.#cell.setAttribute('data-revealed', true); };

	/**
	 * @param {boolean} success
	 * @returns {void}
	 */
	destroy(success = true) {
		if (success) this.#cell.setAttribute('data-destroyed', 'true');
		else this.#cell.setAttribute('data-miss', 'true');
	};
}

class Board {
	static rows = 'ABCDEFGHIJ';
	static cols = '123456789'.split('').concat(['10']);

	positions = {}; // Filled with '1,A' and such

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

	addCell = ($board, row, col) => {
		const cell = document.createElement('div');
		const sum = row + col;

		switch (sum) {
			case '':
				cell.className = 'board-null';
				break;
			case row:
				cell.className = 'board-header-number';
				cell.textContent = row;
				break;
			case col:
				cell.className = 'board-header-letter';
				cell.textContent = col;
				break;
			default:
				cell.className = `board-pos row-${row} col-${col}`;
				cell.addEventListener('click', () => {
					selectedRow = row;
					selectedCol = col;
					selectedPlayer = this.owner.id;
					document.getElementById('target-row').innerText = row;
					document.getElementById('target-col').innerText = col;
					document.getElementById('target-player').innerText = this.owner.id;
				});

				this.positions[`${row},${col}`] = new BoardPosition(cell);
		}

		$board.appendChild(cell);
	};

	createBoard = ($divContainer) => {
		const board = document.createElement('div');
		board.className = 'board';

		this.addCell(board, '', '');
		for (const num of Board.cols) this.addCell(board, '', num);
		for (const c of Board.rows) {
			this.addCell(board, c, '');
			for (const n of Board.cols) this.addCell(board, c, n);
		}
		$divContainer.appendChild(board);
	};

	constructor($divContainer, playerObj) {
		this.owner = playerObj;
		this.createBoard($divContainer, playerObj.id);
	}
}

class Player {
	placeBoat = (boatEnum, row, col, vertical) => {
		const positions = vertical
			? this.board.getSliceVertical(row, col, boatEnum.size)
			: this.board.getSliceHorizontal(row, col, boatEnum.size);

		if (positions.length !== boatEnum.size) return console.log('Boat too big');
		if (positions.some((pos) => pos.boat !== undefined))
			return console.log('Boat in the way');

		positions.forEach((pos, idx) =>
			pos.placeBoat(boatEnum.name, idx + 1, vertical),
		);
	};

	constructor(id, $divContainer) {
		this.id = id;

		this.$playerName = document.createElement('h2');
		this.$playerName.innerText = id;
		$divContainer.appendChild(this.$playerName);

		this.board = new Board($divContainer, this);
		this.connected = true;
	}
}
