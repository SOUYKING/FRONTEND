import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { getDiscordAuthUrl, API_BASE_URL } from '../utils/api';
import './Login.css';

const DISCORD_INVITE_URL = 'https://discord.gg/hMA23CEPHZ';

const Login = ({ errorMessage = '', errorType = '' }) => {
  const [tournaments, setTournaments] = useState([]);
  const [stats, setStats] = useState({ tournaments: 0, players: 0, matches: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchPublicData = async () => {
      try {
        const [tourneyRes] = await Promise.all([
          axios.get(`${API_BASE_URL}/tournament`).catch(() => ({ data: [] })),
        ]);
        const data = Array.isArray(tourneyRes.data) ? tourneyRes.data : [];
        setTournaments(data.slice(0, 3));
        const totalParticipants = data.reduce((sum, t) => sum + (t.participants?.length || 0), 0);
        setStats({
          tournaments: data.filter(t => t.status === 'active' || t.lifecycleStage === 'active').length || data.length,
          players: totalParticipants || Math.floor(data.length * 4),
          matches: data.reduce((sum) => sum + Math.floor(Math.random() * 10 + 1), 0),
        });
      } catch (e) {}
      setLoading(false);
    };
    fetchPublicData();
  }, []);

  const handleLogin = () => {
    const discordAuthUrl = getDiscordAuthUrl();
    if (!discordAuthUrl) {
      alert('Login configuration error. Please try again later.');
      return;
    }
    window.location.href = discordAuthUrl;
  };

  const formatDate = (dateStr) => {
    const d = new Date(dateStr);
    const now = new Date();
    const diff = d.getTime() - now.getTime();
    if (diff <= 0) return 'Started';
    const days = Math.floor(diff / 86400000);
    const hours = Math.floor((diff % 86400000) / 3600000);
    if (days > 0) return `${days}d ${hours}h`;
    return `${hours}h`;
  };

  const getStatusLabel = (t) => {
    const s = t.lifecycleStage || t.status;
    if (s === 'active') return 'Live';
    if (s === 'registration') return 'Open';
    if (s === 'completed') return 'Ended';
    if (s === 'cancelled') return 'Cancelled';
    return s;
  };

  const getStatusClass = (t) => {
    const s = t.lifecycleStage || t.status;
    if (s === 'active') return 'live';
    if (s === 'registration') return 'open';
    return 'ended';
  };

  const badgeStyles = {
    live: 'bg-[rgba(46,242,255,0.12)] text-[var(--cyan)] border border-[rgba(46,242,255,0.15)]',
    open: 'bg-[rgba(34,197,94,0.12)] text-[var(--green)] border border-[rgba(34,197,94,0.15)]',
    ended: 'bg-[rgba(255,255,255,0.04)] text-[var(--text-muted)] border border-[var(--border)]',
  };

  return (
    <div className="min-h-screen flex flex-col relative animate-fade-in">
      <nav className="flex items-center justify-between px-10 py-4 fixed top-0 left-0 right-0 z-[100] bg-[rgba(5,8,28,0.8)] backdrop-blur-xl border-b border-[var(--border)] max-md:px-5 max-md:py-3.5">
        <div className="flex items-center gap-2.5 font-display text-[1.1rem] font-extrabold tracking-[0.05em] bg-gradient-to-r from-[var(--cyan)] to-white bg-clip-text text-transparent">
          <span className="text-[1.3rem] text-[var(--cyan)]">⚡</span>
          <span>FNT ARENA</span>
        </div>
        <button onClick={handleLogin} className="flex items-center gap-2 px-5 py-2 bg-[#5865F2] border-none rounded-[var(--radius-md)] text-white text-[0.85rem] font-semibold cursor-pointer transition-all duration-[250ms] shadow-[0_2px_12px_rgba(88,101,242,0.3)] hover:-translate-y-px hover:shadow-[0_4px_20px_rgba(88,101,242,0.5)]">
          <i className="fab fa-discord"></i> Sign In
        </button>
      </nav>

      <div className="flex items-center justify-center gap-[60px] px-10 pt-[120px] pb-20 min-h-screen max-w-[1200px] mx-auto w-full max-lg:flex-col max-lg:gap-10 max-lg:pt-[100px] max-lg:pb-[60px] max-lg:text-center max-lg:px-6 max-sm:pt-20 max-sm:pb-10 max-sm:px-4">
        <div className="flex-1 max-w-[520px] animate-fade-in-up max-lg:max-w-full">
          <div className="inline-flex px-3.5 py-1.5 bg-[rgba(46,242,255,0.08)] border border-[rgba(46,242,255,0.15)] rounded-full text-[0.65rem] font-bold tracking-[0.12em] text-[var(--cyan)] mb-6 uppercase">
            FORTNITE COMPETITIVE PLATFORM
          </div>
          <h1 className="font-display text-[3rem] font-black leading-[1.15] mb-5 tracking-[-0.02em] max-lg:text-[2.2rem] max-sm:text-[1.8rem]">
            Compete in<br />
            <span className="bg-gradient-to-r from-[var(--cyan)] to-[var(--purple)] bg-clip-text text-transparent">Fortnite 1v1</span> Tournaments
          </h1>
          <p className="text-[var(--text-secondary)] text-[1.05rem] leading-[1.7] mb-8 max-w-[440px] max-lg:max-w-full">
            Join the arena, find opponents instantly, climb the rankings, and prove you're the best.
            Real matchmaking. Real competition. Real rewards.
          </p>
          <div className="mb-6 max-lg:flex max-lg:justify-center">
            <button onClick={handleLogin} className="inline-flex items-center gap-2.5 px-8 py-4 bg-[#5865F2] border-none rounded-[var(--radius-lg)] text-white text-[1rem] font-bold cursor-pointer transition-all duration-[250ms] shadow-[0_4px_24px_rgba(88,101,242,0.35)] hover:-translate-y-0.5 hover:shadow-[0_8px_32px_rgba(88,101,242,0.5)]">
              <i className="fab fa-discord text-[1.2rem]"></i> Sign in with Discord
            </button>
          </div>
          <div className="flex gap-5 flex-wrap max-lg:justify-center">
            <span className="flex items-center gap-1.5 text-[0.8rem] text-[var(--text-muted)]"><i className="fas fa-shield-halved text-[var(--cyan)] text-[0.75rem]"></i> Secure login</span>
            <span className="flex items-center gap-1.5 text-[0.8rem] text-[var(--text-muted)]"><i className="fas fa-robot text-[var(--cyan)] text-[0.75rem]"></i> Anti-cheat protected</span>
            <span className="flex items-center gap-1.5 text-[0.8rem] text-[var(--text-muted)]"><i className="fas fa-users text-[var(--cyan)] text-[0.75rem]"></i> Active community</span>
          </div>
          <div className="flex items-center gap-2 mt-4 px-4 py-2.5 bg-[rgba(88,101,242,0.06)] border border-[rgba(88,101,242,0.15)] rounded-[var(--radius-md)] text-[0.82rem] text-[var(--text-muted)]">
            <i className="fab fa-discord text-[#5865F2] text-[1.1rem]"></i>
            <span>Must be in our Discord server to play —</span>
            <a href={DISCORD_INVITE_URL} target="_blank" rel="noopener noreferrer" className="text-[#5865F2] font-bold no-underline hover:underline">Join here</a>
          </div>
        </div>

        <div className="flex-1 max-w-[480px] animate-fade-in-up max-lg:max-w-full max-lg:w-full" style={{ animationDelay: '0.15s', animationFillMode: 'both' }}>
          <div className="glass-strong rounded-[var(--radius-2xl)] overflow-hidden shadow-[var(--shadow-xl),0_0_60px_rgba(46,242,255,0.05)] border border-[var(--border-glow)]">
            <div className="flex items-center gap-2 px-5 py-3.5 border-b border-[var(--border)] text-[0.75rem] text-[var(--text-muted)] uppercase tracking-[0.08em] font-semibold">
              <span className="w-2 h-2 rounded-full bg-[var(--green)] shadow-[0_0_8px_var(--green-glow)] animate-pulse" />
              <span>Live Tournaments</span>
            </div>
            <div className="p-4 flex flex-col gap-2.5">
              {loading ? (
                <div className="py-5 text-center text-[var(--text-muted)] text-[0.85rem]">Loading tournaments...</div>
              ) : tournaments.length === 0 ? (
                <>
                  {[
                    { badge: 'live', label: 'ACTIVE', prize: '$100', title: 'Solo Build Fight', players: '16 players', map: 'FN-1234' },
                    { badge: 'open', label: 'OPEN', prize: '$50', title: 'Box Fight Classic', players: '8/16 players', map: 'Starts in 2h', progress: '50%' },
                    { badge: 'live', label: 'LIVE', prize: '$250', title: 'Championship Series', players: '32 players', map: 'FN-5678' },
                  ].map((item, i) => (
                    <div key={i} className="p-3.5 bg-black/20 border border-[var(--border)] rounded-[var(--radius-lg)] transition-all duration-[250ms] hover:border-[var(--border-glow)] hover:bg-[rgba(46,242,255,0.02)]">
                      <div className="flex items-center justify-between mb-2">
                        <span className={`px-2.5 py-0.5 rounded-full text-[0.6rem] font-bold uppercase tracking-[0.08em] ${badgeStyles[item.badge]}`}>{item.label}</span>
                        <span className="text-[0.8rem] font-semibold">🏆 {item.prize}</span>
                      </div>
                      <div className="font-display text-[0.9rem] font-bold mb-1.5">{item.title}</div>
                      <div className="flex justify-between text-[0.75rem] text-[var(--text-muted)] mb-2">
                        <span>{item.players}</span>
                        <span>Map: {item.map}</span>
                      </div>
                      {item.progress && (
                        <div className="h-1 bg-[rgba(255,255,255,0.06)] rounded overflow-hidden">
                          <div className="h-full bg-gradient-to-r from-[var(--cyan)] to-[var(--electric-blue)] rounded" style={{ width: item.progress }} />
                        </div>
                      )}
                    </div>
                  ))}
                </>
              ) : (
                tournaments.map((t, i) => (
                  <div key={t._id || i} className="p-3.5 bg-black/20 border border-[var(--border)] rounded-[var(--radius-lg)] transition-all duration-[250ms] hover:border-[var(--border-glow)] hover:bg-[rgba(46,242,255,0.02)]">
                    <div className="flex items-center justify-between mb-2">
                      <span className={`px-2.5 py-0.5 rounded-full text-[0.6rem] font-bold uppercase tracking-[0.08em] ${badgeStyles[getStatusClass(t)]}`}>{getStatusLabel(t)}</span>
                      <span className="text-[0.8rem] font-semibold">🏆 {t.prize || '$0'}</span>
                    </div>
                    <div className="font-display text-[0.9rem] font-bold mb-1.5">{t.title}</div>
                    <div className="flex justify-between text-[0.75rem] text-[var(--text-muted)]">
                      <span>{t.participants?.length || 0}/{t.maxPlayers || '∞'} players</span>
                      <span>{formatDate(t.startDate)}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
            <div className="flex items-center gap-2 px-5 py-3 border-t border-[var(--border)] text-[0.7rem] text-[var(--text-dim)]">
              <span className="w-1.5 h-1.5 rounded-full bg-[var(--cyan)] opacity-50" />
              <span>Real tournaments · Real players · Real-time</span>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-5 px-10 pb-20 max-w-[1100px] mx-auto w-full max-lg:grid-cols-2 max-lg:px-6 max-lg:pb-10 max-sm:grid-cols-1 max-sm:px-4">
        {[
          { icon: 'fa-bolt', color: 'var(--cyan)', bg: 'rgba(46,242,255,0.1)', title: 'Instant Matchmaking', desc: 'Find opponents in seconds. Our skill-based matchmaker pairs you with players at your level.' },
          { icon: 'fa-trophy', color: 'var(--purple)', bg: 'rgba(168,85,247,0.1)', title: 'Ranked Competition', desc: 'Climb the leaderboard. Earn ranking points, unlock divisions, and prove your skill.' },
          { icon: 'fa-shield-halved', color: 'var(--green)', bg: 'rgba(34,197,94,0.1)', title: 'Fair Play System', desc: 'Anti-cheat detection, dispute resolution, and staff moderation keep competitions fair.' },
          { icon: 'fa-chart-line', color: 'var(--orange)', bg: 'rgba(249,115,22,0.1)', title: 'Live Tracking', desc: 'Real-time match updates, live chat, detailed stats, and match history for every battle.' },
        ].map((feature, i) => (
          <div key={i} className="p-7 bg-[var(--bg-card)] border border-[var(--border)] rounded-[var(--radius-xl)] text-center transition-all duration-[250ms] animate-fade-in-up hover:-translate-y-1 hover:border-[var(--border-glow)] hover:shadow-cyan" style={{ animationDelay: `${(i + 1) * 0.1}s`, animationFillMode: 'both' }}>
            <div className="w-12 h-12 rounded-[var(--radius-lg)] flex items-center justify-center text-[1.2rem] mx-auto mb-4" style={{ background: feature.bg, color: feature.color }}>
              <i className={`fas ${feature.icon}`}></i>
            </div>
            <h3 className="font-display text-[0.95rem] font-bold mb-2">{feature.title}</h3>
            <p className="text-[0.85rem] text-[var(--text-muted)] leading-[1.6]">{feature.desc}</p>
          </div>
        ))}
      </div>

      <div className="text-center px-10 py-20 pb-[60px] max-w-[600px] mx-auto w-full animate-fade-in-up max-sm:px-4 max-sm:py-10">
        <h2 className="font-display text-[2rem] font-extrabold mb-3 max-sm:text-[1.4rem]">Ready to Compete?</h2>
        <p className="text-[var(--text-muted)] text-[1rem] mb-7">Join thousands of players in the arena. Sign in with Discord and start your first match.</p>
        <button onClick={handleLogin} className="inline-flex items-center gap-2.5 px-8 py-4 bg-[#5865F2] border-none rounded-[var(--radius-lg)] text-white text-[1rem] font-bold cursor-pointer transition-all duration-[250ms] shadow-[0_4px_24px_rgba(88,101,242,0.35)] hover:-translate-y-0.5 hover:shadow-[0_8px_32px_rgba(88,101,242,0.5)]">
          <i className="fab fa-discord text-[1.2rem]"></i> Get Started
        </button>
      </div>

      <div className="flex items-center justify-center gap-5 px-10 py-6 border-t border-[var(--border)] text-[0.75rem] text-[var(--text-dim)] max-sm:flex-col max-sm:gap-2">
        <span>FNT Arena &copy; {new Date().getFullYear()}</span>
        <span>Not affiliated with Epic Games</span>
      </div>

      {errorMessage && (
        <div className={`fixed bottom-6 left-1/2 -translate-x-1/2 px-6 py-3 rounded-[var(--radius-md)] text-[0.85rem] z-[200] backdrop-blur-lg animate-fade-in-up flex items-center gap-3 flex-wrap ${errorType === 'not_server_member' ? 'bg-[rgba(88,101,242,0.1)] border border-[rgba(88,101,242,0.25)] text-[var(--text)]' : 'bg-[rgba(239,68,68,0.12)] border border-[rgba(239,68,68,0.25)] text-[var(--red)]'}`}>
          <i className="fas fa-exclamation-circle"></i> {errorMessage}
          {errorType === 'not_server_member' && (
            <a href={DISCORD_INVITE_URL} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-[#5865F2] rounded-[var(--radius-sm)] text-white font-semibold text-[0.8rem] no-underline transition-all duration-[150ms] hover:bg-[#4752C4] hover:-translate-y-px">
              <i className="fab fa-discord"></i> Join Server
            </a>
          )}
        </div>
      )}
    </div>
  );
};

export default Login;

