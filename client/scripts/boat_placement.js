const ships = document.querySelectorAll('.source');
const gridPositions = document.querySelectorAll('.board-position');

ships.forEach(ship => {
    ship.addEventListener('dragstart', dragStart);
});

gridPositions.forEach(position => {
    position.addEventListener('dragover', dragOver);
    position.addEventListener('drop', drop);
});

function dragStart(e) {
    e.dataTransfer.setData('text/plain', e.target.id);
}

function dragOver(e) {
    e.preventDefault(); 
}

function drop(e) {
    e.preventDefault();
    const shipId = e.dataTransfer.getData('text/plain');
    const shipElement = document.getElementById(shipId);
    

    if (this.getAttribute('boat') === 'null') {
        this.appendChild(shipElement.cloneNode(true)); 
        this.setAttribute('boat', shipId); 
    } else {
        alert('this space is taken, try again.');
    }
}