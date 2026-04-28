import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getCurrentMatch, getMyRegisteredTournaments, leaveTournament, DISCORD_AVATAR_FALLBACK, buildDiscordAvatar } from '../utils/api';
import { getRank, getRankLabel } from '../utils/ranks';

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
      <div className="page-wrapper min-h-[calc(100vh-80px)] flex items-center justify-center animate-fade-in-up">
        <div className="bg-[var(--bg-card)] border border-[var(--border-glow)] rounded-[var(--radius-2xl)] p-10 max-w-[600px] w-full text-center shadow-[var(--shadow-xl),0_0_40px_rgba(46,242,255,0.05)] animate-fade-in-scale">
          <div className="skeleton" style={{ width: 100, height: 100, borderRadius: '50%', margin: '0 auto 20px' }} />
          <div className="skeleton" style={{ width: 200, height: 24, margin: '0 auto 12px' }} />
          <div className="skeleton" style={{ width: 160, height: 16, margin: '0 auto' }} />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="page-wrapper min-h-[calc(100vh-80px)] flex items-center justify-center animate-fade-in-up">
        <div className="bg-[var(--bg-card)] border border-[var(--border-glow)] rounded-[var(--radius-2xl)] p-10 max-w-[600px] w-full text-center shadow-[var(--shadow-xl),0_0_40px_rgba(46,242,255,0.05)]">
          <p className="text-[var(--red)] mb-4">{error}</p>
          <button onClick={() => navigate('/tournaments')} className="btn btn-ghost">Back to Tournaments</button>
        </div>
      </div>
    );
  }

  if (!currentMatch || !currentMatch.inMatch) {
    return (
      <div className="page-wrapper min-h-[calc(100vh-80px)] flex items-center justify-center animate-fade-in-up">
        {registeredTournament ? (
          <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-[var(--radius-2xl)] p-12 max-w-[500px] w-full text-center shadow-[var(--shadow-lg)] animate-fade-in-scale">
            <div className="text-4xl mb-4 opacity-50">🎮</div>
            <h2 className="font-display text-xl font-bold mb-8">Registered Tournament</h2>
            <div className="text-left mb-5 p-4 bg-[rgba(0,0,0,0.2)] rounded-[var(--radius-md)]">
              <div className="flex items-center gap-2.5 py-1.5 text-sm text-[var(--text-muted)]"><i className="fas fa-trophy text-[var(--cyan)]"></i> {registeredTournament.title}</div>
              <div className="flex items-center gap-2.5 py-1.5 text-sm text-[var(--text-muted)]"><i className="fas fa-calendar text-[var(--purple)]"></i> Starts: {new Date(registeredTournament.startDate).toLocaleString()}</div>
              <div className="flex items-center gap-2.5 py-1.5 text-sm text-[var(--text-muted)]"><i className="fas fa-clock text-[var(--orange)]"></i> {registeredTournament.queueOpen ? 'Queue is open' : 'Waiting for start'}</div>
            </div>
            <div className="flex gap-2.5">
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
            {message && <p className="text-[var(--text-muted)] text-sm mt-3">{message}</p>}
          </div>
        ) : (
          <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-[var(--radius-2xl)] p-12 max-w-[500px] w-full text-center shadow-[var(--shadow-lg)] animate-fade-in-scale">
            <div className="text-4xl mb-4 opacity-50">⚔</div>
            <h2 className="font-display text-xl font-bold mb-8">No Active Game</h2>
            <p className="text-[var(--text-muted)] text-sm mb-5">You are not currently in a match or registered tournament.</p>
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
    <div className="page-wrapper min-h-[calc(100vh-80px)] flex items-center justify-center animate-fade-in-up">
      <div className="bg-[var(--bg-card)] border border-[var(--border-glow)] rounded-[var(--radius-2xl)] p-10 max-w-[600px] w-full text-center shadow-[var(--shadow-xl),0_0_40px_rgba(46,242,255,0.05)] animate-fade-in-scale">
        <h2 className="font-display text-xl font-bold mb-1">Active Match</h2>
        <p className="text-[var(--text-muted)] text-sm mb-6">Your battle is live. Jump back in.</p>

        <div className="flex items-center justify-center gap-6 mb-6">
          <div className="flex-1 p-5 bg-[rgba(0,0,0,0.2)] border border-[var(--border)] rounded-[var(--radius-lg)] text-center transition-all duration-base hover:border-[var(--border-glow)]">
            <div className="w-16 h-16 rounded-full overflow-hidden mx-auto mb-2.5 border-2 border-[var(--border-glow)] shadow-[0_0_15px_var(--cyan-glow)]">
              <img src={buildDiscordAvatar(currentMatch.selfId, currentMatch.selfAvatar) || DISCORD_AVATAR_FALLBACK} alt="" className="w-full h-full object-cover" />
            </div>
            <div className="font-display text-base font-semibold mb-1">{currentMatch.selfName || 'You'}</div>
            <div className="text-[0.7rem] uppercase tracking-wider font-bold text-[var(--text-muted)]">YOU</div>
          </div>

          <div className="flex flex-col items-center gap-2 flex-shrink-0">
            <div className="w-px h-[30px] bg-gradient-to-b from-transparent via-[var(--border-glow)] to-transparent" />
            <div className="font-display text-xl font-black text-[var(--cyan)] animate-countGlow" style={{ textShadow: '0 0 20px var(--cyan-glow)' }}>VS</div>
            <div className="w-px h-[30px] bg-gradient-to-b from-transparent via-[var(--border-glow)] to-transparent" />
          </div>

          <div className="flex-1 p-5 bg-[rgba(0,0,0,0.2)] border border-[var(--border)] rounded-[var(--radius-lg)] text-center transition-all duration-base hover:border-[var(--border-glow)]">
            <div className="w-16 h-16 rounded-full overflow-hidden mx-auto mb-2.5 border-2 border-[var(--border-purple)] shadow-[0_0_15px_var(--purple-glow)]">
              <img src={buildDiscordAvatar(currentMatch.opponentId, currentMatch.opponentAvatar) || DISCORD_AVATAR_FALLBACK} alt="" className="w-full h-full object-cover" />
            </div>
            <div className="font-display text-base font-semibold mb-1">{currentMatch.opponent}</div>
            <div className="text-[0.7rem] uppercase tracking-wider font-bold text-[var(--text-muted)]">OPPONENT</div>
          </div>
        </div>

        <div className="flex justify-center gap-4 flex-wrap mb-6">
          {currentMatch.mapCode && (
            <span className="flex items-center gap-1.5 px-3.5 py-1.5 bg-[rgba(0,0,0,0.2)] border border-[var(--border)] rounded-full text-xs text-[var(--text-muted)]"><i className="fas fa-map-pin text-[var(--cyan)] text-[0.75rem]"></i> {currentMatch.mapCode}</span>
          )}
          <span className="flex items-center gap-1.5 px-3.5 py-1.5 bg-[rgba(0,0,0,0.2)] border border-[var(--border)] rounded-full text-xs text-[var(--text-muted)]"><i className="fas fa-circle text-[var(--green)] text-[0.75rem]"></i> Live</span>
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
          className="btn btn-primary btn-lg w-full"
        >
          <i className="fas fa-arrow-right"></i> Open Match Room
        </button>
      </div>
    </div>
  );
};

export default CurrentGame;
