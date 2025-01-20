# Batalla Naval

## Informacion

Proyecto de Programacion Orientada a la Web
Universidad Catolica Andres Bello

## Integrantes

- Humberto Aleman       30142718
- Cristina Carnevali    30395024
- Jose Flores           31317138

## Dependencias:

- Deno 2.1.X

## Instrucciones para correr

Una vez extraido o clonado el proyecto, entrar en el directorio con el comando

```bash
cd battleship
```

Una vez ahi, correr el comando

```bash
deno run release
```

Esto correra una instancia del servidor de juego en la maquina local en el puerto 8000

## Conectandose con el servidor

Para conectarse con el servidor abra en su navegador `http://127.0.0.1:8000/index.html`

Una vez ahi, se podra seleccionar la opcion "Play Online" para abrir el menu de juegos online o "Play Tournament Mode" para acceder al modo torneo

### Jugar Online

Ingrese su nombre de usuario y cree un cuarto o unase a uno ya creado con el codigo

Si desea jugar solo contra un bot, coloque sus barcos e inicie el juego

> ADVERTENCIA
> Una sala en la que todos los usuarios se desconectaron sera permanentemente eliminada luego de 30 segundos de inactividad

### Modo Torneo

Ingrese su nombre de usuario y cree un lobby o unase a uno ya creado con el codigo

El minimo de usuarios para comenzar un torneo es 3, el maximo es 16, si el numero de usuarios es impar, el ultimo jugara contra un BOT
