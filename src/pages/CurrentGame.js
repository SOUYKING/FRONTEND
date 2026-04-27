import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getCurrentMatch, getMyRegisteredTournaments, leaveTournament, DISCORD_AVATAR_FALLBACK, buildDiscordAvatar } from '../utils/api';
import { getRank, getRankLabel } from '../utils/ranks';
import './CurrentGame.css';

const CurrentGame = () => {
  const navigate = useNavigate();
  const [currentMatch, setCurrentMatch] = useState(null);
  const [registeredTournament, setRegisteredTournament] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    const fetchCurrentState = async () => {
      try {
        const [matchData, registered] = await Promise.all([
          getCurrentMatch(),
          getMyRegisteredTournaments(),
        ]);
        setCurrentMatch(matchData);
        const upcomingOrActive = (registered || [])
          .filter((t) => t.lifecycleStage !== 'completed' && t.lifecycleStage !== 'cancelled')
          .sort((a, b) => new Date(a.startDate) - new Date(b.startDate));
        setRegisteredTournament(upcomingOrActive[0] || null);
      } catch (err) {
        console.error('Error fetching current match:', err);
        setError('Failed to load current game info');
      } finally {
        setLoading(false);
      }
    };
    fetchCurrentState();
    const intervalId = setInterval(fetchCurrentState, 15000);
    return () => clearInterval(intervalId);
  }, []);

  const handleLeaveTournament = async () => {
    if (!registeredTournament?._id) return;
    try {
      const res = await leaveTournament(registeredTournament._id);
      setMessage(res.message || 'You left the tournament.');
      setRegisteredTournament(null);
    } catch (err) {
      setMessage(err.response?.data?.message || 'Failed to leave tournament.');
    }
  };

  if (loading) {
    return (
      <div className="current-game-page page-wrapper">
        <div className="current-game-card">
          <div className="skeleton" style={{ width: 100, height: 100, borderRadius: '50%', margin: '0 auto 20px' }} />
          <div className="skeleton" style={{ width: 200, height: 24, margin: '0 auto 12px' }} />
          <div className="skeleton" style={{ width: 160, height: 16, margin: '0 auto' }} />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="current-game-page page-wrapper">
        <div className="current-game-card">
          <p style={{ color: 'var(--red)', marginBottom: 16 }}>{error}</p>
          <button onClick={() => navigate('/tournaments')} className="btn btn-ghost">Back to Tournaments</button>
        </div>
      </div>
    );
  }

  if (!currentMatch || !currentMatch.inMatch) {
    return (
      <div className="current-game-page page-wrapper">
        {registeredTournament ? (
          <div className="no-game-card">
            <div className="no-game-icon">🎮</div>
            <h2>Registered Tournament</h2>
            <div className="no-game-details">
              <div className="detail-row"><i className="fas fa-trophy" style={{ color: 'var(--cyan)' }}></i> {registeredTournament.title}</div>
              <div className="detail-row"><i className="fas fa-calendar" style={{ color: 'var(--purple)' }}></i> Starts: {new Date(registeredTournament.startDate).toLocaleString()}</div>
              <div className="detail-row"><i className="fas fa-clock" style={{ color: 'var(--orange)' }}></i> {registeredTournament.queueOpen ? 'Queue is open' : 'Waiting for start'}</div>
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button
                onClick={() => navigate(`/queue/${registeredTournament._id}`)}
                className="btn btn-primary"
                disabled={!registeredTournament.queueOpen}
              >
                {registeredTournament.queueOpen ? 'Join Queue' : 'Queue Opens At Start'}
              </button>
              <button onClick={handleLeaveTournament} className="btn btn-ghost">
                Leave
              </button>
            </div>
            {message && <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: 12 }}>{message}</p>}
          </div>
        ) : (
          <div className="no-game-card">
            <div className="no-game-icon">⚔</div>
            <h2>No Active Game</h2>
            <p>You are not currently in a match or registered tournament.</p>
            <button onClick={() => navigate('/tournaments')} className="btn btn-primary">
              Join a Tournament
            </button>
          </div>
        )}
      </div>
    );
  }

  const selfRank = getRank(currentMatch.selfSkillRating || 0);
  const oppRank = getRank(currentMatch.opponentSkillRating || 0);

  return (
    <div className="current-game-page page-wrapper">
      <div className="current-game-card">
        <h2 className="current-game-title">Active Match</h2>
        <p className="current-game-subtitle">Your battle is live. Jump back in.</p>

        <div className="current-vs-area">
          <div className="current-player-card">
            <div className="current-player-avatar">
              <img src={buildDiscordAvatar(currentMatch.selfId, currentMatch.selfAvatar) || DISCORD_AVATAR_FALLBACK} alt="" />
            </div>
            <div className="current-player-name">{currentMatch.selfName || 'You'}</div>
            <div className="current-player-tag">YOU</div>
          </div>

          <div className="current-vs-divider">
            <div className="current-vs-line" />
            <div className="current-vs-text">VS</div>
            <div className="current-vs-line" />
          </div>

          <div className="current-player-card">
            <div className="current-player-avatar" style={{ borderColor: 'var(--border-purple)', boxShadow: '0 0 15px var(--purple-glow)' }}>
              <img src={buildDiscordAvatar(currentMatch.opponentId, currentMatch.opponentAvatar) || DISCORD_AVATAR_FALLBACK} alt="" />
            </div>
            <div className="current-player-name">{currentMatch.opponent}</div>
            <div className="current-player-tag">OPPONENT</div>
          </div>
        </div>

        <div className="current-match-info">
          {currentMatch.mapCode && (
            <span className="current-info-tag"><i className="fas fa-map-pin"></i> {currentMatch.mapCode}</span>
          )}
          <span className="current-info-tag"><i className="fas fa-circle" style={{ color: 'var(--green)' }}></i> Live</span>
        </div>

        <button
          onClick={() => navigate(`/match/${currentMatch.matchId}`, {
            state: {
              matchId: currentMatch.matchId,
              self: { id: currentMatch.selfId, username: currentMatch.selfName, epicName: currentMatch.selfEpicName || currentMatch.selfName },
              opponent: { id: currentMatch.opponentId, username: currentMatch.opponent, epicName: currentMatch.opponentEpicName || currentMatch.opponent },
              mapCode: currentMatch.mapCode || '',
            }
          })}
          className="btn btn-primary btn-lg"
          style={{ width: '100%' }}
        >
          <i className="fas fa-arrow-right"></i> Open Match Room
        </button>
      </div>
    </div>
  );
};

export default CurrentGame;
