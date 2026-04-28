import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getTournaments, joinTournament } from '../utils/api';

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

  const handleJoinQueue = (tournamentId) => navigate(`/queue/${tournamentId}`);
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
    if (s === 'active') return { label: 'LIVE', cls: 'bg-[rgba(46,242,255,0.12)] text-[var(--cyan)] border border-[rgba(46,242,255,0.2)] animate-glow-pulse' };
    if (s === 'registration') return { label: 'OPEN', cls: 'bg-[rgba(34,197,94,0.1)] text-[var(--green)] border border-[rgba(34,197,94,0.15)]' };
    if (s === 'completed') return { label: 'ENDED', cls: 'bg-[rgba(255,255,255,0.03)] text-[var(--text-muted)] border border-[var(--border)]' };
    if (s === 'cancelled') return { label: 'CANCELLED', cls: 'bg-[rgba(255,255,255,0.03)] text-[var(--text-muted)] border border-[var(--border)]' };
    if (s === 'registration_closed') return { label: 'CLOSED', cls: 'bg-[rgba(255,255,255,0.03)] text-[var(--text-muted)] border border-[var(--border)]' };
    return { label: s?.toUpperCase() || 'UNKNOWN', cls: 'bg-[rgba(255,255,255,0.03)] text-[var(--text-muted)] border border-[var(--border)]' };
  };

  if (loading) {
    return (
      <div className="page-wrapper animate-fade-in-up">
        <div className="page-header"><h1>Tournaments</h1><p className="subtitle">Compete in live events</p></div>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {[1, 2, 3].map(i => (
            <div key={i} className="card overflow-hidden flex flex-col">
              <div className="skeleton" style={{ height: 180 }} />
              <div className="p-5"><div className="skeleton" style={{ width: '60%', height: 22, marginBottom: 12 }} /><div className="skeleton" style={{ width: '100%', height: 14, marginBottom: 8 }} /><div className="skeleton" style={{ width: '80%', height: 14 }} /></div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="page-wrapper animate-fade-in-up">
      <div className="page-header">
        <div>
          <h1>Tournaments</h1>
          <p className="subtitle">Compete in live Fortnite 1v1 events</p>
        </div>
        <div className="px-4 py-2 bg-[var(--bg-glass)] border border-[var(--border-glow)] rounded-full text-xs font-semibold text-[var(--cyan)] font-mono">{tournaments.length} event{tournaments.length !== 1 ? 's' : ''}</div>
      </div>

      {error && errorType === 'epic' && (
        <div className="flex items-center justify-between p-3.5 rounded-[var(--radius-md)] mb-5 text-sm gap-3 flex-wrap animate-fade-in bg-[rgba(249,115,22,0.08)] border border-[rgba(249,115,22,0.2)] text-[var(--orange)]">
          <span><i className="fas fa-exclamation-triangle"></i> {error}</span>
          <div className="flex gap-2">
            <button onClick={() => navigate('/account')} className="btn btn-purple btn-sm"><i className="fas fa-gamepad"></i> Verify Epic</button>
            <button onClick={() => { setError(''); setErrorType(''); }} className="btn btn-ghost btn-sm">Dismiss</button>
          </div>
        </div>
      )}
      {error && errorType !== 'epic' && (
        <div className="flex items-center justify-between p-3.5 rounded-[var(--radius-md)] mb-5 text-sm gap-3 flex-wrap animate-fade-in bg-[rgba(239,68,68,0.08)] border border-[rgba(239,68,68,0.2)] text-[var(--red)]">
          <span><i className="fas fa-exclamation-circle"></i> {error}</span>
          <button onClick={() => setError('')} className="btn btn-ghost btn-sm">&times;</button>
        </div>
      )}
      {success && <div className="flex items-center justify-between p-3.5 rounded-[var(--radius-md)] mb-5 text-sm gap-3 flex-wrap animate-fade-in bg-[rgba(34,197,94,0.08)] border border-[rgba(34,197,94,0.2)] text-[var(--green)]"><i className="fas fa-check-circle"></i> {success}</div>}

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
        {tournaments.length === 0 ? (
          <div className="empty-state col-span-full">
            <span>🏆</span>
            <p>No tournaments available. Check back later!</p>
          </div>
        ) : (
          tournaments.map((tournament, idx) => {
            const now = new Date();
            const startDate = new Date(tournament.startDate);
            const endDate = new Date(tournament.endDate);
            const isEnded = now > endDate;
            const user = JSON.parse(localStorage.getItem('user') || '{}');
            const userId = user.id || user.discordId;
            const isRegistered = tournament.participants?.some((p) => p.userId === userId);
            const registrationOpen = tournament.registrationOpen;
            const queueOpen = tournament.queueOpen;
            const stageMeta = getStageMeta(tournament);
            const countdown = formatDate(tournament.startDate);
            const participants = tournament.participants || [];
            const progress = tournament.maxPlayers ? (participants.length / tournament.maxPlayers) * 100 : 0;

            return (
              <div key={tournament._id} className="card overflow-hidden flex flex-col animate-fade-in-up" style={{ animationDelay: `${idx * 0.06}s`, animationFillMode: 'both' }}>
                <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-[var(--cyan)] via-[var(--purple)] to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-base" />
                <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border)] min-h-[52px]">
                  <span className={`px-3.5 py-1 rounded-full text-xs font-extrabold tracking-wider ${stageMeta.cls}`}>{stageMeta.label}</span>
                  {tournament.prize && <span className="flex items-center gap-1.5 text-sm font-bold text-[var(--gold)]"><i className="fas fa-trophy"></i> {tournament.prize}</span>}
                </div>

                <div className="p-5 flex-1">
                  <h3 className="font-display text-lg font-bold mb-2 leading-tight">{tournament.title}</h3>
                  <p className="text-[var(--text-muted)] text-sm leading-relaxed mb-4 line-clamp-2">{tournament.description}</p>

                  <div className="grid grid-cols-2 gap-2 mb-3.5">
                    <div className="flex items-center gap-2 text-xs text-[var(--text-muted)]">
                      <i className="fas fa-map-pin w-[14px] text-[var(--text-dim)] text-[0.75rem]"></i>
                      <span>{tournament.mapCode || 'N/A'}</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-[var(--text-muted)]">
                      <i className="fas fa-users w-[14px] text-[var(--text-dim)] text-[0.75rem]"></i>
                      <span>{participants.length}/{tournament.maxPlayers || '∞'}</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-[var(--text-muted)]">
                      <i className="fas fa-tag w-[14px] text-[var(--text-dim)] text-[0.75rem]"></i>
                      <span>{tournament.type || '1v1'}</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-[var(--text-muted)]">
                      <i className="fas fa-calendar w-[14px] text-[var(--text-dim)] text-[0.75rem]"></i>
                      <span>{startDate.toLocaleDateString()}</span>
                    </div>
                  </div>

                  {tournament.maxPlayers && (
                    <div className="relative h-1.5 bg-[rgba(255,255,255,0.05)] rounded-sm overflow-visible mb-3.5">
                      <div className="h-full bg-gradient-to-r from-[var(--cyan)] to-[var(--electric-blue)] rounded-sm shadow-[0_0_8px_rgba(46,242,255,0.3)] transition-all duration-extra ease-bounce" style={{ width: `${Math.min(progress, 100)}%` }} />
                      <span className="absolute right-0 -top-[18px] text-[0.65rem] text-[var(--text-muted)] font-mono">{Math.round(progress)}% full</span>
                    </div>
                  )}

                  {countdown && !isEnded && (
                    <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-[rgba(249,115,22,0.06)] border border-[rgba(249,115,22,0.12)] rounded-full text-xs text-[var(--orange)] font-mono font-semibold">
                      <i className="fas fa-clock text-[0.7rem]"></i>
                      {countdown.days ? `${countdown.days}d ${countdown.hours}h` : countdown.hours ? `${countdown.hours}h ${countdown.mins}m` : `${countdown.mins}m`}
                    </div>
                  )}
                </div>

                <div className="flex gap-2 px-5 py-4 border-t border-[var(--border)] mt-auto">
                  {!isRegistered && registrationOpen && (tournament.lifecycleStage || tournament.status) === 'registration' && (
                    <button onClick={() => handleJoinTournament(tournament._id)} className="btn btn-primary flex-1">
                      <i className="fas fa-pen"></i> Register
                    </button>
                  )}
                  {isRegistered && queueOpen && !isEnded && (
                    <button onClick={() => handleJoinQueue(tournament._id)} className="btn btn-success flex-1">
                      <i className="fas fa-right-to-bracket"></i> Join Queue
                    </button>
                  )}
                  {!isRegistered && (!registrationOpen || (tournament.lifecycleStage || tournament.status) !== 'registration') && (
                    <button className="btn btn-ghost flex-1" disabled>
                      <i className="fas fa-lock"></i> {stageMeta.label === 'ENDED' ? 'Ended' : 'Closed'}
                    </button>
                  )}
                  {isRegistered && !queueOpen && !isEnded && (
                    <button className="btn btn-ghost flex-1" disabled>
                      <i className="fas fa-hourglass"></i> Waiting
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
