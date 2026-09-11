/**
 * Win / Draw / Win (1X2) match prediction from historical team results.
 *
 * Model: Dixon & Coles (1997) — the reference statistical model for football
 * 1X2 forecasting (bivariate Poisson with a low-score dependence correction
 * τ, ρ). Team strength is estimated from past matches with Maher (1982)
 * attack/defense decomposition, exponential time-decay weighting (recency)
 * and Bayesian shrinkage towards the sport's average, which keeps the model
 * well-behaved with the sparse data of local tournaments (teams with few
 * recorded matches).
 *
 * Sports without draws (baloncesto, voleibol) use a Normal score-difference
 * model: margin ~ N(λA − λB, σA² + σB²), which is the standard approximation
 * for high-scoring sports.
 *
 * Live events: remaining goal expectation is scaled by the remaining time
 * fraction (Brownian scaling σ ∝ √fraction for the Normal model) and
 * probabilities are conditioned on the current score.
 *
 * This module is pure TypeScript (no DB / no Node APIs) so it can be unit
 * tested and shared between server routes.
 */

import { normalizeSportKey } from '@/lib/constants';

/* ── Inputs ────────────────────────────────────────────────────────────────── */

export interface HistoryMatch {
  id: string;
  teamAId: string;
  teamBId: string;
  scoreA: number;
  scoreB: number;
  /** endedAt ?? scheduledAt (ms since epoch or null). */
  playedAt: number | null;
}

export interface TeamHistoryInput {
  teamId: string;
  matches: HistoryMatch[];
}

export interface PredictInput {
  sportName: string;
  teamA: TeamHistoryInput;
  teamB: TeamHistoryInput;
  /** Finished public matches of the same sport (for the league average μ). */
  sportSample: { matches: number; totalGoals: number };
  status: string;
  scoreA: number;
  scoreB: number;
  elapsedSeconds: number;
  now?: number; // epoch ms (tests)
}

/* ── Outputs ───────────────────────────────────────────────────────────────── */

export type FormResult = 'W' | 'D' | 'L';

export interface TeamStats {
  teamId: string;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  /** Recency-weighted average goals for / against (per match). */
  avgGoalsFor: number;
  avgGoalsAgainst: number;
  /** Last 5 results, oldest → newest. */
  form: FormResult[];
  /** Weighted sd of the match margin (scored − conceded); null if <2 matches. */
  marginSd: number | null;
}

export type PredictionModel = 'dixon-coles' | 'normal-difference';

export interface PredictionResult {
  model: PredictionModel;
  hasDraws: boolean;
  /** Final 1X2 probabilities (sum = 1). Live-adjusted when the event is live. */
  probA: number;
  probDraw: number;
  probB: number;
  /** Full-time expected goals/points per team (pre-match). */
  expectedGoalsA: number;
  expectedGoalsB: number;
  live: boolean;
  /** Remaining-time fraction used for live adjustment (0.03–1). */
  liveRemainingFraction: number | null;
  teamA: TeamStats;
  teamB: TeamStats;
  /** League average goals per team per match (blended with a prior). */
  sportAverageGoals: number;
  /** ALTA (≥8 recorded matches), MEDIA (≥4) or BAJA. */
  confidence: 'ALTA' | 'MEDIA' | 'BAJA';
  /** True when neither team has any recorded history. */
  insufficientData: boolean;
}

/* ── Tunable constants (documented, deterministic) ─────────────────────────── */

/** Dixon-Coles low-score dependence parameter (fixed estimate, ρ ∈ (−1, 0)). */
const DC_RHO = -0.1;
/** Bayesian shrinkage: equivalent prior matches pulling strengths to μ. */
const SHRINKAGE_MATCHES = 6;
/** Prior matches backing the sport-average when the sample is small. */
const SPORT_SAMPLE_PRIOR_MATCHES = 4;
/** Recency half-life in days for exponential decay weighting. */
const RECENCY_HALF_LIFE_DAYS = 180;
/** Max history matches considered per team. */
const MAX_TEAM_MATCHES = 15;
/** Grid size safety cap for the Poisson distribution. */
const MAX_GOALS_CAP = 120;
/** Minimum remaining-time fraction for live events (avoids 100%/0%). */
const MIN_LIVE_FRACTION = 0.03;

/** Default total scoring per match by sport (prior, both teams combined). */
const SPORT_PRIOR_TOTAL: Record<string, number> = {
  futbol: 2.7,
  microfutbol: 4.6,
  futboldesalon: 4.6,
  handball: 55,
  baloncesto: 140,
  voleibol: 150,
  beisbol: 9,
};

/** Prior sd of the score margin for no-draw (Normal model) sports. */
const SPORT_PRIOR_MARGIN_SD: Record<string, number> = {
  baloncesto: 14,
  voleibol: 10,
};

/** Regulation duration in seconds (0 = unknown / not time-based). */
const SPORT_DURATION_S: Record<string, number> = {
  futbol: 5400,
  microfutbol: 2400,
  futboldesalon: 2400,
  handball: 3600,
  baloncesto: 2400,
  // voleibol / beisbol: not time-based → no live time scaling.
};

/** Sports whose matches can end in a draw (1X2 with a real X). */
const NO_DRAW_SPORTS = new Set(['baloncesto', 'voleibol']);

export function sportHasDraws(sportName: string): boolean {
  return !NO_DRAW_SPORTS.has(normalizeSportKey(sportName));
}

/**
 * Slug for the lookup tables above: normalizeSportKey + spaces removed, so
 * "Fútbol de salón" → "futboldesalon" and "Microfútbol" → "microfutbol".
 */
function sportSlug(sportName: string): string {
  return normalizeSportKey(sportName).replace(/\s+/g, '');
}

/* ── Math helpers ──────────────────────────────────────────────────────────── */

function clamp(x: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, x));
}

function factorialLn(n: number): number {
  let s = 0;
  for (let i = 2; i <= n; i++) s += Math.log(i);
  return s;
}

/** Poisson pmf in log-space (stable for large λ). */
function poissonPmf(k: number, lambda: number): number {
  return Math.exp(-lambda + k * Math.log(lambda) - factorialLn(k));
}

/** Dixon-Coles τ correction for low scores (τ = 1 otherwise). */
function dcTau(x: number, y: number, lambdaA: number, lambdaB: number): number {
  if (x === 0 && y === 0) return 1 - lambdaA * lambdaB * DC_RHO;
  if (x === 0 && y === 1) return 1 + lambdaA * DC_RHO;
  if (x === 1 && y === 0) return 1 + lambdaB * DC_RHO;
  if (x === 1 && y === 1) return 1 - DC_RHO;
  return 1;
}

/**
 * Dixon-Coles 1X2 probabilities for independent Poisson marginals
 * (λA, λB) with the low-score correction. Current score can be offset so
 * the grid models *remaining* goals during live events.
 */
function dixonColesProbs(
  lambdaA: number,
  lambdaB: number,
  offsetA = 0,
  offsetB = 0,
): { pA: number; pDraw: number; pB: number } {
  const maxGoals = Math.min(
    MAX_GOALS_CAP,
    Math.max(8, Math.ceil(3 * Math.max(lambdaA, lambdaB)) + 6),
  );
  const pmfA: number[] = new Array(maxGoals + 1);
  const pmfB: number[] = new Array(maxGoals + 1);
  for (let k = 0; k <= maxGoals; k++) {
    pmfA[k] = poissonPmf(k, lambdaA);
    pmfB[k] = poissonPmf(k, lambdaB);
  }
  let pA = 0;
  let pDraw = 0;
  let pB = 0;
  let total = 0;
  for (let i = 0; i <= maxGoals; i++) {
    for (let j = 0; j <= maxGoals; j++) {
      const p = pmfA[i] * pmfB[j] * dcTau(i, j, lambdaA, lambdaB);
      total += p;
      const finalA = offsetA + i;
      const finalB = offsetB + j;
      if (finalA > finalB) pA += p;
      else if (finalA < finalB) pB += p;
      else pDraw += p;
    }
  }
  if (total <= 0 || !Number.isFinite(total)) return { pA: 1 / 3, pDraw: 1 / 3, pB: 1 / 3 };
  return { pA: pA / total, pDraw: pDraw / total, pB: pB / total };
}

/** erf approximation (Abramowitz & Stegun 7.1.26, |err| ≤ 1.5e-7). */
function erf(x: number): number {
  const sign = x < 0 ? -1 : 1;
  const ax = Math.abs(x);
  const a1 = 0.254829592,
    a2 = -0.284496736,
    a3 = 1.421413741,
    a4 = -1.453152027,
    a5 = 1.061405429,
    p = 0.3275911;
  const t = 1 / (1 + p * ax);
  const y =
    1 - ((((a5 * t + a4) * t + a3) * t + a2) * t + a1) * t * Math.exp(-ax * ax);
  return sign * y;
}

function normalCdf(z: number): number {
  return 0.5 * (1 + erf(z / Math.SQRT2));
}

/**
 * Normal score-difference model for no-draw sports.
 * margin ~ N(λA − λB, σ²); P(A) = Φ(margin/σ). Optional current-margin
 * offset and √fraction Brownian scaling for live events.
 */
function normalDiffProbs(
  lambdaA: number,
  lambdaB: number,
  sigma: number,
  marginOffset = 0,
  fraction = 1,
): { pA: number; pDraw: number; pB: number } {
  const mean = (lambdaA - lambdaB) * fraction + marginOffset;
  const sd = Math.max(0.5, sigma * Math.sqrt(Math.max(fraction, MIN_LIVE_FRACTION)));
  const pA = clamp(1 - normalCdf(-mean / sd), 0, 1);
  return { pA, pDraw: 0, pB: clamp(1 - pA, 0, 1) };
}

/* ── Team statistics ───────────────────────────────────────────────────────── */

function computeTeamStats(
  teamId: string,
  matches: HistoryMatch[],
  now: number,
  sportAverage: number,
): { stats: TeamStats; weightedAvgFor: number; weightedAvgAgainst: number } {
  // Most recent first, capped.
  const sorted = matches
    .filter((m) => m.teamAId === teamId || m.teamBId === teamId)
    .sort((a, b) => (b.playedAt ?? 0) - (a.playedAt ?? 0))
    .slice(0, MAX_TEAM_MATCHES);

  let played = 0,
    won = 0,
    drawn = 0,
    lost = 0,
    goalsFor = 0,
    goalsAgainst = 0;
  let wSum = 0,
    wFor = 0,
    wAgainst = 0;
  const margins: Array<{ w: number; m: number }> = [];
  const recentForm: FormResult[] = [];

  for (const m of sorted) {
    const isA = m.teamAId === teamId;
    const gf = isA ? m.scoreA : m.scoreB;
    const ga = isA ? m.scoreB : m.scoreA;
    played++;
    goalsFor += gf;
    goalsAgainst += ga;
    let res: FormResult;
    if (gf > ga) {
      won++;
      res = 'W';
    } else if (gf < ga) {
      lost++;
      res = 'L';
    } else {
      drawn++;
      res = 'D';
    }
    if (recentForm.length < 5) recentForm.push(res);

    const days = Math.max(0, (now - (m.playedAt ?? now)) / 86_400_000);
    const w = Math.pow(0.5, days / RECENCY_HALF_LIFE_DAYS);
    wSum += w;
    wFor += w * gf;
    wAgainst += w * ga;
    margins.push({ w, m: gf - ga });
  }

  // Weighted variance of the margin.
  let marginSd: number | null = null;
  if (margins.length >= 2 && wSum > 0) {
    const mean = margins.reduce((s, x) => s + x.w * x.m, 0) / wSum;
    let varSum = 0;
    for (const x of margins) varSum += x.w * (x.m - mean) ** 2;
    marginSd = Math.sqrt(varSum / wSum);
  }

  return {
    stats: {
      teamId,
      played,
      won,
      drawn,
      lost,
      goalsFor,
      goalsAgainst,
      avgGoalsFor: wSum > 0 ? wFor / wSum : sportAverage,
      avgGoalsAgainst: wSum > 0 ? wAgainst / wSum : sportAverage,
      form: recentForm.reverse(), // oldest → newest for display
      marginSd,
    },
    weightedAvgFor: wSum > 0 ? wFor / wSum : sportAverage,
    weightedAvgAgainst: wSum > 0 ? wAgainst / wSum : sportAverage,
  };
}

/* ── Main entry point ──────────────────────────────────────────────────────── */

export function predictMatch(input: PredictInput): PredictionResult {
  const now = input.now ?? Date.now();
  const sportKey = sportSlug(input.sportName);
  const hasDraws = sportHasDraws(input.sportName);

  // League average goals per team per match: blend sample with prior.
  // Each match = 2 team-sides; the prior backs SPORT_SAMPLE_PRIOR_MATCHES
  // matches worth of goals (P × priorTotal goals over 2·P sides).
  const priorTotal = SPORT_PRIOR_TOTAL[sportKey] ?? 4.5;
  const sample = input.sportSample;
  const totalGoals =
    sample.totalGoals + SPORT_SAMPLE_PRIOR_MATCHES * priorTotal;
  const teamSides = 2 * (sample.matches + SPORT_SAMPLE_PRIOR_MATCHES);
  const sportAverage = Math.max(0.1, totalGoals / teamSides);

  const a = computeTeamStats(input.teamA.teamId, input.teamA.matches, now, sportAverage);
  const b = computeTeamStats(input.teamB.teamId, input.teamB.matches, now, sportAverage);

  // Maher attack/defense strengths with Bayesian shrinkage towards μ.
  const k = SHRINKAGE_MATCHES;
  const wA = Math.min(a.stats.played, MAX_TEAM_MATCHES);
  const wB = Math.min(b.stats.played, MAX_TEAM_MATCHES);
  const attA = (a.weightedAvgFor * wA + sportAverage * k) / (wA + k);
  const defA = (a.weightedAvgAgainst * wA + sportAverage * k) / (wA + k);
  const attB = (b.weightedAvgFor * wB + sportAverage * k) / (wB + k);
  const defB = (b.weightedAvgAgainst * wB + sportAverage * k) / (wB + k);

  // λ = expected goals: attack of one side × defensive weakness of the other.
  const lambdaA = clamp((attA * defB) / sportAverage, 0.05, sportAverage * 5);
  const lambdaB = clamp((attB * defA) / sportAverage, 0.05, sportAverage * 5);

  const isLive = input.status === 'LIVE' || input.status === 'PAUSED';
  const duration = SPORT_DURATION_S[sportKey] ?? 0;
  const fraction =
    isLive && duration > 0
      ? clamp(1 - input.elapsedSeconds / duration, MIN_LIVE_FRACTION, 1)
      : 1;

  let probs: { pA: number; pDraw: number; pB: number };
  if (hasDraws) {
    probs = isLive
      ? dixonColesProbs(lambdaA * fraction, lambdaB * fraction, input.scoreA, input.scoreB)
      : dixonColesProbs(lambdaA, lambdaB);
  } else {
    const priorSd = SPORT_PRIOR_MARGIN_SD[sportKey] ?? 12;
    const sdA = a.stats.marginSd ?? priorSd;
    const sdB = b.stats.marginSd ?? priorSd;
    const sigma = Math.sqrt(sdA * sdA + sdB * sdB);
    probs = normalDiffProbs(
      lambdaA,
      lambdaB,
      sigma,
      isLive ? input.scoreA - input.scoreB : 0,
      fraction,
    );
  }

  // Renormalize against floating-point drift.
  const sum = probs.pA + probs.pDraw + probs.pB;
  const pA = probs.pA / sum;
  const pDraw = probs.pDraw / sum;
  const pB = probs.pB / sum;

  const totalPlayed = a.stats.played + b.stats.played;
  const confidence: PredictionResult['confidence'] =
    totalPlayed >= 8 ? 'ALTA' : totalPlayed >= 4 ? 'MEDIA' : 'BAJA';

  return {
    model: hasDraws ? 'dixon-coles' : 'normal-difference',
    hasDraws,
    probA: pA,
    probDraw: pDraw,
    probB: pB,
    expectedGoalsA: Math.round(lambdaA * 10) / 10,
    expectedGoalsB: Math.round(lambdaB * 10) / 10,
    live: isLive,
    liveRemainingFraction: isLive && duration > 0 ? Math.round(fraction * 100) / 100 : null,
    teamA: a.stats,
    teamB: b.stats,
    sportAverageGoals: Math.round(sportAverage * 100) / 100,
    confidence,
    insufficientData: totalPlayed === 0,
  };
}
