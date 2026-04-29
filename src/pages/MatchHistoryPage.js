import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { getMatchHistory, getMatchDetail, buildDiscordAvatar, DISCORD_AVATAR_FALLBACK } from '../utils/api';
import './Leaderboard.css';
import './MatchHistoryPage.css';

const MODE_LABELS = {
  '1v1': '1v1',
  '2v2': '2v2',
  '3v3': '3v3',
  '4v4': '4v4',
};

function modeShort(type) {
  return MODE_LABELS[type] || type || '1v1';
}

function modeDescription(type) {
  const m = type || '1v1';
  if (m === '1v1') return 'Solo duel';
  return `${m} squad match`;
}

const MatchHistoryPage = () => {
  const currentUser = (() => {
    try {
      return JSON.parse(localStorage.getItem('user') || '{}');
    } catch {
      return {};
    }
  })();
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('all');
  const [page, setPage] = useState(1);
  const perPage = 10;
  const [selectedMatch, setSelectedMatch] = useState(null);
  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);

  useEffect(() => {
    const fetchHistory = async () => {
      try {
        const data = await getMatchHistory();
        setMatches(data);
      } catch (err) {
        console.error('Error fetching match history:', err);
        setError('Failed to load match history');
      } finally { setLoading(false); }
    };
    fetchHistory();
  }, []);

  const filtered = filter === 'all' ? matches : matches.filter(m => {
    if (filter === 'win') return m.result === 'Win';
    if (filter === 'loss') return m.result === 'Loss';
    if (filter === 'draw') return m.result === 'Draw';
    if (filter === 'disputed') return m.disputed;
    return true;
  });
  const totalPages = Math.ceil(filtered.length / perPage);
  const paged = filtered.slice((page - 1) * perPage, page * perPage);

  const counts = {
    all: matches.length,
    win: matches.filter(m => m.result === 'Win').length,
    loss: matches.filter(m => m.result === 'Loss').length,
    draw: matches.filter(m => m.result === 'Draw').length,
    disputed: matches.filter(m => m.disputed).length,
  };
  const winRate = counts.all ? Math.round((counts.win / counts.all) * 100) : 0;

  const handleRowClick = async (match) => {
    setSelectedMatch(match);
    setDetail(null);
    setDetailLoading(true);
    try {
      const data = await getMatchDetail(match.id);
      setDetail(data);
    } catch (err) {
      console.error('Error fetching match detail:', err);
      setDetail({ error: 'Failed to load match details' });
    } finally { setDetailLoading(false); }
  };

  const resultClass = (r, d) => {
    if (d || r === 'Disputed') return 'disputed';
    if (r === 'Win') return 'win';
    if (r === 'Loss') return 'loss';
    return 'draw';
  };

  const resultLabel = (r) => {
    if (r === 'Disputed') return 'Disputed';
    if (r === 'Win') return 'Victory';
    if (r === 'Loss') return 'Defeat';
    if (r === 'Pending') return 'Pending';
    if (r === 'Unknown') return 'Unknown';
    return 'Draw';
  };

  const historyBadge = (r, disputed) => {
    if (disputed || r === 'Disputed') return { cls: 'bronze', mark: '!', short: 'FLAG' };
    if (r === 'Win') return { cls: 'gold', mark: 'W', short: 'WIN' };
    if (r === 'Loss') return { cls: 'plain', mark: 'L', short: 'LOSS' };
    if (r === 'Pending') return { cls: 'silver', mark: '…', short: 'WAIT' };
    if (r === 'Unknown') return { cls: 'plain', mark: '?', short: '—' };
    return { cls: 'silver', mark: 'D', short: 'DRAW' };
  };

  const resolveWinnerName = (d) => {
    if (!d?.winnerDiscordId) return '—';
    if (d.winnerDiscordId === d.self?.discordId) return d.self?.discordName || 'You';
    if (d.winnerDiscordId === d.opponent?.discordId) return d.opponent?.discordName || 'Opponent';
    return d.winnerDiscordId;
  };

  const resolveLoserName = (d) => {
    if (!d?.loserDiscordId) return '—';
    if (d.loserDiscordId === d.self?.discordId) return d.self?.discordName || 'You';
    if (d.loserDiscordId === d.opponent?.discordId) return d.opponent?.discordName || 'Opponent';
    return d.loserDiscordId;
  };

  if (loading) {
    return (
      <div className="match-history-page page-wrapper">
        <div className="page-header"><h1>Match History</h1></div>
        {[1,2,3].map(i => <div key={i} className="skeleton" style={{ height: 60, marginBottom: 8 }} />)}
      </div>
    );
  }

  return (
    <div className="match-history-page page-wrapper">
      <div className="page-header">
        <div>
          <h1>Match History</h1>
          <p className="subtitle">Solo and squad matches (2v2–4v4) in one place — open any row for votes, chat, and evidence</p>
        </div>
      </div>

      <div className="match-history-overview">
        <div className="overview-card"><span>Total Matches</span><strong>{counts.all}</strong></div>
        <div className="overview-card"><span>Win Rate</span><strong>{winRate}%</strong></div>
        <div className="overview-card"><span>Disputes</span><strong>{counts.disputed}</strong></div>
        <div className="overview-card"><span>Draws</span><strong>{counts.draw}</strong></div>
      </div>

      <div className="match-history-tips">
        <span><i className="fas fa-lightbulb"></i> Cards match tournament squad leaderboard style — tap for votes, chat, and evidence.</span>
        <span><i className="fas fa-filter"></i> Filters narrow wins, losses, draws, and disputes.</span>
        <span><i className="fas fa-users"></i> Squad matches show team titles; captains handle reporting.</span>
      </div>

      {error && <div style={{ padding: 12, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 'var(--radius-md)', marginBottom: 16, color: 'var(--red)', fontSize: '0.85rem' }}>{error}</div>}

      <div className="filter-tabs" style={{ marginBottom: 20 }}>
        <button className={filter === 'all' ? 'active' : ''} onClick={() => { setFilter('all'); setPage(1); }}>All ({counts.all})</button>
        <button className={filter === 'win' ? 'active' : ''} onClick={() => { setFilter('win'); setPage(1); }}>Wins ({counts.win})</button>
        <button className={filter === 'loss' ? 'active' : ''} onClick={() => { setFilter('loss'); setPage(1); }}>Losses ({counts.loss})</button>
        <button className={filter === 'draw' ? 'active' : ''} onClick={() => { setFilter('draw'); setPage(1); }}>Draws ({counts.draw})</button>
        <button className={filter === 'disputed' ? 'active' : ''} onClick={() => { setFilter('disputed'); setPage(1); }}>Disputed ({counts.disputed})</button>
      </div>

      {matches.length === 0 ? (
        <div className="empty-state">
          <span>📜</span>
          <p>No matches played yet. Join a tournament to start!</p>
        </div>
      ) : (
        <div className="lb-squad-standings mh-card-standings">
          {paged.map((match, idx) => {
            const badge = historyBadge(match.result, match.disputed);
            const outcomeClass = resultClass(match.result, match.disputed);
            const selfAv = buildDiscordAvatar(match.selfId || currentUser?.discordId || currentUser?.id, match.selfAvatar || currentUser?.discordAvatar) || DISCORD_AVATAR_FALLBACK;
            const oppAv = buildDiscordAvatar(match.opponentId, match.opponentAvatar) || DISCORD_AVATAR_FALLBACK;
            const titleMain = match.teamMatch && (match.yourTeamName || match.opponentTeamName)
              ? `${match.yourTeamName || 'Your squad'} vs ${match.opponentTeamName || match.opponent || 'Opponent'}`
              : `You vs ${match.opponent || 'Unknown'}`;
            return (
              <div
                key={match.id}
                className={`lb-squad-card mh-history-card mh-history-card--${outcomeClass}${match.teamMatch ? ' mh-history-card--squad' : ''}`}
                style={{ animationDelay: `${idx * 0.04}s` }}
              >
                <button
                  type="button"
                  className="lb-squad-card-hit mh-history-card-hit"
                  onClick={() => handleRowClick(match)}
                >
                  <div className={`lb-squad-rank-badge ${badge.cls}`}>
                    <span className="lb-squad-rank-num mh-history-badge-mark">{badge.mark}</span>
                    <span className="lb-squad-rank-label">{badge.short}</span>
                  </div>
                  <div className="lb-squad-card-body">
                    <div className="lb-squad-card-top">
                      <div className="lb-squad-avatar-stack mh-history-avatar-stack" aria-hidden>
                        <span className="lb-squad-stack-face mh-history-stack-face--self">
                          <img src={selfAv} alt="" />
                        </span>
                        <span className="lb-squad-stack-face mh-history-stack-face--opp">
                          <img src={oppAv} alt="" />
                        </span>
                      </div>
                      <div className="lb-squad-title-block">
                        <h3 className="lb-squad-team-title mh-history-duel-title">{titleMain}</h3>
                        <p className="lb-squad-team-sub">
                          {match.tournamentTitle ? (
                            <span className="mh-history-tourney-line" title={match.tournamentTitle}>{match.tournamentTitle}</span>
                          ) : (
                            <span>Match history</span>
                          )}
                          {match.teamMatch ? (
                            <span className="mh-history-captain-line"> · Captains: you · {match.opponent || '—'}</span>
                          ) : null}
                        </p>
                      </div>
                    </div>
                    <div className="lb-squad-stat-strip">
                      <div className="lb-squad-stat-pill">
                        <span className="lb-squad-stat-k">Format</span>
                        <span className="lb-squad-stat-v">
                          <span className={`match-mode-pill mode-${modeShort(match.tournamentType)} mh-history-mode-pill`} title={modeDescription(match.tournamentType)}>
                            {modeShort(match.tournamentType)}
                          </span>
                          {match.teamMatch ? (
                            <span className="match-squad-pill mh-history-squad-pill"><i className="fas fa-users" aria-hidden /> Squad</span>
                          ) : null}
                        </span>
                      </div>
                      <div className="lb-squad-stat-pill">
                        <span className="lb-squad-stat-k">Played</span>
                        <span className="lb-squad-stat-v">{new Date(match.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                      </div>
                      <div className={`lb-squad-stat-pill lb-squad-stat-pill--accent mh-history-outcome-pill mh-history-outcome-pill--${outcomeClass}`}>
                        <span className="lb-squad-stat-k">Outcome</span>
                        <span className="lb-squad-stat-v">{resultLabel(match.result)}</span>
                      </div>
                    </div>
                  </div>
                  <div className="lb-squad-chevron" aria-hidden>
                    <i className="fas fa-chevron-right" />
                  </div>
                </button>
              </div>
            );
          })}
        </div>
      )}

      {totalPages > 1 && (
        <div className="pagination">
          <button disabled={page <= 1} onClick={() => setPage(p => Math.max(1, p - 1))}>← Prev</button>
          <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{page} / {totalPages}</span>
          <button disabled={page >= totalPages} onClick={() => setPage(p => Math.min(totalPages, p + 1))}>Next →</button>
        </div>
      )}

      {selectedMatch && (
        <div className="modal-overlay" onClick={() => { setSelectedMatch(null); setDetail(null); }}>
          <div className="match-history-detail-modal modal-content mh-detail-lb-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header mh-detail-modal-head">
              <div>
                <h3>Match details</h3>
                {(selectedMatch?.tournamentTitle || detail?.tournamentTitle) ? (
                  <p className="modal-subtitle">
                    {detail?.tournamentTitle || selectedMatch?.tournamentTitle}
                    {(detail?.tournamentType || selectedMatch?.tournamentType) ? (
                      <span className={`match-mode-pill mode-${modeShort(detail?.tournamentType || selectedMatch?.tournamentType)} modal-mode-pill`}>
                        {modeShort(detail?.tournamentType || selectedMatch?.tournamentType)}
                      </span>
                    ) : null}
                  </p>
                ) : null}
              </div>
              <button type="button" className="close-btn" onClick={() => { setSelectedMatch(null); setDetail(null); }}>&times;</button>
            </div>
            <div className="modal-body">
              {detailLoading ? (
                <div style={{ textAlign: 'center', padding: 30, color: 'var(--text-muted)' }}>Loading match details...</div>
              ) : detail?.error ? (
                <div style={{ color: 'var(--red)', textAlign: 'center', padding: 20 }}>{detail.error}</div>
              ) : detail ? (
                <>
                  <div className={`match-detail-header${detail.teamMatch ? ' match-detail-header--squad' : ''}`}>
                    {detail.teamMatch && (
                      detail.yourTeamName ||
                      detail.opponentTeamName ||
                      detail.winnerTeamName ||
                      detail.player1TeamName ||
                      detail.player2TeamName
                    ) ? (
                      <div className="match-detail-squad-duel">
                        <div className="match-detail-squad-side self">
                          <span className="squad-label">
                            {detail.isParticipant ? 'Your squad' : 'Side 1 · squad'}
                          </span>
                          <strong className="squad-title">
                            {detail.isParticipant
                              ? (detail.yourTeamName || 'Your squad')
                              : (detail.player1TeamName || detail.self?.discordName || 'Squad')}
                          </strong>
                          <div className="match-detail-player match-detail-player--nested">
                            <img src={buildDiscordAvatar(detail.self?.discordId, detail.self?.discordAvatar) || DISCORD_AVATAR_FALLBACK} alt="" />
                            <span className="name">{detail.self?.discordName || 'Captain 1'}</span>
                            <span className="role-pill">Captain</span>
                          </div>
                        </div>
                        <div className="match-detail-vs">VS</div>
                        <div className="match-detail-squad-side opponent">
                          <span className="squad-label">
                            {detail.isParticipant ? 'Opponent squad' : 'Side 2 · squad'}
                          </span>
                          <strong className="squad-title">
                            {detail.isParticipant
                              ? (detail.opponentTeamName || detail.opponent?.discordName || 'Opponent')
                              : (detail.player2TeamName || detail.opponent?.discordName || 'Squad')}
                          </strong>
                          <div className="match-detail-player match-detail-player--nested">
                            <img src={buildDiscordAvatar(detail.opponent?.discordId, detail.opponent?.discordAvatar) || DISCORD_AVATAR_FALLBACK} alt="" />
                            <span className="name">{detail.opponent?.discordName || 'Captain 2'}</span>
                            <span className="role-pill">Captain</span>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="match-detail-players">
                        <div className="match-detail-player">
                          <img src={buildDiscordAvatar(detail.self?.discordId, detail.self?.discordAvatar) || DISCORD_AVATAR_FALLBACK} alt="" />
                          <span className="name">{detail.self?.discordName || 'You'}</span>
                        </div>
                        <div className="match-detail-vs">VS</div>
                        <div className="match-detail-player">
                          <img src={buildDiscordAvatar(detail.opponent?.discordId, detail.opponent?.discordAvatar) || DISCORD_AVATAR_FALLBACK} alt="" />
                          <span className="name">{detail.opponent?.discordName || 'Opponent'}</span>
                        </div>
                      </div>
                    )}
                    <span className={`match-detail-result-badge ${resultClass(detail.result, detail.disputed)}`}>
                      {resultLabel(detail.result)}
                    </span>
                    {!detail.isParticipant ? (
                      <p className="match-detail-spectator-note">
                        Bracket view: side 1 is player 1 in the stored match; result badges use that same perspective.
                      </p>
                    ) : null}
                  </div>

                  <div className="match-detail-info-grid">
                    <div className="match-detail-info-item">
                      <span className="label">Date</span>
                      <span className="value">{new Date(detail.date).toLocaleString()}</span>
                    </div>
                    <div className="match-detail-info-item">
                      <span className="label">Winner (captain)</span>
                      <span className="value">{resolveWinnerName(detail)}</span>
                    </div>
                    <div className="match-detail-info-item">
                      <span className="label">Loser (captain)</span>
                      <span className="value">{resolveLoserName(detail)}</span>
                    </div>
                    {detail.teamMatch && (detail.winnerTeamName || detail.loserTeamName) ? (
                      <>
                        <div className="match-detail-info-item">
                          <span className="label">Winning squad</span>
                          <span className="value">{detail.winnerTeamName || '—'}</span>
                        </div>
                        <div className="match-detail-info-item">
                          <span className="label">Losing squad</span>
                          <span className="value">{detail.loserTeamName || '—'}</span>
                        </div>
                      </>
                    ) : null}
                    {(detail.winnerRank || detail.loserRank) ? (
                      <>
                        <div className="match-detail-info-item">
                          <span className="label">Winner rank</span>
                          <span className="value">{detail.winnerRank || '—'}</span>
                        </div>
                        <div className="match-detail-info-item">
                          <span className="label">Loser rank</span>
                          <span className="value">{detail.loserRank || '—'}</span>
                        </div>
                      </>
                    ) : null}
                    <div className="match-detail-info-item">
                      <span className="label">Status</span>
                      <span className="value" style={{ color: detail.disputed ? 'var(--orange)' : 'var(--green)' }}>
                        {detail.disputed ? 'Disputed' : detail.status || 'Completed'}
                      </span>
                    </div>
                    <div className="match-detail-info-item">
                      <span className="label">Reports</span>
                      <span className="value">{Object.keys(detail.reports || {}).length}/2</span>
                    </div>
                    {detail.tournamentId && (
                      <div className="match-detail-info-item match-detail-info-item--tournament">
                        <span className="label">Tournament</span>
                        <span className="value">
                          {detail.tournamentTitle ? (
                            <Link to={`/tournament/${detail.tournamentId}/leaderboard`} className="match-detail-tournament-link">
                              {detail.tournamentTitle}
                              <i className="fas fa-external-link-alt" aria-hidden />
                            </Link>
                          ) : (
                            <Link to={`/tournament/${detail.tournamentId}/leaderboard`} className="match-detail-tournament-link">
                              Open leaderboard
                              <i className="fas fa-external-link-alt" aria-hidden />
                            </Link>
                          )}
                        </span>
                      </div>
                    )}
                    <div className="match-detail-info-item" style={{ gridColumn: 'span 2' }}>
                      <span className="label">Match ID</span>
                      <span className="value" style={{ fontSize: '0.7rem', fontFamily: 'var(--font-mono)' }}>{detail.id}</span>
                    </div>
                  </div>

                  {Object.keys(detail.reports || {}).length > 0 && (
                    <div className="detail-section detail-surface" style={{ marginTop: 16 }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
                        <i className="fas fa-vote-yea" style={{ color: 'var(--cyan)' }}></i> Captain votes
                      </label>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        {Object.entries(detail.reports).map(([playerId, report]) => {
                          const isSelf = playerId === detail.self?.discordId;
                          const playerName = isSelf ? detail.self?.discordName : detail.opponent?.discordName;
                          const votedForSelf = report.winnerDiscordId === playerId;
                          return (
                            <div key={playerId} style={{
                              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                              padding: '10px 14px', background: 'rgba(0,0,0,0.15)',
                              border: '1px solid var(--border)', borderRadius: 'var(--radius-md)',
                            }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                <img src={buildDiscordAvatar(playerId, '') || DISCORD_AVATAR_FALLBACK} alt="" style={{ width: 28, height: 28, borderRadius: '50%' }} />
                                <span style={{ fontWeight: 600, fontSize: '0.85rem' }}>{playerName}</span>
                              </div>
                              <span style={{
                                fontSize: '0.8rem', fontWeight: 600, padding: '4px 10px',
                                borderRadius: 100, background: votedForSelf ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)',
                                color: votedForSelf ? 'var(--green)' : 'var(--red)',
                              }}>
                                <i className={`fas ${votedForSelf ? 'fa-check-circle' : 'fa-times-circle'}`}></i>
                                {' '}{votedForSelf ? 'Claimed Win' : 'Admitted Loss'}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {detail.chatLogs?.length > 0 && (
                    <div className="detail-section detail-surface" style={{ marginTop: 16 }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
                        <i className="fas fa-comments" style={{ color: 'var(--purple)' }}></i> Match Chat ({detail.chatLogs.length})
                      </label>
                      <div style={{
                        maxHeight: 240, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 4,
                        padding: '8px', background: 'rgba(0,0,0,0.1)', borderRadius: 'var(--radius-md)',
                      }}>
                        {detail.chatLogs.map((msg, i) => (
                          <div key={i} style={{
                            padding: '6px 10px', borderRadius: 'var(--radius-sm)',
                            background: msg.isSystem ? 'rgba(46,242,255,0.03)' : 'transparent',
                            fontSize: '0.82rem',
                          }}>
                            <span style={{
                              color: msg.isSystem ? 'var(--text-muted)' : 'var(--cyan)',
                              fontWeight: 600, fontSize: '0.75rem', marginRight: 8,
                            }}>
                              {msg.isSystem ? 'System' : msg.sender}:
                            </span>
                            <span style={{ color: msg.isSystem ? 'var(--text-dim)' : 'var(--text-secondary)' }}>
                              {typeof msg.message === 'string' ? msg.message.substring(0, 200) : ''}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {detail.evidence?.length > 0 && (
                    <div className="detail-section detail-surface" style={{ marginTop: 16 }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
                        <i className="fas fa-paperclip" style={{ color: 'var(--orange)' }}></i> Evidence ({detail.evidence.length})
                      </label>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {detail.evidence.map((ev, i) => (
                          <div key={i} style={{
                            padding: 12, background: 'rgba(0,0,0,0.15)',
                            border: '1px solid var(--border)', borderRadius: 'var(--radius-md)',
                          }}>
                            <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginBottom: 8 }}>
                              <i className="fas fa-user"></i> Submitted by: {ev.playerDiscordId === detail.self?.discordId ? detail.self?.discordName : detail.opponent?.discordName}
                            </div>
                            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                              {ev.screenshots?.map((url, j) => (
                                <a key={j} href={url} target="_blank" rel="noopener noreferrer" className="btn btn-ghost btn-sm">
                                  <i className="fas fa-image"></i> Screenshot {j + 1}
                                </a>
                              ))}
                              {ev.videoLinks?.map((url, j) => (
                                <a key={j} href={url} target="_blank" rel="noopener noreferrer" className="btn btn-ghost btn-sm">
                                  <i className="fas fa-video"></i> Video {j + 1}
                                </a>
                              ))}
                              {ev.replayCodes?.map((code, j) => (
                                <span key={j} className="btn btn-ghost btn-sm">
                                  <i className="fas fa-code"></i> Replay: {code}
                                </span>
                              ))}
                              {ev.streamLinks?.map((url, j) => (
                                <a key={j} href={url} target="_blank" rel="noopener noreferrer" className="btn btn-ghost btn-sm">
                                  <i className="fas fa-broadcast-tower"></i> Stream
                                </a>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              ) : null}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MatchHistoryPage;
