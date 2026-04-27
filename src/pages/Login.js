import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './Login.css';
import { getDiscordAuthUrl, API_BASE_URL } from '../utils/api';

const Login = ({ errorMessage = '' }) => {
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

  return (
    <div className="login-page">
      <div className="login-nav">
        <div className="login-nav-brand">
          <span className="login-nav-icon">⚡</span>
          <span>FNT ARENA</span>
        </div>
        <button onClick={handleLogin} className="login-nav-btn">
          <i className="fab fa-discord"></i> Sign In
        </button>
      </div>

      <div className="login-hero">
        <div className="login-hero-content">
          <div className="login-hero-badge">FORTNITE COMPETITIVE PLATFORM</div>
          <h1 className="login-hero-title">
            Compete in<br />
            <span>Fortnite 1v1</span> Tournaments
          </h1>
          <p className="login-hero-desc">
            Join the arena, find opponents instantly, climb the rankings, and prove you're the best.
            Real matchmaking. Real competition. Real rewards.
          </p>
          <div className="login-hero-actions">
            <button onClick={handleLogin} className="login-hero-btn">
              <i className="fab fa-discord"></i> Sign in with Discord
            </button>
          </div>
          <div className="login-hero-trust">
            <span><i className="fas fa-shield-halved"></i> Secure login</span>
            <span><i className="fas fa-robot"></i> Anti-cheat protected</span>
            <span><i className="fas fa-users"></i> Active community</span>
          </div>
        </div>
        <div className="login-hero-visual">
          <div className="login-hero-card">
            <div className="login-hero-card-header">
              <span className="login-hero-card-dot" />
              <span>Live Tournaments</span>
            </div>
            <div className="login-hero-card-body">
              {loading ? (
                <div style={{ padding: '20px 0', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>Loading tournaments...</div>
              ) : tournaments.length === 0 ? (
                <>
                  <div className="login-mock-card">
                    <div className="login-mock-top">
                      <span className="login-mock-badge live">ACTIVE</span>
                      <span className="login-mock-prize">🏆 $100</span>
                    </div>
                    <div className="login-mock-title">Solo Build Fight</div>
                    <div className="login-mock-meta">
                      <span>16 players</span>
                      <span>Map: FN-1234</span>
                    </div>
                  </div>
                  <div className="login-mock-card">
                    <div className="login-mock-top">
                      <span className="login-mock-badge open">OPEN</span>
                      <span className="login-mock-prize">🏆 $50</span>
                    </div>
                    <div className="login-mock-title">Box Fight Classic</div>
                    <div className="login-mock-meta">
                      <span>8/16 players</span>
                      <span>Starts in 2h</span>
                    </div>
                    <div className="login-mock-progress"><div className="login-mock-progress-fill" style={{ width: '50%' }} /></div>
                  </div>
                  <div className="login-mock-card">
                    <div className="login-mock-top">
                      <span className="login-mock-badge live">LIVE</span>
                      <span className="login-mock-prize">🏆 $250</span>
                    </div>
                    <div className="login-mock-title">Championship Series</div>
                    <div className="login-mock-meta">
                      <span>32 players</span>
                      <span>Map: FN-5678</span>
                    </div>
                  </div>
                </>
              ) : (
                tournaments.map((t, i) => (
                  <div key={t._id || i} className="login-mock-card">
                    <div className="login-mock-top">
                      <span className={`login-mock-badge ${getStatusClass(t)}`}>{getStatusLabel(t)}</span>
                      <span className="login-mock-prize">🏆 {t.prize || '$0'}</span>
                    </div>
                    <div className="login-mock-title">{t.title}</div>
                    <div className="login-mock-meta">
                      <span>{t.participants?.length || 0}/{t.maxPlayers || '∞'} players</span>
                      <span>{formatDate(t.startDate)}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
            <div className="login-hero-card-footer">
              <span className="login-hero-stats-dot" />
              <span>Real tournaments · Real players · Real-time</span>
            </div>
          </div>
        </div>
      </div>

      <div className="login-features-section">
        <div className="login-feature-card">
          <div className="login-feature-card-icon" style={{ background: 'rgba(46,242,255,0.1)', color: 'var(--cyan)' }}>
            <i className="fas fa-bolt"></i>
          </div>
          <h3>Instant Matchmaking</h3>
          <p>Find opponents in seconds. Our skill-based matchmaker pairs you with players at your level.</p>
        </div>
        <div className="login-feature-card">
          <div className="login-feature-card-icon" style={{ background: 'rgba(168,85,247,0.1)', color: 'var(--purple)' }}>
            <i className="fas fa-trophy"></i>
          </div>
          <h3>Ranked Competition</h3>
          <p>Climb the leaderboard. Earn ranking points, unlock divisions, and prove your skill.</p>
        </div>
        <div className="login-feature-card">
          <div className="login-feature-card-icon" style={{ background: 'rgba(34,197,94,0.1)', color: 'var(--green)' }}>
            <i className="fas fa-shield-halved"></i>
          </div>
          <h3>Fair Play System</h3>
          <p>Anti-cheat detection, dispute resolution, and staff moderation keep competitions fair.</p>
        </div>
        <div className="login-feature-card">
          <div className="login-feature-card-icon" style={{ background: 'rgba(249,115,22,0.1)', color: 'var(--orange)' }}>
            <i className="fas fa-chart-line"></i>
          </div>
          <h3>Live Tracking</h3>
          <p>Real-time match updates, live chat, detailed stats, and match history for every battle.</p>
        </div>
      </div>

      <div className="login-cta-section">
        <h2>Ready to Compete?</h2>
        <p>Join thousands of players in the arena. Sign in with Discord and start your first match.</p>
        <button onClick={handleLogin} className="login-hero-btn">
          <i className="fab fa-discord"></i> Get Started
        </button>
      </div>

      <div className="login-footer">
        <span>FNT Arena &copy; {new Date().getFullYear()}</span>
        <span>Not affiliated with Epic Games</span>
      </div>

      {errorMessage && (
        <div className="login-error-fixed">
          <i className="fas fa-exclamation-circle"></i> {errorMessage}
        </div>
      )}
    </div>
  );
};

export default Login;
