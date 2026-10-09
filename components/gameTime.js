// When the current Game started and, once it is finished, when it ended (ms timestamps).
// A paused Game holds its time in `end` with `paused` set, so the stopwatch stands still.
export const NO_GAME = { start: null, end: null };

const isRunning = ({ start, end }) => start != null && end == null;

// The next Game time after a socket `state` command. A Game starts on the first `play`
// after Level select; the `play` after a Level clear finds a Game running and leaves it alone.
export const gameTimeAfter = (time, cmd, now) => {
  switch (cmd) {
    case 'play':
      return isRunning(time) ? time : { start: now, end: null };
    case 'pause':
      return isRunning(time) ? { ...time, end: now, paused: true } : time;
    // Shift the start by the time spent paused, so the Game's time leaves the pause out.
    case 'resume':
      return time.paused ? { start: time.start + (now - time.end), end: null } : time;
    case 'gameover':
    case 'restart':
      if (time.paused) return { start: time.start, end: time.end };
      return isRunning(time) ? { ...time, end: now } : time;
    default:
      return time;
  }
};
