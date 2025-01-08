# Batalla Naval

## Integrantes

- Humberto Aleman 30142718
- Cristina Carnevali 30395024
- Jose Flores // TODO

## Dependencias:

- Deno 2.1.X

## Instrucciones para correr

Una vez extraido o clonado el proyecto, entrar en el directorio con el comando

```bash
cd battleship
```

Una vez ahi, correr el comando

```bash
deno run --allow-network ./server/server.js
```

Esto correra una instancia del servidor de juego en la maquina local en el puerto 8000

## Conectandose con el servidor

Para conectarse con el servidor se debe abrir con el navegador el archivo `index.html`, el cual se encuentra dentro de la carpeta `client` en un navegador web

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
> Para ahorrar memoria, una sala en la que todos los usuarios se desconectaron sera permanentemente eliminada luego de 30 segundos de inactividad

## Pagina de Juego

Por los momentos, la pagina de juego no establece una conexion con el servidor, pero se han creado funciones de manipulacion del DOM para las siguientes acciones

- Presionar posicion: Marca la posicion como seleccionada
- ATTACK: Destruye esa posicion
- Sonar: Revela una posicion con un barco del tablero seleccionado al azar
- Attack Airplanes: Ataca 5 posiciones del tablero seleccionado al azar
- Marine Mine: Sin importar que tablero se seleccione, toma la posicion seleccionada y planta una mina en el tablero superior izquierdo
- Defensive Shield: Sin importar que tablero se selecciones, toma la posicion seleccionada y planta una mina en el tablero superior izquierdo
- Cruiser Missile; Destruye una posicion en un area de 3x3 de un tablero seleccionado, con centro en la posicion seleccionada
- Quick Fix: Actualmente se encuentra deshabilitada
- EMP Attack: Actualmente se encuentra deshabilitada

> Al plantar la mina marina, uno puede atacar su propio tablero para observar su funcionamiento, si fuese otro jugador atacando, su tablero seria el destruido
> Al utilizar los escudos, estos niegan los ataques regulares, de los aviones y del crucero
