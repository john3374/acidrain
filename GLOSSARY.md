# Acid Rain

A 90s-style typing game: words fall from the top of the screen and the player types them before they land.

## Language

**Player**:
Someone who plays while signed in with an account, and so has a nickname. A Player's Scores carry their nickname.
_Avoid_: User, account, member

**Guest**:
Someone who plays without signing in. A Guest's Scores carry no name and are shown as 익명.
_Avoid_: Anonymous user, visitor, logged-out player

**Game**:
One play-through, from starting at a chosen Level until it is finished. A Game is finished when the player runs out of pH or quits; a Game left by closing the page or losing the connection is abandoned, not finished.
_Avoid_: Round, session, match

**Level**:
One stage of a Game with a fixed drop speed, from 1 to 10. The screen shows it as 마당.
_Avoid_: Stage, round, 단계

**Level clear**:
The moment every word of a Level has been typed or has landed while the player still has pH. The next Level follows it.
_Avoid_: Level up, stage complete

**pH**:
The player's remaining life in a Game. It falls when a word reaches the bottom, and the Game ends when it runs out.
_Avoid_: Life, health, HP

**Level bonus**:
The extra points a player gets for starting a Game at a Level above 1.
_Avoid_: Start bonus, skip bonus

**Hit**:
A submitted word that matches a falling word. The screen shows it as 정타.
_Avoid_: Correct, match

**Typo**:
A submitted word that matches no falling word. The screen shows it as 오타. A word that lands is not a Typo; it costs pH instead.
_Avoid_: Miss, incorrect, error

**Accuracy**:
Hits as a share of all submitted words in a Game. The screen shows it as 정확도.
_Avoid_: Precision, hit rate

**Score**:
The final points from one finished Game. An abandoned Game has no Score.
_Avoid_: Record, result, 점수 entry

**Claim**:
A Guest who signs in right after a Game taking that Game's Score as their own, so it counts as a Player's Score.
_Avoid_: Adopt, transfer, link

**Leaderboard**:
A ranked list of Players within one Period, each placed by their Personal best in that Period. Guests are not ranked.
_Avoid_: Scoreboard, ranking, high-score table

**Personal best**:
A Player's highest Score within a Period.
_Avoid_: High score, PB, record

**Period**:
The time window a Leaderboard covers, always ending now: the last 24 hours, the last 7 days, the last 30 days, or all time. A Score falls in a Period if its Game finished inside it.
_Avoid_: Range, tab, today, this week

**Achievement**:
A goal a Player reaches once, through what happens in a finished Game, and never loses. A Guest sees what their Game would have earned, but keeps it only by Claiming that Game's Score. The screen shows it as 업적.
_Avoid_: Badge, trophy, medal, 도전 과제

**Game played**:
A finished Game with at least one Hit. Only these count toward Achievements for the number of Games.
_Avoid_: Play, run, session

**Replay**:
A Game started within 5 minutes after the same player's previous Game finished.
_Avoid_: Retry, rematch, restart

**Return visit**:
A Game started at least 12 hours after the same player's previous Game.
_Avoid_: Retention, comeback, revisit
