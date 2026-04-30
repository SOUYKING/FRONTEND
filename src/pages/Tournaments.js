import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { getTournaments, getMyRegisteredTournaments, joinTournament } from '../utils/api';
import './Tournaments.css';

const Tournaments = ({ socket }) => {
  const [tournaments, setTournaments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [stageFilter, setStageFilter] = useState('all');
  const [registeredIds, setRegisteredIds] = useState(() => new Set());
  const [actionError, setActionError] = useState('');
  const [chatMessages, setChatMessages] = useState([]);
  const [chatText, setChatText] = useState('');
  const [chatError, setChatError] = useState('');
  const [chatOnline, setChatOnline] = useState(0);
  const [sending, setSending] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [viewerRole, setViewerRole] = useState('player');
  const chatEndRef = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    fetchTournaments();
    const intervalId = setInterval(fetchTournaments, 15000);
    return () => clearInterval(intervalId);
  }, []);

  useEffect(() => {
    try {
      const u = JSON.parse(localStorage.getItem('user') || '{}');
      setViewerRole(u?.role || (u?.isAdmin ? 'admin' : 'player'));
    } catch {}
  }, []);

  useEffect(() => {
    if (!socket) return;
    socket.emit('joinLobbyChat');

    const onHistory = ({ chatLogs }) => {
      setChatMessages(Array.isArray(chatLogs) ? chatLogs : []);
    };
    const onReceive = (msg) => {
      setChatMessages((prev) => [...prev.slice(-149), msg]);
    };
    const onPresence = ({ online }) => {
      setChatOnline(Number(online) || 0);
    };
    const onDelete = ({ messageId }) => {
      if (!messageId) return;
      setChatMessages((prev) => prev.filter((m) => String(m.id) !== String(messageId)));
    };
    const onError = (err) => {
      const msg = err?.message || '';
      if (msg) setChatError(msg);
    };
    const onWarning = (payload) => {
      if (payload?.message) setChatError(payload.message);
    };

    socket.on('lobbyChatHistory', onHistory);
    socket.on('receiveLobbyMessage', onReceive);
    socket.on('lobbyPresence', onPresence);
    socket.on('lobbyMessageDeleted', onDelete);
    socket.on('chatError', onError);
    socket.on('chatWarning', onWarning);

    return () => {
      socket.off('lobbyChatHistory', onHistory);
      socket.off('receiveLobbyMessage', onReceive);
      socket.off('lobbyPresence', onPresence);
      socket.off('lobbyMessageDeleted', onDelete);
      socket.off('chatError', onError);
      socket.off('chatWarning', onWarning);
    };
  }, [socket]);

  useEffect(() => {
    if (chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [chatMessages]);

  const fetchTournaments = async () => {
    try {
      setActionError('');
      const [data, mine] = await Promise.all([
        getTournaments(),
        getMyRegisteredTournaments().catch(() => []),
      ]);
      setTournaments(data);
      setRegisteredIds(new Set((mine || []).map((t) => String(t._id))));
    } catch (err) {
      console.error('Error fetching tournaments:', err);
      setError('Failed to load tournaments');
    } finally {
      setLoading(false);
    }
  };

  const handleJoinQueue = async (tournament) => {
    if (!tournament?._id || !tournament.queueOpen) return;
    setActionError('');
    try {
      await joinTournament(tournament._id);
    } catch (err) {
      const msg = err.response?.data?.message || 'Could not join this tournament. Check Epic verification and try again.';
      setActionError(msg);
      return;
    }
    navigate(`/queue/${tournament._id}`);
  };

  const handleRegisterBracket = async (tournament) => {
    if (!tournament?._id) return;
    setActionError('');
    try {
      await joinTournament(tournament._id);
      setRegisteredIds((prev) => {
        const next = new Set(prev);
        next.add(String(tournament._id));
        return next;
      });
    } catch (err) {
      const msg = err.response?.data?.message || 'Could not register for this bracket.';
      setActionError(msg);
    }
  };
  const handleViewLeaderboard = (tournamentId) => navigate(`/tournament/${tournamentId}/leaderboard`);

  const formatRemaining = (dateStr) => {
    const d = new Date(dateStr);
    if (Number.isNaN(d.getTime())) return null;
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

  const sortedTournaments = [...tournaments].sort((a, b) => {
    const stageA = getStageMeta(a).label;
    const stageB = getStageMeta(b).label;
    const rank = { LIVE: 0, UPCOMING: 1, ENDED: 2, CANCELLED: 3 };
    const diff = (rank[stageA] ?? 9) - (rank[stageB] ?? 9);
    if (diff !== 0) return diff;
    return new Date(a.startDate) - new Date(b.startDate);
  });

  const filteredTournaments = sortedTournaments.filter((t) => {
    if (stageFilter === 'all') return true;
    if (stageFilter === 'live') return getStageMeta(t).label === 'LIVE';
    if (stageFilter === 'upcoming') return getStageMeta(t).label === 'UPCOMING';
    if (stageFilter === 'ended') return getStageMeta(t).label === 'ENDED' || getStageMeta(t).label === 'CANCELLED';
    return true;
  });

  const sendLobbyMessage = () => {
    const text = chatText.trim();
    if (!text || !socket || sending) return;
    setSending(true);
    setChatError('');
    let sender = 'Player';
    try {
      const u = JSON.parse(localStorage.getItem('user') || '{}');
      sender = u?.discordName || u?.username || sender;
    } catch {}
    socket.emit('sendLobbyMessage', { message: text, sender });
    setChatText('');
    setTimeout(() => setSending(false), 250);
  };

  const canModerate = viewerRole === 'admin' || viewerRole === 'owner';
  const deleteLobbyMessage = (messageId) => {
    if (!socket || !messageId || !canModerate) return;
    socket.emit('deleteLobbyMessage', { messageId });
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
          <p className="subtitle">1v1, 1v1 bracket, 2v2, 3v3, and 4v4 events — join multiple tournaments anytime they are live</p>
        </div>
        <div className="tournament-count-badge">{filteredTournaments.length} event{filteredTournaments.length !== 1 ? 's' : ''}</div>
      </div>

      <div className="tournament-top-tools">
        <div className="tournament-filter-tabs">
          <button className={stageFilter === 'all' ? 'active' : ''} onClick={() => setStageFilter('all')}>All</button>
          <button className={stageFilter === 'live' ? 'active' : ''} onClick={() => setStageFilter('live')}>Live</button>
          <button className={stageFilter === 'upcoming' ? 'active' : ''} onClick={() => setStageFilter('upcoming')}>Upcoming</button>
          <button className={stageFilter === 'ended' ? 'active' : ''} onClick={() => setStageFilter('ended')}>Ended</button>
        </div>
        <button onClick={fetchTournaments} className="btn btn-ghost btn-sm">
          <i className="fas fa-rotate-right"></i> Refresh
        </button>
      </div>

      <div className="tournament-help-row">
        <span><i className="fas fa-circle-info"></i> New player? Pick an Upcoming tournament and wait for queue open.</span>
        <span><i className="fas fa-gamepad"></i> Queue Open means you can join match queue instantly.</span>
        <span><i className="fas fa-users"></i> Squad modes: build your team under Profile → Teams before queuing.</span>
      </div>

      {actionError && (
        <div className="tournament-alert error" style={{ marginBottom: 12 }}>
          <span><i className="fas fa-exclamation-circle"></i> {actionError}</span>
          <button type="button" onClick={() => setActionError('')} className="btn btn-ghost btn-sm">Dismiss</button>
        </div>
      )}

      {error && (
        <div className="tournament-alert error">
          <span><i className="fas fa-exclamation-circle"></i> {error}</span>
          <button onClick={fetchTournaments} className="btn btn-ghost btn-sm">Retry</button>
        </div>
      )}

      <div className="tournaments-layout">
        <section className="tournaments-main-panel">
          <div className="tournament-grid">
            {filteredTournaments.length === 0 ? (
              <div className="empty-state" style={{ gridColumn: '1 / -1' }}>
                <span>🏆</span>
                <p>No tournaments found for this filter.</p>
              </div>
            ) : (
              filteredTournaments.map((tournament, idx) => {
                const now = new Date();
                const startDate = new Date(tournament.startDate);
                const endDate = new Date(tournament.endDate);
                const isEnded = now > endDate;
                const queueOpen = tournament.queueOpen;
                const stageMeta = getStageMeta(tournament);
                const startsIn = formatRemaining(tournament.startDate);
                const endsIn = formatRemaining(tournament.endDate);
                const participants = tournament.participants || [];
                const progress = tournament.maxPlayers ? (participants.length / tournament.maxPlayers) * 100 : 0;
                const isBracket = tournament.type === '1v1_bracket';
                const regDeadline = new Date(tournament.registrationDeadline || tournament.startDate);
                const regOpen = now < regDeadline;
                const isRegistered = registeredIds.has(String(tournament._id));
                const showDefaultWaitingBtn = !queueOpen && !isEnded && (!isBracket || (!regOpen && !isRegistered));

                return (
                  <div key={tournament._id} className="tournament-card" style={{ animationDelay: `${idx * 0.06}s` }}>
                    <div className="tournament-card-glow" />
                    {tournament.bannerImage ? (
                      <div className="tournament-banner-wrap">
                        <img
                          src={tournament.bannerImage}
                          alt={tournament.title}
                          className="tournament-banner"
                          loading="lazy"
                          onError={(e) => {
                            e.currentTarget.style.display = 'none';
                          }}
                        />
                      </div>
                    ) : null}
                    <div className="tournament-card-header">
                      <span className={`tournament-stage-badge ${stageMeta.cls}`}>{stageMeta.label}</span>
                      {isRegistered && (
                        <span className="tournament-stage-badge stage-registered"><i className="fas fa-check"></i> Registered</span>
                      )}
                      {tournament.prize && <span className="tournament-prize-badge"><i className="fas fa-trophy"></i> {tournament.prize}</span>}
                    </div>

                    <div className="tournament-card-body">
                      <h3 className="tournament-card-title">{tournament.title || 'Untitled tournament'}</h3>
                      <p className="tournament-card-desc">{tournament.description || 'No description yet.'}</p>

                      <div className="tournament-card-stats">
                        <div className="tournament-stat">
                          <i className="fas fa-map-pin"></i>
                          <span>{tournament.mapCode || tournament.mapName || 'Map TBA'}</span>
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

                      {tournament.type === '1v1_bracket' && !isEnded && (
                        <div className="tournament-countdown">
                          <i className="fas fa-user-clock"></i>
                          Registration closes: {new Date(tournament.registrationDeadline || tournament.startDate).toLocaleString()}
                        </div>
                      )}

                      {startsIn && !queueOpen && !isEnded && (
                        <div className="tournament-countdown">
                          <i className="fas fa-clock"></i>
                          Starts in {startsIn.days ? `${startsIn.days}d ${startsIn.hours}h` : startsIn.hours ? `${startsIn.hours}h ${startsIn.mins}m` : `${startsIn.mins}m`}
                        </div>
                      )}

                      {queueOpen && !isEnded && (
                        <div className="tournament-countdown">
                          <i className="fas fa-flag-checkered"></i>
                          Ends in {endsIn ? (endsIn.days ? `${endsIn.days}d ${endsIn.hours}h` : endsIn.hours ? `${endsIn.hours}h ${endsIn.mins}m` : `${endsIn.mins}m`) : 'soon'}
                        </div>
                      )}
                    </div>

                    <div className="tournament-card-actions">
                      {queueOpen && !isEnded && (
                        <button onClick={() => handleJoinQueue(tournament)} className="btn btn-success" style={{ flex: 1 }}>
                          <i className="fas fa-right-to-bracket"></i> {['2v2', '3v3', '4v4'].includes(tournament.type) ? 'Select Team & Queue' : isBracket ? 'Join Bracket Match' : 'Join Queue'}
                        </button>
                      )}
                      {isBracket && !queueOpen && !isEnded && regOpen && !isRegistered && (
                        <button onClick={() => handleRegisterBracket(tournament)} className="btn btn-primary" style={{ flex: 1 }}>
                          <i className="fas fa-user-plus"></i> Register
                        </button>
                      )}
                      {isBracket && !queueOpen && !isEnded && isRegistered && (
                        <button className="btn btn-ghost" disabled style={{ flex: 1 }}>
                          <i className="fas fa-check"></i> Registered
                        </button>
                      )}
                      {showDefaultWaitingBtn && (
                        <button className="btn btn-ghost" disabled style={{ flex: 1 }}>
                          <i className="fas fa-hourglass-half"></i> {startsIn ? 'Starts Soon' : 'Not Started'}
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
        </section>

        <aside className={`tournaments-chat-panel ${chatOpen ? 'open' : ''}`}>
          <button
            type="button"
            className="lobby-chat-fab"
            onClick={() => setChatOpen((v) => !v)}
            title={chatOpen ? 'Close lobby chat' : 'Open lobby chat'}
          >
            <i className="fas fa-comments"></i>
            <span>{chatOpen ? 'Close' : 'Chat'}</span>
            <em>{chatOnline}</em>
          </button>
          <div className="lobby-chat-card">
            <div className="lobby-chat-head">
              <div>
                <h3>Lobby Chat</h3>
                <p>Call players for queue and find opponents.</p>
              </div>
              <span className="lobby-online-pill">
                <i className="fas fa-circle"></i> {chatOnline} online
              </span>
            </div>
            <div className="lobby-chat-list">
              {chatMessages.length === 0 ? (
                <div className="lobby-empty">No messages yet. Start the lobby conversation.</div>
              ) : (
                chatMessages.map((m, i) => (
                  <div key={`${m.time || 't'}-${i}`} className="lobby-row">
                    <div className="lobby-row-top">
                      <span className={`lobby-name role-${m.role || 'player'}`}>
                        {m.sender || 'Player'}
                        {(m.role === 'admin' || m.role === 'owner') && (
                          <strong className={`chat-role-tag role-${m.role}`}>{m.role.toUpperCase()}</strong>
                        )}
                      </span>
                      <span className="lobby-time">{m.time ? new Date(m.time).toLocaleTimeString() : ''}</span>
                    </div>
                    <div className="lobby-row-msg">
                      <p>{m.message}</p>
                      {canModerate && m.id ? (
                        <button
                          type="button"
                          className="chat-delete-btn"
                          onClick={() => deleteLobbyMessage(m.id)}
                          title="Delete message"
                        >
                          <i className="fas fa-trash"></i>
                        </button>
                      ) : null}
                    </div>
                  </div>
                ))
              )}
              <div ref={chatEndRef} />
            </div>
            {chatError ? (
              <div className="lobby-chat-error">
                <i className="fas fa-triangle-exclamation"></i> {chatError}
              </div>
            ) : null}
            <div className="lobby-chat-send">
              <input
                type="text"
                maxLength={300}
                value={chatText}
                onChange={(e) => setChatText(e.target.value)}
                onKeyDown={(e) => (e.key === 'Enter' ? sendLobbyMessage() : null)}
                placeholder="Anyone join boxfight queue?"
              />
              <button className="btn btn-primary" onClick={sendLobbyMessage} disabled={!chatText.trim() || sending}>
                Send
              </button>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
};

export default Tournaments;
