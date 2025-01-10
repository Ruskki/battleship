const url_string = window.location.href;
const url = new URL(url_string);
const winnerId = url.searchParams.get('winnerId');

document.getElementById('winner-id').innerText = winnerId;
