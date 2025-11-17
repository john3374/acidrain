import { keepPreviousData, useQuery } from '@tanstack/react-query';

const ScoreBoard = ({ queryKey, queryFn }) => {
  const { data: score, status } = useQuery({ queryKey, queryFn, placeholderData: keepPreviousData });

  const getTableData = () => {
    switch (status) {
      case 'pending':
        return (
          <tr>
            <td colspan={3}>로딩중...</td>
          </tr>
        );
      case 'error':
        return (
          <tr>
            <td colspan={3}>에러가 발생했습니다.</td>
          </tr>
        );
      case 'success':
        return score?.length > 0 ? (
          score.map((score, i) => (
            <tr key={i}>
              <td>{score.nickname}</td>
              <td>{score.score}</td>
              <td>{new Intl.DateTimeFormat('ko-KR').format(Date.parse(score.created))}</td>
            </tr>
          ))
        ) : (
          <tr>
            <td colspan={3}>점수가 없습니다.</td>
          </tr>
        );
    }
  };

  return (
    <table className="leaderboard">
      <thead>
        <tr>
          <th>이름</th>
          <th>점수</th>
          <th>일자</th>
        </tr>
      </thead>
      <tbody>{getTableData()}</tbody>
    </table>
  );
};

export default ScoreBoard;
