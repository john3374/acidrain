const Game = require('./Game');

require('dotenv').config();
require('../db');
// const mariadb = require('mysql2');
// const pool = mariadb.createPool({
//   host: process.env.DB_HOST,
//   user: process.env.DB_USER,
//   password: process.env.DB_PASSWORD,
//   connectionLimit: 5,
//   database: 'kkong',
// });

const getWords = async () => {
  let con;
  try {
    // con = pool.promise(); // await pool.getConnection();
    // const [rows, fields] = await con.query('SELECT word FROM acidrain_word ORDER BY RAND() LIMIT 10');
    console.log(rows);
    return rows.map(row => row.word);
  } catch (e) {
    console.log(e);
  } finally {
    // if (con) con.release();
  }
};
const server = require('http').createServer();
const io = require('socket.io')(server, { cors: { origin: '*', method: ['GET', 'POST'] } });
const games = {};

io.on('connection', client => {
  console.log(client.id, client.handshake.address);
  // getWords()
  //   .then(res => client.emit('test', JSON.stringify(res)))
  //   .catch(err => console.log(err));
  client.on('login', id => {
    console.log(id);
    client.playerId = id;
  });
  client.on('init', id => {
    if (!client.gameId) client.gameId = id;
    games[client.gameId] = new Game(client);
  });
  client.on('state', cmd => {
    console.log('state', cmd);
    const game = games[client.gameId];
    switch (cmd) {
      case 'cReady':
        client.emit('game', game.getState());
        client.emit('state', 'play');
        game.start();
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
        client.to(client.gameId).emit('wow');
    }
  });
  client.on('error', err => {
    delete games[client.gameId];
    console.log(err);
  });
  client.on('disconnect', reason => {
    delete games[client.gameId];
  });
});

server.listen(4000, () => console.log('server running at http://localhost:4000'));
server.on('error', err => console.err(err));
