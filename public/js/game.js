const getByID = id => document.getElementById(id);
const domElpased = getByID('elapsed');
const domInput = getByID('gameInput');
const domText = getByID('footer-input');
const domLife = getByID('life');
const domGame = getByID('game');
const domScore = getByID('score');
const domCorrect = getByID('correct');
const domWrong = getByID('wrong');
const domAccuracy = getByID('accuracy');
const domGameover = getByID('gameover-container');
const domGameoverText = getByID('gameover');
const domClose = getByID('btnClose');
const domTitle = getByID('titleText');
const ctx = domGame.getContext('2d');
const defaultWords = ['커다랗다', '산들바람', '바로잡다', '꽁지', '셈틀', '덩달다', '길쭉하다', '담빡', '삐죽이', '무럭무럭'];
let secOffset = 1000,
  time = 0,
  life = 18,
  correct = 0,
  wrong = 0,
  level = 1,
  score = 10,
  nextLevel = 26;
let words = [],
  wordQueue = defaultWords;
let wordIdx = 0,
  dropRain = true,
  lastTime = 0,
  running = true,
  isGame = true,
  genSkipped = 0;

const elapsedTimer = setInterval(() => {
  domElpased.innerHTML = formatTimer(++time);
  secOffset = 1000 - (new Date().getTime() % 1000);
}, secOffset);

const gameUpdate = () => {
  const now = new Date().getTime();
  const gw = domGame.offsetWidth;
  const gh = domGame.offsetHeight;
  const dropRate = 1800 - level * 100;
  ctx.canvas.width = gw;
  ctx.canvas.height = gh;
  if (now - lastTime > dropRate) {
    if (nextLevel - correct > words.length && (genSkipped > 2 || Math.random() < (level + 50) / 100)) {
      words.push({
        word: genWord(),
        x: Math.random() * (gw - 80),
        y: 0,
        sp: Math.random() < 0.04 ? true : false,
      });
      genSkipped = 0;
    } else genSkipped++;
    for (let i in words) {
      words[i].y += 20;
      if (words[i].y > gh) {
        delete words[i];
        words.splice(i, 1);
        populateLife(--life);
      }
    }
    lastTime = now;
  }
  if (correct >= nextLevel) {
    nextLevel += 26 + 2 * level++;
    showPopup(`${level}  놀 이 마 당`);
    domTitle.innerHTML = `한컴타자연습 (놀이마당 ${level})`;
  }
};

const gameRender = () => {
  ctx.clearRect(0, 0, domGame.offsetWidth, domGame.offsetHeight);
  ctx.font = '600 1.5em 궁서';
  for (let i in words) {
    const { word, x, y, sp } = words[i];
    ctx.fillStyle = sp ? 'cyan' : 'black';
    ctx.fillText(word, x, y);
  }
};

const gameLoop = () => {
  if (isGame) {
    gameUpdate();
    gameRender();
    if (running) {
      if (life > 0) setTimeout(gameLoop, 30);
      else endGame();
    }
  }
};

const endGame = () => {
  if (isGame) {
    isGame = false;
    clearInterval(elapsedTimer);
    showPopup('놀이가 끝났습니다.');
    const xhr = new XMLHttpRequest();
    xhr.open('POST', 'record.php', true);
    xhr.setRequestHeader('Content-type', 'application/x-www-form-urlencoded');
    xhr.send(`score=${score}&correct=${correct}&wrong=${wrong}&secret=${getByID('secret').value}&time=${time}&level=${level}&name=이름 없음`);
    xhr.onreadystatechange = () => {
      if (xhr.readyState == 4) {
        showScore(xhr.responseText);
      }
    };
  }
};

const showScore = data => {
  console.log(data);
};

const showPopup = str => {
  running = false;
  domGameoverText.innerHTML = str;
  domGameover.style.display = 'flex';
};

const genWord = () => {
  const ret = wordQueue[wordIdx++];
  if (wordIdx >= wordQueue.length) {
    wordIdx = 0;
    shuffleWords();
  }
  return ret;
};

const shuffleWords = async () => {
  const req = new XMLHttpRequest();
  req.onreadystatechange = e => {
    if (e.target.readyState === 4 && e.target.status === 200 && e.target.responseText) wordQueue = JSON.parse(e.target.responseText);
    else wordQueue = defaultWords;
  };
  req.open('GET', 'morewords.php', true);
  req.send();
  // for (let i = wordQueue.length - 1; i > 0; i--) {
  //   const j = Math.floor(Math.random() * (i + 1));
  //   [wordQueue[i], wordQueue[j]] = [wordQueue[j], wordQueue[i]];
  // }
};

const formatTimer = num => {
  const min = Math.floor(num / 60);
  const sec = num % 60;
  return `${min < 10 ? '0' + min : min}:${sec < 10 ? '0' + sec : sec}`;
};

const populateLife = life => {
  domLife.innerHTML = '';
  for (let i = 0; i < 18; i++) domLife.innerHTML += `<span class="${i < life ? '' : 'no'}life"> </span>`;
};

const resumeGame = () => {
  if (!running && isGame) {
    domGameover.style.display = 'none';
    domInput.focus();
    running = true;
    gameLoop();
  }
};

const onLoad = () => {
  populateLife(life);
  domGame.setAttribute('height', domGame.offsetHeight);
  domGame.setAttribute('width', domGame.offsetWidth);
  domTitle.innerHTML = `한컴타자연습 (놀이마당 ${level})`;
  domClose.addEventListener('click', () => endGame());
  domInput.addEventListener('keyup', e => {
    if (e.code === 'Space' || e.code === 'Enter') {
      if (domInput.value.trim() !== '') {
        let isCorrect = false;
        for (let i in words) {
          const w = words[i].word;
          if (w === domInput.value.trim()) {
            score += w.length * 10 + 20;
            delete words[i];
            words.splice(i, 1);
            isCorrect = true;
            break;
          }
        }
        if (isCorrect) correct++;
        else wrong++;
        domScore.innerHTML = score;
        domCorrect.innerHTML = `정타:${correct}`;
        domWrong.innerHTML = `오타:${wrong}`;
        domAccuracy.innerHTML = `정확도:${correct + wrong !== 0 ? Math.round((correct / (correct + wrong)) * 100) : 0}%`;
      } else if (domGameover.style.display === 'flex') {
        domGameover.style.display = 'none';
        running = true;
        gameLoop();
      }
      domInput.value = '';
    } else if (e.code === 'Escape') life = 0;
  });
  domInput.addEventListener('focusin', () => resumeGame());
  domInput.addEventListener('focusout', () => (isGame ? showPopup('일 시 정 지') : 0));
  domGameover.addEventListener('click', () => resumeGame());
  shuffleWords();
  gameLoop();
};

onLoad();
