import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './Login.css';
import { getDiscordAuthUrl, API_BASE_URL } from '../utils/api';
import logo from '../assets/logo.png';

const DISCORD_INVITE_URL = 'https://discord.gg/hMA23CEPHZ';

const Login = ({ errorMessage = '', errorType = '' }) => {
  const [tournaments, setTournaments] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    axios.get(`${API_BASE_URL}/tournament`).then(r => {
      const data = Array.isArray(r.data) ? r.data : [];
      setTournaments(data.slice(0, 3));
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const handleLogin = () => {
    const url = getDiscordAuthUrl();
    if (url) window.location.href = url;
  };

  const fmtDate = (s) => {
    const d = new Date(s);
    const diff = d.getTime() - Date.now();
    if (diff <= 0) return 'Started';
    const h = Math.floor(diff / 3600000);
    const m = Math.floor((diff % 3600000) / 60000);
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
  };

  const stageLabel = (t) => {
    const s = t.lifecycleStage || t.status;
    if (s === 'active') return 'LIVE';
    if (s === 'registration') return 'OPEN';
    return s;
  };

  const stageClass = (t) => {
    const s = t.lifecycleStage || t.status;
    return s === 'active' ? 'live' : s === 'registration' ? 'open' : 'ended';
  };

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-brand">
          <img src={logo} alt="FNT Arena" className="login-logo-img" />
          <div>
            <h1 className="login-title">FNT Arena</h1>
            <p className="login-sub">Compete. Dominate. Rise.</p>
          </div>
        </div>

        <p className="login-desc">
          Fortnite 1v1 tournament platform with live matchmaking, rankings, and anti-cheat protection.
        </p>

        <button onClick={handleLogin} className="login-btn">
          <i className="fab fa-discord"></i>
          Sign in with Discord
        </button>

        {errorMessage && (
          <div className={`login-err ${errorType === 'not_server_member' ? 'login-err-join' : ''}`}>
            <i className="fas fa-exclamation-circle"></i>
            <span>{errorMessage}</span>
            {errorType === 'not_server_member' && (
              <a href={DISCORD_INVITE_URL} target="_blank" rel="noopener noreferrer" className="login-err-btn">
                <i className="fab fa-discord"></i> Join Server
              </a>
            )}
          </div>
        )}

        <div className="login-divider"><span>Live tournaments</span></div>

        <div className="login-tournaments">
          {loading ? (
            <div className="login-loading" />
          ) : tournaments.length === 0 ? (
            <>
              <div className="login-tcard">
                <div className="login-tcard-top">
                  <span className="login-tbadge live">LIVE</span>
                  <span className="login-tprize">🏆 $100</span>
                </div>
                <div className="login-tname">Solo Build Fight</div>
                <div className="login-tmeta">16 players · Map: FN-1234</div>
              </div>
              <div className="login-tcard">
                <div className="login-tcard-top">
                  <span className="login-tbadge open">OPEN</span>
                  <span className="login-tprize">🏆 $50</span>
                </div>
                <div className="login-tname">Box Fight Classic</div>
                <div className="login-tmeta">8/16 players · Starts in 2h</div>
                <div className="login-tbar"><div className="login-tbar-fill" style={{ width: '50%' }} /></div>
              </div>
              <div className="login-tcard">
                <div className="login-tcard-top">
                  <span className="login-tbadge live">LIVE</span>
                  <span className="login-tprize">🏆 $250</span>
                </div>
                <div className="login-tname">Championship Series</div>
                <div className="login-tmeta">32 players · Map: FN-5678</div>
              </div>
            </>
          ) : (
            tournaments.map((t, i) => (
              <div key={t._id || i} className="login-tcard">
                <div className="login-tcard-top">
                  <span className={`login-tbadge ${stageClass(t)}`}>{stageLabel(t)}</span>
                  <span className="login-tprize">🏆 {t.prize || '$0'}</span>
                </div>
                <div className="login-tname">{t.title}</div>
                <div className="login-tmeta">
                  {t.participants?.length || 0}/{t.maxPlayers || '∞'} players · {fmtDate(t.startDate)}
                </div>
              </div>
            ))
          )}
        </div>

        <div className="login-footer-text">
          Not affiliated with Epic Games &middot; &copy; {new Date().getFullYear()}
        </div>
      </div>
    </div>
  );
};

export default Login;
