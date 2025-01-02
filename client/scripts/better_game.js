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

class Game {
	static players = {};

	static add_player = (id, name, slot) => {
		this.players[slot] = new Player(
			id,
			name,
			document.getElementById(`player-${slot + 1}`),
			slot === 0,
		);
		return this.players[slot];
	};

	static attack_player = (slot_from, slot_to, row, col) => {
		const target = this.players[slot_to];

		const pos = target.board.get_position(row, col);
		pos.destroy();
		if (pos.boat === undefined) return console.log("Miss!");

		this.players[slot_from].points += 5;
	};

	static sonar = (slot_from, slot_to) => {
		const user = this.players[slot_from];
		if (user.points < 5) return console.log("User does not have enough points");
		if (user.boats[Boats.SUBMARINE.name].is_destroyed())
			return console.log("Cannot use sonar, submarine is destroyed");

		const target = this.players[slot_to];

		target.board.get_random_position().make_visible();

		user.points -= 5;
	};

	static attack_airplanes = (slot_from, slot_to) => {
		const user = this.players[slot_from];
		if (user.points < 10)
			return console.log("User does not have enough points");
		if (user.boats[Boats.AIRCRAFT.name].is_destroyed())
			return console.log("Cannot use attack airplanes, aircraft is destroyed");
		const target = this.players[slot_to];

		for (let _ = 0; _ < 5; _++) target.board.get_random_position().destroy();

		user.points -= 10;
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
	place_boat = (boat_name, slot, vertical) => {
		this.boat = boat_name;
		this.destroyed = false;
		this.vertical = vertical;
		this.boat_slot = slot;
	};

	destroy = () => {
		this.cell.setAttribute("data-destroyed", "true");
		this.destroyed = true;
		this.make_visible();
	};

	make_visible = () => {
		if (this.boat === undefined) return console.log("No boat to make visible");

		this.visible = true;
		const dir = this.vertical ? "v" : "h";
		this.cell.setAttribute("data-boat", `${this.boat}-${dir}${this.boat_slot}`);
	};

	constructor(cell, row, col, owner) {
		this.cell = cell;
		this.row = row;
		this.col = col;
		this.owner = owner;
		this.visible = owner.main_player;
		this.shielded = false;

		this.boat = undefined;
		this.destroyed = undefined;
		this.vertical = undefined;
		this.boat_slot = undefined;
	}
}

class Boat {
	positions = [];

	get_size = () => this.positions.length;
	is_destroyed = () => !this.positions.some((pos) => !pos.destroyed);

	reveal = () => this.positions.forEach((x) => x.make_visible());
	destroy = () => this.positions.forEach((x) => x.destroy());
}

class Board {
	static rows = "ABCDEFGHIJ";
	static cols = "123456789".split("").concat(["10"]);

	positions = {}; // Filled with "1,A" and such

	get_position = (row, col) => this.positions[`${row},${col}`];

	get_random_position = () => {
		const positions = Object.keys(this.positions);
		return this.positions[
			positions[Math.floor(Math.random() * positions.length)]
		];
	};

	get_slice_horizontal = (row, col, size) =>
		Board.cols
			.slice(Board.cols.indexOf(col), Board.cols.indexOf(col) + size)
			.map((x) => this.get_position(row, x));

	get_slice_vertical = (row, col, size) =>
		Board.rows
			.slice(Board.rows.indexOf(row), Board.rows.indexOf(row) + size)
			.split("")
			.map((x) => this.get_position(x, col));

	add_cell = ($board, row, col) => {
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
				this.positions[`${row},${col}`] = new BoardPosition(
					cell,
					row,
					col,
					this.owner,
				);
		}

		$board.appendChild(cell);
	};

	create_board = ($div_container) => {
		const board = document.createElement("div");
		board.className = "board";

		this.add_cell(board, "", "");
		for (let num of Board.cols) this.add_cell(board, "", num);
		for (let c of Board.rows) {
			this.add_cell(board, c, "");
			for (let n of Board.cols) this.add_cell(board, c, n);
		}
		$div_container.appendChild(board);
	};

	constructor($div_container, player_obj, main_player = false) {
		this.owner = player_obj;
		this.create_board($div_container, player_obj.id);
	}
}

class Player {
	place_boat = (boat_enum, row, col, vertical) => {
		const positions = vertical
			? this.board.get_slice_vertical(row, col, boat_enum.size)
			: this.board.get_slice_horizontal(row, col, boat_enum.size);

		if (positions.length !== boat_enum.size) return console.log("Boat too big");
		if (positions.some((pos) => pos.boat !== undefined))
			return console.log("Boat in the way");

		positions.forEach((pos, idx) =>
			pos.place_boat(boat_enum.name, idx + 1, vertical),
		);
		if (this.main_player) positions.forEach((pos) => pos.make_visible());

		this.boats[boat_enum.name].positions = positions;
	};

	constructor(id, name, $div_container, main_player = false) {
		this.id = id;
		this.name = name;
		this.main_player = main_player;
		this.board = new Board($div_container, this);
		this.points = 0;

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
	const player = Game.add_player(x.split("-").at(-1), "Name", idx);
	player.place_boat(Boats.AIRCRAFT, "A", "1", false);
	player.place_boat(Boats.DESTROYER, "B", "1", true);
	player.place_boat(Boats.SUBMARINE, "B", "2", true);
	player.place_boat(Boats.CRUISE, "B", "3", true);
	player.place_boat(Boats.BATTELSHIP, "B", "4", true);
});

const random_targets_test = (targets = 25) => {
	for (let _ = 0; _ < targets; _++) {
		const row = Board.rows[Math.floor(Math.random() * Board.rows.length)];
		const col = Board.cols[Math.floor(Math.random() * Board.cols.length)];
		Game.attack_player(0, 1, row, col);
	}
};

const sonar_test = () => {
	// Sonar test
	Game.players[0].points = 5;
	Game.sonar(0, 1);
	Game.players[0].boats["submarine"].destroy();
	Game.sonar(0, 1);
};

const airplanes_test = () => {
	Game.players[0].points = 10;
	Game.attack_airplanes(0, 1);
};

// random_targets_test();
// sonar_test();
airplanes_test();
