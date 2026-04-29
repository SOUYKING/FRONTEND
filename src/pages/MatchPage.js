import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { getActiveMatchInfo, getPublicPlayerProfile, submitMatchResult, resolveMatchDispute, DISCORD_AVATAR_FALLBACK, buildDiscordAvatar, getMatchChat } from '../utils/api';
import { getRank, getRankProgress, getRankLabel } from '../utils/ranks';
import './MatchPage.css';

const STAFF_ROLES = ['admin', 'owner', 'staff'];

const MatchPage = ({ socket, user: currentUserFromApp }) => {
  const { matchId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const [matchContext, setMatchContext] = useState(location.state || null);
  const { self, opponent, mapCode, matchMode, tournamentName } = matchContext || {};
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [resultMessage, setResultMessage] = useState('');
  const [reporting, setReporting] = useState(false);
  const [reported, setReported] = useState(false);
  const [disputed, setDisputed] = useState(false);
  const [staffNotified, setStaffNotified] = useState(false);
  const [isStaff, setIsStaff] = useState(false);
  const [staffForcing, setStaffForcing] = useState(false);
  const [showProfile, setShowProfile] = useState(null);
  const [chatOpen, setChatOpen] = useState(true);
  const [selfProfileStats, setSelfProfileStats] = useState(null);
  const [opponentProfileStats, setOpponentProfileStats] = useState(null);
  const [isSpectator, setIsSpectator] = useState(false);
  const [canChat, setCanChat] = useState(false);
  const [contextLoaded, setContextLoaded] = useState(false);
  const [player1, setPlayer1] = useState(null);
  const [player2, setPlayer2] = useState(null);
  const [autoResolveAt, setAutoResolveAt] = useState(null);
  const [countdown, setCountdown] = useState(null);
  const [chatAtBottom, setChatAtBottom] = useState(true);
  const [newMsg, setNewMsg] = useState(false);

  const currentUser = useMemo(
    () => currentUserFromApp || JSON.parse(localStorage.getItem('user') || '{}'),
    [currentUserFromApp]
  );
  const currentUserId = currentUser?.discordId || currentUser?.id;
  const chatRef = useRef(null);

  const myName = self?.username || currentUser?.discordName || 'You';
  const opponentName = opponent?.username || opponent?.discordName || 'Opponent';
  const userRole = currentUser?.role || 'player';

  const myPoints = selfProfileStats?.rankingPoints ?? self?.rankingPoints ?? currentUser?.rankingPoints ?? 0;
  const opponentPoints = opponentProfileStats?.rankingPoints ?? opponent?.rankingPoints ?? 0;
  const myRank = getRank(myPoints);
  const opponentRank = getRank(opponentPoints);

  const selfAvatar = self?.avatarUrl
    || buildDiscordAvatar(self?.id, self?.avatar)
    || buildDiscordAvatar(currentUser?.id, currentUser?.discordAvatar)
    || DISCORD_AVATAR_FALLBACK;

  const opponentAvatar = opponent?.avatarUrl
    || buildDiscordAvatar(opponent?.id, opponent?.avatar)
    || (opponent?.id ? buildDiscordAvatar(opponent.id, null) : null)
    || DISCORD_AVATAR_FALLBACK;

  const isViewingAsSelf = !!self;
  const isViewingAsStaff = isStaff && !self;

  const leftPlayer = isViewingAsSelf ? self : player1;
  const rightPlayer = isViewingAsSelf ? opponent : player2;
  const leftPlayerIsSelf = !!self && player1?.id === self?.id;
  const rightPlayerIsSelf = !!self && player2?.id === self?.id;

  const leftAvatar = leftPlayer ? (leftPlayer.avatar ? buildDiscordAvatar(leftPlayer.id, leftPlayer.avatar) : DISCORD_AVATAR_FALLBACK) : selfAvatar;
  const rightAvatar = rightPlayer ? (rightPlayer.avatar ? buildDiscordAvatar(rightPlayer.id, rightPlayer.avatar) : DISCORD_AVATAR_FALLBACK) : opponentAvatar;
  const leftName = leftPlayer?.username || leftPlayer?.discordName || 'Player 1';
  const rightName = rightPlayer?.username || rightPlayer?.discordName || 'Player 2';

  const openProfile = (player) => {
    if (!player) return;
    const playerId = player.id || player.discordId;
    const selfId = self?.id || currentUserId;
    setShowProfile({
      player,
      isSelf: !!playerId && !!selfId && playerId === selfId,
    });
  };

  useEffect(() => {
    let mounted = true;
    const loadContext = async () => {
      try {
        const [matchInfo, chatHistory] = await Promise.all([
          getActiveMatchInfo(matchId).catch(() => null),
          getMatchChat(matchId).catch(() => []),
        ]);
        if (!mounted) return;
        if (matchInfo?.inMatch) {
          setIsStaff(matchInfo.isStaff);
          setIsSpectator(matchInfo.isSpectator);
          setCanChat(!matchInfo.isSpectator);
          setContextLoaded(true);
          setPlayer1(matchInfo.player1);
          setPlayer2(matchInfo.player2);
          setMatchContext({
            matchId: matchInfo.matchId,
            self: matchInfo.self ? { id: matchInfo.self.id, username: matchInfo.self.username, epicName: matchInfo.self.epicName, avatar: matchInfo.self.avatar } : null,
            opponent: { id: matchInfo.opponent.id, username: matchInfo.opponent.username, epicName: matchInfo.opponent.epicName, avatar: matchInfo.opponent.avatar },
            mapCode: matchInfo.mapCode || '',
          });
          if (chatHistory.length > 0) {
            setMessages(chatHistory);
          }
        } else if (mounted) {
          setIsSpectator(true);
          setCanChat(false);
          setContextLoaded(true);
          setMatchContext(prev => prev || { matchId });
        }
      } catch { if (mounted) {} }
    };
    loadContext();
    return () => { mounted = false; };
  }, [matchId]);

  useEffect(() => {
    const selfId = self?.id || currentUserId;
    const opponentId = opponent?.id;
    if (!selfId && !opponentId) return;

    let cancelled = false;
    const fetchProfileStats = async () => {
      try {
        const tasks = [];
        if (selfId) tasks.push(getPublicPlayerProfile(selfId));
        else tasks.push(Promise.resolve(null));
        if (opponentId) tasks.push(getPublicPlayerProfile(opponentId));
        else tasks.push(Promise.resolve(null));
        const [selfStats, opponentStats] = await Promise.all(tasks);
        if (cancelled) return;
        setSelfProfileStats(selfStats || null);
        setOpponentProfileStats(opponentStats || null);
      } catch {}
    };
    fetchProfileStats();
    return () => { cancelled = true; };
  }, [self?.id, opponent?.id, currentUserId]);

  useEffect(() => {
    if (!contextLoaded) return;
    if (matchId && self !== undefined) {
      if (self) {
        sessionStorage.setItem('currentMatch', JSON.stringify({ matchId, self, opponent }));
        socket.emit('joinMatch', { matchId, playerName: myName });
      } else if (isStaff) {
        socket.emit('staffJoinMatch', { matchId, staffName: myName });
      } else if (isSpectator) {
        socket.emit('joinMatchAsViewer', { matchId, viewerName: currentUser?.discordName || 'Viewer' });
      }
    }

    const onReceiveMessage = (msg) => {
      setMessages((prev) => [...prev, msg]);
      setNewMsg(true);
    };

    const onChatHistory = (data) => {
      if (data.chatLogs && data.chatLogs.length > 0) {
        setMessages(data.chatLogs);
      }
    };

    const onDisputeOpened = () => {
      setDisputed(true);
      setResultMessage('Dispute opened. Staff will review.');
    };

    const onStaffNotified = (data) => {
      setStaffNotified(true);
      setResultMessage(data.message || 'Staff has been notified.');
    };

    const onStaffJoinedMatch = (data) => {
      setResultMessage(data.message || 'You joined the match as staff.');
    };

    const onMatchCompleted = () => {
      setAutoResolveAt(null);
      setCountdown(null);
      setReported(true);
      setResultMessage('Match completed! Redirecting...');
      setTimeout(() => {
        sessionStorage.removeItem('currentMatch');
        navigate('/dashboard');
      }, 3000);
    };

    const onWinSubmitted = (data) => {
      setAutoResolveAt(data.autoResolveAt);
      if (data.submittedBy !== myName) setReported(false);
    };

    const onChatError = (data) => {
      setResultMessage(data?.message || 'Chat action failed.');
    };

    const onChatWarning = (data) => {
      setResultMessage(data?.message || 'Message was filtered.');
    };

    const onReportSubmitted = (data) => {
      setResultMessage(data?.message || 'Report submitted. Staff will review.');
    };

    // Backend can redirect non-participants from joinMatch to viewer mode.
    const onJoinMatchAsViewer = (data) => {
      socket.emit('joinMatchAsViewer', {
        matchId: data?.matchId || matchId,
        viewerName: data?.viewerName || currentUser?.discordName || 'Viewer',
      });
    };

    socket.on('receiveMessage', onReceiveMessage);
    socket.on('chatHistory', onChatHistory);
    socket.on('disputeOpened', onDisputeOpened);
    socket.on('staffNotified', onStaffNotified);
    socket.on('staffJoinedMatch', onStaffJoinedMatch);
    socket.on('matchCompleted', onMatchCompleted);
    socket.on('winSubmitted', onWinSubmitted);
    socket.on('chatError', onChatError);
    socket.on('chatWarning', onChatWarning);
    socket.on('reportSubmitted', onReportSubmitted);
    socket.on('joinMatchAsViewer', onJoinMatchAsViewer);

    return () => {
      socket.off('receiveMessage', onReceiveMessage);
      socket.off('chatHistory', onChatHistory);
      socket.off('disputeOpened', onDisputeOpened);
      socket.off('staffNotified', onStaffNotified);
      socket.off('staffJoinedMatch', onStaffJoinedMatch);
      socket.off('matchCompleted', onMatchCompleted);
      socket.off('winSubmitted', onWinSubmitted);
      socket.off('chatError', onChatError);
      socket.off('chatWarning', onChatWarning);
      socket.off('reportSubmitted', onReportSubmitted);
      socket.off('joinMatchAsViewer', onJoinMatchAsViewer);
    };
  }, [matchId, self, opponent, socket, navigate, myName, currentUser?.discordName, isStaff, isSpectator, contextLoaded]);

  useEffect(() => {
    if (chatRef.current && chatAtBottom) {
      chatRef.current.scrollTop = chatRef.current.scrollHeight;
      setNewMsg(false);
    }
  }, [messages]);

  const handleChatScroll = () => {
    if (!chatRef.current) return;
    const el = chatRef.current;
    const isBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 60;
    setChatAtBottom(isBottom);
    if (isBottom) setNewMsg(false);
  };

  const scrollToBottom = () => {
    if (chatRef.current) {
      chatRef.current.scrollTop = chatRef.current.scrollHeight;
      setChatAtBottom(true);
      setNewMsg(false);
    }
  };

  useEffect(() => {
    if (!autoResolveAt) { setCountdown(null); return; }
    const interval = setInterval(() => {
      const remaining = Math.max(0, Math.floor((new Date(autoResolveAt).getTime() - Date.now()) / 1000));
      setCountdown(remaining > 0 ? remaining : 0);
      if (remaining <= 0) { clearInterval(interval); setAutoResolveAt(null); }
    }, 1000);
    return () => clearInterval(interval);
  }, [autoResolveAt]);

  const handleSendMessage = () => {
    if (newMessage.trim()) {
      socket.emit('sendMessage', { matchId, message: newMessage, sender: myName });
      setNewMessage('');
    }
  };

  const handleReportResult = async (winnerDiscordId) => {
    if (!self?.id && !currentUserId) return;
    try {
      setReporting(true);
      const res = await submitMatchResult(matchId, winnerDiscordId);
      setReported(true);
      setResultMessage(res.message || 'Result submitted');
      if (res.autoResolveAt) setAutoResolveAt(res.autoResolveAt);
      if (res.status === 'disputed') setDisputed(true);
    } catch (error) {
      const msg = error.response?.data?.message || 'Failed to submit result';
      setResultMessage(msg);
      if (error.response?.status === 409) setDisputed(true);
    } finally { setReporting(false); }
  };

  const handleForceWin = async (winnerId, winnerName) => {
    try {
      setStaffForcing(true);
      await resolveMatchDispute(matchId, winnerId);
      setResultMessage(`${winnerName} has been force-win. Match finalized.`);
      setDisputed(false);
      setReported(true);
    } catch (error) {
      setResultMessage(error.response?.data?.message || 'Failed to force win');
    } finally { setStaffForcing(false); }
  };

  const handleCallStaff = () => {
    if (staffNotified) return;
    socket.emit('callStaff', { matchId, callerName: myName, reason: 'Requesting staff assistance' });
    setStaffNotified(true);
  };

  const handleCopyMapCode = () => {
    if (!mapCode) return;
    navigator.clipboard.writeText(mapCode).then(() => setResultMessage('Map code copied!')).catch(() => {});
  };

  const formatTime = (timeStr) => {
    try { return new Date(timeStr).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true }); }
    catch { return ''; }
  };

  const getRoleBadge = (role) => {
    if (role === 'owner') return { label: 'OWNER', cls: 'role-owner' };
    if (role === 'admin') return { label: 'ADMIN', cls: 'role-admin' };
    if (role === 'staff') return { label: 'STAFF', cls: 'role-staff' };
    if (role === 'content_creator') return { label: 'CREATOR', cls: 'role-creator' };
    return null;
  };

  const PlayerProfileModal = ({ player, isSelf, onClose }) => {
    if (!player) return null;
    const playerId = player.id || player.discordId;
    const stats =
      (selfProfileStats?.discordId && selfProfileStats.discordId === playerId && selfProfileStats)
      || (opponentProfileStats?.discordId && opponentProfileStats.discordId === playerId && opponentProfileStats)
      || (isSelf ? selfProfileStats : opponentProfileStats);
    const pts = stats?.rankingPoints ?? player.rankingPoints ?? 0;
    const rank = getRank(pts);
    const rankLabel = getRankLabel(pts);
    const avatar = buildDiscordAvatar(playerId, player.avatar || player.discordAvatar) || (isSelf ? selfAvatar : opponentAvatar);
    const name = stats?.discordName || player.username || player.discordName || (isSelf ? myName : opponentName);
    const wins = stats?.wins ?? 0;
    const losses = stats?.losses ?? 0;
    const totalMatches = stats?.totalMatches ?? 0;
    const winRate = totalMatches > 0 ? Number(((wins / totalMatches) * 100).toFixed(1)) : 0;

    return (
      <div className="profile-modal-overlay" onClick={onClose}>
        <div className="profile-modal" onClick={(e) => e.stopPropagation()}>
          <div className="profile-modal-header">
            <div className="profile-modal-avatar"><img src={avatar} alt={name} /></div>
            <h3 className="profile-modal-name">{name}</h3>
            {(stats?.epicGamesName || player.epicName) && <p className="profile-modal-epic">{stats?.epicGamesName || player.epicName}</p>}
          </div>
          <div className="profile-modal-rank">
            <img src={rank.icon} alt={rankLabel} />
            <span className="profile-modal-rank-label" style={{ color: rank.color }}>{rankLabel}</span>
          </div>
          <div className="rank-progress-bar">
            <div className="rank-progress-fill" style={{ width: `${getRankProgress(pts)}%`, background: rank.color }} />
          </div>
          <div className="profile-stats-grid">
            <div className="profile-stat-card"><strong>{wins}</strong><span>Wins</span></div>
            <div className="profile-stat-card"><strong>{losses}</strong><span>Losses</span></div>
            <div className="profile-stat-card"><strong>{totalMatches}</strong><span>Total</span></div>
            <div className="profile-stat-card"><strong>{winRate}%</strong><span>Win Rate</span></div>
          </div>
        </div>
      </div>
    );
  };

    return (
      <div className="match-page page-wrapper">
        <div className="match-header">
          <div className="match-header-left">
            <h1>MATCH</h1>
            <div className="match-header-tags">
              {matchMode && <span className="match-tag mode">{matchMode}</span>}
              {tournamentName && <span className="match-tag tourney">{tournamentName}</span>}
            </div>
          </div>
          <span className={`match-status-badge ${disputed ? 'disputed' : reported ? 'reported' : 'live'}`}>
            <i className={`fas ${disputed ? 'fa-gavel' : reported ? 'fa-check-circle' : 'fa-circle'}`}></i>
            {disputed ? ' Disputed' : reported ? ' Reported' : ' LIVE'}
            {isSpectator && <span style={{ marginLeft: 6, opacity: 0.6, fontWeight: 400 }}>· Spectator</span>}
            {isStaff && !isSpectator && !self && <span style={{ marginLeft: 6, opacity: 0.6, fontWeight: 400 }}>· Staff View</span>}
          </span>
        </div>

        <div className="match-arena">
          <div className="match-player-panel" onClick={() => openProfile(leftPlayer)}>
            <div className="player-bg" style={{ background: 'linear-gradient(135deg, rgba(46,242,255,0.04), transparent)' }} />
            <div className="match-player-avatar">
              <img src={leftAvatar} alt={leftName} />
            </div>
            <div className="match-player-name">{leftName}</div>
            {leftPlayer?.epicName && <div className="match-player-epic">{leftPlayer.epicName}</div>}
            <div className="match-player-tag self">{isViewingAsSelf ? 'YOU' : (leftPlayerIsSelf ? 'YOU' : 'PLAYER 1')}</div>
          </div>

          <div className="match-vs-center">
            <div className="match-vs-badge">VS</div>
            {mapCode && (
              <div className="match-map-code" onClick={handleCopyMapCode} title="Click to copy">
                <i className="fas fa-map-pin"></i>
                <code>{mapCode}</code>
                <i className="fas fa-copy"></i>
              </div>
            )}
          </div>

          <div className="match-player-panel" onClick={() => openProfile(rightPlayer)}>
            <div className="player-bg" style={{ background: 'linear-gradient(135deg, rgba(168,85,247,0.04), transparent)' }} />
            <div className="match-player-avatar" style={{ borderColor: 'var(--border-purple)', boxShadow: '0 0 25px var(--purple-glow)' }}>
              <img src={rightAvatar} alt={rightName} />
            </div>
            <div className="match-player-name">{rightName}</div>
            {rightPlayer?.epicName && <div className="match-player-epic">{rightPlayer.epicName}</div>}
            <div className="match-player-tag opponent">{isViewingAsSelf ? 'OPPONENT' : (rightPlayerIsSelf ? 'YOU' : 'PLAYER 2')}</div>
          </div>
        </div>

        <div className="match-info-bar">
          <div className="match-info-tags">
            {mapCode && <span className="match-info-tag"><i className="fas fa-map-pin"></i> {mapCode}</span>}
          </div>
          <div className="match-timeline">
            <span className="timeline-step completed"><i className="fas fa-check-circle"></i> Ready</span>
            <span className="timeline-step active"><i className="fas fa-play-circle"></i> Live</span>
          </div>
        </div>

        <div className="match-bottom">
          <div className="match-chat-panel">
            <div className="chat-panel-header" onClick={() => setChatOpen(!chatOpen)}>
              <div className="chat-panel-title">
                <i className="fas fa-comments"></i> Match Chat
                {messages.length > 0 && <span className="chat-message-count">{messages.length}</span>}
              </div>
              <i className={`fas fa-chevron-${chatOpen ? 'down' : 'up'}`}></i>
            </div>
            {chatOpen && (
              <>
                <div className="chat-messages" ref={chatRef} onScroll={handleChatScroll}>
                  {newMsg && !chatAtBottom && (
                    <button onClick={scrollToBottom} className="chat-scroll-btn">
                      <i className="fas fa-arrow-down"></i> New messages
                    </button>
                  )}
                  {messages.length === 0 && <div className="chat-empty">No messages yet.</div>}
                  {messages.map((msg, index) => {
                    const badge = !msg.isSystem ? getRoleBadge(msg.role) : null;
                    return (
                      <div key={index} className={`chat-message ${msg.isSystem ? 'system' : ''}`}>
                        <div className="chat-message-header">
                          <span className="chat-sender">
                            {msg.isSystem ? 'System' : msg.sender}
                            {badge && <span className={`chat-role-badge ${badge.cls}`}>{badge.label}</span>}
                          </span>
                          <span className="chat-time">{formatTime(msg.time)}</span>
                        </div>
                        <div className="chat-text">{msg.message}</div>
                      </div>
                    );
                  })}
                </div>
                <div className="chat-input-area">
                  <input
                    className="chat-input"
                    type="text"
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                    placeholder={!canChat ? "Spectator mode - chat disabled" : "Type a message..."}
                    disabled={!canChat}
                  />
                  <button className="chat-send-btn" onClick={handleSendMessage} disabled={!newMessage.trim() || !canChat}>
                    Send
                  </button>
                </div>
              </>
            )}
          </div>

          <div className="match-action-column">
            <div className="match-action-card">
              <div className="match-action-card-header"><i className="fas fa-trophy"></i> Report Result</div>
              <div className="match-action-card-body">
                {isSpectator || (isStaff && !self) ? (
                  <div className="match-status-msg">
                    <i className="fas fa-eye" style={{ color: 'var(--text-muted)', opacity: 0.5, fontSize: '1.5rem', marginBottom: 8 }}></i>
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>You are {isStaff ? 'staff observer' : 'spectating'} this match.</p>
                  </div>
                ) : !reported && !disputed ? (
                  <div className="result-buttons">
                    <button disabled={reporting} onClick={() => handleReportResult(self?.id || currentUserId)} className="result-btn win">
                      <i className="fas fa-check-circle"></i> I Won
                    </button>
                    <button disabled={reporting} onClick={() => handleReportResult(opponent?.id)} className="result-btn lose">
                      <i className="fas fa-times-circle"></i> I Lost
                    </button>
                    <button disabled={reporting || staffNotified} onClick={handleCallStaff} className="result-btn staff">
                      <i className="fas fa-headset"></i> Call Staff
                    </button>
                  </div>
                ) : disputed ? (
                  <div className="match-status-msg">
                    <i className="fas fa-gavel" style={{ color: 'var(--red)' }}></i>
                    <p>Match disputed. Staff will review.</p>
                    {isStaff && !isSpectator && (
                      <div className="force-buttons">
                        {player1 && (
                          <button disabled={staffForcing} onClick={() => handleForceWin(player1.id, player1.username)} className="result-btn win">
                            Force: {player1.username}
                          </button>
                        )}
                        {player2 && (
                          <button disabled={staffForcing} onClick={() => handleForceWin(player2.id, player2.username)} className="result-btn lose">
                            Force: {player2.username}
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="match-status-msg">
                    <i className="fas fa-check-circle" style={{ color: 'var(--green)' }}></i>
                    <p>{resultMessage || 'Result submitted. Waiting...'}</p>
                    {countdown !== null && countdown > 0 && (
                      <div className="auto-resolve-timer">
                        <i className="fas fa-hourglass-half"></i>
                        Auto in {Math.floor(countdown / 60)}:{String(countdown % 60).padStart(2, '0')}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {isStaff && !isSpectator && (
              <div className="match-action-card">
                <div className="match-action-card-header"><i className="fas fa-gavel"></i> Staff Tools</div>
                <div className="match-action-card-body">
                  <p className="force-hint">Force a winner any time:</p>
                  <div className="force-buttons">
                    {player1 && (
                      <button disabled={staffForcing} onClick={() => handleForceWin(player1.id, player1.username)} className="result-btn win">
                        Win: {player1.username}
                      </button>
                    )}
                    {player2 && (
                      <button disabled={staffForcing} onClick={() => handleForceWin(player2.id, player2.username)} className="result-btn lose">
                        Win: {player2.username}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {showProfile && (
          <PlayerProfileModal
            player={showProfile.player}
            isSelf={showProfile.isSelf}
            onClose={() => setShowProfile(null)}
          />
        )}
      </div>
    );
};

export default MatchPage;
