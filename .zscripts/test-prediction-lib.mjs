/**
 * Sanity tests for the pure prediction (Dixon-Coles) and MVP libraries.
 * Run: node --experimental-strip-types --import .zscripts/alias-register.mjs .zscripts/test-prediction-lib.mjs
 */
import { predictMatch, sportHasDraws } from '@/lib/prediction';
import { computeMatchMVP } from '@/lib/mvp';

const day = 86_400_000;
const now = Date.now();
const mk = (id, a, b, sa, sb, daysAgo) => ({
  id, teamAId: a, teamBId: b, scoreA: sa, scoreB: sb, playedAt: now - daysAgo * day,
});

let failures = 0;
function check(name, cond, extra = '') {
  if (cond) {
    console.log(`  ok  ${name}`);
  } else {
    failures++;
    console.error(`  FAIL ${name} ${extra}`);
  }
}

/* ── Prediction ── */
console.log('predictMatch:');

// Strong A (4 wins) vs weak B (4 losses), futsal.
const matchesA = [mk('1','A','X',4,0,10), mk('2','X','A',1,3,8), mk('3','A','Y',5,1,6), mk('4','Y','A',0,2,4)];
const matchesB = [mk('5','B','X',0,3,9), mk('6','X','B',4,1,7), mk('7','B','Y',1,2,5), mk('8','Y','B',3,0,3)];

const r = predictMatch({
  sportName: 'Fútbol de salón',
  teamA: { teamId: 'A', matches: matchesA },
  teamB: { teamId: 'B', matches: matchesB },
  sportSample: { matches: 48, totalGoals: 130 },
  status: 'SCHEDULED', scoreA: 0, scoreB: 0, elapsedSeconds: 0, now,
});
console.log('  futsal A/B:', { pA: r.probA.toFixed(3), pX: r.probDraw.toFixed(3), pB: r.probB.toFixed(3), xgA: r.expectedGoalsA, xgB: r.expectedGoalsB, conf: r.confidence, model: r.model });
check('probs sum to 1', Math.abs(r.probA + r.probDraw + r.probB - 1) < 1e-9);
check('strong A favored', r.probA > r.probB);
check('draw probability present', r.probDraw > 0.05 && r.probDraw < 0.35, `(got ${r.probDraw})`);
check('form A = 4 wins', r.teamA.form.join('') === 'WWWW', r.teamA.form.join(''));
check('form B = 4 losses', r.teamB.form.join('') === 'LLLL', r.teamB.form.join(''));

// No history at all → neutral-ish, honest flag.
const r2 = predictMatch({
  sportName: 'Fútbol de salón',
  teamA: { teamId: 'A', matches: [] },
  teamB: { teamId: 'B', matches: [] },
  sportSample: { matches: 0, totalGoals: 0 },
  status: 'SCHEDULED', scoreA: 0, scoreB: 0, elapsedSeconds: 0, now,
});
console.log('  no-data:', { pA: r2.probA.toFixed(3), pX: r2.probDraw.toFixed(3), pB: r2.probB.toFixed(3), insuf: r2.insufficientData, mu: r2.sportAverageGoals });
check('no-data flagged', r2.insufficientData === true);
check('no-data symmetric', Math.abs(r2.probA - r2.probB) < 1e-9);
check('prior mu = 2.3 (futsal prior 4.6/2)', Math.abs(r2.sportAverageGoals - 2.3) < 1e-9);

// Live: A leads 3-0 with 10% of time left → near-certain A.
const r3 = predictMatch({
  sportName: 'Fútbol de salón',
  teamA: { teamId: 'A', matches: matchesA },
  teamB: { teamId: 'B', matches: matchesB },
  sportSample: { matches: 48, totalGoals: 130 },
  status: 'LIVE', scoreA: 3, scoreB: 0, elapsedSeconds: 2160, now,
});
console.log('  live 3-0 @90%:', { pA: r3.probA.toFixed(3), pX: r3.probDraw.toFixed(3), pB: r3.probB.toFixed(3), frac: r3.liveRemainingFraction });
check('live leader dominant', r3.probA > 0.9);
check('live fraction ~0.1', Math.abs(r3.liveRemainingFraction - 0.1) < 0.01);
check('live flagged', r3.live === true);

// Live: tied 0-0 late → draw very likely.
const r4 = predictMatch({
  sportName: 'Fútbol de salón',
  teamA: { teamId: 'A', matches: matchesA },
  teamB: { teamId: 'B', matches: matchesB },
  sportSample: { matches: 48, totalGoals: 130 },
  status: 'LIVE', scoreA: 0, scoreB: 0, elapsedSeconds: 2160, now,
});
console.log('  live 0-0 @90%:', { pX: r4.probDraw.toFixed(3) });
check('late 0-0 → high draw', r4.probDraw > 0.6);

// Basketball: no draws, Normal model.
const rb = predictMatch({
  sportName: 'Baloncesto',
  teamA: { teamId: 'A', matches: [mk('b1','A','X',80,60,5), mk('b2','X','A',65,75,3)] },
  teamB: { teamId: 'B', matches: [mk('b3','B','X',55,70,5), mk('b4','X','B',78,60,3)] },
  sportSample: { matches: 10, totalGoals: 1400 },
  status: 'SCHEDULED', scoreA: 0, scoreB: 0, elapsedSeconds: 0, now,
});
console.log('  basket:', { model: rb.model, pA: rb.probA.toFixed(3), pX: rb.probDraw, pB: rb.probB.toFixed(3) });
check('basket uses normal-difference', rb.model === 'normal-difference');
check('basket has no draw', rb.probDraw === 0 && Math.abs(rb.probA + rb.probB - 1) < 1e-9);

check('sportHasDraws futsal', sportHasDraws('Fútbol de salón') === true);
check('sportHasDraws basket', sportHasDraws('Baloncesto') === false);

/* ── MVP ── */
console.log('computeMatchMVP:');
const players = {
  p1: { id: 'p1', name: 'Ana', number: 9, position: 'Delantero', teamId: 'A' },
  p2: { id: 'p2', name: 'Beto', number: 7, position: 'Ala', teamId: 'A' },
  p3: { id: 'p3', name: 'Caro', number: 10, position: 'Pivot', teamId: 'B' },
};
const sportActions = [
  { name: 'FUTSAL_GOAL', isCard: false },
  { name: 'FUTSAL_YELLOW', isCard: true },
  { name: 'FUTSAL_RED', isCard: true },
];
const base = { teamAId: 'A', teamBId: 'B', sportActions, status: 'FINISHED' };

const m1 = computeMatchMVP({
  ...base, scoreA: 2, scoreB: 1,
  actions: [
    { playerId: 'p1', player: players.p1, actionType: 'FUTSAL_GOAL', actionLabel: 'Gol', minute: 5, value: 1 },
    { playerId: 'p1', player: players.p1, actionType: 'FUTSAL_GOAL', actionLabel: 'Gol', minute: 20, value: 1 },
    { playerId: 'p2', player: players.p2, actionType: 'FUTSAL_GOAL', actionLabel: 'Gol', minute: 10, value: 1 },
    { playerId: 'p3', player: players.p3, actionType: 'FUTSAL_GOAL', actionLabel: 'Gol', minute: 15, value: 1 },
    { playerId: 'p3', player: players.p3, actionType: 'FUTSAL_YELLOW', actionLabel: 'Amarilla', minute: 8, value: 1 },
  ],
});
check('MVP is top scorer of winning side', m1?.mvp.playerId === 'p1', m1?.mvp.playerName);
check('MVP rating scale 1-10', m1.mvp.rating >= 1 && m1.mvp.rating <= 10, String(m1.mvp.rating));
check('breakdown goals', m1.mvp.breakdown.goals === 2 && m1.mvp.breakdown.yellowCards === 0);
check('podium has 3', m1.podium.length === 3);
check('card player ranked last', m1.podium[2].playerId === 'p3');

const m2 = computeMatchMVP({
  ...base, scoreA: 0, scoreB: 0,
  actions: [
    { playerId: 'p1', player: players.p1, actionType: 'FUTSAL_YELLOW', actionLabel: 'Amarilla', minute: 3, value: 1 },
  ],
});
check('no scoring → no MVP', m2 === null);

// Own goal penalized; scorer of equal points beats own-goal player.
const m3 = computeMatchMVP({
  ...base, scoreA: 1, scoreB: 1,
  actions: [
    { playerId: 'p1', player: players.p1, actionType: 'FUTSAL_GOAL', actionLabel: 'Gol', minute: 2, value: 1 },
    { playerId: 'p3', player: players.p3, actionType: 'FUTSAL_GOAL', actionLabel: 'Gol', minute: 30, value: 1 },
    { playerId: 'p2', player: players.p2, actionType: 'OWN_GOAL', actionLabel: 'Autogol', minute: 30, value: 1 },
  ],
});
check('own goal penalized', m3.podium.every((e) => e.playerId !== 'p2' || e.points < 0) || !m3.podium.some((e) => e.playerId === 'p2'));

/* ── Result ── */
if (failures > 0) {
  console.error(`\n${failures} FAILURES`);
  process.exit(1);
}
console.log('\nAll lib tests passed.');
