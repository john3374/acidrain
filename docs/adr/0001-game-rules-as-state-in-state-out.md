# Game rules are a state-in, state-out module

The game rules (Score, pH, drop speed, Level bonus, word placement) live in a top-level `game/` module that only calculates: it takes the current state of a Game and one event (start, tick, typed word, quit, words loaded) and returns the new state plus a list of things to do (send state, schedule the next tick, fetch words, Game over with final Score). The socket server in `wss/` owns the timer, the socket, MongoDB and seed creation, and carries those things out. We chose this so every rule can be tested by feeding events in, with no fake timers, sockets or database, and so Leaderboard changes to what a Score records never touch the rules.

## Considered Options

- **One `Game` class with injected clock, random source, sender and storage.** Rejected: the rules stay spread across four fakes, and tests must drive a timer.
- **Pull out only small pure helpers (scoring, drop speed, placement).** Rejected: the tick loop, the hardest part to get right, would stay untested.

## Consequences

- The rules module can't fetch or wait. When a Level ends it returns "fetch words for the next Level", and the socket server replies with a "words loaded" event. This keeps today's timing and database load.
- The server sends one state message per event, where today it sometimes sends two in one tick. The browser shows the same thing.
- Before the rules move, tests pin the current `wss/Game.js` behaviour with a fake database and timer, so the move can be shown not to change gameplay.
