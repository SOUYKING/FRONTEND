import React, { useState, useEffect } from 'react';
import { getMatchHistory, getMatchDetail, buildDiscordAvatar, DISCORD_AVATAR_FALLBACK } from '../utils/api';
import './MatchHistoryPage.css';

const MatchHistoryPage = () => {
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('all');
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
        <button className={filter === 'all' ? 'active' : ''} onClick={() => setFilter('all')}>All ({counts.all})</button>
        <button className={filter === 'win' ? 'active' : ''} onClick={() => setFilter('win')}>Wins ({counts.win})</button>
        <button className={filter === 'loss' ? 'active' : ''} onClick={() => setFilter('loss')}>Losses ({counts.loss})</button>
        <button className={filter === 'draw' ? 'active' : ''} onClick={() => setFilter('draw')}>Draws ({counts.draw})</button>
        <button className={filter === 'disputed' ? 'active' : ''} onClick={() => setFilter('disputed')}>Disputed ({counts.disputed})</button>
      </div>

      {matches.length === 0 ? (
        <div className="empty-state">
          <span>📜</span>
          <p>No matches played yet. Join a tournament to start!</p>
        </div>
      ) : (
        <div className="match-history-list">
          {filtered.map((match, idx) => (
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

      {selectedMatch && (
        <div className="modal-overlay" onClick={() => { setSelectedMatch(null); setDetail(null); }}>
          <div className="match-history-detail-modal modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Match Details</h3>
              <button className="close-btn" onClick={() => { setSelectedMatch(null); setDetail(null); }}>&times;</button>
            </div>
            <div className="modal-body">
              {detailLoading ? (
                <div style={{ textAlign: 'center', padding: 20, color: 'var(--text-muted)' }}>Loading...</div>
              ) : detail?.error ? (
                <div style={{ color: 'var(--red)', textAlign: 'center' }}>{detail.error}</div>
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
                      <span className="label">Status</span>
                      <span className="value" style={{ color: detail.disputed ? 'var(--orange)' : 'var(--green)' }}>{detail.disputed ? 'Disputed' : detail.status || 'Completed'}</span>
                    </div>
                    <div className="match-detail-info-item">
                      <span className="label">Reports</span>
                      <span className="value">{Object.keys(detail.reports || {}).length}/2</span>
                    </div>
                  </div>

                  {detail.evidence?.length > 0 && (
                    <div className="detail-section" style={{ marginTop: 16 }}>
                      <label>Evidence ({detail.evidence.length})</label>
                      {detail.evidence.map((ev, i) => (
                        <div key={i} style={{ padding: 10, background: 'rgba(0,0,0,0.15)', borderRadius: 'var(--radius-sm)', marginBottom: 8, fontSize: '0.85rem' }}>
                          <div style={{ color: 'var(--text-muted)', marginBottom: 6 }}>
                            By: {ev.playerDiscordId === detail.self?.discordId ? detail.self?.discordName : detail.opponent?.discordName}
                          </div>
                          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                            {ev.screenshots?.map((url, j) => (
                              <a key={j} href={url} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--cyan)', fontSize: '0.8rem' }}>📷 Screenshot</a>
                            ))}
                            {ev.videoLinks?.map((url, j) => (
                              <a key={j} href={url} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--purple)', fontSize: '0.8rem' }}>🎥 Video</a>
                            ))}
                          </div>
                        </div>
                      ))}
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
