import React, { useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { getCurrentMatch, getActiveMatchInfo, getPublicPlayerProfile, submitMatchResult, resolveMatchDispute, DISCORD_AVATAR_FALLBACK, buildDiscordAvatar } from '../utils/api';
import { getRank, getRankProgress, getRankLabel } from '../utils/ranks';

const STAFF_ROLES = ['admin', 'owner', 'staff'];

const MatchPage = ({ socket }) => {
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
  const [autoResolveAt, setAutoResolveAt] = useState(null);
  const [countdown, setCountdown] = useState(null);
  const [chatAtBottom, setChatAtBottom] = useState(true);
  const [newMsg, setNewMsg] = useState(false);
  const currentUser = JSON.parse(localStorage.getItem('user') || '{}');
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

  useEffect(() => {
    let mounted = true;
    const loadContext = async () => {
      if (self && opponent && !isSpectator) return;
      try {
        const currentMatch = await getCurrentMatch().catch(() => null);
        if (!mounted) return;
        if (currentMatch?.inMatch && currentMatch.matchId === matchId) {
          setIsSpectator(false);
          setMatchContext({
            matchId: currentMatch.matchId,
            self: { id: currentMatch.selfId, username: currentMatch.selfName || currentUser?.discordName || 'You', epicName: currentMatch.selfEpicName || currentMatch.selfName || 'You', avatar: currentMatch.selfAvatar, rankingPoints: currentUser?.rankingPoints || 0 },
            opponent: { id: currentMatch.opponentId, username: currentMatch.opponent || 'Opponent', epicName: currentMatch.opponentEpicName || currentMatch.opponent || 'Opponent', avatar: currentMatch.opponentAvatar, rankingPoints: 0 },
            mapCode: currentMatch.mapCode || '',
          });
          return;
        }
        const matchInfo = await getActiveMatchInfo(matchId).catch(() => null);
        if (!mounted) return;
        if (matchInfo?.inMatch) {
          if (matchInfo.isStaff) {
            setIsStaff(true);
            setIsSpectator(false);
          } else {
            setIsSpectator(true);
          }
          setMatchContext({
            matchId: matchInfo.matchId,
            self: matchInfo.self ? { id: matchInfo.self.id, username: matchInfo.self.username, epicName: matchInfo.self.epicName, avatar: matchInfo.self.avatar } : null,
            opponent: { id: matchInfo.opponent.id, username: matchInfo.opponent.username, epicName: matchInfo.opponent.epicName, avatar: matchInfo.opponent.avatar },
            mapCode: matchInfo.mapCode || '',
          });
        }
      } catch { if (mounted) {} }
    };
    loadContext();
    return () => { mounted = false; };
  }, [self, opponent, matchId, navigate, isSpectator, currentUser?.discordName, currentUser?.rankingPoints]);

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
    if (!isStaff && !isSpectator && !self) return;

    const isActuallyStaff = isStaff || STAFF_ROLES.includes(userRole);
    if (isActuallyStaff) {
      setIsStaff(true);
      socket.emit('staffJoinMatch', { matchId, staffName: myName });
    } else if (!isSpectator) {
      sessionStorage.setItem('currentMatch', JSON.stringify({ matchId, self, opponent }));
      socket.emit('joinMatch', { matchId, playerName: myName });
    } else {
      socket.emit('joinMatch', { matchId, playerName: (currentUser?.discordName || 'Spectator') + ' (spectating)' });
    }

    const onReceiveMessage = (msg) => {
      setMessages((prev) => [...prev, msg]);
      setNewMsg(true);
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

    socket.on('receiveMessage', onReceiveMessage);
    socket.on('disputeOpened', onDisputeOpened);
    socket.on('staffNotified', onStaffNotified);
    socket.on('staffJoinedMatch', onStaffJoinedMatch);
    socket.on('matchCompleted', onMatchCompleted);
    socket.on('winSubmitted', onWinSubmitted);

    return () => {
      socket.off('receiveMessage', onReceiveMessage);
      socket.off('disputeOpened', onDisputeOpened);
      socket.off('staffNotified', onStaffNotified);
      socket.off('staffJoinedMatch', onStaffJoinedMatch);
      socket.off('matchCompleted', onMatchCompleted);
      socket.off('winSubmitted', onWinSubmitted);
    };
  }, [matchId, self, opponent, socket, navigate, myName, userRole, isStaff, isSpectator]);

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
    if (role === 'owner') return { label: 'OWNER', cls: 'bg-[rgba(255,79,216,0.15)] text-[var(--magenta)]' };
    if (role === 'admin') return { label: 'ADMIN', cls: 'bg-[rgba(46,242,255,0.12)] text-[var(--cyan)]' };
    if (role === 'staff') return { label: 'STAFF', cls: 'bg-[rgba(168,85,247,0.12)] text-[var(--purple)]' };
    if (role === 'content_creator') return { label: 'CREATOR', cls: 'bg-[rgba(249,115,22,0.12)] text-[var(--orange)]' };
    return null;
  };

  const PlayerProfileModal = ({ player, isSelf, onClose }) => {
    if (!player) return null;
    const stats = isSelf ? selfProfileStats : opponentProfileStats;
    const pts = stats?.rankingPoints ?? player.rankingPoints ?? 0;
    const rank = getRank(pts);
    const rankLabel = getRankLabel(pts);
    const avatar = isSelf ? selfAvatar : opponentAvatar;
    const name = stats?.discordName || (isSelf ? myName : opponentName);
    const wins = stats?.wins ?? 0;
    const losses = stats?.losses ?? 0;
    const totalMatches = stats?.totalMatches ?? 0;
    const winRate = totalMatches > 0 ? Number(((wins / totalMatches) * 100).toFixed(1)) : 0;

    return (
      <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[1000] backdrop-blur-sm animate-fade-in" onClick={onClose}>
        <div className="bg-[var(--bg-glass-strong)] backdrop-blur-2xl border border-[var(--border-glow)] rounded-[var(--radius-2xl)] p-8 max-w-[400px] w-[90%] shadow-[var(--shadow-xl)] animate-scale-in" onClick={(e) => e.stopPropagation()}>
          <div className="text-center mb-5">
            <div className="w-20 h-20 rounded-full overflow-hidden mx-auto mb-3 border-3 border-[var(--border-glow-strong)] shadow-[0_0_20px_var(--cyan-glow)]"><img src={avatar} alt={name} className="w-full h-full object-cover" /></div>
            <h3 className="font-display text-xl font-bold mb-0.5">{name}</h3>
            {(stats?.epicGamesName || player.epicName) && <p className="text-xs text-[var(--text-muted)] font-mono">{stats?.epicGamesName || player.epicName}</p>}
          </div>
          <div className="flex items-center justify-center gap-2 mb-4">
            <img src={rank.icon} alt={rankLabel} className="w-8 h-8" />
            <span className="text-lg font-bold" style={{ color: rank.color }}>{rankLabel}</span>
          </div>
          <div className="h-1.5 bg-[rgba(255,255,255,0.06)] rounded-sm overflow-hidden mb-5">
            <div className="h-full rounded-sm transition-all duration-500 ease" style={{ width: `${getRankProgress(pts)}%`, background: rank.color }} />
          </div>
          <div className="grid grid-cols-2 gap-2.5">
            <div className="p-3.5 bg-[rgba(0,0,0,0.2)] border border-[var(--border)] rounded-[var(--radius-md)] text-center"><strong className="block font-display text-xl font-bold text-[var(--cyan)]">{wins}</strong><span className="text-[0.7rem] text-[var(--text-muted)] uppercase tracking-wider">Wins</span></div>
            <div className="p-3.5 bg-[rgba(0,0,0,0.2)] border border-[var(--border)] rounded-[var(--radius-md)] text-center"><strong className="block font-display text-xl font-bold text-[var(--cyan)]">{losses}</strong><span className="text-[0.7rem] text-[var(--text-muted)] uppercase tracking-wider">Losses</span></div>
            <div className="p-3.5 bg-[rgba(0,0,0,0.2)] border border-[var(--border)] rounded-[var(--radius-md)] text-center"><strong className="block font-display text-xl font-bold text-[var(--cyan)]">{totalMatches}</strong><span className="text-[0.7rem] text-[var(--text-muted)] uppercase tracking-wider">Total</span></div>
            <div className="p-3.5 bg-[rgba(0,0,0,0.2)] border border-[var(--border)] rounded-[var(--radius-md)] text-center"><strong className="block font-display text-xl font-bold text-[var(--cyan)]">{winRate}%</strong><span className="text-[0.7rem] text-[var(--text-muted)] uppercase tracking-wider">Win Rate</span></div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="page-wrapper animate-fade-in-up">
      <div className="flex items-center justify-between mb-6 p-5 bg-[var(--bg-card)] border border-[var(--border-glow)] rounded-[var(--radius-xl)] shadow-[var(--shadow-cyan)]">
        <div>
          <h1 className="font-display text-xl font-extrabold bg-gradient-to-r from-[var(--cyan)] to-white bg-clip-text text-transparent">MATCH</h1>
          <div className="flex gap-2 mt-1.5">
            {matchMode && <span className="px-2.5 py-0.5 rounded-full text-[0.7rem] font-semibold uppercase tracking-wider bg-[rgba(46,242,255,0.1)] text-[var(--cyan)] border border-[rgba(46,242,255,0.15)]">{matchMode}</span>}
            {tournamentName && <span className="px-2.5 py-0.5 rounded-full text-[0.7rem] font-semibold uppercase tracking-wider bg-[rgba(168,85,247,0.1)] text-[var(--purple)] border border-[rgba(168,85,247,0.15)]">{tournamentName}</span>}
          </div>
        </div>
        <span className={`px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 ${disputed ? 'bg-[rgba(249,115,22,0.1)] text-[var(--orange)] border border-[rgba(249,115,22,0.2)]' : reported ? 'bg-[rgba(34,197,94,0.1)] text-[var(--green)] border border-[rgba(34,197,94,0.2)]' : 'bg-[rgba(46,242,255,0.1)] text-[var(--cyan)] border border-[rgba(46,242,255,0.2)] animate-glow-pulse'}`}>
          <i className={`fas ${disputed ? 'fa-gavel' : reported ? 'fa-check-circle' : 'fa-circle'}`}></i>
          {disputed ? ' Disputed' : reported ? ' Reported' : isSpectator ? ' LIVE' : ' LIVE'}
          {isSpectator && <span className="ml-1.5 opacity-60 font-normal">· Spectator</span>}
        </span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_auto_1fr] gap-5 mb-6 items-center">
        <div className="relative p-6 bg-[var(--bg-card)] border border-[var(--border)] rounded-[var(--radius-xl)] text-center cursor-pointer transition-all duration-base hover:border-[var(--border-glow)] hover:shadow-[var(--shadow-cyan)] hover:-translate-y-0.5 overflow-hidden" onClick={() => setShowProfile('self')}>
          <div className="absolute inset-0 opacity-30 pointer-events-none" style={{ background: 'linear-gradient(135deg, rgba(46,242,255,0.04), transparent)' }} />
          <div className="w-20 h-20 rounded-full overflow-hidden mx-auto mb-3 relative border-3 border-[var(--border-glow)] shadow-[0_0_25px_var(--cyan-glow)]">
            <img src={selfAvatar} alt={myName} className="w-full h-full object-cover" />
          </div>
          <div className="font-display text-lg font-bold mb-0.5">{myName}</div>
          {self?.epicName && <div className="text-xs text-[var(--text-muted)] font-mono mb-2">{self.epicName}</div>}
          <div className="flex items-center justify-center gap-1.5 text-sm font-semibold" style={{ color: myRank.color }}>
            <img src={myRank.icon} alt="" className="rank-icon-img" /> {getRankLabel(myPoints)}
          </div>
          <div className="absolute top-3 right-3 px-2.5 py-0.5 rounded-full text-[0.65rem] font-bold uppercase tracking-wider bg-[rgba(46,242,255,0.1)] text-[var(--cyan)] border border-[rgba(46,242,255,0.15)]">YOU</div>
        </div>

        <div className="flex flex-col items-center gap-3">
          <div className="font-display text-[1.8rem] font-black text-[var(--cyan)] animate-countGlow" style={{ textShadow: '0 0 30px var(--cyan-glow)' }}>VS</div>
          {mapCode && (
            <div className="flex items-center gap-2 px-4 py-2 bg-[rgba(0,0,0,0.3)] border border-[var(--border-glow)] rounded-[var(--radius-md)] cursor-pointer transition-all duration-base hover:bg-[rgba(46,242,255,0.05)] hover:border-[var(--border-glow-strong)]" onClick={handleCopyMapCode} title="Click to copy">
              <i className="fas fa-map-pin text-[var(--text-muted)] text-xs"></i>
              <code className="font-mono text-[var(--cyan)] text-sm font-semibold">{mapCode}</code>
              <i className="fas fa-copy text-[var(--text-muted)] text-xs"></i>
            </div>
          )}
        </div>

        <div className="relative p-6 bg-[var(--bg-card)] border border-[var(--border)] rounded-[var(--radius-xl)] text-center cursor-pointer transition-all duration-base hover:border-[var(--border-glow)] hover:shadow-[var(--shadow-cyan)] hover:-translate-y-0.5 overflow-hidden" onClick={() => setShowProfile('opponent')}>
          <div className="absolute inset-0 opacity-30 pointer-events-none" style={{ background: 'linear-gradient(135deg, rgba(168,85,247,0.04), transparent)' }} />
          <div className="w-20 h-20 rounded-full overflow-hidden mx-auto mb-3 relative border-3 border-[var(--border-purple)] shadow-[0_0_25px_var(--purple-glow)]">
            <img src={opponentAvatar} alt={opponentName} className="w-full h-full object-cover" />
          </div>
          <div className="font-display text-lg font-bold mb-0.5">{opponentName}</div>
          {opponent?.epicName && <div className="text-xs text-[var(--text-muted)] font-mono mb-2">{opponent.epicName}</div>}
          <div className="flex items-center justify-center gap-1.5 text-sm font-semibold" style={{ color: opponentRank.color }}>
            <img src={opponentRank.icon} alt="" className="rank-icon-img" /> {getRankLabel(opponentPoints)}
          </div>
          <div className="absolute top-3 right-3 px-2.5 py-0.5 rounded-full text-[0.65rem] font-bold uppercase tracking-wider bg-[rgba(168,85,247,0.1)] text-[var(--purple)] border border-[rgba(168,85,247,0.15)]">OPPONENT</div>
        </div>
      </div>

      <div className="flex items-center justify-between flex-wrap gap-3 p-3.5 px-5 bg-[var(--bg-card)] border border-[var(--border)] rounded-[var(--radius-lg)] mb-6">
        <div className="flex gap-2 flex-wrap">
          {mapCode && <span className="flex items-center gap-1.5 px-3 py-1.5 bg-[rgba(0,0,0,0.2)] border border-[var(--border)] rounded-full text-xs text-[var(--text-muted)]"><i className="fas fa-map-pin text-[var(--cyan)] text-[0.7rem]"></i> {mapCode}</span>}
        </div>
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1.5 text-xs text-[var(--text-muted)] transition-colors duration-fast text-[var(--green)]"><i className="fas fa-check-circle text-xs"></i> Ready</span>
          <span className="flex items-center gap-1.5 text-xs text-[var(--text-muted)] transition-colors duration-fast text-[var(--cyan)]"><i className="fas fa-play-circle text-xs"></i> Live</span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-5">
        <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-[var(--radius-xl)] overflow-hidden flex flex-col min-h-[400px]">
          <div className="flex items-center justify-between px-5 py-3.5 border-b border-[var(--border)] cursor-pointer" onClick={() => setChatOpen(!chatOpen)}>
            <div className="flex items-center gap-2.5 font-display text-sm font-semibold text-[var(--text-secondary)] uppercase tracking-wider">
              <i className="fas fa-comments"></i> Match Chat
              {messages.length > 0 && <span className="px-2 py-px bg-[rgba(46,242,255,0.1)] rounded-full text-[0.7rem] text-[var(--cyan)]">{messages.length}</span>}
            </div>
            <i className={`fas fa-chevron-${chatOpen ? 'down' : 'up'}`}></i>
          </div>
          {chatOpen && (
            <>
              <div className="flex-1 p-4 px-5 overflow-y-auto max-h-[400px] flex flex-col gap-2 relative" ref={chatRef} onScroll={handleChatScroll}>
                {newMsg && !chatAtBottom && (
                  <button onClick={scrollToBottom} className="sticky bottom-2 self-center px-4 py-2 bg-[var(--bg-glass-strong)] backdrop-blur-xl border border-[var(--border-glow)] rounded-full text-[var(--cyan)] text-xs font-semibold cursor-pointer z-[5] shadow-[var(--shadow-md)] transition-all duration-fast hover:bg-[rgba(46,242,255,0.1)] hover:border-[var(--border-glow-strong)] hover:-translate-y-px animate-fade-in-up flex items-center gap-1.5">
                    <i className="fas fa-arrow-down"></i> New messages
                  </button>
                )}
                {messages.length === 0 && <div className="text-center py-10 text-[var(--text-muted)] text-sm">No messages yet. Say something!</div>}
                {messages.map((msg, index) => {
                  const badge = !msg.isSystem ? getRoleBadge(msg.role) : null;
                  return (
                    <div key={index} className={`p-2.5 px-3.5 border rounded-[var(--radius-md)] animate-fade-in-up ${msg.isSystem ? 'bg-[rgba(46,242,255,0.03)] border-[rgba(46,242,255,0.08)]' : 'bg-[rgba(255,255,255,0.02)] border-[var(--border)]'}`}>
                      <div className="flex items-center justify-between mb-1">
                        <span className={`text-sm font-semibold flex items-center gap-1.5 ${msg.isSystem ? 'text-[var(--text-muted)] italic' : 'text-[var(--cyan)]'}`}>
                          {msg.isSystem ? 'System' : msg.sender}
                          {badge && <span className={`px-1 py-px rounded text-[0.6rem] font-bold uppercase tracking-wider ${badge.cls}`}>{badge.label}</span>}
                        </span>
                        <span className="text-[0.7rem] text-[var(--text-dim)]">{formatTime(msg.time)}</span>
                      </div>
                      <div className={`text-sm ${msg.isSystem ? 'text-[var(--text-muted)] text-xs' : 'text-[var(--text-secondary)]'} break-words`}>{msg.message}</div>
                    </div>
                  );
                })}
              </div>
              <div className="flex gap-2 p-3 px-4 border-t border-[var(--border)]">
                <input
                  className="flex-1 p-2.5 px-3.5 bg-[rgba(0,0,0,0.3)] border border-[var(--border)] rounded-[var(--radius-md)] text-[var(--text)] text-sm outline-none transition-colors duration-fast focus:border-[var(--border-glow-strong)] disabled:opacity-50"
                  type="text"
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                  placeholder={isSpectator ? "Spectator mode - chat disabled" : "Type a message..."}
                  disabled={disputed || isSpectator}
                />
                <button className="px-5 py-2.5 bg-gradient-to-r from-[var(--cyan)] to-[var(--electric-blue)] border-none rounded-[var(--radius-md)] text-black font-bold text-sm cursor-pointer transition-all duration-base whitespace-nowrap hover:shadow-[0_0_20px_rgba(46,242,255,0.3)] hover:-translate-y-px disabled:opacity-40 disabled:cursor-not-allowed" onClick={handleSendMessage} disabled={!newMessage.trim() || disputed || isSpectator}>
                  Send
                </button>
              </div>
            </>
          )}
        </div>

        <div className="flex flex-col gap-4">
          <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-[var(--radius-lg)] overflow-hidden transition-all duration-base hover:border-[var(--border-glow)]">
            <div className="px-4 py-3 font-display text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)] border-b border-[var(--border)] flex items-center gap-2"><i className="fas fa-trophy"></i> Report Result</div>
            <div className="p-4">
              {isSpectator ? (
                <div className="text-center p-4">
                  <i className="fas fa-eye text-[var(--text-muted)] opacity-50 text-2xl mb-2 block"></i>
                  <p className="text-[var(--text-muted)] text-sm">You are spectating this match.</p>
                </div>
              ) : !reported && !disputed ? (
                <div className="flex flex-col gap-2">
                  <button disabled={reporting} onClick={() => handleReportResult(self?.id || currentUserId)} className="flex items-center justify-center gap-2 p-3 border border-[var(--border)] rounded-[var(--radius-md)] bg-[rgba(0,0,0,0.2)] text-[var(--text)] text-sm font-semibold cursor-pointer transition-all duration-base hover:-translate-y-px disabled:opacity-50 disabled:cursor-not-allowed border-[rgba(34,197,94,0.2)] text-[var(--green)] hover:bg-[rgba(34,197,94,0.08)] hover:shadow-[0_0_15px_rgba(34,197,94,0.15)]">
                    <i className="fas fa-check-circle"></i> I Won
                  </button>
                  <button disabled={reporting} onClick={() => handleReportResult(opponent?.id)} className="flex items-center justify-center gap-2 p-3 border border-[var(--border)] rounded-[var(--radius-md)] bg-[rgba(0,0,0,0.2)] text-[var(--text)] text-sm font-semibold cursor-pointer transition-all duration-base hover:-translate-y-px disabled:opacity-50 disabled:cursor-not-allowed border-[rgba(239,68,68,0.15)] text-[var(--red)] hover:bg-[rgba(239,68,68,0.08)]">
                    <i className="fas fa-times-circle"></i> I Lost
                  </button>
                  <button disabled={reporting || staffNotified} onClick={handleCallStaff} className="flex items-center justify-center gap-2 p-3 border border-[var(--border)] rounded-[var(--radius-md)] bg-[rgba(0,0,0,0.2)] text-[var(--text)] text-sm font-semibold cursor-pointer transition-all duration-base hover:-translate-y-px disabled:opacity-50 disabled:cursor-not-allowed border-[rgba(168,85,247,0.15)] text-[var(--purple)] hover:bg-[rgba(168,85,247,0.08)]">
                    <i className="fas fa-headset"></i> Call Staff
                  </button>
                </div>
              ) : disputed ? (
                <div className="text-center p-4">
                  <i className="fas fa-gavel text-[var(--red)] text-2xl mb-2 block"></i>
                  <p className="text-sm text-[var(--text-muted)]">Match disputed. Staff will review.</p>
                  {isStaff && (
                    <div className="flex flex-col gap-2 mt-3">
                      <div className="text-xs text-[var(--text-muted)] mb-2">Force a win:</div>
                      <button disabled={staffForcing} onClick={() => handleForceWin(self?.id || currentUserId, myName)} className="flex items-center justify-center gap-2 p-3 border border-[var(--border)] rounded-[var(--radius-md)] bg-[rgba(0,0,0,0.2)] text-[var(--text)] text-sm font-semibold cursor-pointer transition-all duration-base hover:-translate-y-px disabled:opacity-50 disabled:cursor-not-allowed border-[rgba(34,197,94,0.2)] text-[var(--green)] hover:bg-[rgba(34,197,94,0.08)] hover:shadow-[0_0_15px_rgba(34,197,94,0.15)]">
                        Force: {myName}
                      </button>
                      <button disabled={staffForcing} onClick={() => handleForceWin(opponent?.id, opponentName)} className="flex items-center justify-center gap-2 p-3 border border-[var(--border)] rounded-[var(--radius-md)] bg-[rgba(0,0,0,0.2)] text-[var(--text)] text-sm font-semibold cursor-pointer transition-all duration-base hover:-translate-y-px disabled:opacity-50 disabled:cursor-not-allowed border-[rgba(239,68,68,0.15)] text-[var(--red)] hover:bg-[rgba(239,68,68,0.08)]">
                        Force: {opponentName}
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center p-4">
                  <i className="fas fa-check-circle text-[var(--green)] text-2xl mb-2 block"></i>
                  <p className="text-sm text-[var(--text-muted)]">{resultMessage || 'Result submitted. Waiting...'}</p>
                  {countdown !== null && countdown > 0 && (
                    <div className="flex items-center justify-center gap-2 mt-3 px-3.5 py-2 bg-[rgba(249,115,22,0.08)] border border-[rgba(249,115,22,0.15)] rounded-[var(--radius-md)] text-xs text-[var(--orange)] font-mono">
                      <i className="fas fa-hourglass-half"></i>
                      Auto in {Math.floor(countdown / 60)}:{String(countdown % 60).padStart(2, '0')}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {isStaff && !isSpectator && !disputed && !reported && (
            <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-[var(--radius-lg)] overflow-hidden transition-all duration-base hover:border-[var(--border-glow)]">
              <div className="px-4 py-3 font-display text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)] border-b border-[var(--border)] flex items-center gap-2"><i className="fas fa-gavel"></i> Staff Tools</div>
              <div className="p-4">
                <p className="text-xs text-[var(--text-muted)] mb-2">Force a win:</p>
                <div className="flex flex-col gap-2">
                  <button disabled={staffForcing} onClick={() => handleForceWin(self?.id || currentUserId, myName)} className="flex items-center justify-center gap-2 p-3 border border-[var(--border)] rounded-[var(--radius-md)] bg-[rgba(0,0,0,0.2)] text-[var(--text)] text-sm font-semibold cursor-pointer transition-all duration-base hover:-translate-y-px disabled:opacity-50 disabled:cursor-not-allowed border-[rgba(34,197,94,0.2)] text-[var(--green)] hover:bg-[rgba(34,197,94,0.08)] hover:shadow-[0_0_15px_rgba(34,197,94,0.15)]">
                    Win: {myName}
                  </button>
                  <button disabled={staffForcing} onClick={() => handleForceWin(opponent?.id, opponentName)} className="flex items-center justify-center gap-2 p-3 border border-[var(--border)] rounded-[var(--radius-md)] bg-[rgba(0,0,0,0.2)] text-[var(--text)] text-sm font-semibold cursor-pointer transition-all duration-base hover:-translate-y-px disabled:opacity-50 disabled:cursor-not-allowed border-[rgba(239,68,68,0.15)] text-[var(--red)] hover:bg-[rgba(239,68,68,0.08)]">
                    Win: {opponentName}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {showProfile && (
        <PlayerProfileModal
          player={showProfile === 'self' ? (self || currentUser) : opponent}
          isSelf={showProfile === 'self'}
          onClose={() => setShowProfile(null)}
        />
      )}
    </div>
  );
};

export default MatchPage;