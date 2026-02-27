# Acid Rain Game / 추억의 산성비 게임

[Play](https://acidrain.akfn.net) | [플레이하기](https://acidrain.akfn.net)

Nostalgic 90s typing game: type falling words before they hit the bottom. Miss = lose pH (life). 10 levels, faster drops each level. Next.js 14, Socket.io, MongoDB, NextAuth.

90년대 추억의 산성비 타자연습. 떨어지는 단어를 타이핑. 놓치면 pH 감소. 10단계.

---
## 프로젝트 구조

```
acidrain/
├── app/                    # Next.js 앱 라우터
│   ├── api/               # API 라우트 (점수, 인증 등)
│   ├── layout.js
│   └── page.js            # 메인 게임 페이지
├── components/            # React 컴포넌트
│   ├── ScoreBoard.js      # 점수판
│   ├── Stopwatch.js       # 타이머
│   ├── socket.js          # Socket.io 클라이언트
│   └── ...
├── schema/                # MongoDB 스키마
│   ├── Game.js
│   ├── Score.js
│   ├── Word.js
│   └── Player.js
├── wss/                   # WebSocket 서버
│   ├── Game.js            # 게임 로직
│   └── wss.js             # Socket.io 서버
└── ...
```

## Run

```bash
pnpm install
pnpm wss      # terminal 1 — WebSocket server :4000
pnpm dev      # terminal 2 — Next.js :4001
```

**Prod:** `pnpm build && pnpm start`

**Env:** `.env` — MongoDB, NEXTAUTH_SECRET, NEXTAUTH_URL

---

## Controls | 조작

| Key | Action |
|-----|--------|
| Space/Enter | Start game |
| Type + Space | Submit word |
| ESC | Quit |

---

## Stack

Next.js 14 · React 18 · Socket.io · MongoDB · NextAuth · Tailwind
