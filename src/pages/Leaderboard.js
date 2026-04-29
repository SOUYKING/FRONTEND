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
    const tid = e.teamId || `__solo_${e.userId}`;
    if (!byTeam.has(tid)) {
      byTeam.set(tid, {
        teamId: e.teamId,
        teamName: e.teamId ? (e.teamName || 'Team') : null,
        members: [],
      });
    }
    byTeam.get(tid).members.push(e);
  }
  const rows = [...byTeam.values()].map((t) => {
    const { members } = t;
    const avgPoints = members.length
      ? Math.round(members.reduce((s, m) => s + (m.points || 0), 0) / members.length)
      : 0;
    const wins = members[0]?.wins ?? 0;
    const losses = members[0]?.losses ?? 0;
    return {
      ...t,
      avgPoints,
      wins,
      losses,
      winRateLabel: winRate(wins, losses),
      memberCount: members.length,
    };
  });
  rows.sort((a, b) => b.avgPoints - a.avgPoints);
  return rows;
}

const Leaderboard = () => {
  const { id } = useParams();
  const [entries, setEntries] = useState([]);
  const [tournamentMeta, setTournamentMeta] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [view, setView] = useState('players');

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

  useEffect(() => {
    if (!isSquadTournament && view === 'teams') setView('players');
  }, [isSquadTournament, view]);

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
    <div className="leaderboard-page page-wrapper">
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
                <i className="fas fa-users" /> {entries.length} {entries.length === 1 ? 'player' : 'players'}
                {isSquadTournament && teamRollup.length > 0 && (
                  <> · {teamRollup.length} {teamRollup.length === 1 ? 'team' : 'teams'}</>
                )}
              </span>
            </div>
            {isSquadTournament && (
              <p className="lb-hero-hint">
                Squad event: rankings track each player; <strong>Teams</strong> view groups rosters and shows average points.
              </p>
            )}
          </div>
        </div>
      )}

      <div className={`page-header lb-page-header ${tournamentMeta && id ? 'lb-header-compact' : ''}`}>
        <div>
          <h1>{!id || !tournamentMeta ? `${title} leaderboard` : 'Standings'}</h1>
          <p className="subtitle">
            {!id ? 'Top players worldwide' : 'Points, wins, and team breakdown for this event'}
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

      {id && isSquadTournament && (
        <div className="leaderboard-tabs lb-tabs">
          <button
            type="button"
            className={`leaderboard-tab ${view === 'players' ? 'active' : ''}`}
            onClick={() => setView('players')}
          >
            <i className="fas fa-user" /> Players
          </button>
          <button
            type="button"
            className={`leaderboard-tab ${view === 'teams' ? 'active' : ''}`}
            onClick={() => setView('teams')}
          >
            <i className="fas fa-users" /> Teams
          </button>
        </div>
      )}

      {(!id || view === 'players') && (
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
            <div className={`lb-table-wrap ${isSquadTournament ? 'squad' : ''}`}>
              <div className="lb-table-head" aria-hidden="true">
                <span className="lb-th-rank">#</span>
                <span className="lb-th-player">Player</span>
                {isSquadTournament && <span className="lb-th-team">Team</span>}
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
                      {isSquadTournament && (
                        <div className="lb-team-cell">
                          {entry.teamName ? (
                            <span className="lb-team-pill" title={entry.teamId || ''}>{entry.teamName}</span>
                          ) : (
                            <span className="lb-team-pill lb-team-none">—</span>
                          )}
                        </div>
                      )}
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

      {id && isSquadTournament && view === 'teams' && (
        <>
          {teamRollup.length === 0 ? (
            <div className="empty-state lb-empty"><p>No teams to show.</p></div>
          ) : (
            <div className="lb-team-grid">
              {teamRollup.map((team, index) => {
                const rank = getRankDisplay(index);
                return (
                  <div key={team.teamId || team.members[0]?.userId || index} className={`lb-team-card ${getRankClass(index)}`}>
                    <div className="lb-team-card-head">
                      <div className={`lb-team-rank ${rank.cls}`}>{rank.label}</div>
                      <div className="lb-team-title">
                        <h3>{team.teamName || 'Team'}</h3>
                        <span className="lb-team-sub">{team.memberCount} {team.memberCount === 1 ? 'player' : 'players'} · Avg {team.avgPoints} pts</span>
                      </div>
                    </div>
                    <div className="lb-team-roster">
                      {team.members.map((m) => (
                        <div key={m.userId} className="lb-roster-member" title={m.discordName}>
                          <img
                            src={buildDiscordAvatar(m.discordId, m.discordAvatar) || DISCORD_AVATAR_FALLBACK}
                            alt=""
                          />
                        </div>
                      ))}
                    </div>
                    <div className="lb-team-stats">
                      <div>
                        <span className="lb-ts-label">Record</span>
                        <span className="lb-ts-val">{team.wins}W — {team.losses}L</span>
                      </div>
                      <div>
                        <span className="lb-ts-label">Win rate</span>
                        <span className="lb-ts-val">{team.winRateLabel}</span>
                      </div>
                      <div>
                        <span className="lb-ts-label">Avg points</span>
                        <span className="lb-ts-val lb-ts-cyan">{team.avgPoints}</span>
                      </div>
                    </div>
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
