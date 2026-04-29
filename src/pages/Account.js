import React, { useState, useEffect } from 'react';
import { fetchProfileData, verifyEpicAccount, updateEpicGamesName, buildDiscordAvatar, DISCORD_AVATAR_FALLBACK } from '../utils/api';
import { getRank, getRankProgress, getRankLabel } from '../utils/ranks';
import './Account.css';

const Account = () => {
  const [userData, setUserData] = useState(null);
  const [epicGamesName, setEpicGamesName] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [verifying, setVerifying] = useState(false);
  const [showUpdateForm, setShowUpdateForm] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      const token = localStorage.getItem('token');
      if (!token) { setLoading(false); return; }
      try {
        const data = await fetchProfileData();
        setUserData(data);
        setEpicGamesName(data.epicGamesName || '');
      } catch (err) {
        console.error('Error fetching user data:', err.message);
        setErrorMessage('Failed to load account data.');
      } finally { setLoading(false); }
    };
    fetchData();
  }, []);

  const handleVerifyEpic = async () => {
    if (!epicGamesName.trim()) {
      setErrorMessage('Please enter your Epic Games username');
      return;
    }
    setVerifying(true);
    try {
      const response = userData?.epicVerified
        ? await updateEpicGamesName(epicGamesName)
        : await verifyEpicAccount(epicGamesName);
      setSuccessMessage(response.message);
      setErrorMessage('');
      setShowUpdateForm(false);
      const updatedData = await fetchProfileData();
      setUserData(updatedData);
      setEpicGamesName(updatedData.epicGamesName || '');
      let storedUser = {};
      try { storedUser = JSON.parse(localStorage.getItem('user') || '{}'); } catch {}
      localStorage.setItem('user', JSON.stringify({
        ...storedUser,
        epicVerified: !!updatedData.epicVerified,
        epicGamesName: updatedData.epicGamesName || epicGamesName,
      }));
      window.dispatchEvent(new Event('user-updated'));
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (err) {
      setErrorMessage(err.response?.data?.message || 'Failed to verify Epic Games account');
      setTimeout(() => setErrorMessage(''), 3000);
    } finally { setVerifying(false); }
  };

  const handleLogout = () => {
    localStorage.clear();
    sessionStorage.clear();
    window.location.href = '/';
  };

  const pts = userData?.rankingPoints || 0;
  const rank = getRank(pts);
  const progress = getRankProgress(pts);
  const rankLabel = getRankLabel(pts);
  const winRate = userData?.totalMatches > 0 ? ((userData.wins / userData.totalMatches) * 100).toFixed(1) : 0;

  if (loading) {
    return (
      <div className="account-page page-wrapper">
        <div className="account-grid">
          <div className="skeleton" style={{ height: 400 }} />
          <div><div className="skeleton" style={{ height: 200, marginBottom: 20 }} /></div>
        </div>
      </div>
    );
  }

  return (
    <div className="account-page page-wrapper">
      {successMessage && <div className="account-message"><i className="fas fa-check-circle"></i> {successMessage}</div>}
      {errorMessage && <div className="account-message error"><i className="fas fa-exclamation-circle"></i> {errorMessage}</div>}
      {userData?.isBanned && (
        <div className="account-message error" style={{ marginBottom: 16 }}>
          <i className="fas fa-ban"></i> Your account is banned. Reason: {userData.banReason || 'No reason provided'}
        </div>
      )}

      <div className="account-grid">
        <div className="account-sidebar-card">
          <div className="account-avatar-wrapper">
            <img
              className="account-avatar"
              src={buildDiscordAvatar(userData?.discordId || userData?.id, userData?.discordAvatar) || DISCORD_AVATAR_FALLBACK}
              alt=""
            />
            <div className="account-rank-badge">
              <img src={rank.icon} alt="" style={{ width: 20, height: 20 }} />
            </div>
          </div>
          <h2 className="account-name">{userData?.discordName || userData?.username || 'Player'}</h2>
          <p className="account-epic-name">{userData?.epicGamesName || 'Not verified'}</p>

          <div className="account-stats-row">
            <div className="account-stat-box">
              <div className="value">{userData?.wins || 0}</div>
              <div className="label">Wins</div>
            </div>
            <div className="account-stat-box">
              <div className="value">{userData?.losses || 0}</div>
              <div className="label">Losses</div>
            </div>
            <div className="account-stat-box">
              <div className="value">{userData?.totalMatches || 0}</div>
              <div className="label">Matches</div>
            </div>
            <div className="account-stat-box">
              <div className="value">{winRate}%</div>
              <div className="label">Win Rate</div>
            </div>
          </div>

          <div className="rank-progress-bar">
            <div className="rank-progress-fill" style={{ width: `${progress}%`, background: rank.color }} />
          </div>
          <p className="account-helper-text">Tip: Keep your Epic name accurate so opponents can add you faster.</p>
        </div>

        <div>
          <div className="account-main-card">
            <h3 className="account-section-title"><i className="fas fa-circle-info"></i> Quick Help</h3>
            <div className="account-help-list">
              <div className="account-help-item"><strong>1.</strong> Verify your Epic username before joining queue.</div>
              <div className="account-help-item"><strong>2.</strong> Use the update button only if your Epic name changed.</div>
              <div className="account-help-item"><strong>3.</strong> If you entered the wrong name, contact staff from match page support tools.</div>
            </div>
          </div>

          <div className="account-main-card">
            <h3 className="account-section-title"><i className="fas fa-user"></i> Discord Profile</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
                <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Username</span>
                <span style={{ fontWeight: 600 }}>{userData?.discordName || userData?.username || '—'}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
                <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Role</span>
                <span className={`role-badge ${userData?.role || 'player'}`}>{userData?.role || 'Player'}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
                <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Rank</span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 600, color: rank.color }}>
                  <img src={rank.icon} alt="" className="rank-icon-img" /> {rankLabel}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0' }}>
                <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Ranking Points</span>
                <span style={{ fontWeight: 700, color: 'var(--cyan)' }}>{pts}</span>
              </div>
            </div>
          </div>

          <div className="account-main-card">
            <h3 className="account-section-title"><i className="fas fa-shield-halved"></i> Epic Games {userData?.epicVerified && <span style={{ color: 'var(--green)', fontSize: '0.7rem', marginLeft: 8 }}>✓ Verified</span>}</h3>
            {!userData?.epicVerified ? (
              <div className="settings-form">
                <div className="input-group">
                  <label>Epic Games Username</label>
                  <input
                    type="text"
                    placeholder="e.g. FaZe_Player"
                    value={epicGamesName}
                    onChange={(e) => setEpicGamesName(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleVerifyEpic()}
                  />
                </div>
                <button onClick={handleVerifyEpic} disabled={verifying} className="btn btn-primary">
                  <i className="fas fa-gamepad"></i> {verifying ? 'Verifying...' : 'Verify Epic Account'}
                </button>
              </div>
            ) : (
              <div>
                <div className="verification-card verified">
                  <div className="verification-info">
                    <div className="verification-icon epic"><i className="fas fa-check-circle"></i></div>
                    <div className="verification-text">
                      <strong>{userData.epicGamesName}</strong>
                      <span>Other players can add you by this name</span>
                    </div>
                  </div>
                  <button onClick={() => setShowUpdateForm(!showUpdateForm)} className="btn btn-ghost btn-sm" style={{ flexShrink: 0 }}>
                    <i className="fas fa-pen"></i> {showUpdateForm ? 'Cancel' : 'Update'}
                  </button>
                </div>
                {showUpdateForm && (
                  <div className="settings-form" style={{ marginTop: 12 }}>
                    <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: 12 }}>
                      You can change your Epic account once every 7 days.
                    </p>
                    <div className="input-group">
                      <label>New Epic Games Username</label>
                      <input
                        type="text"
                        placeholder="Enter new username"
                        value={epicGamesName}
                        onChange={(e) => setEpicGamesName(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleVerifyEpic()}
                      />
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button onClick={handleVerifyEpic} disabled={verifying} className="btn btn-primary btn-sm">
                        <i className="fas fa-save"></i> {verifying ? 'Saving...' : 'Save Changes'}
                      </button>
                      <button onClick={() => { setShowUpdateForm(false); setEpicGamesName(userData.epicGamesName || ''); }} className="btn btn-ghost btn-sm">
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="account-main-card">
            <h3 className="account-section-title"><i className="fas fa-chart-simple"></i> Statistics</h3>
            <div className="account-stats-row" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
              <div className="account-stat-box"><div className="value">{userData?.wins || 0}</div><div className="label">Wins</div></div>
              <div className="account-stat-box"><div className="value">{userData?.losses || 0}</div><div className="label">Losses</div></div>
              <div className="account-stat-box"><div className="value">{userData?.totalMatches || 0}</div><div className="label">Total</div></div>
              <div className="account-stat-box"><div className="value">{winRate}%</div><div className="label">Win Rate</div></div>
            </div>
            <div className="account-stats-row" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
              <div className="account-stat-box"><div className="value">{userData?.trustScore ?? 100}</div><div className="label">Trust</div></div>
              <div className="account-stat-box"><div className="value">{userData?.anticheatScore ?? 100}</div><div className="label">Anti-Cheat</div></div>
              <div className="account-stat-box"><div className="value">{userData?.strikes || 0}/3</div><div className="label">Strikes</div></div>
              <div className="account-stat-box"><div className="value">{userData?.warnings?.length || 0}</div><div className="label">Warnings</div></div>
            </div>
          </div>

          <button onClick={handleLogout} className="btn btn-danger" style={{ width: '100%', marginTop: 8 }}>
            <i className="fas fa-sign-out-alt"></i> Log Out
          </button>
        </div>
      </div>
    </div>
  );
};

export default Account;
