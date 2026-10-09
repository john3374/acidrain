import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import Stopwatch from './Stopwatch.js';
import { gameTimeAfter, NO_GAME } from './gameTime.js';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

let container;
let root;

const render = props => act(() => root.render(<Stopwatch {...props} />));
const wait = ms => act(() => vi.advanceTimersByTime(ms));
const shown = () => container.textContent;

beforeEach(() => {
  vi.useFakeTimers();
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.useRealTimers();
});

describe('Stopwatch', () => {
  test('shows 00:00 before the first Game, however long the page has been open', () => {
    render({ start: null, end: null });
    wait(60_000);
    expect(shown()).toBe('00:00');
  });

  test('counts from 00:00 when a Game starts', () => {
    wait(60_000); // the page was open for a minute before the Game
    render({ start: Date.now(), end: null });
    expect(shown()).toBe('00:00');
    wait(1000);
    expect(shown()).toBe('00:01');
    wait(61_000);
    expect(shown()).toBe('01:02');
  });

  test('holds its value once the Game is finished', () => {
    const start = Date.now();
    render({ start, end: null });
    wait(5000);
    render({ start, end: start + 5000 });
    wait(30_000);
    expect(shown()).toBe('00:05');
  });

  test('keeps elapsed time visible immediately after a long Pause resumes', () => {
    let time = gameTimeAfter(NO_GAME, 'play', Date.now());
    render(time);
    wait(3500);
    time = gameTimeAfter(time, 'pause', Date.now());
    render(time);
    expect(shown()).toBe('00:03');

    wait(60_000);
    expect(shown()).toBe('00:03');
    time = gameTimeAfter(time, 'resume', Date.now());
    render(time);
    expect(shown()).toBe('00:03');

    wait(1000);
    expect(shown()).toBe('00:04');
  });

  test('resets to 00:00 when the next Game starts', () => {
    const start = Date.now();
    render({ start, end: null });
    wait(5000);
    render({ start, end: start + 5000 });
    wait(30_000);
    render({ start: Date.now(), end: null });
    expect(shown()).toBe('00:00');
    wait(2000);
    expect(shown()).toBe('00:02');
  });
});
