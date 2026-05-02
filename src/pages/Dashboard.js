import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { fetchUserData, getMyRegisteredTournaments, getCurrentMatch, buildDiscordAvatar, DISCORD_AVATAR_FALLBACK } from '../utils/api';
import { getRank, getRankProgress, getRankLabel } from '../utils/ranks';
import './Dashboard.css';

function readStoredUserSafe(user) {
  if (user) return user;
  try {
    return JSON.parse(localStorage.getItem('user') || '{}');
  } catch {
    return {};
  }
}

const Dashboard = ({ user }) => {
  const storedUser = readStoredUserSafe(user);
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
        if (tournaments) {
          setActiveTournaments(
            tournaments.filter((t) => {
              const stage = t.lifecycleStage || t.status;
              return stage !== 'completed' && stage !== 'cancelled';
            }),
          );
        }
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
  const nextRankPts = rank.nextRankPoints || points;
  const progressPct = rank.nextRankPoints ? (points / rank.nextRankPoints) * 100 : 100;

  if (loading) {
    return (
      <div className="dashboard-page">
        <div className="profile-rank-card">
          <div className="skeleton" style={{ width: 72, height: 72, borderRadius: '50%' }} />
          <div style={{ flex: 1 }}>
            <div className="skeleton" style={{ width: 200, height: 24, marginBottom: 8 }} />
            <div className="skeleton" style={{ width: 120, height: 16 }} />
          </div>
        </div>
        <div className="stat-cards">
          {[1,2,3,4].map(i => <div key={i} className="skeleton" style={{ height: 100 }} />)}
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard-page page-wrapper">
      {isInMatch && currentMatch?.matchId && (
        <div className="dashboard-live-match-banner">
          <div className="dashboard-live-match-main">
            <span className="dashboard-live-dot" aria-hidden />
            <div>
              <div className="dashboard-live-title">You have a live match</div>
              <div className="dashboard-live-sub">
                vs <strong>{currentMatch.opponent || 'Opponent'}</strong>
                {currentMatch.mapCode ? (
                  <span className="dashboard-live-map"> · Map {currentMatch.mapCode}</span>
                ) : null}
              </div>
            </div>
          </div>
          <div className="dashboard-live-actions">
            <Link to={`/match/${currentMatch.matchId}`} className="btn btn-primary btn-sm dashboard-live-btn">
              <i className="fas fa-door-open" /> Open match room
            </Link>
            <Link to="/current-game" className="btn btn-ghost btn-sm dashboard-live-btn">
              Overview
            </Link>
          </div>
        </div>
      )}
      <div className="profile-rank-card">
        <div className="profile-rank-avatar">
          <img src={avatarUrl} alt="" />
        </div>
        <div className="profile-rank-info">
          <h2 className="profile-rank-name">{displayName}</h2>
          <div className="profile-rank-tag" style={{ background: `${rank.color}15`, color: rank.color }}>
            <img src={rank.icon} alt="" className="rank-icon-img" /> {rankLabel}
          </div>
        </div>
        <div className="profile-rank-stats">
          <div className="profile-stat-mini">
            <div className="value" style={{ color: rank.color }}>{wins}</div>
            <div className="label">Wins</div>
          </div>
          <div className="profile-stat-mini">
            <div className="value">{totalMatches}</div>
            <div className="label">Matches</div>
          </div>
          <div className="profile-stat-mini">
            <div className="value" style={{ color: winRate >= 50 ? 'var(--green)' : 'var(--red)' }}>{winRate}%</div>
            <div className="label">Win Rate</div>
          </div>
        </div>
      </div>

      <div className="stat-cards">
        <div className="stat-card">
          <div className="stat-icon" style={{ color: 'var(--cyan)' }}>⚔</div>
          <span className="stat-value">{totalMatches}</span>
          <span className="stat-label">Total Matches</span>
        </div>
        <div className="stat-card">
          <div className="stat-icon" style={{ color: 'var(--green)' }}>🏆</div>
          <span className="stat-value">{wins}</span>
          <span className="stat-label">Wins</span>
        </div>
        <div className="stat-card">
          <div className="stat-icon" style={{ color: 'var(--purple)' }}>📈</div>
          <span className="stat-value">{winRate}%</span>
          <span className="stat-label">Win Rate</span>
        </div>
        <div className="stat-card">
          <div className="stat-icon" style={{ color: 'var(--orange)' }}>⭐</div>
          <span className="stat-value">{points}</span>
          <span className="stat-label">Rank Points</span>
        </div>
      </div>

      <div className="dashboard-grid">
        <div className="dashboard-card">
          <div className="dashboard-card-header">
            <span className="dashboard-card-title">Active Tournaments</span>
            <div className="dashboard-card-icon" style={{ background: 'rgba(46,242,255,0.08)', color: 'var(--cyan)' }}>
              <i className="fas fa-trophy"></i>
            </div>
          </div>
          {activeTournaments.length > 0 ? (
            <div className="tournament-mini-list">
              {activeTournaments.slice(0, 6).map((t) => {
                const stage = t.lifecycleStage || t.status || '—';
                return (
                  <div key={t._id} className="tournament-mini-item">
                    <div className="tournament-mini-item-text">
                      <span className="tournament-mini-name">{t.title}</span>
                      <div className="tournament-mini-meta">
                        <span>{t.type || '1v1'}</span>
                        <span>·</span>
                        <span>{stage}</span>
                        {t.queueOpen && <span className="tournament-mini-live">Live queue</span>}
                      </div>
                    </div>
                    {t.queueOpen && (
                      <Link to={`/queue/${t._id}`} className="tournament-mini-queue">Queue</Link>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: 12 }}>No active tournaments yet.</p>
          )}
          <Link to="/tournaments" style={{ color: 'var(--cyan)', fontSize: '0.85rem', fontWeight: 600, marginTop: 12, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            Browse Tournaments <i className="fas fa-arrow-right"></i>
          </Link>
        </div>

        <div className="dashboard-card">
          <div className="dashboard-card-header">
            <span className="dashboard-card-title">Recent Activity</span>
            <div className="dashboard-card-icon" style={{ background: 'rgba(168,85,247,0.08)', color: 'var(--purple)' }}>
              <i className="fas fa-bolt"></i>
            </div>
          </div>
          <Link to="/match-history" style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
            View your match history and track your progress.
          </Link>
          <div style={{ marginTop: 16 }}>
            {isInMatch ? (
              <Link to={`/match/${currentMatch.matchId}`} className="quick-join-btn">
                <i className="fas fa-gamepad"></i> Resume Match
              </Link>
            ) : (
              <Link to="/current-game" className="quick-join-btn">
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
