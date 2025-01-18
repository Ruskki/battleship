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

/** @returns {void} */
function handlePlayerWinplayerId() {
	const player = Game.players[playerId];
	if (!player) return;
	window.location.href = `./winner.html?winnerId=${playerId}`;
}

/**
 * @param {string} playerId
 * @param {string} row
 * @param {string} col
 * @returns {void}
 */
function handleDestroyPosition(playerId, row, col) {
	const player = Game.players[playerId];
	if (!player) return;
	player.board.getPosition(row, col).destroy();
}

/**
 * @param {string} turnOfId
 * @returns {void}
 */
function handleTurnOfPlayer(turnOfId) {
	$turnOfPlayer.innerText = turnOfId;
	showInformation(`It's the turn of ${turnOfId}`);
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
	const player = Game.players[pId];
	if (player) {
		player.connected = true;
		player.$playerName.innerText = pId;
	}

	if (pId === playerId) {
		const boatMsg = JSON.stringify({
			type: 'instruction',
			instruction: 'getBoats',
			playerId,
		});
		websocket.send(boatMsg);

		const turnMsg = JSON.stringify({
			type: 'instruction',
			instruction: 'getTurnOf',
			gameId,
		});
		websocket.send(turnMsg);
	}

	showSuccess(`${pId} has connected!`);
	Game.addPlayer(pId);
}

/**
 * @param {string} playerId
 * @returns {void}
 */
function handleDisconnectGame(playerId) {
	const player = Game.players[playerId];
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
	Object.values(Game.players)[0].placeBoat(Boats[boatName], row, col, vertical);
}

/**
 * @param {string} playerId
 * @param {string} row
 * @param {string} col
 * @param {boolean} success
 * @returns {void}
 */
function handleAttackPosition(playerId, row, col, success) {
	const player = Game.players[playerId];
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
function handlePowerPlaceShield({ row, col }) {
	const player = Game.players[playerId];
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
	const player = Game.players[playerId];
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

	for (const btn in powerupBtns) btn.classList.add('disabled');
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
	const player = Game.players[playerId];
	if (!player) return;
	const pos = player.board.getPosition(row, col);
	if (!pos) return;
	pos.heal();
}

/**
 * @returns {void}
 */
function handleActivatePowerups() {
	sonarBtn.innerText = 'Sonar (5)';
	airplanesBtn.innerText = 'Attack Airplanes (10)';
	mineBtn.innerText = 'Marine Mine (5)';
	shieldBtn.innerText = 'Defensive Shield (15)';
	missileBtn.innerText = 'Cruise Missile (15)';
	quickfixBtn.innerText = 'Quick Fix (10)';
	empBtn.innerText = 'EMP Attack (25)';

	for (const btn in powerupBtns) btn.classList.remove('disabled');
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

	console.log(ev);

	if (ev.type === 'instruction') {
		if (ev.instruction === 'playerWin') handlePlayerWin(ev.playerId);
		if (ev.instruction === 'destroyPosition')
			handleDestroyPosition(ev.playerId, ev.row, ev.col);
		if (ev.instruction === 'turnOfPlayer') handleTurnOfPlayer(ev.playerId);
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

		if (ev.instruction === 'powerPlaceShield') handlePowerPlaceShield(ev);
		if (ev.instruction === 'powerRemoveShield') handlePowerRemoveShield(ev);

		if (ev.instruction === 'activatePowerups') handleActivatePowerups(ev);
		if (ev.instruction === 'deactivatePowerups') handleDeactivatePowerups(ev);

		if (ev.instruction === 'activateQuickFix') handleActivateQuickFix(ev);
		if (ev.instruction === 'deactivateQuickFix') handleDeactivateQuickFix(ev);
		if (ev.instruction === 'healPosition') handleHealPosition(ev);
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
	Game.sonar(0, Game.slotFromId(selectedPlayer));
});

airplanesBtn.addEventListener('click', () => {
	Game.attackAirplanes(0, Game.slotFromId(selectedPlayer));
});

mineBtn.addEventListener('click', () => {
	Game.plantMine(0, selectedRow, selectedCol);
});

shieldBtn.addEventListener('click', () => {
	Game.webShield(selectedRow, selectedCol);
});

missileBtn.addEventListener('click', () => {
	Game.cruiseMissile(
		0,
		Game.slotFromId(selectedPlayer),
		selectedRow,
		selectedCol,
	);
});

quickfixBtn.addEventListener('click', () => {
	Game.webActivateQuickFix();
});

empBtn.addEventListener('click', () => {
	Game.webEMP();
});

class Game {
	static players = {};

	static getPlayers = () => Object.values(Game.players);

	static addPlayer = (id) => {
		if (this.players[id]) return;
		this.players[id] = new Player(
			id,
			document.getElementById(`player-${this.getPlayers().length + 1}`),
			this.players.length === 0,
		);
		return this.players[id];
	};

	static attackPlayer = (slotFrom, slotTo, row, col) => {
		const user = this.players[slotFrom];
		const target = this.players[slotTo];

		const pos = target.board.getPosition(row, col);

		if (pos.hasMine) {
			pickRandom(user.board.getAdyacentsPositions(row, col)).destroy();
			target.setPoints(target.points + 5);
			return;
		}

		if (pos.shielded) {
			console.log('Bloqueado');
			return;
		}

		pos.destroy();
		if (pos.boat === undefined) return console.log('Miss!');

		user.setPoints(user.points + 5);
	};

	static webAttackPlayer = (idFrom, idTo, row, col) => {
		const user = this.players[idFrom];
		const target = this.players[idTo];

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

	static sonar = (slotFrom, slotTo) => {
		const user = this.players[slotFrom];
		if (user.points < 5) return console.log('User does not have enough points');
		if (user.boats[Boats.submarine.name].isDestroyed())
			return console.log('Cannot use sonar, submarine is destroyed');

		const target = this.players[slotTo];

		pickRandom(
			Object.values(target.boats)
				.map((x) => x.positions)
				.flat()
				.filter((x) => !x.visible),
		)?.makeVisible();

		user.setPoints(user.points - 5);
	};

	static attackAirplanes = (slotFrom, slotTo) => {
		const user = this.players[slotFrom];
		if (user.points < 10)
			return console.log('User does not have enough points');
		if (user.boats[Boats.aircraft.name].isDestroyed())
			return console.log('Cannot use attack airplanes, aircraft is destroyed');
		const target = this.players[slotTo];

		const validPositions = Object.values(target.board.positions).filter(
			(x) => !x.destroyed,
		);
		for (let _ = 0; _ < 5; _++) {
			const pos = pickRandom(validPositions);
			this.attackPlayer(slotFrom, slotTo, pos.row, pos.col);
			validPositions.splice(validPositions.indexOf(pos), 1);
			if (validPositions.length === 0) break;
		}

		user.setPoints(user.points - 10);
	};

	static plantMine = (slotFrom, row, col) => {
		const user = this.players[slotFrom];
		if (user.points < 5) return console.log('User does not have enough points');

		const pos = user.board.getPosition(row, col);
		if (pos.boat !== undefined)
			return console.log('Cannot plant mine where boat is');
		if (pos.hasMine) return console.log('Position already has mine');
		pos.plantMine();

		pos.setPoints(user.points - 5);
	};

	static shieldPositions = (slotFrom, row, col) => {
		const user = this.players[slotFrom];
		if (user.points < 15)
			return console.log('User does not have enough points');

		user.board.getArea(row, col).forEach((x) => {
			x.shield();
		});

		user.setPoints(user.points - 15);
	};

	static cruiseMissile = (slotFrom, slotTo, row, col) => {
		const user = this.players[slotFrom];
		if (user.points < 15)
			return console.log('User does not have enough points');

		const target = this.players[slotTo];
		target.board.getArea(row, col).forEach((x) => {
			Game.attackPlayer(slotFrom, slotTo, x.row, x.col);
		});

		user.setPoints(user.points - 15);
	};

	static quickFix = (slotFrom, rowOne, colOne, rowTwo, colTwo) => {
		const user = this.players[slotFrom];
		if (user.points < 10)
			return console.log('User does not have enough points');

		const posOne = user.board.getPosition(rowOne, colOne);
		const posTwo = user.board.getPosition(rowTwo, colTwo);

		let oneHealed = false;
		let twoHealed = false;

		if (posOne.boat === undefined)
			console.log(`${rowOne},${colOne} does not have a boat`);
		else if (user.boats[posOne.boat].wasHealed)
			console.log(
				`Unable to heal ${posOne.boat} because it was already healed`,
			);
		else if (user.boats[posOne.boat].isDestroyed())
			console.log(
				`The boat ${posOne.boat} from ${user.name} is already fully destroyed`,
			);
		else if (!posOne.destroyed)
			console.log(`${rowOne},${colOne} is not destroyed`);
		else {
			posOne.heal();
			oneHealed = true;
		}

		if (posTwo.boat === undefined)
			console.log(`${rowTwo},${colTwo} does not have a boat`);
		else if (user.boats[posTwo.boat].wasHealed)
			console.log(
				`Unable to heal ${posTwo.boat} because it was already healed`,
			);
		else if (user.boats[posTwo.boat].isDestroyed())
			console.log(
				`The boat ${posTwo.boat} from ${user.name} is already fully destroyed`,
			);
		else if (!posTwo.destroyed)
			console.log(`${rowTwo},${colTwo} is not destroyed`);
		else {
			posTwo.heal();
			twoHealed = true;
		}

		if (oneHealed) user.boats[posOne.boat].wasHealed = true;
		if (twoHealed) user.boats[posTwo.boat].wasHealed = true;

		user.setPoints(user.points - 10);
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

	constructor() {
		this.players = {
			0: undefined,
			1: undefined,
			2: undefined,
			3: undefined,
		};
	}
}

class BoardPosition {
	placeBoat = (boatName, slot, vertical) => {
		this.boat = boatName;
		this.vertical = vertical;
		this.boatSlot = slot;
	};

	plantMine = () => {
		this.hasMine = true;
	};

	shield = () => {
		this.shielded = true;
		this.cell.setAttribute('data-shield', 'true');
	};

	unshield = () => {
		this.shielded = false;
		this.cell.removeAttribute('data-shield');
	};

	destroy = (success = true) => {
		if (success) this.cell.setAttribute('data-destroyed', 'true');
		else this.cell.setAttribute('data-miss', 'true');
		this.destroyed = true;
	};

	heal = () => {
		this.cell.removeAttribute('data-destroyed');
		this.destroyed = false;
	};

	makeVisible = () => {
		this.visible = true;
		const dir = this.vertical ? 'v' : 'h';
		if (this.boat)
			this.cell.setAttribute(
				'data-boat',
				`${this.boat}-${dir}${this.boatSlot}`,
			);
		if (this.hasMine) this.cell.setAttribute('data-mine', 'true');
		if (this.shielded) this.cell.setAttribute('data-shield', 'true');
	};

	constructor(cell, row, col, owner) {
		this.cell = cell;
		this.row = row;
		this.col = col;
		this.owner = owner;
		this.visible = owner.mainPlayer;
		this.shielded = false;
		this.hasMine = false;

		this.boat = undefined;
		this.destroyed = undefined;
		this.vertical = undefined;
		this.boatSlot = undefined;
	}
}

class Boat {
	positions = [];

	getSize = () => this.positions.length;
	isDestroyed = () => !this.positions.some((pos) => !pos.destroyed);

	reveal = () => this.positions.forEach((x) => x.makeVisible());
	destroy = () => this.positions.forEach((x) => x.destroy());
	wasHealed = false;
}

class Board {
	static rows = 'ABCDEFGHIJ';
	static cols = '123456789'.split('').concat(['10']);

	positions = {}; // Filled with '1,A' and such

	getPosition = (row, col) => this.positions[`${row},${col}`];

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

	getAdyacentsPositions = (row, col) => {
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

				this.positions[`${row},${col}`] = new BoardPosition(
					cell,
					row,
					col,
					this.owner,
				);
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
		positions.forEach((pos) => pos.makeVisible());

		this.boats[boatEnum.name].positions = positions;
	};

	setPoints = (points) => {
		if (!this.mainPlayer) return;
		this.points = points;
		$pointsEl.innerHTML = this.points;
	};

	constructor(id, $divContainer) {
		this.id = id;

		this.$playerName = document.createElement('h2');
		this.$playerName.innerText = id;
		$divContainer.appendChild(this.$playerName);

		this.board = new Board($divContainer, this);
		this.points = 999999999;
		this.connected = true;

		this.boats = {
			destroyer: new Boat(),
			submarine: new Boat(),
			cruise: new Boat(),
			battleship: new Boat(),
			aircraft: new Boat(),
		};
	}
}
