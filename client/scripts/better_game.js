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

const pick_random = (arr) => arr[Math.floor(Math.random() * arr.length)];

let selected_row = "A";
let selected_col = "1";
let selected_player = undefined;

document.getElementById("attack-button").addEventListener("click", () => {
	Game.attack_player(0, 1, selected_row, selected_col);
});

document.getElementById("mine-button").addEventListener("click", () => {
	Game.plant_mine(0, selected_row, selected_col);
});

document.getElementById("shield-button").addEventListener("click", () => {
	Game.shield_positions(0, selected_row, selected_row);
});

document.getElementById("missile-button").addEventListener("click", () => {
	Game.cruise_missile(0, 1, selected_row, selected_row);
});

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
		const user = this.players[slot_from];
		const target = this.players[slot_to];

		const pos = target.board.get_position(row, col);

		if (pos.has_mine) {
			pick_random(user.board.get_adyacents_positions(row, col)).destroy();
			target.points += 5;
			return;
		}

		if (pos.shielded) {
			console.log("lmao"); // TODO: Change message
			return;
		}

		pos.destroy();
		if (pos.boat === undefined) return console.log("Miss!");

		user.points += 5;
	};

	static sonar = (slot_from, slot_to) => {
		const user = this.players[slot_from];
		if (user.points < 5) return console.log("User does not have enough points");
		if (user.boats[Boats.SUBMARINE.name].is_destroyed())
			return console.log("Cannot use sonar, submarine is destroyed");

		const target = this.players[slot_to];

		pick_random(
			Object.values(target.boats)
				.map((x) => x.positions)
				.flat()
				.filter((x) => !x.visible),
		)?.make_visible();

		user.points -= 5;
	};

	static attack_airplanes = (slot_from, slot_to) => {
		const user = this.players[slot_from];
		if (user.points < 10)
			return console.log("User does not have enough points");
		if (user.boats[Boats.AIRCRAFT.name].is_destroyed())
			return console.log("Cannot use attack airplanes, aircraft is destroyed");
		const target = this.players[slot_to];

		const valid_positions = Object.values(target.board.positions).filter(
			(x) => !x.destroyed,
		);
		for (let _ = 0; _ < 5; _++) {
			const pos = pick_random(valid_positions);
			pos.destroy();
			valid_positions.splice(valid_positions.indexOf(pos), 1);
			if (valid_positions.length === 0) break;
		}

		user.points -= 10;
	};

	static plant_mine = (slot_from, row, col) => {
		const user = this.players[slot_from];
		if (user.points < 5) return console.log("User does not have enough points");

		const pos = user.board.get_position(row, col);
		if (pos.boat !== undefined)
			return console.log("Cannot plant mine where boat is");
		if (pos.has_mine) return console.log("Position already has mine");
		pos.plant_mine();

		pos.points -= 5;
	};

	static shield_positions = (slot_from, row, col) => {
		const user = this.players[slot_from];
		if (user.points < 15)
			return console.log("User does not have enough points");

		user.board.get_area(row, col).forEach((x) => {
			x.shield();
		});

		user.points -= 15;
	};

	static cruise_missile = (slot_from, slot_to, row, col) => {
		const user = this.players[slot_from];
		if (user.points < 15)
			return console.log("User does not have enough points");

		const target = this.players[slot_to];
		target.board.get_area(row, col).forEach((x) => {
			Game.attack_player(slot_from, slot_to, x.row, x.col);
		});

		user.points -= 15;
	};

	static quick_fix = (slot_from, row_one, col_one, row_two, col_two) => {
		const user = this.players[slot_from];
		if (user.points < 10)
			return console.log("User does not have enough points");

		const pos_one = user.board.get_position(row_one, col_one);
		const pos_two = user.board.get_position(row_two, col_two);

		let one_healed = false;
		let two_healed = false;

		if (pos_one.boat === undefined) {
			console.log(`${row_one},${col_one} does not have a boat`);
		} else if (user.boats[pos_one.boat].was_healed) {
			console.log(
				`Unable to heal ${pos_one.boat} because it was already healed`,
			);
		} else if (user.boats[pos_one.boat].is_destroyed()) {
			console.log(
				`The boat ${pos_one.boat} from ${user.name} is already fully destroyed`,
			);
		} else if (!pos_one.destroyed) {
			console.log(`${row_one},${col_one} is not destroyed`);
		} else {
			pos_one.heal();
			one_healed = true;
		}

		if (pos_two.boat === undefined) {
			console.log(`${row_two},${col_two} does not have a boat`);
		} else if (user.boats[pos_two.boat].was_healed) {
			console.log(
				`Unable to heal ${pos_two.boat} because it was already healed`,
			);
		} else if (user.boats[pos_two.boat].is_destroyed()) {
			console.log(
				`The boat ${pos_two.boat} from ${user.name} is already fully destroyed`,
			);
		} else if (!pos_two.destroyed) {
			console.log(`${row_two},${col_two} is not destroyed`);
		} else {
			pos_two.heal();
			two_healed = true;
		}

		if (one_healed) user.boats[pos_one.boat].was_healed = true;
		if (two_healed) user.boats[pos_two.boat].was_healed = true;
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

	plant_mine = () => {
		this.has_mine = true;
		if (this.visible) this.cell.setAttribute("data-mine", "true");
	};

	shield = (where) => {
		this.shielded = true;
		if (this.visible) this.cell.setAttribute("data-shield", "true");
	};

	destroy = () => {
		this.cell.setAttribute("data-destroyed", "true");
		this.destroyed = true;
		this.make_visible();
	};

	heal = () => {
		this.cell.removeAttribute("data-destroyed");
		this.destroyed = false;
	};

	make_visible = () => {
		if (this.boat === undefined) return console.log("No boat to make visible");

		this.visible = true;
		const dir = this.vertical ? "v" : "h";
		this.cell.setAttribute("data-boat", `${this.boat}-${dir}${this.boat_slot}`);
		if (this.has_mine) this.cell.setAttribute("data-mine", "true");
	};

	constructor(cell, row, col, owner) {
		this.cell = cell;
		this.row = row;
		this.col = col;
		this.owner = owner;
		this.visible = owner.main_player;
		this.shielded = false;
		this.has_mine = false;

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
	was_healed = false;
}

class Board {
	static rows = "ABCDEFGHIJ";
	static cols = "123456789".split("").concat(["10"]);

	positions = {}; // Filled with "1,A" and such

	get_position = (row, col) => this.positions[`${row},${col}`];

	get_area = (row, col) => {
		const min_row = Math.max(0, Board.rows.indexOf(row) - 1);
		const max_row = Math.min(Board.rows.length, Board.rows.indexOf(row) + 2);
		const min_col = Math.max(0, Board.cols.indexOf(col) - 1);
		const max_col = Math.min(Board.cols.length, Board.cols.indexOf(col) + 2);

		return Board.rows
			.slice(min_row, max_row)
			.split("")
			.map((r) =>
				Board.cols.slice(min_col, max_col).map((c) => this.get_position(r, c)),
			)
			.flat(); // Transforms from 3 arrays of 3 to 1 array of 9
	};

	get_adyacents_positions = (row, col) => {
		const min_row = Math.max(0, Board.rows.indexOf(row) - 1);
		const max_row = Math.min(Board.cols.length, Board.rows.indexOf(row) + 2);
		const min_col = Math.max(0, Board.cols.indexOf(col) - 1);
		const max_col = Math.min(Board.cols.length, Board.cols.indexOf(col) + 2);

		return Board.rows
			.slice(min_row, max_row)
			.split("")
			.map((r) =>
				Board.cols.slice(min_col, max_col).map((c) => {
					if (r === row && c === col) return;
					return this.get_position(r, c);
				}),
			)
			.flat() // Transforms from 3 arrays of 3 to 1 array of 9
			.filter((x) => x); // This last step filters the undefined out
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
				cell.addEventListener("click", () => {
					selected_row = row;
					selected_col = col;
					selected_player = this.owner;
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
	const player = Game.add_player(x.split("-").at(-1), "Name", idx);
	player.place_boat(Boats.AIRCRAFT, "A", "1", false);
	player.place_boat(Boats.DESTROYER, "B", "1", true);
	player.place_boat(Boats.SUBMARINE, "B", "2", true);
	player.place_boat(Boats.CRUISE, "B", "3", true);
	player.place_boat(Boats.BATTELSHIP, "B", "4", true);
});

const random_targets_test = (targets = 25) => {
	for (let _ = 0; _ < targets; _++) {
		const row = pick_random(Board.rows);
		const col = pick_random(Board.cols);
		Game.attack_player(0, 1, row, col);
	}
};

const sonar_test = () => {
	// Sonar test
	Game.players[0].points = 10;
	Game.sonar(0, 1);
	Game.players[0].boats["submarine"].destroy();
	Game.sonar(0, 1);
};

const airplanes_test = () => {
	Game.players[0].points = 10;
	Game.attack_airplanes(0, 1);
};

const mine_test = () => {
	Game.players[0].points = 10;
	Game.plant_mine(0, "J", "10");
	Game.plant_mine(0, "A", "1");

	Game.attack_player(1, 0, "J", "10");
};

const shield_test = () => {
	Game.players[0].points = 15;
	Game.shield_positions(0, "H", "8");

	Game.players[1].points = 15;
	Game.shield_positions(1, "H", "8");

	Game.attack_player(0, 1, "G", "7");
	Game.attack_player(1, 0, "I", "9");
};

const missile_test = () => {
	Game.players[0].points = 15;
	Game.cruise_missile(0, 1, "B", "2");
};

const test_heal = () => {
	Game.players[1].points = 15;
	Game.cruise_missile(1, 0, "B", "2");

	Game.quick_fix(0, "B", "1", "C", "1");
	Game.quick_fix(0, "A", "1", "A", "2");
	Game.quick_fix(0, "A", "3", "A", "3");
};

// random_targets_test();
// sonar_test();
// airplanes_test();
// mine_test();
// shield_test();
// missile_test();
// test_heal();
