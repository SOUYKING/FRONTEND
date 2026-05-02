import React, { useState, useEffect } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { getTournamentById, getCurrentMatch, joinMatchmaking, leaveMatchmaking, getMyTeams } from '../utils/api';
import './QueuePage.css';

const QueuePage = ({ socket }) => {
  const { tournamentId } = useParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState('idle');
  const [message, setMessage] = useState('');
  const [tournament, setTournament] = useState(null);
  const [queueSize, setQueueSize] = useState(0);
  const [epicName, setEpicName] = useState('');
  const [myTeams, setMyTeams] = useState([]);
  const [selectedTeamId, setSelectedTeamId] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);

  const getStoredUser = () => {
    try {
      return JSON.parse(localStorage.getItem('user') || '{}');
    } catch {
      return {};
    }
  };

  const requiredTeamSize = tournament?.type === '2v2' ? 2 : tournament?.type === '3v3' ? 3 : tournament?.type === '4v4' ? 4 : 1;
  const isTeamTournament = requiredTeamSize > 1;
  const isBracketTournament = tournament?.type === '1v1_bracket';

  const attemptApiQueueJoin = async (user, customEpicName) => {
    const res = await joinMatchmaking(tournamentId, customEpicName || user.epicGamesName, isTeamTournament ? selectedTeamId : null);
    socket.emit('register');
    setStatus('waiting');
    setQueueSize(res.queueSize || 0);
    setMessage(res.message || 'Waiting for opponent...');
  };

  useEffect(() => {
    const fetchTournament = async () => {
      try {
        setMessage('');
        const data = await getTournamentById(tournamentId);
        setTournament(data);
        const teamSize = data?.type === '2v2' ? 2 : data?.type === '3v3' ? 3 : data?.type === '4v4' ? 4 : 0;
        if (teamSize > 1) {
          const teams = await getMyTeams(teamSize);
          setMyTeams(teams || []);
          if (teams?.length === 1) setSelectedTeamId(teams[0]._id);
        } else {
          setMyTeams([]);
          setSelectedTeamId('');
        }
      } catch (err) {
        console.error('Error fetching tournament:', err);
        setMessage('Failed to load tournament');
      }
    };
    fetchTournament();

    const user = getStoredUser();
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

    socket.emit('register');

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
      const isBracketWaitMsg = lowerMsg.includes('wait for your next-round opponent') || lowerMsg.includes('qualified');
      if (isBracketWaitMsg) {
        setMessage(msg);
        setStatus('idle');
        return;
      }
      // Handle mixed backend deployments by retrying via API for legacy socket errors.
      const shouldRetryViaApi =
        lowerMsg.includes('must register for this tournament') ||
        lowerMsg.includes('tournament is not active') ||
        lowerMsg.includes('tournament is no longer active');

      if (shouldRetryViaApi) {
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
  }, [tournamentId, navigate, socket, refreshKey]);

  const handleJoinQueue = async () => {
    const user = getStoredUser();
    const finalEpicName = (epicName || user.epicGamesName || '').trim();
    if (!finalEpicName) {
      setStatus('error');
      setMessage('Please add your Epic name in Account page first.');
      return;
    }
    // Do not hard-block on client-side queueOpen; backend is the source of truth.
    if (isTeamTournament && !selectedTeamId) {
      setStatus('error');
      setMessage(`Select your ${requiredTeamSize}v${requiredTeamSize} team first.`);
      return;
    }
    setStatus('joining');
    setMessage('Joining queue...');
    // Socket-first join avoids stale API validators on some deployments.
    socket.emit('joinQueue', {
      tournamentId,
      epicName: finalEpicName,
      teamId: isTeamTournament ? selectedTeamId : undefined,
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
        <p className="queue-subtitle">{isBracketTournament ? 'Bracket match queue' : 'Queue lobby'}</p>

        <div className="queue-helper-chips">
          <span><i className="fas fa-circle-info" /> Join queue when ready to play.</span>
          {isBracketTournament && (
            <span><i className="fas fa-trophy" /> Single elimination: lose once and you're out.</span>
          )}
          <span><i className="fas fa-bolt" /> Keep this tab open for instant match alerts.</span>
          {isTeamTournament && (
            <span>
              <i className="fas fa-users" /> Captain queues the team; teammates open{' '}
              <Link to="/current-game" className="queue-inline-link">Current Game</Link> for the match link.
            </span>
          )}
        </div>

        <div className="queue-status-message">{message || 'Ready to join the queue?'}</div>

        {isTeamTournament && (
          <div className="queue-info-box" style={{ marginTop: -8 }}>
            <div className="queue-info-row">
              <span className="queue-info-label">Tournament Type</span>
              <span className="queue-info-value">{tournament?.type}</span>
            </div>
            <div className="queue-info-row">
              <span className="queue-info-label">Select Team</span>
              <select
                value={selectedTeamId}
                onChange={(e) => setSelectedTeamId(e.target.value)}
                className="chat-input"
                style={{ maxWidth: 250 }}
              >
                <option value="">Choose your team</option>
                {myTeams.map((team) => (
                  <option key={team._id} value={team._id}>
                    {team.name} ({team.members?.length || 0}/{team.size})
                  </option>
                ))}
              </select>
            </div>
            {myTeams.length === 0 && (
              <div style={{ color: 'var(--orange)', fontSize: '0.8rem', marginTop: 8 }}>
                No eligible team found. Create or accept a team on the Teams page first.
              </div>
            )}
          </div>
        )}

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
              <i className="fas fa-sign-in-alt"></i> {isBracketTournament ? 'Join Bracket Queue' : 'Join Queue'}
            </button>
          )}
          {isActive && (
            <button onClick={handleLeaveQueue} className="queue-btn leave">
              <i className="fas fa-sign-out-alt"></i> Leave Queue
            </button>
          )}
          <button onClick={() => setRefreshKey((k) => k + 1)} className="queue-btn neutral">
            <i className="fas fa-rotate-right"></i> Refresh
          </button>
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
