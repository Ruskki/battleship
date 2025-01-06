const ships = document.querySelectorAll(".source");
const gridPositions = document.querySelectorAll(".board-position");

const Boats = {
	aircraft: {
		size: 5,
		positions: [], // ["A,1", "A,2"] ...
		placed: false,
	},
	battleship: {
		size: 4,
		positions: [],
		placed: false,
	},
	submarine: {
		size: 3,
		positions: [],
		placed: false,
	},
	cruise: {
		size: 3,
		positions: [],
		placed: false,
	},
	destroyer: {
		size: 2,
		positions: [],
		placed: false,
	},
};

ships.forEach((ship) => {
	ship.addEventListener("dragstart", dragStart);
});

gridPositions.forEach((position) => {
	position.addEventListener("dragover", dragOver);
	position.addEventListener("drop", drop);
});

function dragStart(e) {
	e.dataTransfer.setData("text/plain", e.target.id);
}

const getCosecutivePositions = (row, col, size, vertical) => {
	const head_rows = "ABCDEFGHIJ".split("");
	const head_cols = "123456789".split("").concat("10");

	const rows = head_rows.slice(
		head_rows.indexOf(row),
		head_rows.indexOf(row) + size,
	);
	const cols = head_cols.slice(
		head_cols.indexOf(col),
		head_cols.indexOf(col) + size,
	);

	const res = [];
	for (let i = 0; i < size; i++)
		res.push(
			document.getElementById(
				`${vertical ? rows[i] : rows[0]},${vertical ? cols[0] : cols[i]}`,
			),
		);
	return res.filter((x) => x);
};

function dragOver(e) {
	e.preventDefault();
}

function drop(e) {
	e.preventDefault();

	const [row, col] = Object.values(
		document.getElementById("board").getElementsByClassName("board-position"),
	)
		.find((x) => x.matches(":hover"))
		.id.split(",");
	const shipId = e.dataTransfer.getData("text/plain");

	if (Boats[shipId].placed) return console.error(`Already placed ${shipId}`);

	// TODO: Get vertical variable from html
	const vertical = false;
	const positions = getCosecutivePositions(
		row,
		col,
		Boats[shipId].size,
		vertical,
	);

	if (positions.some((x) => x.getAttribute("data-boat") !== null))
		return console.error(`Boat ${shipId} clashes with another boat`);
	if (positions.length !== Boats[shipId].size)
		return console.error(`Boat ${shipId} doesn't fit here`);

	positions.forEach((x, idx) => {
		x.setAttribute("data-boat", `${shipId}-${vertical ? "v" : "h"}${idx + 1}`);
	});
	Boats[shipId].placed = true;
}
