import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { fetchUserData, getMyRegisteredTournaments, getCurrentMatch, buildDiscordAvatar, DISCORD_AVATAR_FALLBACK } from '../utils/api';
import { getRank, getRankProgress, getRankLabel } from '../utils/ranks';
import './Dashboard.css';

const Dashboard = ({ user }) => {
  const storedUser = user || JSON.parse(localStorage.getItem('user') || '{}');
  const [profile, setProfile] = useState(null);
  const [stats, setStats] = useState(null);
  const [currentMatch, setCurrentMatch] = useState(null);
  const [activeTournaments, setActiveTournaments] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [profileData, matchData, tournaments] = await Promise.all([
          fetchUserData().catch(() => null),
          getCurrentMatch().catch(() => null),
          getMyRegisteredTournaments().catch(() => []),
        ]);
        if (profileData) setProfile(profileData);
        if (matchData) setCurrentMatch(matchData);
        if (tournaments) setActiveTournaments(tournaments.filter(t => t.status !== 'completed' && t.status !== 'cancelled'));
      } catch (e) {
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const points = stats?.rankingPoints || profile?.rankingPoints || storedUser?.rankingPoints || 0;
  const wins = stats?.wins || profile?.wins || storedUser?.wins || 0;
  const losses = stats?.losses || profile?.losses || storedUser?.losses || 0;
  const totalMatches = stats?.totalMatches || profile?.totalMatches || storedUser?.totalMatches || 0;
  const winRate = totalMatches > 0 ? ((wins / totalMatches) * 100).toFixed(1) : 0;
  const rank = getRank(points);
  const progress = getRankProgress(points);
  const rankLabel = getRankLabel(points);
  const displayName = profile?.discordName || storedUser?.username || storedUser?.discordName || 'Player';
  const avatarUrl = buildDiscordAvatar(
    profile?.discordId || storedUser?.discordId || storedUser?.id,
    profile?.discordAvatar || storedUser?.discordAvatar
  ) || DISCORD_AVATAR_FALLBACK;
  const isInMatch = currentMatch?.inMatch;
  const progressPct = rank.nextRankPoints ? (points / rank.nextRankPoints) * 100 : 100;

  if (loading) {
    return (
      <div className="animate-fade-in-up">
        <div className="flex items-center gap-5 p-6 bg-[var(--bg-card)] border border-[var(--border-glow)] rounded-[var(--radius-xl)] shadow-cyan mb-6">
          <div className="skeleton w-[72px] h-[72px] rounded-full" />
          <div className="flex-1">
            <div className="skeleton w-[200px] h-6 mb-2" />
            <div className="skeleton w-[120px] h-4" />
          </div>
        </div>
        <div className="grid grid-cols-4 gap-4 max-md:grid-cols-2">
          {[1,2,3,4].map(i => <div key={i} className="skeleton h-[100px]" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="animate-fade-in-up page-wrapper">
      <div className="flex items-center gap-5 p-6 bg-[var(--bg-card)] border border-[var(--border-glow)] rounded-[var(--radius-xl)] shadow-cyan mb-6 max-md:flex-col max-md:text-center">
        <div className="relative w-[72px] h-[72px] rounded-full overflow-hidden border-2 border-[var(--border-glow-strong)] shadow-[0_0_20px_var(--cyan-glow)] shrink-0">
          <img src={avatarUrl} alt="" className="w-full h-full object-cover" />
        </div>
        <div className="flex-1">
          <h2 className="font-display text-[1.2rem] font-bold">{displayName}</h2>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[0.75rem] font-semibold mt-1" style={{ background: `${rank.color}15`, color: rank.color }}>
            <img src={rank.icon} alt="" className="rank-icon-img" /> {rankLabel}
          </div>
        </div>
        <div className="flex gap-5 shrink-0 max-md:w-full max-md:justify-center">
          <div className="text-center">
            <div className="font-display text-[1.1rem] font-bold" style={{ color: rank.color }}>{wins}</div>
            <div className="text-[0.65rem] text-[var(--text-muted)] uppercase tracking-[0.08em]">Wins</div>
          </div>
          <div className="text-center">
            <div className="font-display text-[1.1rem] font-bold">{totalMatches}</div>
            <div className="text-[0.65rem] text-[var(--text-muted)] uppercase tracking-[0.08em]">Matches</div>
          </div>
          <div className="text-center">
            <div className="font-display text-[1.1rem] font-bold" style={{ color: winRate >= 50 ? 'var(--green)' : 'var(--red)' }}>{winRate}%</div>
            <div className="text-[0.65rem] text-[var(--text-muted)] uppercase tracking-[0.08em]">Win Rate</div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-4 mb-6 max-md:grid-cols-2 max-md:gap-3">
        <div className="p-5 bg-[var(--bg-card)] border border-[var(--border)] rounded-[var(--radius-lg)] text-center transition-all duration-[250ms] hover:border-[var(--border-glow)] hover:shadow-cyan hover:-translate-y-0.5 animate-fade-in-up">
          <div className="text-[1.5rem] mb-2" style={{ color: 'var(--cyan)' }}>⚔</div>
          <span className="font-display text-[1.5rem] font-extrabold block max-md:text-[1.2rem]">{totalMatches}</span>
          <span className="text-[0.75rem] text-[var(--text-muted)] uppercase tracking-[0.08em] block mt-1">Total Matches</span>
        </div>
        <div className="p-5 bg-[var(--bg-card)] border border-[var(--border)] rounded-[var(--radius-lg)] text-center transition-all duration-[250ms] hover:border-[var(--border-glow)] hover:shadow-cyan hover:-translate-y-0.5 animate-fade-in-up">
          <div className="text-[1.5rem] mb-2" style={{ color: 'var(--green)' }}>🏆</div>
          <span className="font-display text-[1.5rem] font-extrabold block max-md:text-[1.2rem]">{wins}</span>
          <span className="text-[0.75rem] text-[var(--text-muted)] uppercase tracking-[0.08em] block mt-1">Wins</span>
        </div>
        <div className="p-5 bg-[var(--bg-card)] border border-[var(--border)] rounded-[var(--radius-lg)] text-center transition-all duration-[250ms] hover:border-[var(--border-glow)] hover:shadow-cyan hover:-translate-y-0.5 animate-fade-in-up">
          <div className="text-[1.5rem] mb-2" style={{ color: 'var(--purple)' }}>📈</div>
          <span className="font-display text-[1.5rem] font-extrabold block max-md:text-[1.2rem]">{winRate}%</span>
          <span className="text-[0.75rem] text-[var(--text-muted)] uppercase tracking-[0.08em] block mt-1">Win Rate</span>
        </div>
        <div className="p-5 bg-[var(--bg-card)] border border-[var(--border)] rounded-[var(--radius-lg)] text-center transition-all duration-[250ms] hover:border-[var(--border-glow)] hover:shadow-cyan hover:-translate-y-0.5 animate-fade-in-up">
          <div className="text-[1.5rem] mb-2" style={{ color: 'var(--orange)' }}>⭐</div>
          <span className="font-display text-[1.5rem] font-extrabold block max-md:text-[1.2rem]">{points}</span>
          <span className="text-[0.75rem] text-[var(--text-muted)] uppercase tracking-[0.08em] block mt-1">Rank Points</span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-5 mb-6 max-md:grid-cols-1">
        <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-[var(--radius-lg)] p-5 transition-all duration-[250ms] hover:border-[var(--border-glow)] hover:shadow-cyan">
          <div className="flex items-center justify-between mb-4">
            <span className="font-display text-[0.85rem] font-semibold text-[var(--text-secondary)] uppercase tracking-[0.08em]">Active Tournaments</span>
            <div className="w-9 h-9 flex items-center justify-center rounded-[var(--radius-sm)] text-[0.95rem]" style={{ background: 'rgba(46,242,255,0.08)', color: 'var(--cyan)' }}>
              <i className="fas fa-trophy"></i>
            </div>
          </div>
          {activeTournaments.length > 0 ? (
            <div className="flex flex-col gap-2">
              {activeTournaments.slice(0, 5).map(t => (
                <div key={t._id} className="flex items-center justify-between px-3.5 py-2.5 bg-[rgba(255,255,255,0.02)] border border-[var(--border)] rounded-[var(--radius-md)] transition-all duration-[150ms] cursor-pointer hover:bg-[var(--bg-hover)] hover:border-[var(--border-glow)]">
                  <span className="text-[0.85rem] font-semibold">{t.title}</span>
                  <div className="flex items-center gap-2.5 text-[0.75rem] text-[var(--text-muted)]">{t.status}</div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-[0.85rem] text-[var(--text-muted)] mb-3">No active tournaments yet.</p>
          )}
          <Link to="/tournaments" className="text-[var(--cyan)] text-[0.85rem] font-semibold mt-3 inline-flex items-center gap-1.5">
            Browse Tournaments <i className="fas fa-arrow-right"></i>
          </Link>
        </div>

        <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-[var(--radius-lg)] p-5 transition-all duration-[250ms] hover:border-[var(--border-glow)] hover:shadow-cyan">
          <div className="flex items-center justify-between mb-4">
            <span className="font-display text-[0.85rem] font-semibold text-[var(--text-secondary)] uppercase tracking-[0.08em]">Recent Activity</span>
            <div className="w-9 h-9 flex items-center justify-center rounded-[var(--radius-sm)] text-[0.95rem]" style={{ background: 'rgba(168,85,247,0.08)', color: 'var(--purple)' }}>
              <i className="fas fa-bolt"></i>
            </div>
          </div>
          <Link to="/match-history" className="text-[var(--text-muted)] text-[0.85rem]">
            View your match history and track your progress.
          </Link>
          <div className="mt-4">
            {isInMatch ? (
              <Link to={`/match/${currentMatch.matchId}`} className="flex items-center justify-center gap-2.5 w-full p-4 bg-gradient-to-r from-[rgba(46,242,255,0.1)] to-[rgba(168,85,247,0.1)] border border-[var(--border-glow)] rounded-[var(--radius-lg)] text-[var(--cyan)] font-display text-[0.95rem] font-bold cursor-pointer transition-all duration-[250ms] uppercase tracking-[0.08em] hover:from-[rgba(46,242,255,0.2)] hover:to-[rgba(168,85,247,0.2)] hover:border-[var(--border-glow-strong)] hover:shadow-[0_0_30px_rgba(46,242,255,0.15)] hover:-translate-y-0.5">
                <i className="fas fa-gamepad"></i> Resume Match
              </Link>
            ) : (
              <Link to="/current-game" className="flex items-center justify-center gap-2.5 w-full p-4 bg-gradient-to-r from-[rgba(46,242,255,0.1)] to-[rgba(168,85,247,0.1)] border border-[var(--border-glow)] rounded-[var(--radius-lg)] text-[var(--cyan)] font-display text-[0.95rem] font-bold cursor-pointer transition-all duration-[250ms] uppercase tracking-[0.08em] hover:from-[rgba(46,242,255,0.2)] hover:to-[rgba(168,85,247,0.2)] hover:border-[var(--border-glow-strong)] hover:shadow-[0_0_30px_rgba(46,242,255,0.15)] hover:-translate-y-0.5">
                <i className="fas fa-right-to-bracket"></i> Join Game
              </Link>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;

