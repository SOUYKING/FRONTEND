import React, { useState, useEffect } from 'react';
import { getMatchHistory, getMatchDetail, buildDiscordAvatar, DISCORD_AVATAR_FALLBACK } from '../utils/api';
import './MatchHistoryPage.css';

const MatchHistoryPage = () => {
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
    return 'Draw';
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
          <p className="subtitle">Track your competitive journey</p>
        </div>
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
        <div className="match-history-list">
          {paged.map((match, idx) => (
            <div
              key={match.id}
              className="match-history-item"
              style={{ animationDelay: `${idx * 0.03}s` }}
              onClick={() => handleRowClick(match)}
            >
              <div className="match-history-avatars">
                <div className="match-history-avatar self">
                  <img src={buildDiscordAvatar(JSON.parse(localStorage.getItem('user') || '{}')?.discordId || JSON.parse(localStorage.getItem('user') || '{}')?.id, JSON.parse(localStorage.getItem('user') || '{}')?.discordAvatar) || DISCORD_AVATAR_FALLBACK} alt="" />
                </div>
                <span className="match-history-vs">VS</span>
                <div className="match-history-avatar opponent">
                  <img src={buildDiscordAvatar(match.opponentId, match.opponentAvatar) || DISCORD_AVATAR_FALLBACK} alt="" />
                </div>
              </div>
              <div className="match-history-info">
                <div className="match-history-players">
                  You <span className="vs-text">vs</span> {match.opponent}
                </div>
                <div className="match-history-date">{new Date(match.date).toLocaleDateString()}</div>
              </div>
              <div className={`match-history-result ${resultClass(match.result, match.disputed)}`}>
                {resultLabel(match.result)}
              </div>
            </div>
          ))}
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
          <div className="match-history-detail-modal modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Match Details</h3>
              <button className="close-btn" onClick={() => { setSelectedMatch(null); setDetail(null); }}>&times;</button>
            </div>
            <div className="modal-body">
              {detailLoading ? (
                <div style={{ textAlign: 'center', padding: 30, color: 'var(--text-muted)' }}>Loading match details...</div>
              ) : detail?.error ? (
                <div style={{ color: 'var(--red)', textAlign: 'center', padding: 20 }}>{detail.error}</div>
              ) : detail ? (
                <>
                  <div className="match-detail-header">
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
                    <span className={`match-detail-result-badge ${resultClass(detail.result, detail.disputed)}`}>
                      {resultLabel(detail.result)}
                    </span>
                  </div>

                  <div className="match-detail-info-grid">
                    <div className="match-detail-info-item">
                      <span className="label">Date</span>
                      <span className="value">{new Date(detail.date).toLocaleString()}</span>
                    </div>
                    <div className="match-detail-info-item">
                      <span className="label">Winner</span>
                      <span className="value">{detail.winnerDiscordId === detail.self?.discordId ? detail.self?.discordName : detail.opponent?.discordName}</span>
                    </div>
                    <div className="match-detail-info-item">
                      <span className="label">Loser</span>
                      <span className="value">{detail.loserDiscordId === detail.self?.discordId ? detail.self?.discordName : (detail.loserDiscordId === detail.opponent?.discordId ? detail.opponent?.discordName : '—')}</span>
                    </div>
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
                      <div className="match-detail-info-item">
                        <span className="label">Tournament</span>
                        <span className="value" style={{ fontSize: '0.75rem' }}>{detail.tournamentId.substring(0, 12)}...</span>
                      </div>
                    )}
                    <div className="match-detail-info-item" style={{ gridColumn: 'span 2' }}>
                      <span className="label">Match ID</span>
                      <span className="value" style={{ fontSize: '0.7rem', fontFamily: 'var(--font-mono)' }}>{detail.id}</span>
                    </div>
                  </div>

                  {Object.keys(detail.reports || {}).length > 0 && (
                    <div className="detail-section" style={{ marginTop: 16 }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
                        <i className="fas fa-vote-yea" style={{ color: 'var(--cyan)' }}></i> Player Votes
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
                    <div className="detail-section" style={{ marginTop: 16 }}>
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
                    <div className="detail-section" style={{ marginTop: 16 }}>
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
