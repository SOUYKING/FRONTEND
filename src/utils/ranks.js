import RANKS from '../data/ranks.json';

export function getRank(points = 0) {
  let rank = RANKS[0];
  for (const r of RANKS) {
    if (points >= r.minPoints) rank = r;
    else break;
  }
  return rank;
}

export function getRankProgress(points = 0) {
  const rank = getRank(points);
  const nextIdx = RANKS.indexOf(rank) + 1;
  if (nextIdx >= RANKS.length) return 100;
  const nextRank = RANKS[nextIdx];
  const range = nextRank.minPoints - rank.minPoints;
  if (range <= 0) return 100;
  return Math.min(100, Math.max(0, ((points - rank.minPoints) / range) * 100));
}

export function getRankLabel(points = 0) {
  const rank = getRank(points);
  return rank.division ? `${rank.name} ${rank.division}` : rank.name;
}

export { RANKS };
