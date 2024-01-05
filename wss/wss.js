require('dotenv').config();
require('../db');
const Game = require('./Game');
const server = require('http').createServer();
const io = require('socket.io')(server, { cors: { origin: '*', method: ['GET', 'POST'] } });
const games = {};

io.on('connection', client => {
  console.log(client.id, client.handshake.address);
  client.on('login', id => {
    console.log(id);
    client.playerId = id;
  });
  client.on('init', ({ clientId, width, charWidth }) => {
    client.width = width;
    client.charWidth = charWidth;
    if (!client.gameId) client.gameId = clientId;
    const game = games[client.gameId];
    if (game) {
      if (!game.ready) game.stop();
      game.resetGame();
    } else {
      client.gameId = clientId;
      games[clientId] = new Game(client);
    }
  });
  client.on('state', cmd => {
    console.log(client.gameId, 'state', cmd);
    const game = games[client.gameId];
    if (game == null) {
      client.emit('state', 'restart');
      return;
    }
    switch (cmd) {
      case 'cReady':
        if (game.ready) {
          client.emit('game', game.getState());
          client.emit('state', 'play');
          game.start();
        }
        break;
      case 'play':
        break;
      case 'gameover':
        client.emit('state', 'gameover');
        game.stop();
        game.recordScore();
        game.resetGame();
        client.emit('game', game.getState());
        break;
      default:
        console.log('unknown cmd', cmd);
    }
  });
  client.on('error', err => {
    delete games[client.gameId];
    console.log(err);
  });
  client.on('disconnect', reason => {
    console.log('reason', reason);
    delete games[client.gameId];
    console.log(Object.keys(games));
    console.log(io.engine.clientsCount);
  });
});

server.listen(4000, () => console.log('server running at http://localhost:4000'));
server.on('error', err => console.err(err));
