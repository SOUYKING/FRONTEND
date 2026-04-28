import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { getTournamentById, getTournamentLeaderboard, getGlobalLeaderboard, buildDiscordAvatar, DISCORD_AVATAR_FALLBACK } from '../utils/api';
import './Leaderboard.css';

const Leaderboard = () => {
  const { id } = useParams();
  const [leaderboard, setLeaderboard] = useState([]);
  const [tournament, setTournament] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [tab, setTab] = useState('points');

  useEffect(() => {
    const fetchLeaderboard = async () => {
      try {
        if (id) {
          const [tourneyData, lbData] = await Promise.all([
            getTournamentById(id).catch(() => null),
            getTournamentLeaderboard(id).catch(() => []),
          ]);
          setTournament(tourneyData);
          const sorted = Array.isArray(lbData) ? [...lbData].sort((a, b) => b.points - a.points) : [];
          setLeaderboard(sorted);
        } else {
          const globalData = await getGlobalLeaderboard();
          const sorted = Array.isArray(globalData) ? [...globalData].sort((a, b) => b.points - a.points) : [];
          setLeaderboard(sorted);
          setTournament(null);
        }
      } catch (err) {
        console.error('Error fetching leaderboard:', err);
        setError('Failed to load leaderboard');
      } finally { setLoading(false); }
    };
    fetchLeaderboard();
  }, [id]);

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
        {[1,2,3,4,5].map(i => <div key={i} className="skeleton" style={{ height: 56, marginBottom: 8 }} />)}
      </div>
    );
  }

  return (
    <div className="leaderboard-page page-wrapper">
      <div className="page-header">
        <div>
          <h1>{tournament?.title || 'Global'} Leaderboard</h1>
          <p className="subtitle">{tournament?.title ? 'Tournament rankings' : 'Top players worldwide'}</p>
        </div>
      </div>

      {error && <div style={{ padding: 12, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 'var(--radius-md)', marginBottom: 16, color: 'var(--red)', fontSize: '0.85rem' }}>{error}</div>}

      <div className="leaderboard-tabs">
        <button className={`leaderboard-tab ${tab === 'points' ? 'active' : ''}`} onClick={() => setTab('points')}>
          <i className="fas fa-trophy"></i> Rankings
        </button>
      </div>

      {leaderboard.length === 0 ? (
        <div className="empty-state">
          <span>🏆</span>
          <p>No leaderboard data available yet.</p>
        </div>
      ) : (
        <div className="leaderboard-list">
          {leaderboard.map((entry, index) => {
            const rank = getRankDisplay(index);
            return (
              <div key={entry.userId || index} className={`leaderboard-item ${getRankClass(index)}`}>
                <div className={`leaderboard-rank ${rank.cls}`}>{rank.label}</div>
                <div className="leaderboard-avatar">
                  <img src={buildDiscordAvatar(entry.discordId, entry.discordAvatar) || DISCORD_AVATAR_FALLBACK} alt="" />
                </div>
                <div className="leaderboard-name">{entry.discordName}</div>
                <div className="leaderboard-stats">
                  <span>Wins <strong>{entry.wins || 0}</strong></span>
                  <span>Losses <strong>{entry.losses || 0}</strong></span>
                </div>
                <div className="leaderboard-points">{entry.points || 0}</div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default Leaderboard;
