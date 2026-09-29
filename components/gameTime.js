// When the current Game started and, once it is finished, when it ended (ms timestamps).
export const NO_GAME = { start: null, end: null };

const isRunning = ({ start, end }) => start != null && end == null;

// The next Game time after a socket `state` command. A Game starts on the first `play`
// after Level select; the `play` after a Level clear finds a Game running and leaves it alone.
export const gameTimeAfter = (time, cmd, now) => {
  switch (cmd) {
    case 'play':
      return isRunning(time) ? time : { start: now, end: null };
    case 'gameover':
    case 'restart':
      return isRunning(time) ? { ...time, end: now } : time;
    default:
      return time;
  }
};
