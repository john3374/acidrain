import { useEffect, useState } from 'react';

const ScoreBoard = () => {
  const [score, setScore] = useState();
  useEffect(() => {
    if (!score)
      fetch('/api/score', { headers: { 'Cache-Control': 'no-store' } }).then(res =>
        res.json().then(json =>
          setScore(
            json.map((score, i) => (
              <tr key={i}>
                <td>{score.nickname}</td>
                <td>{score.score}</td>
                <td>{new Intl.DateTimeFormat('ko-KR').format(Date.parse(score.created))}</td>
              </tr>
            ))
          )
        )
      );
  });

  return (
    <table className="leaderboard">
      <tr>
        <th>이름</th>
        <th>점수</th>
        <th>일자</th>
      </tr>
      {score?.length > 0 ? (
        score
      ) : (
        <tr>
          <td colspan={3}>점수가 없습니다.</td>
        </tr>
      )}
    </table>
  );
};

export default ScoreBoard;
