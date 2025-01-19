const urlString = window.location.href;
const url = new URL(urlString);
const winnerId = url.searchParams.get('winnerId');

document.getElementById('winner-id').innerText = winnerId;
