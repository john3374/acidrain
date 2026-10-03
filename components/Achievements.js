import { useQuery } from '@tanstack/react-query';

import { ACHIEVEMENTS, nextGamesPlayedThreshold } from '@/game/achievements';

const formatDate = value => new Intl.DateTimeFormat('ko-KR').format(Date.parse(value));

// A Player's eight Achievements (업적): earned ones with their date, the rest greyed out with their condition,
// and progress toward the next step of the Games-played ladder.
const Achievements = () => {
  const { data, status } = useQuery({
    queryKey: ['achievements'],
    queryFn: () =>
      fetch('/api/achievement').then(res => {
        if (!res.ok) throw new Error(res.statusText);
        return res.json();
      }),
  });

  if (status === 'pending') return <p className="achievements-status">로딩중...</p>;
  if (status === 'error') return <p className="achievements-status">에러가 발생했습니다.</p>;

  const earnedOn = new Map(data.achievements.map(({ id, earned }) => [id, earned]));
  const nextThreshold = nextGamesPlayedThreshold(data.gamesPlayed);

  return (
    <ul className="achievements" aria-label="업적">
      {ACHIEVEMENTS.map(({ id, name, condition, gamesPlayed }) => {
        const earned = earnedOn.get(id);
        const progress = !earned && gamesPlayed === nextThreshold ? `${data.gamesPlayed} / ${gamesPlayed}판` : null;
        return (
          <li key={id} className={`achievement${earned ? '' : ' locked'}`}>
            <span className="achievement-name">{name}</span>
            <span className="achievement-detail">{earned ? formatDate(earned) : progress ?? condition}</span>
          </li>
        );
      })}
    </ul>
  );
};

export default Achievements;
