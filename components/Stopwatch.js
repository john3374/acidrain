import { useEffect, useState } from 'react';
const start = Date.now();
const Stopwatch = () => {
  const [time, setTime] = useState(0);
  const formatTimer = num => {
    const min = Math.floor(num / 60);
    const sec = num % 60;
    return `${min < 10 ? '0' + min : min}:${sec < 10 ? '0' + sec : sec}`;
  };

  useEffect(() => {
    let secOffset = 1000;
    let timeId = setTimeout(() => {
      const now = Date.now();
      setTime(Math.round((now - start) / 1000));
      secOffset = 1000 - (now % 1000);
    }, secOffset);
    return () => clearTimeout(timeId);
  });

  return <div>{formatTimer(time)}</div>;
};

export default Stopwatch;
