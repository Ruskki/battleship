const Boats = {
	DESTROYER: {
		name: "destroyer",
		size: 2,
	},
	SUBMARINE: {
		name: "submarine",
		size: 3,
	},
	CRUISE: {
		name: "cruise",
		size: 3,
	},
	BATTELSHIP: {
		name: "battleship",
		size: 4,
	},
	AIRCRAFT: {
		name: "aircraft",
		size: 5,
	},
};

const pickRandom = (arr) => arr[Math.floor(Math.random() * arr.length)];

let selectedRow = "A";
let selectedCol = "1";
let selectedPlayer = undefined;

const $pointsEl = document.getElementById("player-points");

document.getElementById("attack-button").addEventListener("click", () => {
	Game.attackPlayer(
		0,
		Game.slotFromId(selectedPlayer),
		selectedRow,
		selectedCol,
	);
});

document.getElementById("sonar-button").addEventListener("click", () => {
	Game.sonar(0, Game.slotFromId(selectedPlayer));
});

document.getElementById("airplanes-button").addEventListener("click", () => {
	Game.attackAirplanes(0, Game.slotFromId(selectedPlayer));
});

document.getElementById("mine-button").addEventListener("click", () => {
	Game.plantMine(0, selectedRow, selectedCol);
});

document.getElementById("shield-button").addEventListener("click", () => {
	Game.shieldPositions(0, selectedRow, selectedCol);
});

document.getElementById("missile-button").addEventListener("click", () => {
	Game.cruiseMissile(
		0,
		Game.slotFromId(selectedPlayer),
		selectedRow,
		selectedCol,
	);
});

class Game {
	static players = [];

	static slotFromId = (id) => this.players.findIndex((x) => x.id === id);

	static addPlayer = (id, name, slot) => {
		this.players[slot] = new Player(
			id,
			name,
			document.getElementById(`player-${slot + 1}`),
			slot === 0,
		);
		return this.players[slot];
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
			console.log("Bloqueado");
			return;
		}

		pos.destroy();
		if (pos.boat === undefined) return console.log("Miss!");

		user.setPoints(user.points + 5);
	};

	static sonar = (slotFrom, slotTo) => {
		const user = this.players[slotFrom];
		if (user.points < 5) return console.log("User does not have enough points");
		if (user.boats[Boats.SUBMARINE.name].isDestroyed())
			return console.log("Cannot use sonar, submarine is destroyed");

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
			return console.log("User does not have enough points");
		if (user.boats[Boats.AIRCRAFT.name].isDestroyed())
			return console.log("Cannot use attack airplanes, aircraft is destroyed");
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
		if (user.points < 5) return console.log("User does not have enough points");

		const pos = user.board.getPosition(row, col);
		if (pos.boat !== undefined)
			return console.log("Cannot plant mine where boat is");
		if (pos.hasMine) return console.log("Position already has mine");
		pos.plantMine();

		pos.setPoints(user.points - 5);
	};

	static shieldPositions = (slotFrom, row, col) => {
		const user = this.players[slotFrom];
		if (user.points < 15)
			return console.log("User does not have enough points");

		user.board.getArea(row, col).forEach((x) => {
			x.shield();
		});

		user.setPoints(user.points - 15);
	};

	static cruiseMissile = (slotFrom, slotTo, row, col) => {
		const user = this.players[slotFrom];
		if (user.points < 15)
			return console.log("User does not have enough points");

		const target = this.players[slotTo];
		target.board.getArea(row, col).forEach((x) => {
			Game.attackPlayer(slotFrom, slotTo, x.row, x.col);
		});

		user.setPoints(user.points - 15);
	};

	static quickFix = (slotFrom, rowOne, colOne, rowTwo, colTwo) => {
		const user = this.players[slotFrom];
		if (user.points < 10)
			return console.log("User does not have enough points");

		const posOne = user.board.getPosition(rowOne, colOne);
		const posTwo = user.board.getPosition(rowTwo, colTwo);

		let oneHealed = false;
		let twoHealed = false;

		if (posOne.boat === undefined) {
			console.log(`${rowOne},${colOne} does not have a boat`);
		} else if (user.boats[posOne.boat].wasHealed) {
			console.log(
				`Unable to heal ${posOne.boat} because it was already healed`,
			);
		} else if (user.boats[posOne.boat].isDestroyed()) {
			console.log(
				`The boat ${posOne.boat} from ${user.name} is already fully destroyed`,
			);
		} else if (!posOne.destroyed) {
			console.log(`${rowOne},${colOne} is not destroyed`);
		} else {
			posOne.heal();
			oneHealed = true;
		}

		if (posTwo.boat === undefined) {
			console.log(`${rowTwo},${colTwo} does not have a boat`);
		} else if (user.boats[posTwo.boat].wasHealed) {
			console.log(
				`Unable to heal ${posTwo.boat} because it was already healed`,
			);
		} else if (user.boats[posTwo.boat].isDestroyed()) {
			console.log(
				`The boat ${posTwo.boat} from ${user.name} is already fully destroyed`,
			);
		} else if (!posTwo.destroyed) {
			console.log(`${rowTwo},${colTwo} is not destroyed`);
		} else {
			posTwo.heal();
			twoHealed = true;
		}

		if (oneHealed) user.boats[posOne.boat].wasHealed = true;
		if (twoHealed) user.boats[posTwo.boat].wasHealed = true;

		user.setPoints(user.points - 10);
	};

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
		this.destroyed = false;
		this.vertical = vertical;
		this.boatSlot = slot;
	};

	plantMine = () => {
		this.hasMine = true;
		if (this.visible) this.cell.setAttribute("data-mine", "true");
	};

	shield = (where) => {
		this.shielded = true;
		if (this.visible) this.cell.setAttribute("data-shield", "true");
	};

	destroy = () => {
		this.cell.setAttribute("data-destroyed", "true");
		this.destroyed = true;
		this.makeVisible();
	};

	heal = () => {
		this.cell.removeAttribute("data-destroyed");
		this.destroyed = false;
	};

	makeVisible = () => {
		if (this.boat === undefined) return console.log("No boat to make visible");

		this.visible = true;
		const dir = this.vertical ? "v" : "h";
		this.cell.setAttribute("data-boat", `${this.boat}-${dir}${this.boatSlot}`);
		if (this.hasMine) this.cell.setAttribute("data-mine", "true");
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
	static rows = "ABCDEFGHIJ";
	static cols = "123456789".split("").concat(["10"]);

	positions = {}; // Filled with "1,A" and such

	getPosition = (row, col) => this.positions[`${row},${col}`];

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

	getAdyacentsPositions = (row, col) => {
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

	getSliceHorizontal = (row, col, size) =>
		Board.cols
			.slice(Board.cols.indexOf(col), Board.cols.indexOf(col) + size)
			.map((x) => this.getPosition(row, x));

	getSliceVertical = (row, col, size) =>
		Board.rows
			.slice(Board.rows.indexOf(row), Board.rows.indexOf(row) + size)
			.split("")
			.map((x) => this.getPosition(x, col));

	addCell = ($board, row, col) => {
		const cell = document.createElement("div");
		const sum = row + col;

		switch (sum) {
			case "":
				cell.className = "board-null";
				break;
			case row:
				cell.className = "board-header-number";
				cell.textContent = row;
				break;
			case col:
				cell.className = "board-header-letter";
				cell.textContent = col;
				break;
			default:
				cell.className = `board-pos row-${row} col-${col}`;
				cell.addEventListener("click", () => {
					selectedRow = row;
					selectedCol = col;
					selectedPlayer = this.owner.id;
					document.getElementById("target-row").innerText = row;
					document.getElementById("target-col").innerText = col;
					document.getElementById("target-player").innerText = this.owner.id;
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
		const board = document.createElement("div");
		board.className = "board";

		this.addCell(board, "", "");
		for (let num of Board.cols) this.addCell(board, "", num);
		for (let c of Board.rows) {
			this.addCell(board, c, "");
			for (let n of Board.cols) this.addCell(board, c, n);
		}
		$divContainer.appendChild(board);
	};

	constructor($divContainer, playerObj, mainPlayer = false) {
		this.owner = playerObj;
		this.createBoard($divContainer, playerObj.id);
	}
}

class Player {
	placeBoat = (boatEnum, row, col, vertical) => {
		const positions = vertical
			? this.board.getSliceVertical(row, col, boatEnum.size)
			: this.board.getSliceHorizontal(row, col, boatEnum.size);

		if (positions.length !== boatEnum.size) return console.log("Boat too big");
		if (positions.some((pos) => pos.boat !== undefined))
			return console.log("Boat in the way");

		positions.forEach((pos, idx) =>
			pos.placeBoat(boatEnum.name, idx + 1, vertical),
		);
		if (this.mainPlayer) positions.forEach((pos) => pos.makeVisible());

		this.boats[boatEnum.name].positions = positions;
	};

	setPoints = (points) => {
		if (!this.mainPlayer) return;
		this.points = points;
		$pointsEl.innerHTML = this.points;
	};

	constructor(id, name, $divContainer, mainPlayer = false) {
		this.id = id;
		this.name = name;
		this.mainPlayer = mainPlayer;
		this.board = new Board($divContainer, this);
		this.points = 999999999;

		this.boats = {
			destroyer: new Boat(),
			submarine: new Boat(),
			cruise: new Boat(),
			battleship: new Boat(),
			aircraft: new Boat(),
		};
	}
}

["player-1", "player-2", "player-3", "player-4"].forEach((x, idx) => {
	const player = Game.addPlayer(x.split("-").at(-1), "Name", idx);
	player.placeBoat(Boats.AIRCRAFT, "A", "1", false);
	player.placeBoat(Boats.DESTROYER, "B", "1", true);
	player.placeBoat(Boats.SUBMARINE, "B", "2", true);
	player.placeBoat(Boats.CRUISE, "B", "3", true);
	player.placeBoat(Boats.BATTELSHIP, "B", "4", true);
});

const randomTargetsTest = (targets = 25) => {
	for (let _ = 0; _ < targets; _++) {
		const row = pickRandom(Board.rows);
		const col = pickRandom(Board.cols);
		Game.attackPlayer(0, 1, row, col);
	}
};

const sonarTest = () => {
	// Sonar test
	Game.players[0].points = 10;
	Game.sonar(0, 1);
	Game.players[0].boats["submarine"].destroy();
	Game.sonar(0, 1);
};

const airplanesTest = () => {
	Game.players[0].points = 10;
	Game.attackAirplanes(0, 1);
};

const mineTest = () => {
	Game.players[0].points = 10;
	Game.plantMine(0, "J", "10");
	Game.plantMine(0, "A", "1");

	Game.attackPlayer(1, 0, "J", "10");
};

const shieldTest = () => {
	Game.players[0].points = 15;
	Game.shieldPositions(0, "H", "8");

	Game.players[1].points = 15;
	Game.shieldPositions(1, "H", "8");

	Game.attackPlayer(0, 1, "G", "7");
	Game.attackPlayer(1, 0, "I", "9");
};

const missileTest = () => {
	Game.players[0].points = 15;
	Game.cruiseMissile(0, 1, "B", "2");
};

const testHeal = () => {
	Game.players[1].points = 15;
	Game.cruiseMissile(1, 0, "B", "2");

	Game.quickFix(0, "B", "1", "C", "1");
	Game.quickFix(0, "A", "1", "A", "2");
	Game.quickFix(0, "A", "3", "A", "3");
};

// randomTargetsTest();
// sonarTest();
// airplanesTest();
// mineTest();
// shieldTest();
// missileTest();
// testHeal();
