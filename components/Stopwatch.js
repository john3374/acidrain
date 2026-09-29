import { useEffect, useState } from 'react';

const formatTimer = num => {
  const min = Math.floor(num / 60);
  const sec = num % 60;
  return `${min < 10 ? '0' + min : min}:${sec < 10 ? '0' + sec : sec}`;
};

// Shows how long the current Game has lasted: 00:00 before the first Game, counting while
// `start` is set and `end` is not, and holding its value once `end` is set.
const Stopwatch = ({ start = null, end = null }) => {
  const [now, setNow] = useState(0);
  const running = start != null && end == null;

  useEffect(() => {
    if (!running) return;
    const timeId = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timeId);
  }, [running, start]);

  const time = start == null ? 0 : Math.max(0, Math.floor(((end ?? now) - start) / 1000));
  return <div>{formatTimer(time)}</div>;
};

export default Stopwatch;
