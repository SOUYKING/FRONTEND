import React, { useState, useEffect, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { getTournamentById, getTournamentLeaderboard, getGlobalLeaderboard, buildDiscordAvatar, DISCORD_AVATAR_FALLBACK } from '../utils/api';
import './Leaderboard.css';

const TEAM_TYPES = new Set(['2v2', '3v3', '4v4']);

function normalizeTournamentLbResponse(data) {
  if (Array.isArray(data)) {
    return { tournament: null, entries: data };
  }
  return {
    tournament: data?.tournament || null,
    entries: Array.isArray(data?.entries) ? data.entries : [],
  };
}

function winRate(wins, losses) {
  const t = (wins || 0) + (losses || 0);
  if (t === 0) return '—';
  return `${(((wins || 0) / t) * 100).toFixed(1)}%`;
}

function buildTeamRollup(entries, tournamentType) {
  if (!TEAM_TYPES.has(tournamentType || '')) return [];
  const byTeam = new Map();
  for (const e of entries) {
    const hasTeamId = e.teamId != null && String(e.teamId).trim() !== '';
    const nameNorm = e.teamName && String(e.teamName).trim().toLowerCase();
    const groupKey = hasTeamId
      ? `id:${String(e.teamId).trim()}`
      : nameNorm
        ? `name:${nameNorm}`
        : `solo:${e.userId}`;
    if (!byTeam.has(groupKey)) {
      byTeam.set(groupKey, {
        teamId: hasTeamId ? String(e.teamId).trim() : null,
        teamName: null,
        members: [],
      });
    }
    const bucket = byTeam.get(groupKey);
    bucket.members.push(e);
    if (hasTeamId && !bucket.teamId) bucket.teamId = String(e.teamId).trim();
    const nm = e.teamName && String(e.teamName).trim();
    if (nm && (!bucket.teamName || nm.length > bucket.teamName.length)) {
      bucket.teamName = nm;
    }
  }
  const rows = [...byTeam.values()].map((t) => {
    const { members } = t;
    const avgPoints = members.length
      ? Math.round(members.reduce((s, m) => s + (m.points || 0), 0) / members.length)
      : 0;
    const wins = members[0]?.wins ?? 0;
    const losses = members[0]?.losses ?? 0;
    const roster = [...members].sort((a, b) => (b.points || 0) - (a.points || 0));
    const displayName =
      (t.teamName && t.teamName.trim()) ||
      roster.map((m) => m.teamName).find((n) => n && String(n).trim()) ||
      (roster.length === 1 ? String(roster[0].discordName || 'Player').trim() : null) ||
      `Team (${roster.length})`;
    return {
      ...t,
      members: roster,
      displayName,
      avgPoints,
      wins,
      losses,
      winRateLabel: winRate(wins, losses),
      memberCount: members.length,
    };
  });
  rows.sort((a, b) => {
    const wp = (b.wins || 0) - (a.wins || 0);
    if (wp !== 0) return wp;
    const lp = (a.losses || 0) - (b.losses || 0);
    if (lp !== 0) return lp;
    return (b.avgPoints || 0) - (a.avgPoints || 0);
  });
  return rows;
}

const Leaderboard = () => {
  const { id } = useParams();
  const [entries, setEntries] = useState([]);
  const [tournamentMeta, setTournamentMeta] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [expandedTeamKey, setExpandedTeamKey] = useState(null);

  useEffect(() => {
    const fetchLeaderboard = async () => {
      try {
        if (id) {
          const lbRaw = await getTournamentLeaderboard(id).catch(() => null);
          const { tournament: tMeta, entries: ent } = normalizeTournamentLbResponse(lbRaw || []);
          if (!tMeta && id) {
            const tourneyData = await getTournamentById(id).catch(() => null);
            setTournamentMeta(tourneyData);
          } else {
            setTournamentMeta(tMeta);
          }
          const sorted = [...ent].sort((a, b) => (b.points || 0) - (a.points || 0));
          setEntries(sorted);
        } else {
          const globalData = await getGlobalLeaderboard();
          const sorted = Array.isArray(globalData)
            ? [...globalData].sort((a, b) => (b.points || 0) - (a.points || 0))
            : [];
          setEntries(sorted);
          setTournamentMeta(null);
        }
      } catch (err) {
        console.error('Error fetching leaderboard:', err);
        setError('Failed to load leaderboard');
      } finally {
        setLoading(false);
      }
    };
    fetchLeaderboard();
  }, [id]);

  const isSquadTournament = TEAM_TYPES.has(tournamentMeta?.type || '');
  const teamRollup = useMemo(
    () => buildTeamRollup(entries, tournamentMeta?.type),
    [entries, tournamentMeta?.type],
  );

  const teamRowKey = (team, index) =>
    team.teamId || team.members.map((m) => m.userId).join('|') || `team-row-${index}`;

  const getRankClass = (index) => {
    if (index === 0) return 'top-1';
    if (index === 1) return 'top-2';
    if (index === 2) return 'top-3';
    return '';
  };

  const getRankDisplay = (index) => {
    if (index === 0) return { label: '1', cls: 'gold' };
    if (index === 1) return { label: '2', cls: 'silver' };
    if (index === 2) return { label: '3', cls: 'bronze' };
    return { label: `${index + 1}`, cls: '' };
  };

  if (loading) {
    return (
      <div className="leaderboard-page page-wrapper">
        <div className="page-header"><h1>Leaderboard</h1></div>
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="skeleton lb-skeleton-row" />
        ))}
      </div>
    );
  }

  const title = tournamentMeta?.title || 'Global';
  const typeLabel = tournamentMeta?.type || null;

  return (
    <div className={`leaderboard-page page-wrapper${id && isSquadTournament ? ' lb-page--squad' : ''}`}>
      {tournamentMeta && id && (
        <div className="lb-hero">
          {tournamentMeta.bannerImage ? (
            <div className="lb-hero-banner">
              <img src={tournamentMeta.bannerImage} alt="" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
              <div className="lb-hero-banner-overlay" />
            </div>
          ) : null}
          <div className="lb-hero-inner">
            <div className="lb-hero-top">
              <Link to="/tournaments" className="lb-back-link">
                <i className="fas fa-arrow-left" /> Tournaments
              </Link>
              {typeLabel && <span className="lb-type-pill">{typeLabel}</span>}
            </div>
            <h1 className="lb-hero-title">{tournamentMeta.title || 'Tournament'}</h1>
            <div className="lb-hero-meta">
              {tournamentMeta.mapCode && (
                <span className="lb-meta-chip"><i className="fas fa-map-pin" /> {tournamentMeta.mapCode}</span>
              )}
              {tournamentMeta.prize && (
                <span className="lb-meta-chip lb-meta-prize"><i className="fas fa-trophy" /> {tournamentMeta.prize}</span>
              )}
              <span className="lb-meta-chip">
                <i className="fas fa-users" />
                {isSquadTournament && teamRollup.length > 0 ? (
                  <>
                    {teamRollup.length} {teamRollup.length === 1 ? 'team' : 'teams'}
                    {' · '}
                    {entries.length} {entries.length === 1 ? 'player' : 'players'}
                  </>
                ) : (
                  <>
                    {entries.length} {entries.length === 1 ? 'player' : 'players'}
                  </>
                )}
              </span>
            </div>
            {isSquadTournament && (
              <p className="lb-hero-hint">
                Teams ranked by wins. Open a card to see the full roster.
              </p>
            )}
          </div>
        </div>
      )}

      <div className={`page-header lb-page-header ${tournamentMeta && id ? 'lb-header-compact' : ''}`}>
        <div>
          <h1>{!id || !tournamentMeta ? `${title} leaderboard` : 'Standings'}</h1>
          <p className="subtitle">
            {!id
              ? 'Top players worldwide'
              : isSquadTournament
                ? 'Squad standings — tap any team for player details'
                : 'Points and match record for this event'}
          </p>
        </div>
        {!id && (
          <Link to="/tournaments" className="btn btn-ghost btn-sm lb-header-link">
            <i className="fas fa-trophy" /> Tournaments
          </Link>
        )}
      </div>

      {error && (
        <div className="lb-alert">{error}</div>
      )}

      {(!id || !isSquadTournament) && (
        <>
          {entries.length === 0 ? (
            <div className="empty-state lb-empty">
              <span>🏆</span>
              <p>No leaderboard data yet. Play matches in this tournament to earn points.</p>
              {id && (
                <Link to={`/queue/${id}`} className="btn btn-primary btn-sm">Go to queue</Link>
              )}
            </div>
          ) : (
            <div className="lb-table-wrap">
              <div className="lb-table-head" aria-hidden="true">
                <span className="lb-th-rank">#</span>
                <span className="lb-th-player">Player</span>
                <span className="lb-th-stat">W</span>
                <span className="lb-th-stat">L</span>
                <span className="lb-th-stat lb-th-wr">Win%</span>
                <span className="lb-th-points">Pts</span>
              </div>
              <div className="leaderboard-list">
                {entries.map((entry, index) => {
                  const rank = getRankDisplay(index);
                  const wr = winRate(entry.wins, entry.losses);
                  return (
                    <div
                      key={entry.userId || index}
                      className={`leaderboard-item lb-row ${getRankClass(index)}`}
                    >
                      <div className={`leaderboard-rank lb-rank ${rank.cls}`}>{rank.label}</div>
                      <div className="lb-player-cell">
                        <div className="leaderboard-avatar lb-avatar">
                          <img
                            src={buildDiscordAvatar(entry.discordId, entry.discordAvatar) || DISCORD_AVATAR_FALLBACK}
                            alt=""
                          />
                        </div>
                        <div className="lb-name-block">
                          <div className="leaderboard-name">{entry.discordName || 'Player'}</div>
                          {entry.epicName && (
                            <div className="lb-epic"><i className="fas fa-gamepad" /> {entry.epicName}</div>
                          )}
                        </div>
                      </div>
                      <div className="lb-stat">{entry.wins ?? 0}</div>
                      <div className="lb-stat">{entry.losses ?? 0}</div>
                      <div className="lb-stat lb-stat-wr">{wr}</div>
                      <div className="leaderboard-points lb-points">{entry.points ?? 0}</div>
                      <div className="lb-row-mobile-meta">
                        <span>{entry.wins ?? 0}W · {entry.losses ?? 0}L</span>
                        <span>{wr} WR</span>
                        <span className="lb-m-pts">{entry.points ?? 0} pts</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}

      {id && isSquadTournament && (
        <>
          {teamRollup.length === 0 ? (
            <div className="empty-state lb-empty">
              <span>🏆</span>
              <p>No teams on the board yet. Play matches to fill the standings.</p>
              <Link to={`/queue/${id}`} className="btn btn-primary btn-sm">Go to queue</Link>
            </div>
          ) : (
            <div className="lb-squad-standings">
              {teamRollup.map((team, index) => {
                const rank = getRankDisplay(index);
                const key = teamRowKey(team, index);
                const open = expandedTeamKey === key;
                const tier = getRankClass(index);
                return (
                  <div
                    key={key || index}
                    className={`lb-squad-card ${tier}${open ? ' is-open' : ''}`}
                  >
                    <button
                      type="button"
                      className="lb-squad-card-hit"
                      onClick={() => setExpandedTeamKey(open ? null : key)}
                      aria-expanded={open}
                      aria-controls={`roster-${key}`}
                    >
                      <div className={`lb-squad-rank-badge ${rank.cls || 'plain'}`}>
                        <span className="lb-squad-rank-num">{rank.label}</span>
                        {index === 0 && <span className="lb-squad-rank-label">1st</span>}
                        {index === 1 && <span className="lb-squad-rank-label">2nd</span>}
                        {index === 2 && <span className="lb-squad-rank-label">3rd</span>}
                      </div>
                      <div className="lb-squad-card-body">
                        <div className="lb-squad-card-top">
                          <div className="lb-squad-avatar-stack" aria-hidden>
                            {team.members.slice(0, 4).map((m) => (
                              <span key={m.userId} className="lb-squad-stack-face">
                                <img
                                  src={buildDiscordAvatar(m.discordId, m.discordAvatar) || DISCORD_AVATAR_FALLBACK}
                                  alt=""
                                />
                              </span>
                            ))}
                          </div>
                          <div className="lb-squad-title-block">
                            <h3 className="lb-squad-team-title">{team.displayName}</h3>
                            <p className="lb-squad-team-sub">
                              {team.memberCount} {team.memberCount === 1 ? 'player' : 'players'}
                              {open ? ' · roster open' : ' · tap for roster'}
                            </p>
                          </div>
                        </div>
                        <div className="lb-squad-stat-strip">
                          <div className="lb-squad-stat-pill">
                            <span className="lb-squad-stat-k">Record</span>
                            <span className="lb-squad-stat-v">{team.wins ?? 0}–{team.losses ?? 0}</span>
                          </div>
                          <div className="lb-squad-stat-pill">
                            <span className="lb-squad-stat-k">Win rate</span>
                            <span className="lb-squad-stat-v">{team.winRateLabel}</span>
                          </div>
                          <div className="lb-squad-stat-pill lb-squad-stat-pill--accent">
                            <span className="lb-squad-stat-k">Avg pts</span>
                            <span className="lb-squad-stat-v">{team.avgPoints ?? 0}</span>
                          </div>
                        </div>
                      </div>
                      <div className="lb-squad-chevron" aria-hidden>
                        <i className={`fas fa-chevron-${open ? 'up' : 'down'}`} />
                      </div>
                    </button>
                    {open ? (
                      <div className="lb-squad-roster" id={`roster-${key}`}>
                        <div className="lb-squad-roster-head">
                          <span className="lb-squad-roster-title">Roster</span>
                          <span className="lb-squad-roster-team">{team.displayName}</span>
                        </div>
                        <ul className="lb-squad-roster-list">
                          {team.members.map((m) => {
                            const wrM = winRate(m.wins, m.losses);
                            return (
                              <li key={m.userId} className="lb-squad-player-tile">
                                <div className="lb-squad-player-id">
                                  <div className="lb-squad-player-av">
                                    <img
                                      src={buildDiscordAvatar(m.discordId, m.discordAvatar) || DISCORD_AVATAR_FALLBACK}
                                      alt=""
                                    />
                                  </div>
                                  <div>
                                    <div className="lb-squad-player-name">{m.discordName || 'Player'}</div>
                                    {m.epicName ? (
                                      <div className="lb-squad-player-epic">
                                        <i className="fas fa-gamepad" /> {m.epicName}
                                      </div>
                                    ) : null}
                                  </div>
                                </div>
                                <div className="lb-squad-player-metrics">
                                  <span>{m.wins ?? 0}W</span>
                                  <span>{m.losses ?? 0}L</span>
                                  <span className="lb-squad-player-wr">{wrM}</span>
                                  <span className="lb-squad-player-pts">{m.points ?? 0} pts</span>
                                </div>
                              </li>
                            );
                          })}
                        </ul>
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default Leaderboard;
