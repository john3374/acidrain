'use client';
import Popup from 'reactjs-popup';
import Image from 'next/image';
import { useEffect, useRef, useState } from 'react';
import { useSession } from 'next-auth/react';
import { socket } from '@/components/socket';
import Stopwatch from '@/components/Stopwatch';
import ScoreBoard from '@/components/ScoreBoard';
import ButtonLogin from '@/components/ButtonLogin';
import 'reactjs-popup/dist/index.css';

const GAME_STATE = { BEFORE_START: 0, PLAYING: 1, GAME_OVER: 2, READY: 3 };

const Home = () => {
  const inputRef = useRef(null);
  const inputValueRef = useRef(null);
  const canvasRef = useRef(null);
  const [showPopup, setShowPopup] = useState(false);
  const [popupText, setPopupText] = useState('');
  const [titleText, setTitleText] = useState('랜덤타자연습');
  const [footerText, setFooterText] = useState('연결 없음');
  const [popupColour, setPopupColour] = useState('');
  const [stat, setStat] = useState({ level: 1, correct: 0, incorrect: 0, accuracy: 0, score: 10, life: 18 });
  const [game, setGame] = useState([]);
  const [gameState, setGameState] = useState(0);
  const [hideTutorial, setHideTutorial] = useState(false);
  const { data: session } = useSession();

  useEffect(() => {
    setHideTutorial(localStorage.getItem('hideTutorial') === 'true' || false);
  }, [showPopup]);
  
  useEffect(() => {
    const ctx = canvasRef.current.getContext('2d');
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
    // ctx.fillText(ctx.measureText('벌거숭이').width, 5, 30);

    ctx.font = '600 1.5em 궁서';
    game.forEach(pos => {
      ctx.fillText(pos.word, (gw - 108) * pos.x, (pos.y / 25) * gh);
    });
    if (socket.connected) {
    }
    socket.on('disconnect', () => {
      setFooterText('연결 없음');
    });
    socket.on('test', data => console.log(data));
    socket.on('state', cmd => {
      console.log('state', cmd);
      switch (cmd) {
        case 'sReady':
          switch (gameState) {
            case GAME_STATE.GAME_OVER:
              resetGame();
              setTimeout(() => initGame(), 5000);
              break;
            case GAME_STATE.BEFORE_START:
            case GAME_STATE.PLAYING:
              initGame();
              break;
          }
          break;
        case 'play':
          setShowPopup(false);
          setFooterText('');
          setGameState(GAME_STATE.PLAYING);
          break;
        case 'gameover':
          setPopupColour('yellow');
          setPopupText('놀이가 끝났습니다.');
          setShowPopup(true);
          setFooterText('');
          setGameState(GAME_STATE.GAME_OVER);
          resetGame();
          break;
      }
    });
    socket.on('game', game => {
      const { level, life, position, correct, incorrect, score } = game;
      if (gameState === GAME_STATE.PLAYING) {
        setStat(
          Object.assign(stat, {
            level,
            life,
            correct,
            incorrect,
            score,
            accuracy: correct + incorrect !== 0 ? Math.round((correct / (correct + incorrect)) * 100) : 0,
          })
        );
        setGame(position);
      } else if (gameState === GAME_STATE.GAME_OVER)
        setStat(
          Object.assign(stat, {
            level,
            life,
            correct,
            incorrect,
            score,
            accuracy: correct + incorrect !== 0 ? Math.round((correct / (correct + incorrect)) * 100) : 0,
          })
        );
    });
    return () => {
      socket.off();
    };
  });

  const resetGame = () => {
    setGame([]);
    setStat({ level: 1, correct: 0, incorrect: 0, accuracy: 0, score: 10, life: 18 });
  };

  const initGame = () => {
    setTitleText(`랜덤타자연습 (놀이마당 ${stat.level})`);
    setPopupText(`${stat.level}  놀 이 마 당`);
    setShowPopup(true);
    setFooterText('사이띄개를 누르세요');
    setGameState(GAME_STATE.READY);
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
  const inputChangeHandler = e => (inputValueRef.current = e.target.value);
  const inputHandler = e => {
    if (e.nativeEvent.isComposing === false)
      switch (e.code) {
        case 'Escape':
          socket.emit('state', 'gameover');
          break;
        case 'Space':
        case 'Enter':
          e.preventDefault();
          switch (gameState) {
            case GAME_STATE.GAME_OVER:
              break;
            case GAME_STATE.READY:
              if (session?.user.id) socket.emit('login', session.user.id);
              socket.emit('state', 'cReady');
              break;
            case GAME_STATE.PLAYING:
              const trimmed = inputRef.current.value.trim();
              if (trimmed) socket.emit('game', trimmed);
              break;
          }
          inputRef.current.value = '';
          break;
      }
  };

  // onFocus={resumeGame}
  // onBlur={() => (isGame ? pauseGame() : 0)}
  // const pauseGame = () => {
  //   setPopupColour('yellow');
  //   setPopupText('일 시 정 지');
  // };
  const resumeGame = () => {
    if (gameState === GAME_STATE.BEFORE_START) {
      setGameState(GAME_STATE.PLAYING);
      inputRef.current.focus();
    }
  };

  return (
    <main onClick={() => inputRef.current.focus()}>
      <div className="title">
        <div className="title-text">
          <Image className="logo" src="/title.png" alt="logo" width={36} height={30} />
          <span id="titleText">{titleText}</span>
        </div>
        <div className="profile">
          <Popup trigger={<button className="button">점수 보기</button>} modal nested>
            {close => (
              <div className="modal">
                <div className="content">
                  <ScoreBoard />
                </div>
              </div>
            )}
          </Popup>
          <ButtonLogin />
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
          <input className="p-4" id="gameInput" type="text" spellCheck="false" autoFocus onKeyDown={inputHandler} ref={r => (inputRef.current = r)} />
        </div>
        <div className="footer-status">
          <div className="keyboard">한글-2</div>
          <div className="status">{footerText}</div>
          <div className="elapsed">
            <Stopwatch />
          </div>
        </div>
      </div>
      {showPopup && (
        <div className="popup-container" onClick={() => inputRef.current.focus()}>
          {!hideTutorial && (
            <div className="tutorial">
              로그인을 하시면 <br />
              점수를 기록하실 수 있습니다.
              <button
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
            {popupText}
          </div>
        </div>
      )}
    </main>
  );
};

export default Home;