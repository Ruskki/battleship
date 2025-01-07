const createGame = () => {
	const websocket = new WebSocket("ws://192.168.4.237:8000");
	websocket.addEventListener("open", () => {
		const playerId = "humberto"; // TODO: get this from html
		console.log(`Creating game for player $${playerId}`);
		websocket.send(
			JSON.stringify({
				type: "message",
				instruction: "createGame",
				playerId: playerId,
			}),
		);
	});

	websocket.addEventListener("message", (event) => {
		let ev;
		try {
			ev = JSON.parse(event.data);
		} catch (e) {
			console.error(e);
			return;
		}

		if (ev.type === "error") console.error(ev.text);
		if (ev.type === "instruction")
			window.location.href = `./fleet.html?playerId=${ev.playerId}`;
	});
};
