'use client';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@radix-ui/react-tabs';
import { useSession } from 'next-auth/react';
import dynamic from 'next/dynamic';
import Image from 'next/image';
import { useEffect, useRef, useState } from 'react';

import ButtonLogin from '@/components/ButtonLogin';
import RotateNotice, { useLandscapePhone } from '@/components/RotateNotice';
import { achievementById } from '@/game/achievements';
import ScoreBoard from '@/components/ScoreBoard';
import { NO_GAME, gameTimeAfter } from '@/components/gameTime';
import { clientId, socket } from '@/components/socket';
import Stopwatch from '@/components/Stopwatch';
import useViewportHeight from '@/components/useViewportHeight';
import 'reactjs-popup/dist/index.css';

const Popup = dynamic(() => import('reactjs-popup'), { ssr: false });

const GAME_STATE = { BEFORE_START: 0, PLAYING: 1, GAME_OVER: 2, READY: 3, WAITING: 4 };

const Home = () => {
  const inputRef = useRef(null);
  const canvasRef = useRef(null);
  const gameOverTimer = useRef(null);
  // True between `gameover` and leaving the game-over screen. A ref, because `result` can arrive in the same
  // batch as `gameover`, before React has committed the new gameState.
  const awaitingResult = useRef(false);
  // True while the server holds the Game because the phone is sideways and the rotate notice covers it.
  const pausedForRotation = useRef(false);
  // Game overs seen on this connection; a `result` for an earlier Game (its `sequence` is lower) is stale.
  const gamesFinished = useRef(0);
  // Enter was pressed while a syllable was still being composed; submit once it's committed.
  const submitAfterComposition = useRef(false);
  const [showPopup, setShowPopup] = useState({ game: false, levelSelect: false, score: false, settings: false, profile: false });
  const [popupText, setPopupText] = useState(null);
  const [footerText, setFooterText] = useState('연결을 기다리는 중입니다');
  const [popupColour, setPopupColour] = useState('');
  const [stat, setStat] = useState({ level: 1, correct: 0, incorrect: 0, accuracy: 0, score: 10, life: 18 });
  const [game, setGame] = useState([]);
  const [gameState, setGameState] = useState(0);
  const [gameTime, setGameTime] = useState(NO_GAME);
  // The finished Game's Achievements from the `result` event: { achievements: [id], guest }.
  const [result, setResult] = useState(null);
  const [hideTutorial, setHideTutorial] = useState(() =>
    typeof window === 'undefined' ? false : localStorage.getItem('hideTutorial') === 'true'
  );
  const [online, setOnline] = useState(false);
  const [bgWord, setBgWord] = useState(() => (typeof window === 'undefined' ? '#aaa' : localStorage.getItem('wordBgColour') || '#aaa'));
  const { data: session, status } = useSession();
  const viewportHeight = useViewportHeight();
  const landscape = useLandscapePhone();
  // The notice never hides a running Game: once a Level's Pauses are used up, it stays playable sideways.
  const showRotateNotice = landscape && (gameState !== GAME_STATE.PLAYING || gameTime.paused);
  const titleText = `랜덤타자연습 (놀이마당 ${stat.level})`;

  const resetGame = () => {
    setGame([]);
    setStat({ level: 1, correct: 0, incorrect: 0, accuracy: 0, score: 10, life: 18 });
  };

  // Back to Level select after a Game over, whether the 4-second timer or a key got there first.
  const dismissGameOver = () => {
    clearTimeout(gameOverTimer.current);
    gameOverTimer.current = null;
    awaitingResult.current = false;
    resetGame();
    setResult(null);
    setShowPopup(prev => ({ ...prev, levelSelect: true, game: false }));
    setGameState(GAME_STATE.BEFORE_START);
  };

  // The Level banner reads stat.level when it renders: `sReady` can arrive before the handlers see the new Level.
  const initGame = () => {
    setPopupText(null);
    setShowPopup(prev => ({ ...prev, game: true }));
    setFooterText('사이띄개를 누르세요');
    setGameState(GAME_STATE.READY);
  };

  // Pause the Game while the rotate notice hides it, and resume once the phone is upright again.
  useEffect(() => {
    const pause = landscape && gameState === GAME_STATE.PLAYING;
    if (pause === pausedForRotation.current) return;
    pausedForRotation.current = pause;
    socket.emit('state', pause ? 'pause' : 'resume');
  }, [landscape, gameState]);

  useEffect(() => {
    const ctx = canvasRef.current.getContext('2d');
    if (online === false)
      setTimeout(() => {
        if (socket.connected && gameState == GAME_STATE.BEFORE_START) {
          socket.emit('init', { clientId, width: canvasRef.current.offsetWidth, charWidth: ctx.measureText('글').width });
          setShowPopup(prev => ({ ...prev, levelSelect: true }));
          setFooterText('');
          setOnline(true);
        }
      }, 2000);

    // animationFrameId = requestAnimationFrame(gameLoop);
    const gw = canvasRef.current.offsetWidth;
    const gh = canvasRef.current.offsetHeight;
    ctx.canvas.width = gw;
    ctx.canvas.height = gh;
    // safely reset frame counter
    // render
    ctx.clearRect(0, 0, canvasRef.current.offsetWidth, canvasRef.current.offsetHeight);

    // ctx.font = '600 1rem san-serif';
    // ctx.fillText(clientId, 5, 15);
    // ctx.fillText(ctx.measureText('벌거숭이').actualBoundingBoxDescent , 5, 45);

    const fontSize = gw > 1000 ? '1.5em' : '1em';
    ctx.font = `600 ${fontSize} ChosunGs`;
    game.forEach(pos => {
      const metrics = ctx.measureText(pos.word);
      ctx.fillStyle = bgWord;
      ctx.fillRect((gw - 108) * pos.x, ((pos.y - 2) / 25) * gh, metrics.width, metrics.actualBoundingBoxAscent + metrics.actualBoundingBoxDescent);
      ctx.fillStyle = '#000';
      ctx.fillText(pos.word, (gw - 108) * pos.x, ((pos.y - 2) / 25) * gh + 20);
    });

    socket.on('disconnect', () => {
      setFooterText('연결 없음');
    });
    socket.on('connect', () => {
      gamesFinished.current = 0;
      pausedForRotation.current = false;
    });
    socket.on('state', cmd => {
      const now = Date.now();
      setGameTime(prev => gameTimeAfter(prev, cmd, now));
      switch (cmd) {
        case 'restart':
          setGameState(GAME_STATE.BEFORE_START);
          setShowPopup(prev => ({ ...prev, levelSelect: true }));
          setFooterText('사이띄개를 누르세요');
          break;
        case 'sReady':
          switch (gameState) {
            case GAME_STATE.PLAYING:
              initGame();
              break;
          }
          break;
        case 'play':
          setShowPopup(prev => ({ ...prev, game: false }));
          setFooterText('');
          setGameState(GAME_STATE.PLAYING);
          break;
        case 'gameover':
          setPopupColour('yellow');
          setPopupText('놀이가 끝났습니다.');
          setShowPopup(prev => ({ ...prev, game: true }));
          setFooterText('');
          setGameState(GAME_STATE.GAME_OVER);
          setResult(null);
          awaitingResult.current = true;
          gamesFinished.current += 1;
          clearTimeout(gameOverTimer.current);
          gameOverTimer.current = setTimeout(dismissGameOver, 4000);
          break;
      }
    });
    // Arrives just after `gameover`, once the Score is saved. With Achievements to read, the screen waits for a key.
    socket.on('result', payload => {
      if (!awaitingResult.current || !Array.isArray(payload?.achievements)) return;
      if (typeof payload.sequence === 'number' && payload.sequence < gamesFinished.current) return;
      setResult(payload);
      if (payload.achievements.length > 0) {
        clearTimeout(gameOverTimer.current);
        gameOverTimer.current = null;
        setFooterText('사이띄개를 누르세요');
      }
    });
    socket.on('game', game => {
      const { level, life, position, correct, incorrect, score } = game;
      if (gameState === GAME_STATE.PLAYING) {
        setStat({
          level,
          life,
          correct,
          incorrect,
          score,
          accuracy: correct + incorrect !== 0 ? Math.round((correct / (correct + incorrect)) * 100) : 0,
        });
        setGame(position.filter(p => p.y > 1));
      } else if (gameState === GAME_STATE.GAME_OVER)
        setStat({
          level,
          life,
          correct,
          incorrect,
          score,
          accuracy: correct + incorrect !== 0 ? Math.round((correct / (correct + incorrect)) * 100) : 0,
        });
    });
    return () => socket.off();
  });

  const handleLevelSelect = level => {
    setStat(prev => ({ ...prev, level }));
    socket.emit('startLevel', level);
    setShowPopup(prev => ({ ...prev, levelSelect: false }));
    initGame();
  };

  const populateLife = () => {
    const bar = [];
    const { life } = stat;
    for (let i = 0; i < 18; i++)
      if (i < life)
        bar.push(
          <span key={i} className="life">
            {' '}
          </span>
        );
      else
        bar.push(
          <span key={i} className="nolife">
            {' '}
          </span>
        );
    return bar;
  };

  const submitWord = input => {
    submitAfterComposition.current = false;
    // Words don't count during a Pause; keep what was typed for after it.
    if (gameState !== GAME_STATE.PLAYING || gameTime.paused) return;
    const trimmed = input.value.trim();
    if (trimmed) socket.emit('game', trimmed);
    input.value = '';
  };

  const inputHandler = e => {
    // Mid-composition the last syllable isn't in the value yet, and clearing the input now would leave it behind
    // as the start of the next word. Space reaches handleWordInput once the syllable is committed; Enter waits
    // for compositionend.
    if (e.nativeEvent.isComposing) {
      if (e.key === 'Enter' || e.code === 'Enter' || e.code === 'NumpadEnter') submitAfterComposition.current = true;
      return;
    }
    switch (e.key) {
      case 'Escape':
        if (gameState === GAME_STATE.GAME_OVER) dismissGameOver();
        else socket.emit('state', 'gameover');
        break;
      case 'Enter':
      case ' ':
        switch (gameState) {
          case GAME_STATE.GAME_OVER:
            dismissGameOver();
            break;
          case GAME_STATE.READY:
            if (session?.user.id) socket.emit('login', session.user.id);
            socket.emit('state', 'cReady');
            break;
          case GAME_STATE.PLAYING:
            if (gameTime.paused) break;
            e.preventDefault();
            submitWord(e.target);
            break;
        }
        break;
    }
  };

  // A space that commits a syllable, or one from a phone keyboard that only sends keyCode 229, arrives as input.
  const handleWordInput = e => {
    const { data, isComposing } = e.nativeEvent;
    if (!isComposing && data && /\s/.test(data)) submitWord(e.target);
  };

  const handleCompositionEnd = e => {
    if (!submitAfterComposition.current) return;
    const input = e.target;
    // The committed syllable lands in the value just after compositionend.
    setTimeout(() => submitWord(input));
  };

  const handleColourChange = c => {
    localStorage.setItem('wordBgColour', c);
    setBgWord(c);
  };

  // onFocus={resumeGame}
  // onBlur={() => (isGame ? pauseGame() : 0)}
  // const pauseGame = () => {
  //   setPopupColour('yellow');
  //   setPopupText('일 시 정 지');
  // };

  return (
    <main style={viewportHeight ? { height: viewportHeight } : undefined} onClick={() => inputRef.current.focus()}>
      <div className="title">
        <div className="title-text">
          <Image className="logo" src="/title.png" alt="logo" width={36} height={30} />
          <span id="titleText">{titleText}</span>
        </div>
        <div className="profile">
          <Popup
            trigger={<button className="button">점수 보기</button>}
            modal
            nested
            open={showPopup.score}
            onClose={() => setShowPopup(prev => ({ ...prev, score: false }))}
            closeOnDocumentClick={false}
          >
            {close => (
              <div className="level-select-window">
                <div className="title">
                  <div className="title-text">
                    <Image className="logo" src="/title.png" alt="logo" width={36} height={30} />
                    <span className="titleText">점수 보기</span>
                  </div>
                  <button type="button" className="button quit" aria-label="닫기" onClick={close}>
                    X
                  </button>
                </div>
                <div className="content">
                  <Tabs defaultValue="today" className="w-full" style={{ marginTop: '.5rem' }}>
                    <TabsList className="flex gap-1">
                      <TabsTrigger value="today" className="button">
                        오늘
                      </TabsTrigger>
                      <TabsTrigger value="week" className="button">
                        지난 7일
                      </TabsTrigger>
                      <TabsTrigger value="month" className="button">
                        지난 30일
                      </TabsTrigger>
                      <TabsTrigger value="all" className="button">
                        전체
                      </TabsTrigger>
                    </TabsList>
                    <TabsContent value="today">
                      <ScoreBoard queryKey={['score-today']} queryFn={() => fetch('/api/score/today').then(res => res.json())} />
                    </TabsContent>
                    <TabsContent value="week">
                      <ScoreBoard queryKey={['score-last-7-days']} queryFn={() => fetch('/api/score/week').then(res => res.json())} />
                    </TabsContent>
                    <TabsContent value="month">
                      <ScoreBoard queryKey={['score-last-month']} queryFn={() => fetch('/api/score/month').then(res => res.json())} />
                    </TabsContent>
                    <TabsContent value="all">
                      <ScoreBoard queryKey={['score-all-time']} queryFn={() => fetch('/api/score').then(res => res.json())} />
                    </TabsContent>
                  </Tabs>
                </div>
              </div>
            )}
          </Popup>
          <Popup
            trigger={<button className="button">설정</button>}
            modal
            nested
            open={showPopup.settings}
            onClose={() => setShowPopup(prev => ({ ...prev, settings: false }))}
            closeOnDocumentClick={false}
          >
            {close => (
              <div className="level-select-window">
                <div className="title">
                  <div className="title-text">
                    <Image className="logo" src="/title.png" alt="logo" width={36} height={30} />
                    <span className="titleText">점수 보기</span>
                  </div>
                  <button type="button" className="button quit" aria-label="닫기" onClick={close}>
                    X
                  </button>
                </div>
                <div className="content">
                  <div className="word-bg-picker">
                    단어 배경색:
                    <button type="button" aria-label="단어 배경 회색" className={`word-bg aaa${bgWord === '#aaa' ? ' active' : ''}`} onClick={() => handleColourChange('#aaa')}></button>
                    <button type="button" aria-label="단어 배경 밝은 회색" className={`word-bg ccc${bgWord === '#ccc' ? ' active' : ''}`} onClick={() => handleColourChange('#ccc')}></button>
                    <button type="button" aria-label="단어 배경 흰색" className={`word-bg fff${bgWord === '#fff' ? ' active' : ''}`} onClick={() => handleColourChange('#fff')}></button>
                  </div>
                  <hr />
                </div>
              </div>
            )}
          </Popup>
          <ButtonLogin />
          <button
            type="button"
            className="button quit"
            aria-label="게임 종료"
            onClick={e => {
              e.preventDefault();
              socket.emit('state', 'gameover');
            }}
          >
            X
          </button>
        </div>
      </div>
      <div className="dashboard">
        <div className="stats">
          <span>정타:{stat.correct}</span>
          <span>오타:{stat.incorrect}</span>
          <span>정확도:{stat.accuracy}%</span>
        </div>
        <div className="score">
          <span>점수:</span>
          <div>{stat.score}</div>
        </div>
        <div className="life-container">
          <span>pH:</span>
          <span>{populateLife()}</span>
        </div>
      </div>
      <canvas className="game" ref={canvasRef} />
      <div className="footer">
        <div id="footer-input" data-input="">
          <input className="p-4" id="gameInput" type="text" aria-label="게임 단어 입력" spellCheck="false" autoFocus onKeyDown={inputHandler} onInput={handleWordInput} onCompositionEnd={handleCompositionEnd} ref={inputRef} />
        </div>
        <div className="footer-status">
          <div className="keyboard">한글-2</div>
          <div className="status">{footerText}</div>
          <div className="elapsed">
            <Stopwatch start={gameTime.start} end={gameTime.end} />
          </div>
        </div>
      </div>
      <Popup
        contentStyle={{ width: '30rem' }}
        defaultOpen={true}
        open={showPopup.levelSelect}
        onClose={() => setShowPopup(prev => ({ ...prev, levelSelect: false }))}
        closeOnDocumentClick={false}
        modal
        nested
      >
        {() => (
          <div className="level-select-window">
            <div className="title">
              <div className="title-text">
                <Image className="logo" src="/title.png" alt="logo" width={36} height={30} />
                <span className="titleText">놀이마당</span>
              </div>
            </div>
            <div className="level-select-content">
              <fieldset className="level-select-header">
                <legend className="level-select-header-legend">&nbsp;마당</legend>
                <div className="level-select-list">
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(level => (
                    <button key={level} type="button" className="level-select-item" onClick={() => handleLevelSelect(level)}>
                      {level} 놀이마당
                    </button>
                  ))}
                </div>
              </fieldset>
            </div>
            <div className="level-select-footer">
              <div className="level-select-footer-text">놀이의 마당을 선택하세요</div>
            </div>
          </div>
        )}
      </Popup>
      {showPopup.game && (
        <div className="popup-container" onClick={() => inputRef.current.focus()}>
          {!hideTutorial && status !== 'authenticated' && (
              <div className="tutorial">
                로그인을 하시면
                <br />
                점수를 기록하실 수 있습니다.
                <br />
                로그인을 위해 이메일만 수집합니다.
                <br />
                탈퇴시 이메일과 기록은 삭제됩니다.
                <button
                  type="button"
                  className="button"
                  onClick={() => {
                    localStorage.setItem('hideTutorial', true);
                    setHideTutorial(true);
                  }}
                >
                  다시 보지 않기
                </button>
              </div>
            )}
          <div id="gameover" className={popupColour}>
            {popupText ?? `${stat.level}  놀 이 마 당`}
          </div>
          {result?.achievements.length > 0 && (
            <div className="achievements-earned" aria-label="업적">
              <div className="achievements-earned-title">{result.guest ? '로그인했다면 받았을 업적' : '새 업적'}</div>
              {result.achievements.map(id => (
                <span key={id} className="achievement-badge">
                  {achievementById(id)?.name ?? id}
                </span>
              ))}
            </div>
          )}
        </div>
      )}
      {showRotateNotice && <RotateNotice />}
    </main>
  );
};

export default Home;
