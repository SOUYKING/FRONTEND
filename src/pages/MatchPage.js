import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { getActiveMatchInfo, getPublicPlayerProfile, submitMatchResult, resolveMatchDispute, DISCORD_AVATAR_FALLBACK, buildDiscordAvatar, getMatchChat } from '../utils/api';
import { getRank, getRankProgress, getRankLabel } from '../utils/ranks';
import './MatchPage.css';

const readStoredUser = () => {
  try {
    return JSON.parse(localStorage.getItem('user') || '{}');
  } catch {
    return {};
  }
};

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
  const [matchSides, setMatchSides] = useState(null);
  const [participantSide, setParticipantSide] = useState(null);
  const [teamMatch, setTeamMatch] = useState(false);
  const [isTeamCaptain, setIsTeamCaptain] = useState(true);

  const currentUser = useMemo(
    () => currentUserFromApp || readStoredUser(),
    [currentUserFromApp]
  );
  const currentUserId = currentUser?.discordId || currentUser?.id;
  const chatRef = useRef(null);

  const staffModerator = useMemo(() => {
    if (!currentUser) return false;
    if (currentUser.isOwner) return true;
    const r = String(currentUser.role || '').toLowerCase();
    return r === 'admin' || r === 'owner' || r === 'staff';
  }, [currentUser]);

  const showStaffMatchTools = Boolean(
    !isSpectator &&
    !self &&
    (isStaff || staffModerator)
  );

  const myName = self?.username || currentUser?.discordName || 'You';
  const opponentName = opponent?.username || opponent?.discordName || 'Opponent';
  const userRole = currentUser?.role || 'player';

  const selfAvatar = self?.avatarUrl
    || buildDiscordAvatar(self?.id, self?.avatar)
    || buildDiscordAvatar(currentUser?.id, currentUser?.discordAvatar)
    || DISCORD_AVATAR_FALLBACK;

  const opponentAvatar = opponent?.avatarUrl
    || buildDiscordAvatar(opponent?.id, opponent?.avatar)
    || (opponent?.id ? buildDiscordAvatar(opponent.id, null) : null)
    || DISCORD_AVATAR_FALLBACK;

  const fallbackLeftName = participantSide === 'player2'
    ? (player2?.username || 'Squad A')
    : (player1?.username || 'Squad A');
  const fallbackRightName = participantSide === 'player2'
    ? (player1?.username || 'Squad B')
    : (player2?.username || 'Squad B');

  const { leftSide, rightSide, leftSideKey, rightSideKey, displayFormat } = useMemo(() => {
    const blank = (p) => {
      if (!p?.id) return { teamMode: false, label: '—', teamSize: 1, members: [] };
      return {
        teamMode: false,
        label: p.username,
        teamSize: 1,
        members: [{
          id: p.id,
          username: p.username,
          epicName: p.epicName || null,
          avatar: p.avatar || null,
          rankingPoints: 0,
          isCaptain: true,
        }],
      };
    };
    if (matchSides?.player1 && matchSides?.player2) {
      const lsKey = self && participantSide ? participantSide : 'player1';
      const rsKey = lsKey === 'player1' ? 'player2' : 'player1';
      const ls = matchSides[lsKey];
      const rs = matchSides[rsKey];
      let fmt = Math.max(ls?.teamSize || 1, rs?.teamSize || 1);
      if (matchMode && /(\d)/.test(String(matchMode))) {
        const d = Number(String(matchMode).match(/(\d)/)[1]);
        if (!Number.isNaN(d)) fmt = Math.max(fmt, d);
      }
      return {
        leftSide: ls,
        rightSide: rs,
        leftSideKey: lsKey,
        rightSideKey: rsKey,
        displayFormat: fmt,
      };
    }
    const lsKey = self && participantSide ? participantSide : 'player1';
    const rsKey = lsKey === 'player1' ? 'player2' : 'player1';
    let fmt = 1;
    if (matchMode && /(\d)/.test(String(matchMode))) {
      const d = Number(String(matchMode).match(/(\d)/)[1]);
      if (!Number.isNaN(d)) fmt = d;
    }
    return {
      leftSide: lsKey === 'player1' ? blank(player1) : blank(player2),
      rightSide: rsKey === 'player1' ? blank(player1) : blank(player2),
      leftSideKey: lsKey,
      rightSideKey: rsKey,
      displayFormat: fmt,
    };
  }, [matchSides, participantSide, self, player1, player2, matchMode]);

  const memberToPlayer = (m) => ({
    id: m.id,
    discordId: m.id,
    username: m.username,
    discordName: m.username,
    avatar: m.avatar,
    epicName: m.epicName,
    rankingPoints: m.rankingPoints,
  });

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
          setMatchSides(matchInfo.sides || null);
          setParticipantSide(matchInfo.participantSide || null);
          setTeamMatch(!!matchInfo.teamMatch);
          setIsTeamCaptain(matchInfo.isTeamCaptain !== false);
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
      } else if (!self && (isStaff || staffModerator)) {
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
  }, [matchId, self, opponent, socket, navigate, myName, currentUser?.discordName, isStaff, staffModerator, isSpectator, contextLoaded]);

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
    if (!navigator?.clipboard?.writeText) {
      setResultMessage('Copy is not supported on this browser.');
      return;
    }
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
              {displayFormat > 1 && (
                <span className="match-tag mode match-tag-format">{displayFormat}v{displayFormat} beta</span>
              )}
              {matchMode && <span className="match-tag mode">{matchMode}</span>}
              {tournamentName && <span className="match-tag tourney">{tournamentName}</span>}
            </div>
          </div>
          <span className={`match-status-badge ${disputed ? 'disputed' : reported ? 'reported' : 'live'}`}>
            <i className={`fas ${disputed ? 'fa-gavel' : reported ? 'fa-check-circle' : 'fa-circle'}`}></i>
            {disputed ? ' Disputed' : reported ? ' Reported' : ' LIVE'}
            {isSpectator && <span style={{ marginLeft: 6, opacity: 0.6, fontWeight: 400 }}>· Spectator</span>}
            {showStaffMatchTools && <span style={{ marginLeft: 6, opacity: 0.6, fontWeight: 400 }}>· Staff View</span>}
          </span>
        </div>

        <div className="match-beta-board">
          <section
            className={`match-roster-panel match-roster-panel--alpha ${self && participantSide === leftSideKey ? 'match-roster-panel--yours' : ''}`}
            aria-label="Side A roster"
          >
            <header className="match-roster-panel__head">
              <span className="match-roster-panel__eyebrow">{leftSide?.teamMode ? 'Squad' : 'Player'}</span>
              <h2 className="match-roster-panel__title">{leftSide?.label || fallbackLeftName}</h2>
              <span className="match-roster-panel__meta">{leftSide?.teamSize || 1}v{leftSide?.teamSize || 1}</span>
            </header>
            <ul className="match-roster-panel__list">
              {(leftSide?.members || []).map((m) => {
                const rk = getRank(m.rankingPoints || 0);
                const av = buildDiscordAvatar(m.id, m.avatar) || DISCORD_AVATAR_FALLBACK;
                const you = !!currentUserId && m.id === currentUserId;
                return (
                  <li
                    key={m.id}
                    className={`match-roster-panel__row ${you ? 'is-you' : ''}`}
                    onClick={() => openProfile(memberToPlayer(m))}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => e.key === 'Enter' && openProfile(memberToPlayer(m))}
                  >
                    <img className="match-roster-panel__avatar" src={av} alt="" />
                    <div className="match-roster-panel__who">
                      <span className="match-roster-panel__name">
                        {m.username}
                        <img className="match-roster-panel__rank-ico" src={rk.icon} alt="" title={getRankLabel(m.rankingPoints || 0)} />
                      </span>
                      {m.epicName && <span className="match-roster-panel__epic">{m.epicName}</span>}
                    </div>
                    <div className="match-roster-panel__badges">
                      {m.isCaptain && <span className="match-roster-panel__pill match-roster-panel__pill--cap">Captain</span>}
                      {you && <span className="match-roster-panel__pill match-roster-panel__pill--you">You</span>}
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>

          <div className="match-beta-center">
            <div className="match-beta-center__ring">
              <span className="match-beta-center__format">{displayFormat}v{displayFormat}</span>
              <span className="match-beta-center__sub">beta board</span>
            </div>
            {mapCode ? (
              <button type="button" className="match-beta-map" onClick={handleCopyMapCode} title="Copy map code">
                <i className="fas fa-map-pin" aria-hidden />
                <code>{mapCode}</code>
                <i className="fas fa-copy" aria-hidden />
              </button>
            ) : (
              <p className="match-beta-map-placeholder">Map code from host</p>
            )}
            <div className="match-beta-center__strip">
              <span className="match-beta-live-dot" />
              In match — use chat for callouts and proof
            </div>
          </div>

          <section
            className={`match-roster-panel match-roster-panel--beta ${self && participantSide === rightSideKey ? 'match-roster-panel--yours' : ''}`}
            aria-label="Side B roster"
          >
            <header className="match-roster-panel__head">
              <span className="match-roster-panel__eyebrow">{rightSide?.teamMode ? 'Squad' : 'Player'}</span>
              <h2 className="match-roster-panel__title">{rightSide?.label || fallbackRightName}</h2>
              <span className="match-roster-panel__meta">{rightSide?.teamSize || 1}v{rightSide?.teamSize || 1}</span>
            </header>
            <ul className="match-roster-panel__list">
              {(rightSide?.members || []).map((m) => {
                const rk = getRank(m.rankingPoints || 0);
                const av = buildDiscordAvatar(m.id, m.avatar) || DISCORD_AVATAR_FALLBACK;
                const you = !!currentUserId && m.id === currentUserId;
                return (
                  <li
                    key={m.id}
                    className={`match-roster-panel__row ${you ? 'is-you' : ''}`}
                    onClick={() => openProfile(memberToPlayer(m))}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => e.key === 'Enter' && openProfile(memberToPlayer(m))}
                  >
                    <img className="match-roster-panel__avatar" src={av} alt="" />
                    <div className="match-roster-panel__who">
                      <span className="match-roster-panel__name">
                        {m.username}
                        <img className="match-roster-panel__rank-ico" src={rk.icon} alt="" title={getRankLabel(m.rankingPoints || 0)} />
                      </span>
                      {m.epicName && <span className="match-roster-panel__epic">{m.epicName}</span>}
                    </div>
                    <div className="match-roster-panel__badges">
                      {m.isCaptain && <span className="match-roster-panel__pill match-roster-panel__pill--cap">Captain</span>}
                      {you && <span className="match-roster-panel__pill match-roster-panel__pill--you">You</span>}
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>
        </div>

        <div className="match-flow-hints">
          {teamMatch ? (
            <>
              <span><i className="fas fa-users"></i> Team queue: everyone listed plays this match ({displayFormat}v{displayFormat}).</span>
              <span><i className="fas fa-crown"></i> Only the captain submits win / loss — squadmates use chat for proof.</span>
            </>
          ) : (
            <span><i className="fas fa-circle-info"></i> 1v1: report your result right after the game to avoid disputes.</span>
          )}
          <span><i className="fas fa-headset"></i> Need help? Call Staff and keep chat clear.</span>
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
                {isSpectator || showStaffMatchTools ? (
                  <div className="match-status-msg">
                    <i className="fas fa-eye" style={{ color: 'var(--text-muted)', opacity: 0.5, fontSize: '1.5rem', marginBottom: 8 }}></i>
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                      You are {showStaffMatchTools ? 'staff observer' : 'spectating'} this match.
                    </p>
                  </div>
                ) : !reported && !disputed ? (
                  teamMatch && !isTeamCaptain ? (
                    <div className="match-status-msg match-captain-gate">
                      <i className="fas fa-crown" style={{ color: 'var(--gold)' }} />
                      <p>Only your team captain can submit the match result. Use chat to coordinate proof.</p>
                    </div>
                  ) : (
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
                  )
                ) : disputed ? (
                  <div className="match-status-msg">
                    <i className="fas fa-gavel" style={{ color: 'var(--red)' }}></i>
                    <p>Match disputed. Staff will review.</p>
                    {showStaffMatchTools && (
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

            {showStaffMatchTools && (
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
