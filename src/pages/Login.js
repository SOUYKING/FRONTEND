import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { getDiscordAuthUrl, API_BASE_URL } from '../utils/api';
import { DiscordButton, GlassCard } from '../components/ui';
import logo from '../assets/logo.png';

const DISCORD_INVITE = 'https://discord.gg/hMA23CEPHZ';

const Login = ({ errorMessage = '', errorType = '' }) => {
  const [tournaments, setTournaments] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    axios.get(`${API_BASE_URL}/tournament`).then(r => {
      setTournaments(Array.isArray(r.data) ? r.data.slice(0, 3) : []);
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const handleLogin = () => { const url = getDiscordAuthUrl(); if (url) window.location.href = url; };

  const fmtDate = (s) => {
    const d = new Date(s); const diff = d.getTime() - Date.now();
    if (diff <= 0) return 'Started';
    const h = Math.floor(diff / 3600000);
    const m = Math.floor((diff % 3600000) / 60000);
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
  };

  const stageClass = (t) => {
    const s = t.lifecycleStage || t.status;
    return s === 'active' ? { label: 'LIVE', cls: 'text-[#2EF2FF] bg-[rgba(46,242,255,0.1)] border-[rgba(46,242,255,0.15)]' }
      : s === 'registration' ? { label: 'OPEN', cls: 'text-[#22C55E] bg-[rgba(34,197,94,0.1)] border-[rgba(34,197,94,0.15)]' }
      : { label: s?.toUpperCase() || 'ENDED', cls: 'text-white/45 bg-white/5 border-white/10' };
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-5 relative bg-[#0a0a0a]">
      <div className="w-full max-w-md">
        <GlassCard className="p-8 sm:p-10 animate-fade-in-up">
          <div className="flex items-center gap-3 mb-5">
            <img src={logo} alt="" className="w-11 h-11 rounded-xl drop-shadow-[0_0_12px_rgba(46,242,255,0.2)]" />
            <div>
              <h1 className="font-display text-xl font-extrabold tracking-wide text-gradient">FNT Arena</h1>
              <p className="text-xs text-white/45 uppercase tracking-widest mt-0.5">Compete. Dominate. Rise.</p>
            </div>
          </div>

          <p className="text-white/75 text-sm leading-relaxed mb-6">
            Fortnite 1v1 tournament platform with live matchmaking, rankings, and anti-cheat protection.
          </p>

          <DiscordButton onClick={handleLogin} className="w-full">
            <i className="fab fa-discord text-lg"></i> Sign in with Discord
          </DiscordButton>

          {errorMessage && (
            <div className={`mt-3 flex items-center gap-2 flex-wrap p-3 rounded-xl text-sm animate-fade-in ${errorType === 'not_server_member' ? 'bg-[rgba(88,101,242,0.08)] border border-[rgba(88,101,242,0.2)]' : 'bg-[rgba(239,68,68,0.08)] border border-[rgba(239,68,68,0.2)] text-red-500'}`}>
              <i className="fas fa-exclamation-circle"></i>
              <span className="flex-1">{errorMessage}</span>
              {errorType === 'not_server_member' && (
                <a href={DISCORD_INVITE} target="_blank" rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#5865F2] text-white text-xs font-semibold hover:bg-[#4752C4] transition-colors">
                  <i className="fab fa-discord"></i> Join Server
                </a>
              )}
            </div>
          )}

          <div className="flex items-center gap-3 my-5">
            <div className="flex-1 h-px bg-white/10" />
            <span className="text-[0.65rem] text-white/30 uppercase tracking-widest font-semibold">Live Tournaments</span>
            <div className="flex-1 h-px bg-white/10" />
          </div>

          <div className="flex flex-col gap-2">
            {loading ? (
              <div className="h-20 bg-gradient-to-r from-white/[0.02] via-white/[0.05] to-white/[0.02] bg-[length:200%_100%] animate-shimmer rounded-xl" />
            ) : tournaments.length === 0 ? (
              <>
                <TournamentCard label="LIVE" cls="text-[#2EF2FF] bg-[rgba(46,242,255,0.1)] border-[rgba(46,242,255,0.15)]"
                  title="Solo Build Fight" meta="16 players · Map: FN-1234" prize="$100" />
                <TournamentCard label="OPEN" cls="text-[#22C55E] bg-[rgba(34,197,94,0.1)] border-[rgba(34,197,94,0.15)]"
                  title="Box Fight Classic" meta="8/16 players · Starts in 2h" prize="$50" progress={50} />
                <TournamentCard label="LIVE" cls="text-[#2EF2FF] bg-[rgba(46,242,255,0.1)] border-[rgba(46,242,255,0.15)]"
                  title="Championship Series" meta="32 players · Map: FN-5678" prize="$250" />
              </>
            ) : tournaments.map((t, i) => {
              const s = stageClass(t);
              return <TournamentCard key={t._id || i} label={s.label} cls={s.cls}
                title={t.title} meta={`${t.participants?.length || 0}/${t.maxPlayers || '∞'} · ${fmtDate(t.startDate)}`}
                prize={t.prize || '$0'} />;
            })}
          </div>

          <p className="text-center text-[0.65rem] text-white/20 mt-5 pt-4 border-t border-white/10">
            Not affiliated with Epic Games &middot; &copy; {new Date().getFullYear()}
          </p>
        </GlassCard>
      </div>
    </div>
  );
};

const TournamentCard = ({ label, cls, title, meta, prize, progress }) => (
  <div className="p-3 rounded-xl bg-black/20 border border-white/10 hover:border-[rgba(46,242,255,0.15)] transition-colors">
    <div className="flex items-center justify-between mb-1.5">
      <span className={`px-2 py-0.5 rounded-full text-[0.55rem] font-bold uppercase tracking-wider border ${cls}`}>{label}</span>
      <span className="text-xs font-semibold text-white/75">{prize}</span>
    </div>
    <p className="font-display text-sm font-semibold mb-1">{title}</p>
    <p className="text-[0.7rem] text-white/45">{meta}</p>
    {progress !== undefined && (
      <div className="mt-1.5 h-1 rounded-full bg-white/5 overflow-hidden">
        <div className="h-full rounded-full bg-gradient-to-r from-[#2EF2FF] to-[#1DAEFF]" style={{ width: `${progress}%` }} />
      </div>
    )}
  </div>
);

export default Login;
