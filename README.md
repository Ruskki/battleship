# Batalla Naval

## Informacion

Proyecto de Programacion Orientada a la Web
Universidad Catolica Andres Bello

## Integrantes

- Humberto Aleman 		30142718
- Cristina Carnevali 	30395024
- Jose Flores 				31317138

## Dependencias:

- Deno 2.1.X

## Instrucciones para correr

Una vez extraido o clonado el proyecto, entrar en el directorio con el comando

```bash
cd battleship
```

Una vez ahi, correr el comando

```bash
deno run --allow-read --allow-net ./server/server.js
```

Esto correra una instancia del servidor de juego en la maquina local en el puerto 8000

## Conectandose con el servidor

Para conectarse con el servidor abra en su navegador `http://127.0.0.1:8000/index.html`

Una vez ahi, se podra seleccionar la opcion "Play Online" para abrir el menu de juegos online

Debe ingresar su nombre de usuario, el cual debe ser unico, en el campo superior, y se le presentan dos opciones

### Create a Room

Esta opcion generara un cuarto con id randomizada y lo agregara como administrador del cuarto

### Join a Room

Debe ingresar el codigo de un cuarto valido en el campo denominado "Room Code", y si el codigo es valido, sera agregado como jugador a el cuarto especificado

## Dentro del Cuarto

Dentro del cuarto, se podran unir hasta cuatro jugadores con nombres distintos

El jugador que tenga la corona es el administrador de la sala

Una vez todos los jugadores hayan colocado sus barcos y presionen el boton de "Ready", al administrador se le colocara el boton verde y cambiara a "Start Game"

Al presionar el boton "Start Game", todos los jugadores seran enviados a la pagina de juego, y el juego comenzara

> ADVERTENCIA
> El servidor solamente guardara los barcos colocados una vez el jugador presione el boton de "Ready", si el jugador presiona el boton "Unready" el servidor no guardara la posicion de sus barcos

> ADVERTENCIA
> Una sala en la que todos los usuarios se desconectaron sera permanentemente eliminada luego de 30 segundos de inactividad

## Pagina de Juego

Por los momentos, solo se encuentran funcionales estas acciones

- Presionar posicion: Marca la posicion como seleccionada
- ATTACK: Destruye esa posicion
