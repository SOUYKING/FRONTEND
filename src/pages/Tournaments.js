import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getTournaments, joinTournament } from '../utils/api';
import './Tournaments.css';

const Tournaments = () => {
  const [tournaments, setTournaments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [errorType, setErrorType] = useState('');
  const [success, setSuccess] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    fetchTournaments();
    const intervalId = setInterval(fetchTournaments, 15000);
    return () => clearInterval(intervalId);
  }, []);

  const fetchTournaments = async () => {
    try {
      const data = await getTournaments();
      setTournaments(data);
    } catch (err) {
      console.error('Error fetching tournaments:', err);
      setError('Failed to load tournaments');
    } finally {
      setLoading(false);
    }
  };

  const handleJoinTournament = async (tournamentId) => {
    try {
      const response = await joinTournament(tournamentId);
      setSuccess(response.message || 'Registered!');
      setTimeout(() => setSuccess(''), 3000);
      setError('');
      setErrorType('');
      fetchTournaments();
    } catch (err) {
      const msg = err.response?.data?.message || 'Failed to join';
      setError(msg);
      setErrorType(err.response?.status === 403 && msg.toLowerCase().includes('epic') ? 'epic' : '');
    }
  };

  const handleJoinQueue = async (tournamentId) => {
    try {
      await joinTournament(tournamentId);
      navigate(`/queue/${tournamentId}`);
    } catch (err) {
      const msg = err.response?.data?.message || 'Failed to join queue';
      const lowerMsg = msg.toLowerCase();
      if (lowerMsg.includes('registration deadline has passed')) {
        // Compatibility: older backend may reject /join, but queue join is still valid during live window.
        navigate(`/queue/${tournamentId}`);
        return;
      }
      setError(msg);
      setErrorType(err.response?.status === 403 && lowerMsg.includes('epic') ? 'epic' : '');
    }
  };
  const handleViewLeaderboard = (tournamentId) => navigate(`/tournament/${tournamentId}/leaderboard`);

  const formatDate = (dateStr) => {
    const d = new Date(dateStr);
    const now = new Date();
    const diff = d.getTime() - now.getTime();
    if (diff <= 0) return null;
    const days = Math.floor(diff / 86400000);
    const hours = Math.floor((diff % 86400000) / 3600000);
    const mins = Math.floor((diff % 3600000) / 60000);
    if (days > 0) return { days, hours };
    if (hours > 0) return { hours, mins };
    return { mins };
  };

  const getStageMeta = (t) => {
    const s = t.lifecycleStage || t.status;
    if (s === 'active') return { label: 'LIVE', cls: 'stage-live' };
    if (s === 'waiting') return { label: 'UPCOMING', cls: 'stage-open' };
    if (s === 'completed') return { label: 'ENDED', cls: 'stage-ended' };
    if (s === 'cancelled') return { label: 'CANCELLED', cls: 'stage-cancelled' };
    return { label: s?.toUpperCase() || 'UNKNOWN', cls: '' };
  };

  if (loading) {
    return (
      <div className="tournaments-page page-wrapper">
        <div className="page-header"><h1>Tournaments</h1><p className="subtitle">Compete in live events</p></div>
        <div className="tournament-grid">
          {[1, 2, 3].map(i => (
            <div key={i} className="tournament-card">
              <div className="skeleton" style={{ height: 180 }} />
              <div style={{ padding: 20 }}><div className="skeleton" style={{ width: '60%', height: 22, marginBottom: 12 }} /><div className="skeleton" style={{ width: '100%', height: 14, marginBottom: 8 }} /><div className="skeleton" style={{ width: '80%', height: 14 }} /></div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="tournaments-page page-wrapper">
      <div className="page-header">
        <div>
          <h1>Tournaments</h1>
          <p className="subtitle">Compete in live Fortnite 1v1 events</p>
        </div>
        <div className="tournament-count-badge">{tournaments.length} event{tournaments.length !== 1 ? 's' : ''}</div>
      </div>

      {error && errorType === 'epic' && (
        <div className="tournament-alert warning">
          <span><i className="fas fa-exclamation-triangle"></i> {error}</span>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => navigate('/account')} className="btn btn-purple btn-sm"><i className="fas fa-gamepad"></i> Verify Epic</button>
            <button onClick={() => { setError(''); setErrorType(''); }} className="btn btn-ghost btn-sm">Dismiss</button>
          </div>
        </div>
      )}
      {error && errorType !== 'epic' && (
        <div className="tournament-alert error">
          <span><i className="fas fa-exclamation-circle"></i> {error}</span>
          <button onClick={() => setError('')} className="btn btn-ghost btn-sm">&times;</button>
        </div>
      )}
      {success && <div className="tournament-alert success"><i className="fas fa-check-circle"></i> {success}</div>}

      <div className="tournament-grid">
        {tournaments.length === 0 ? (
          <div className="empty-state" style={{ gridColumn: '1 / -1' }}>
            <span>🏆</span>
            <p>No tournaments available. Check back later!</p>
          </div>
        ) : (
          tournaments.map((tournament, idx) => {
            const now = new Date();
            const startDate = new Date(tournament.startDate);
            const endDate = new Date(tournament.endDate);
            const isEnded = now > endDate;
            const queueOpen = tournament.queueOpen;
            const stageMeta = getStageMeta(tournament);
            const countdown = formatDate(tournament.startDate);
            const participants = tournament.participants || [];
            const progress = tournament.maxPlayers ? (participants.length / tournament.maxPlayers) * 100 : 0;

            return (
              <div key={tournament._id} className="tournament-card" style={{ animationDelay: `${idx * 0.06}s` }}>
                <div className="tournament-card-glow" />
                <div className="tournament-card-header">
                  <span className={`tournament-stage-badge ${stageMeta.cls}`}>{stageMeta.label}</span>
                  {tournament.prize && <span className="tournament-prize-badge"><i className="fas fa-trophy"></i> {tournament.prize}</span>}
                </div>

                <div className="tournament-card-body">
                  <h3 className="tournament-card-title">{tournament.title}</h3>
                  <p className="tournament-card-desc">{tournament.description}</p>

                  <div className="tournament-card-stats">
                    <div className="tournament-stat">
                      <i className="fas fa-map-pin"></i>
                      <span>{tournament.mapCode || 'N/A'}</span>
                    </div>
                    <div className="tournament-stat">
                      <i className="fas fa-users"></i>
                      <span>{participants.length}/{tournament.maxPlayers || '∞'}</span>
                    </div>
                    <div className="tournament-stat">
                      <i className="fas fa-tag"></i>
                      <span>{tournament.type || '1v1'}</span>
                    </div>
                    <div className="tournament-stat">
                      <i className="fas fa-calendar"></i>
                      <span>{startDate.toLocaleDateString()}</span>
                    </div>
                  </div>

                  {tournament.maxPlayers && (
                    <div className="tournament-progress-bar">
                      <div className="tournament-progress-fill" style={{ width: `${Math.min(progress, 100)}%` }} />
                      <span className="tournament-progress-text">{Math.round(progress)}% full</span>
                    </div>
                  )}



                  {countdown && !isEnded && (
                    <div className="tournament-countdown">
                      <i className="fas fa-clock"></i>
                      {countdown.days ? `${countdown.days}d ${countdown.hours}h` : countdown.hours ? `${countdown.hours}h ${countdown.mins}m` : `${countdown.mins}m`}
                    </div>
                  )}
                </div>

                <div className="tournament-card-actions">
                  {queueOpen && !isEnded && (
                    <button onClick={() => handleJoinQueue(tournament._id)} className="btn btn-success" style={{ flex: 1 }}>
                      <i className="fas fa-right-to-bracket"></i> Join Queue
                    </button>
                  )}
                  {!queueOpen && !isEnded && (
                    <button className="btn btn-ghost" disabled style={{ flex: 1 }}>
                      <i className="fas fa-hourglass-half"></i> {countdown ? 'Starts Soon' : 'Not Started'}
                    </button>
                  )}
                  {isEnded && (
                    <button className="btn btn-ghost" disabled style={{ flex: 1 }}>
                      <i className="fas fa-ban"></i> Ended
                    </button>
                  )}
                  <button onClick={() => handleViewLeaderboard(tournament._id)} className="btn btn-ghost">
                    <i className="fas fa-list"></i>
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default Tournaments;
