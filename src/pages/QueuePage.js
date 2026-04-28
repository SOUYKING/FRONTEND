import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { getTournamentById, getCurrentMatch, joinMatchmaking, leaveMatchmaking } from '../utils/api';
import './QueuePage.css';

const QueuePage = ({ socket }) => {
  const { tournamentId } = useParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState('idle');
  const [message, setMessage] = useState('');
  const [tournament, setTournament] = useState(null);
  const [queueSize, setQueueSize] = useState(0);
  const [epicName, setEpicName] = useState('');

  const attemptApiQueueJoin = async (user, customEpicName) => {
    const res = await joinMatchmaking(tournamentId, customEpicName || user.epicGamesName);
    socket.emit('register', { userId: user.discordId || user.id });
    setStatus('waiting');
    setQueueSize(res.queueSize || 0);
    setMessage(res.message || 'Waiting for opponent...');
  };

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

    const onSocketError = async (data) => {
      const msg = data?.message || 'Queue error';
      const lowerMsg = msg.toLowerCase();
      // Force no-registration flow: if legacy socket says register first, fallback to API join.
      if (lowerMsg.includes('must register for this tournament')) {
        try {
          const freshUser = JSON.parse(localStorage.getItem('user') || '{}');
          await attemptApiQueueJoin(freshUser, epicName || freshUser.epicGamesName);
          return;
        } catch (err) {
          const fallbackMsg = err.response?.data?.message || msg;
          setMessage(fallbackMsg);
          setStatus('error');
          return;
        }
      }
      setMessage(msg);
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

  const handleJoinQueue = async () => {
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
    // Socket-first join avoids stale API validators on some deployments.
    socket.emit('joinQueue', {
      tournamentId,
      epicName: epicName || user.epicGamesName,
    });
  };

  const handleLeaveQueue = async () => {
    socket.emit('leaveQueue');
    try {
      await leaveMatchmaking();
    } catch {}
    setStatus('idle');
    setMessage('Left queue');
  };

  const isActive = status === 'waiting' || status === 'joining';

  return (
    <div className="queue-page page-wrapper">
      <div className="queue-card">
        <div className={`queue-icon-wrapper ${status === 'matched' ? 'matched' : isActive ? 'searching' : 'idle'}`}>
          {status === 'matched' ? (
            <i className="fas fa-check-circle"></i>
          ) : isActive ? (
            <i className="fas fa-search"></i>
          ) : (
            <i className="fas fa-hourglass-start"></i>
          )}
        </div>

        <h2 className="queue-title">{tournament?.title || 'Matchmaking'}</h2>
        <p className="queue-subtitle">Waiting room</p>

        <div className="queue-status-message">{message || 'Ready to join the queue?'}</div>

        {isActive && (
          <div className="queue-info-box">
            <div className="queue-info-row">
              <span className="queue-info-label">Queue Position</span>
              <span className="queue-info-value">{queueSize > 0 ? `${queueSize} ahead` : 'Searching...'}</span>
            </div>
            <div className="queue-info-row">
              <span className="queue-info-label">Status</span>
              <span className="queue-info-value finding">Finding opponent</span>
            </div>
            <div className="searching-bars">
              <div className="search-bar"></div>
              <div className="search-bar"></div>
              <div className="search-bar"></div>
              <div className="search-bar"></div>
              <div className="search-bar"></div>
            </div>
          </div>
        )}

        <div className="queue-actions">
          {(status === 'idle' || status === 'error') && (
            <button onClick={handleJoinQueue} className="queue-btn join">
              <i className="fas fa-sign-in-alt"></i> Join Queue
            </button>
          )}
          {isActive && (
            <button onClick={handleLeaveQueue} className="queue-btn leave">
              <i className="fas fa-sign-out-alt"></i> Leave Queue
            </button>
          )}
        </div>

        {tournament && (
          <div className="queue-tournament-info">
            <div className="info-row">
              <span className="label">Map Code</span>
              <span className="value map-code">{tournament.mapCode}</span>
            </div>
            {tournament.rules && (
              <div className="info-row">
                <span className="label">Rules</span>
                <span className="value">{tournament.rules}</span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default QueuePage;
