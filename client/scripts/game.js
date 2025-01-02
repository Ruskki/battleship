const head_nums = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10"];
const head_chars = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J"];

class BoatList {
	boat_information = {};
	add_new_boat_cell = (name, cell) => {
		if (name in this.boat_information)
			this.boat_information[name].push({
				element: cell,
				row: cell.id.split(",").at(1),
				col: cell.id.split(",").at(2),
				destroyed: false,
				shielded: false,
				exposed: false,
			});
		else
			this.boat_information[name] = [
				{
					element: cell,
					row: cell.id.split(",").at(1),
					col: cell.id.split(",").at(2),
					destroyed: false,
					shielded: false,
					exposed: false,
				},
			];
	};

	get_boat_position = (boat_name, row, col) =>
		this.boat_information[boat_name]
			.filter((x) => x.row === row && x.col === col)
			.at(0);

	is_boat_in_cell = (boat_name, row, col) =>
		this.get_boat_position(boat_name, row, col) !== undefined;

	any_boat_in_cell = (row, col) =>
		Object.keys(this.boat_information).some(
			(x) => this.get_boat_position(x, row, col) !== undefined,
		);

	get_boat_in_cell = (row, col) => {
		console.log(
			Object.keys(this.boat_information).filter(
				(x) => this.get_boat_position(x, row, col) !== undefined,
			),
		);
	};

	attack_boat_cell = (boat_name, row, col) => {
		pos = this.get_boat_in_cell(row, col);
		if (pos === undefined)
			return console.log("This position doesn't exist on this boat");

		if (pos.destroyed) console.log("This position was already destroyed");

		pos.element.setAttribute("data-destroyed", "true");
		pos.destroyed = true;

		return pos;
	};
}

class Board {
	positions = {};

	boat_list = new BoatList();

	create_cell = (board, className, content, id = "") => {
		const cell = document.createElement("div");
		cell.className = className;
		board.appendChild(cell);
		if (content !== "") cell.textContent = content;
		if (id === "") return;
		this.positions[id.split(",").slice(1, 3).join(",")] = cell;
		cell.id = id;
	};

	get_position = (row, col) => this.positions[`${row},${col}`];

	get_slice_horizontal = (row, col, size) =>
		head_nums
			.slice(head_nums.indexOf(col), head_nums.indexOf(col) + size)
			.map((x) => this.get_position(row, x));
	get_slice_vertical = (row, col, size) =>
		head_chars
			.slice(head_chars.indexOf(row), head_chars.indexOf(row) + size)
			.map((x) => this.get_position(x, col));

	create_board = (player_element, player_number) => {
		const board = document.createElement("div");
		board.className = "board";

		this.create_cell(board, "board-null", "");
		for (let num of head_nums)
			this.create_cell(board, "board-header-number", num);
		for (let c of head_chars) {
			this.create_cell(board, "board-header-letter", c);
			for (let n of head_nums) {
				const id = `${player_number},${c},${n}`;
				this.create_cell(board, `board-pos row-${c} col-${n}`, "", id);
			}
		}
		player_element.appendChild(board);
	};

	place_boat = (row, col, boat, vertical, visible = false) => {
		if (Object.values(Boats).indexOf(boat) === -1)
			return console.log(`Boat ${boat} is invalid`);

		const slice = vertical
			? this.get_slice_vertical(row, col, boat.size)
			: this.get_slice_horizontal(row, col, boat.size);

		if (slice.length !== boat.size)
			return console.log("The boat is too big to place in this position!");

		if (slice.some((cell) => cell.getAttribute("data-boat") !== null))
			return console.log(`Can't place boat, collides with another boat`);

		const dir = vertical ? "v" : "h";
		slice.forEach((cell, i) => {
			if (visible)
				cell.setAttribute("data-boat", `${boat.name}-${dir}${i + 1}`);
			this.boat_list.add_new_boat_cell(boat.name, cell);
		});
	};

	constructor(p_element_id) {
		const parent = document.createElement("div");
		parent.className = "board";
		this.parent_element = parent;

		this.create_board(
			document.getElementById(p_element_id),
			p_element_id.split("-").at(-1),
		);
	}
}

class Player {
	constructor(id) {
		this.id = id;
		this.board = new Board(id);
		this.points = 0;
	}
}

class PlayerDict {
	player_list = [];
	add_player = (player_object) => this.player_list.push(player_object);
	get_player_by_id = (player_id) =>
		this.player_list.filter((x) => x.id === player_id).at(0);

	player_attack = (from, to, row, col) => {
		const p_from = this.get_player_by_id(from);
		const p_to = this.get_player_by_id(to);

		if (p_from === null || p_to === null)
			return console.log("One of the players doesn't exist");

		const pos = p_to.board.get_position(row, col);
		if (pos === null)
			return console.log("The position attacked does not exist");

		const any = p_to.board.boat_list.any_boat_in_cell(row, col);
		if (!any) return console.log("Miss!");

		const answer = p_to.board.boat_list.attack_boat_cell(row, col);
		if (answer === undefined) return console.log("Miss!");

		p_from.points += 5;
	};

	player_use_sonar = (from, to) => {
		const p_from = this.get_player_by_id(from);
		const p_to = this.get_player_by_id(to);

		if (p_from === null || p_to === null)
			return console.log("One of the players doesn't exist");
	};
}

const player_dict = new PlayerDict();

for (let id of ["player-1", "player-2", "player-3", "player-4"]) {
	const game_area = document.getElementById(id);
	if (game_area === null)
		console.log(`Could not find element with id ${id}`, "color:red");
	else {
		player_dict.add_player(new Player(id));
	}
}

// Testing

// Horizontal Placement && Vertical Placement
for (let id of ["player-1", "player-2", "player-3", "player-4"]) {
	const playa = player_dict.get_player_by_id(id);
	playa.board.place_boat("A", "1", Boats.AIRCRAFT, false, id === "player-1");
	playa.board.place_boat("B", "1", Boats.BATTELSHIP, true, id === "player-1");
	playa.board.place_boat("B", "2", Boats.CRUISE, true, id === "player-1");
	playa.board.place_boat("B", "3", Boats.SUBMARINE, true, id === "player-1");
	playa.board.place_boat("B", "4", Boats.DESTROYER, true, id === "player-1");
}

// Boat Information Print
const player = player_dict.get_player_by_id("player-1");

// Attack Test
player_dict.player_attack("player-1", "player-2", "A", "1"); // Hit
player_dict.player_attack("player-1", "player-2", "J", "10"); // Miss
