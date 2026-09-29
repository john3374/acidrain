# Leaderboards and achievements for replays and return visits

Research for issue #10. Checked 2026-09-29. Terms follow `GLOSSARY.md`: **Game**, **Score**, **Leaderboard**, **Period**.

How sources were checked: Monkeytype was read from its source code, pinned to commit `4bd46c6` (2026-09-23). The Google Play Games and Apple GameKit docs were fetched directly. The network proxy blocked typeracer.com, nitrotype.com, Steam's partner docs, arXiv and the publisher pages, so those claims come from search-engine abstracts and snippets and are marked **(index)**. Fan wikis and press are marked **(secondary)**. I found no peer-reviewed study of typing games specifically.

## Implications for Acid Rain

1. **Rank each player's best Score, not every Score.** Monkeytype, Google Play Games and Game Center all keep one best entry per player [M2][G1][A3]. Today Acid Rain's `/api/score/*` routes sort every Score and take the top 10 [AR1], so one player can fill a whole Period's Leaderboard.
2. **Keep logged-out Scores off the ranked Leaderboard, but let the player claim the last one after signing in.** Monkeytype, TypeRacer and Nitro Type all leave guests off their boards [M5][T3][N3]. Monkeytype keeps the last signed-out result and offers "Would you like to save it?" after sign-in [M9]. A "익명" row can't be deduplicated per player, because a logged-out Score has no player id.
3. **Reset "today" at a fixed, visible time, and show a countdown to it.** Everyone surveyed resets on a calendar boundary: Monkeytype at 00:00 UTC (weekly on Monday) [M4][M7], Play Games at UTC-7 [G1], TypeRacer's Quote of the Day at 00:00 UTC [T1]. Acid Rain uses the server's local midnight [AR1], so the reset time depends on the host's timezone. For a Korean audience, Asia/Seoul (UTC+9, no daylight saving) is the natural anchor. The fresh-start effect gives a reason to make resets visible [R9].
4. **Treat "last 7/30 days" as a deliberate choice.** None of the surveyed boards uses rolling windows. They use calendar or fixed-occurrence Periods [M4][G1][A1][T1]. A rolling Period never gives players a clean slate. Whether to switch to "this week / this month" is a glossary decision (Period), not a bug.
5. **On game over, show the rank this Score reached, whether it beat the player's personal best, and the gap to the next rank.** Also delay the automatic return to level select, which currently happens after 4 s with only "놀이가 끝났습니다." [AR2]. Monkeytype shows the daily rank on the result screen [M8]. Play Games recommends leaderboard links "after player death" [G3]. On gaps, the goal-gradient and badge-threshold studies show effort rising as a visible goal gets closer [R6][R8]. The "gap to next rank" display itself is an inference: no surveyed game documents one.
6. **Start with a few achievements that can be earned within one Game, and add cross-Game achievements for signed-in players.** Google requires at least 4 achievements "reasonably and reliably achievable within an hour", recommends no more than one in the first 5 minutes, and says incremental goals should take "at least ten sessions" [G2][G3]. Cross-Game achievements need persistence: Google says to keep progress locally and sync it on sign-in [G3].
7. **Expect modest, uneven effects, and measure them.** Field evidence shows badges and leaderboards increase activity [R1][R5][R7]. Lab studies find no gain in intrinsic motivation [R2], and one classroom study found harm [R4]. The one leaderboard-format study in a live game found a Top-5 board kept more players than a relative board [R10]. Log replays within a few minutes of game over and day-N returns before and after each change.

## Ranking unit and logged-out play

- **Monkeytype, daily board:** one Redis sorted set per language/mode/day. `ZADD … GT` keeps only a player's best Score per day [M2]. Ties go to whoever typed earlier that day, because the time is folded into the sort key [M3].
- **Monkeytype, all-time board:** built from each user's `lbPersonalBests` (one PB per user per mode) and recomputed every 15 minutes [M6].
- **Monkeytype, weekly XP board:** the one cumulative board. `ZINCRBY` sums XP across all of a player's Games in the week [M10]. It rewards playing volume, while the daily board rewards the best single Game.
- **Monkeytype eligibility:** not banned, not opted out, and at least 2 hours of total typing time [M5]. Tests with a bail-out or a triggered stop-on-letter are excluded [M5]. If a signed-in player is not qualified, the leaderboard page explains why, e.g. "min speed required" [M11].
- **Monkeytype, signed-out play:** results are not submitted. The result screen shows "Sign in to save your result". After sign-in, the "Last signed out result" modal offers save or discard [M9].
- **Google Play Games:** "checks if this score is better than the player's current leaderboard entry for the daily, weekly, or all-time score" and only then updates it [G1].
- **Game Center:** `loadEntries` "for each player, keeps the best score that player earns and discards the rest" [A3]. A recurring leaderboard can keep either the best or the most recent Score [A1]. For time-boxed Challenges, Apple says to track the *most recent* Score, not personal bests, so that regular players don't get an unfair advantage [A2].
- **TypeRacer:** guests were removed from the high scores as an anti-cheating measure [T3] (secondary). Since Competitions 2.0 (Feb 2026), only multiplayer races count toward competitions [T1] (index).
- **Nitro Type:** guest racers' stats are not logged and they cannot join public races. They are prompted to sign up [N3] (secondary).

## Periods, resets and timezones

| Game or platform | Periods | Reset | Timezone |
|---|---|---|---|
| Monkeytype | daily, weekly XP, all-time | daily at UTC midnight; weekly on Monday [M4] | UTC. The UI counts down: "Next reset in: …" [M7] |
| Monkeytype streaks | per player | per-player `hourOffset` setting [M12] | player-chosen |
| Google Play Games | daily, weekly, all-time (automatic) | daily; weekly between Saturday and Sunday [G1] | UTC-7 all year [G1] |
| Game Center | classic (never resets) or recurring | developer sets start, duration and restart interval, e.g. 24 h/24 h for daily [A1] | a fixed instant chosen by the developer |
| TypeRacer | daily, weekly, monthly, yearly competitions; Quote of the Day | QOTD ends at 12:00 AM UTC; unlimited retries [T1] | UTC (index) |
| Nitro Type | weekly leagues of 30 players; bottom 7 demoted [N1][N2] | "usually end on Friday", local time [N1] | player's timezone (index/secondary) |
| Spelunky HD Daily | daily seed, one attempt [S1] | daily | (secondary) |

- None of these uses a rolling "last N days" window. Game Center's recurring boards are explicitly "sequential and don't overlap" [A1].
- Apple says recurring boards "can increase engagement by giving players more chances to take the lead" [A2]. Game Center shows players only the current occurrence and one previous occurrence [A1].
- Monkeytype mails XP rewards the day after a daily placement ("Daily leaderboard placement") [M13]. That gives placed players a reason to come back the next day.

## Game-over screen

- **Monkeytype:** shows a PB crown and, when the Score placed, the daily rank (`#result .stats .dailyLeaderboard`) [M8]. On the leaderboard page it shows "Top x.xx%" (the top-ranked player sees "GOAT") and "↑n since you last checked" [M11].
- **Google Play checklist 3.1:** "After critical transitions (end of level, player death), show links to relevant leaderboards." Checklist 3.4: submit Scores at those transitions, not continuously [G3].
- **Game Center:** returns the local player's entry along with the requested range of at most 100 ranks, so games can show "you vs. the board" [A3]. Players get notifications when friends pass their score [A2].
- **Gap to next rank:** no surveyed game documents this display. The case for it rests on goal-distance evidence. Customers bought more often as they neared a reward [R8]. Stack Overflow users increased activity as they approached badge thresholds [R6]. Leaderboards performed like "difficult" goals because people implicitly aimed near the top [R5].
- **Acid Rain today:** a 4-second "놀이가 끝났습니다." popup, then an automatic return to level select, with no Score context [AR2].

## Achievements for short sessions, and which need an account

Platform guidance [G2][G3][A2]:
- At least 10 visible achievements, with 40 or more recommended. At least 4 should be achievable within an hour. At most 1 in the first 5 minutes.
- Use incremental achievements with visible progress bars, and tiers (1k → 5k → 10k). Size them to take "at least ten sessions".
- Use hidden achievements sparingly. Apple shows progress nudges such as "more than halfway… Keep going!"

Examples from typing games:
- **Monkeytype:** a 365-day-streak badge [M5]. Its XP system adds a first-Game-of-the-day bonus and a streak multiplier [M5]. These are account-bound by construction.
- **Nitro Type:** league achievements award titles and cash [N1]. "Keyboard Cat" is 400 races in a single session, where a session means no gap over 30 minutes [N4] (secondary).
- **TypeRacer:** gold, silver and bronze profile badges for the top 3 in each daily, weekly, monthly and yearly competition [T2] (index).

Split for Acid Rain (inference from the sources above):
- **Within one Game, no account needed to earn:** reach level N, clear a level without losing life, 100% accuracy for a level, Score ≥ X. These can be shown on the game-over screen even when logged out. Keeping them needs either a login or `localStorage` plus sync on sign-in, as in [G3] 1.4.
- **Across Games, account needed:** Games played (incremental), daily streak, placing in today's top 10, beating your own best N times. Streaks need an agreed day boundary (implication 3). Monkeytype's `hourOffset` shows the edge cases around that boundary [M12].

## Evidence on what moves retention

| Study | Setting and design | Finding | Status |
|---|---|---|---|
| Hamari 2017 [R1] | ShareTribe, 2-year field experiment (N≈1,410 vs 1,579) | Users with badges were significantly more likely to post, transact, comment and use the service | peer-reviewed (index) |
| Mekler et al. 2017 [R2] | Online experiment: points, levels, leaderboards | More tags produced, but no effect on intrinsic motivation or competence | peer-reviewed (index) |
| Sailer et al. 2017 [R3] | Randomized simulation | Badges, leaderboards and performance graphs raised competence-need satisfaction and task meaningfulness | peer-reviewed (index) |
| Hanus & Fox 2015 [R4] | Semester-long course with a leaderboard and mandatory badges | Lower intrinsic motivation, satisfaction and final-exam scores than the control class | peer-reviewed (index) |
| Landers et al. 2017 [R5] | Lab goal-setting experiment | A leaderboard produced performance like difficult or impossible goals | peer-reviewed (index) |
| Anderson et al. 2013 [R6] | Stack Overflow logs | Activity rises as users approach a badge threshold | peer-reviewed (index) |
| Moldon et al. 2021 [R7] | GitHub removed its streak counter (natural experiment) | Long streaks and weekend activity fell | peer-reviewed (index) |
| Kivetz et al. 2006 [R8] | Café punch card; song-rating site | Visits and purchases speed up near the goal; players dropped out less often near it | peer-reviewed (index) |
| Dai et al. 2014 [R9] | Gym check-ins (11,912 members) | Visits rise at the start of a week, month or year | peer-reviewed (index) |
| Pedersen et al. 2017 [R10] | Quantum Moves launch: no board, then Top-5, then relative board, run in sequence | The Top-5 board retained the highest fraction of players | conference paper, quasi-experimental (index) |
| Mazal (ex-Duolingo CPO) [D1] | Duolingo leagues A/B test | +17% learning time; 3× highly engaged learners | insider write-up, not peer-reviewed (index) |

Takeaways:
- Effects on behavior (more activity, more returns) are well supported.
- Effects on enjoyment are mixed [R2][R4]. Mandatory, public comparison is where harm shows up [R4].
- Removing a visible streak counter measurably changed behavior [R7]. Streak mechanics are strong, but they are only fair when the day boundary is clear.

## Sources

Monkeytype (GitHub, `monkeytypegame/monkeytype` @ `4bd46c6ca1c2b02ba0203b83b6f0b32a2a5a53ec`; prefix `https://github.com/monkeytypegame/monkeytype/blob/4bd46c6ca1c2b02ba0203b83b6f0b32a2a5a53ec/`):
- [M1] `backend/src/utils/daily-leaderboards.ts`
- [M2] `backend/redis-scripts/add-result.lua` (L10, `ZADD GT CH`)
- [M3] `backend/src/utils/misc.ts` (L69, `kogascore`)
- [M4] `packages/util/src/date-and-time.ts` (L10–26 day start, L64–80 Monday week)
- [M5] `backend/src/api/controllers/result.ts` (L521–531 eligibility; L580 365-day badge; L795 streak multiplier; L833 daily bonus); `backend/src/constants/base-configuration.ts` L99 (`minTimeTyping: 2 * 60 * 60`)
- [M6] `backend/src/dal/leaderboards.ts` L183; `backend/src/jobs/update-leaderboards.ts` L6 (`30 14/15 * * * *`)
- [M7] `frontend/src/ts/components/pages/leaderboard/NextUpdate.tsx` L30–42
- [M8] `frontend/src/ts/test/test-logic.ts` L1200–1217
- [M9] `frontend/src/html/pages/test-result.html` L309–311; `frontend/src/ts/components/modals/LastSignedOutResultModal.tsx` L54–57
- [M10] `backend/redis-scripts/add-result-increment.lua` L9; `backend/src/services/weekly-xp-leaderboard.ts`
- [M11] `frontend/src/ts/components/pages/leaderboard/UserRank.tsx` L34–63, L101
- [M12] `backend/src/dal/user.ts` L1128–1170
- [M13] `backend/src/workers/later-worker.ts` L52–85

Platforms:
- [G1] https://developer.android.com/games/pgs/leaderboards
- [G2] https://developer.android.com/games/pgs/achievements
- [G3] https://developer.android.com/games/pgs/quality
- [A1] https://developer.apple.com/documentation/gamekit/creating-recurring-leaderboards
- [A2] https://developer.apple.com/design/human-interface-guidelines/game-center
- [A3] https://developer.apple.com/documentation/gamekit/gkleaderboard/loadentries(for:timescope:range:completionhandler:)

Games (index = search snippet; the site was blocked):
- [T1] https://blog.typeracer.com/2026/02/24/introducing-competitions-2-0/ (index)
- [T2] https://blog.typeracer.com/2017/09/03/new-feature-competition-awards/ (index)
- [T3] https://en.wikipedia.org/wiki/TypeRacer (secondary)
- [N1] https://www.nitrotype.com/news/read/266/introducing-leagues-a-new-era-of-competition and https://www.nitrotype.com/leagues (index)
- [N2] https://nitro.fandom.com/wiki/Leagues (secondary)
- [N3] https://nitro.fandom.com/wiki/Guest_racers (secondary)
- [N4] https://nitro.fandom.com/wiki/Races (secondary)
- [S1] https://spelunky.fandom.com/wiki/Daily_Challenge_Mode_(HD); https://www.shacknews.com/article/80294/spelunky-pc-introduces-daily-challenges (secondary)

Studies (abstracts via search index; full text blocked):
- [R1] Hamari, J. (2017). Do badges increase user activity? *Computers in Human Behavior* 71, 469–478. https://research.utu.fi/converis/portal/detail/Publication/27336812
- [R2] Mekler, Brühlmann, Tuch, Opwis (2017). *CHB* 71, 525–534. https://edoc.unibas.ch/32047/
- [R3] Sailer, Hense, Mayr, Mandl (2017). How gamification motivates. *CHB* 69, 371–380. https://epub.ub.uni-muenchen.de/53202
- [R4] Hanus & Fox (2015). *Computers & Education* 80, 152–161. https://www.smhp.psych.ucla.edu/pdfdocs/gamil.pdf
- [R5] Landers, Bauer, Callan (2017). *CHB* 71, 508–515. https://experts.umn.edu/en/publications/gamification-of-task-performance-with-leaderboards-a-goal-setting/
- [R6] Anderson, Huttenlocher, Kleinberg, Leskovec (2013). Steering user behavior with badges. WWW '13. https://archives.iw3c2.org/www2013/proceedings/p95.pdf
- [R7] Moldon, Strohmaier, Wachs (2021). How gamification affects software developers. ICSE. https://arxiv.org/abs/2006.02371
- [R8] Kivetz, Urminsky, Zheng (2006). The goal-gradient hypothesis resurrected. *JMR* 43, 39–58. https://business.columbia.edu/sites/default/files-efs/pubfiles/1200/goalgradient.pdf
- [R9] Dai, Milkman, Riis (2014). The fresh start effect. *Management Science*. https://faculty.wharton.upenn.edu/wp-content/uploads/2014/06/Dai_Fresh_Start_2014_Mgmt_Sci.pdf
- [R10] Pedersen, Rasmussen, Sherson, Basaiawmoit (2017). Leaderboard effects on player performance in a citizen science game. ECGBL. https://arxiv.org/abs/1707.03704
- [D1] Mazal, J. How Duolingo reignited user growth. Lenny's Newsletter. https://www.lennysnewsletter.com/p/how-duolingo-reignited-user-growth (index)

Acid Rain (this repo):
- [AR1] `app/api/score/today/route.js`, `app/api/score/week/route.js`: `setHours(0,0,0,0)` in the server's timezone; every Score is sorted and the top 10 taken
- [AR2] `app/page.js` L105–115: game-over popup, then a 4 s timeout back to level select
