import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { getTournamentById, getCurrentMatch } from '../utils/api';
import './QueuePage.css';

const QueuePage = ({ socket }) => {
  const { tournamentId } = useParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState('idle');
  const [message, setMessage] = useState('');
  const [tournament, setTournament] = useState(null);
  const [queueSize, setQueueSize] = useState(0);
  const [epicName, setEpicName] = useState('');

  useEffect(() => {
    const fetchTournament = async () => {
      try {
        const data = await getTournamentById(tournamentId);
        setTournament(data);
      } catch (err) {
        console.error('Error fetching tournament:', err);
        setMessage('Failed to load tournament');
      }
    };
    fetchTournament();

    const user = JSON.parse(localStorage.getItem('user') || '{}');
    setEpicName(user.epicGamesName || '');

    const fallbackTimer = setTimeout(async () => {
      try {
        const active = await getCurrentMatch();
        if (active && active.inMatch && active.matchId) {
          localStorage.setItem('currentMatchId', active.matchId);
          setStatus('matched');
          setMessage('Match found! Redirecting...');
          setTimeout(() => navigate(`/match/${active.matchId}`, {
            state: {
              matchId: active.matchId,
              self: { id: active.selfId, username: active.selfName, epicName: active.selfEpicName, avatar: active.selfAvatar },
              opponent: { id: active.opponentId, username: active.opponent, epicName: active.opponentEpicName, avatar: active.opponentAvatar },
              mapCode: active.mapCode || ''
            }
          }), 1000);
        }
      } catch (e) {}
    }, 3000);

    socket.emit('register', { userId: user.discordId || user.id });

    const onWaiting = (data) => {
      setStatus('waiting');
      setMessage(data.message);
      setQueueSize(data.queueSize || 0);
    };

    const onMatchFound = (data) => {
      setStatus('matched');
      setMessage('Match found! Redirecting...');
      localStorage.setItem('currentMatchId', data.matchId);
      setTimeout(() => {
        navigate(`/match/${data.matchId}`, {
          state: {
            matchId: data.matchId,
            self: { id: data.selfId, username: user.discordName, epicName: user.epicGamesName, avatar: data.selfAvatar, rankingPoints: user.rankingPoints },
            opponent: { id: data.opponentId, username: data.opponent, epicName: data.opponentEpicName || data.opponent, avatar: data.opponentAvatar },
            mapCode: data.mapCode || ''
          }
        });
      }, 2000);
    };

    const onSocketError = (data) => {
      setMessage(data.message);
      setStatus('error');
    };

    const onLeftQueue = () => {
      setStatus('idle');
      setMessage('Left queue');
    };

    socket.on('waiting', onWaiting);
    socket.on('matchFound', onMatchFound);
    socket.on('error', onSocketError);
    socket.on('leftQueue', onLeftQueue);

    return () => {
      socket.off('waiting', onWaiting);
      socket.off('matchFound', onMatchFound);
      socket.off('error', onSocketError);
      socket.off('leftQueue', onLeftQueue);
      clearTimeout(fallbackTimer);
    };
  }, [tournamentId, navigate, socket]);

  const handleJoinQueue = () => {
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    if (!user.epicVerified) {
      setMessage('You must verify your Epic Games account first!');
      return;
    }
    if (tournament && !tournament.queueOpen) {
      setMessage('Queue opens when the tournament starts.');
      return;
    }
    setStatus('joining');
    setMessage('Joining queue...');
    socket.emit('joinQueue', {
      tournamentId: tournamentId,
      epicName: epicName || user.epicGamesName
    });
  };

  const handleLeaveQueue = () => {
    socket.emit('leaveQueue');
    setStatus('idle');
    setMessage('Left queue');
  };

  const isActive = status === 'waiting' || status === 'joining';

  return (
    <div className="page-wrapper flex items-center justify-center min-h-[calc(100vh-80px)] animate-fade-in-up">
      <div className="bg-[var(--bg-card)] border border-[var(--border-glow)] rounded-[var(--radius-2xl)] p-10 max-w-[520px] w-full text-center shadow-[var(--shadow-xl),0_0_40px_rgba(46,242,255,0.05)] animate-fade-in-scale">
        <div className={`w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-5 text-2xl relative ${status === 'matched' ? 'bg-[rgba(34,197,94,0.08)] border-2 border-[rgba(34,197,94,0.2)] text-[var(--green)]' : isActive ? 'bg-[rgba(46,242,255,0.08)] border-2 border-[rgba(46,242,255,0.2)] animate-glow-pulse' : 'bg-[rgba(255,255,255,0.03)] border-2 border-[var(--border)] text-[var(--text-muted)]'}`}>
          {status === 'matched' ? (
            <i className="fas fa-check-circle"></i>
          ) : isActive ? (
            <i className="fas fa-search"></i>
          ) : (
            <i className="fas fa-hourglass-start"></i>
          )}
        </div>

        <h2 className="font-display text-xl font-bold mb-1">{tournament?.title || 'Matchmaking'}</h2>
        <p className="text-[var(--text-muted)] text-sm mb-6">Waiting room</p>

        <div className="text-[var(--text-secondary)] text-sm mb-6 min-h-[24px]">{message || 'Ready to join the queue?'}</div>

        {isActive && (
          <div className="bg-[rgba(0,0,0,0.2)] border border-[var(--border)] rounded-[var(--radius-lg)] p-5 mb-6">
            <div className="flex justify-between items-center py-2 border-b border-[var(--border)]">
              <span className="text-xs text-[var(--text-muted)]">Queue Position</span>
              <span className="text-sm font-semibold text-[var(--text-secondary)]">{queueSize > 0 ? `${queueSize} ahead` : 'Searching...'}</span>
            </div>
            <div className="flex justify-between items-center py-2">
              <span className="text-xs text-[var(--text-muted)]">Status</span>
              <span className="text-sm font-semibold text-[var(--cyan)] animate-pulse">Finding opponent</span>
            </div>
            <div className="flex gap-1 justify-center mt-4">
              {[0, 1, 2, 3, 4].map(i => (
                <div key={i} className="w-1.5 rounded-sm bg-[var(--cyan-glow)] animate-pulse" style={{
                  height: 24,
                  animationDelay: `${i * 0.15}s`,
                  animation: `searchingBar 1.5s ease-in-out ${i * 0.15}s infinite`
                }} />
              ))}
            </div>
          </div>
        )}

        <div className="flex flex-col gap-2.5">
          {(status === 'idle' || status === 'error') && (
            <button onClick={handleJoinQueue} className="w-full py-3.5 px-6 rounded-[var(--radius-lg)] font-display text-sm font-bold uppercase tracking-wider cursor-pointer transition-all duration-base bg-gradient-to-r from-[var(--cyan)] to-[var(--electric-blue)] text-black shadow-[0_0_30px_rgba(46,242,255,0.2)] hover:shadow-[0_0_50px_rgba(46,242,255,0.4)] hover:-translate-y-0.5">
              <i className="fas fa-sign-in-alt"></i> Join Queue
            </button>
          )}
          {isActive && (
            <button onClick={handleLeaveQueue} className="w-full py-3.5 px-6 rounded-[var(--radius-lg)] font-display text-sm font-bold uppercase tracking-wider cursor-pointer transition-all duration-base bg-[rgba(239,68,68,0.1)] border border-[rgba(239,68,68,0.25)] text-[var(--red)] hover:bg-[rgba(239,68,68,0.2)]">
              <i className="fas fa-sign-out-alt"></i> Leave Queue
            </button>
          )}
        </div>

        {tournament && (
          <div className="mt-5 pt-5 border-t border-[var(--border)] text-left">
            <div className="flex justify-between py-1.5 text-sm">
              <span className="text-[var(--text-muted)]">Map Code</span>
              <span className="text-[var(--text-secondary)] font-semibold text-[var(--cyan)] font-mono">{tournament.mapCode}</span>
            </div>
            {tournament.rules && (
              <div className="flex justify-between py-1.5 text-sm">
                <span className="text-[var(--text-muted)]">Rules</span>
                <span className="text-[var(--text-secondary)] font-semibold">{tournament.rules}</span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default QueuePage;

