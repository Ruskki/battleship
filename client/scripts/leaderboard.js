const websocket = new WebSocket('ws://127.0.0.1:8000');

const leaderboardTbody = document.getElementById('leaderboardTBody');

websocket.addEventListener('open', () => {
	const msg = JSON.stringify({
		type: 'instruction',
		instruction: 'getLeaderboards'
	});
	websocket.send(msg);
});

websocket.addEventListener('message', (event) => {
	let ev;
	try {
		ev = JSON.parse(event.data);
	} catch (e) {
		console.error('ERROR PARSING JSON');
	}

	for (const entryN in ev.leaderboards) {
		const [player, wins] = ev.leaderboards[entryN];

		const tr = document.createElement('tr');

		const td3 = document.createElement('td');
		td3.innerText = entryN + 1;
		tr.appendChild(td3);

		const td = document.createElement('td');
		td.innerHTML = `<strong>${player}</strong>`;
		tr.appendChild(td);

		const td2 = document.createElement('td');
		td2.innerText = wins;
		tr.appendChild(td2);

		leaderboardTbody.appendChild(tr);

		tr.classList.add(`leaderboard-position-${entryN}`);
	}
});
