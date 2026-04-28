import React, { useState, useEffect } from 'react';
import { fetchProfileData, verifyEpicAccount, buildDiscordAvatar, DISCORD_AVATAR_FALLBACK } from '../utils/api';
import './Account.css';
import { getRank, getRankProgress, getRankLabel } from '../utils/ranks';

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
      const response = await verifyEpicAccount(epicGamesName, epicGamesName);
      setSuccessMessage(response.message);
      setErrorMessage('');
      setShowUpdateForm(false);
      const updatedData = await fetchProfileData();
      setUserData(updatedData);
      setEpicGamesName(updatedData.epicGamesName || '');
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
      <div className="page-wrapper animate-fade-in-up">
        <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-6">
          <div className="skeleton" style={{ height: 400 }} />
          <div><div className="skeleton" style={{ height: 200, marginBottom: 20 }} /></div>
        </div>
      </div>
    );
  }

  return (
    <div className="page-wrapper animate-fade-in-up">
      {successMessage && <div className="p-3 bg-[rgba(34,197,94,0.08)] border border-[rgba(34,197,94,0.2)] rounded-[var(--radius-md)] text-[var(--green)] text-sm mt-3"><i className="fas fa-check-circle"></i> {successMessage}</div>}
      {errorMessage && <div className="p-3 bg-[rgba(239,68,68,0.08)] border border-[rgba(239,68,68,0.2)] rounded-[var(--radius-md)] text-[var(--red)] text-sm mt-3"><i className="fas fa-exclamation-circle"></i> {errorMessage}</div>}
      {userData?.isBanned && (
        <div className="p-3 bg-[rgba(239,68,68,0.08)] border border-[rgba(239,68,68,0.2)] rounded-[var(--radius-md)] text-[var(--red)] text-sm mb-4">
          <i className="fas fa-ban"></i> Your account is banned. Reason: {userData.banReason || 'No reason provided'}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-6">
        <div className="bg-[var(--bg-card)] border border-[var(--border-glow)] rounded-[var(--radius-xl)] p-8 text-center shadow-[var(--shadow-cyan)]">
          <div className="relative w-[100px] h-[100px] mx-auto mb-4">
            <img
              className="w-full h-full rounded-full object-cover border-3 border-[var(--border-glow-strong)] shadow-[0_0_30px_var(--cyan-glow)]"
              src={buildDiscordAvatar(userData?.discordId || userData?.id, userData?.discordAvatar) || DISCORD_AVATAR_FALLBACK}
              alt=""
            />
            <div className="absolute -bottom-1 -right-1 w-9 h-9 rounded-full bg-[var(--bg-base)] border-2 border-[var(--border-glow)] flex items-center justify-center">
              <img src={rank.icon} alt="" style={{ width: 20, height: 20 }} />
            </div>
          </div>
          <h2 className="font-display text-xl font-bold mb-1">{userData?.discordName || userData?.username || 'Player'}</h2>
          <p className="text-[var(--text-muted)] text-sm mb-4 font-mono">{userData?.epicGamesName || 'Not verified'}</p>

          <div className="grid grid-cols-2 gap-2.5 mb-5">
            <div className="p-3 bg-[rgba(0,0,0,0.2)] border border-[var(--border)] rounded-[var(--radius-md)]">
              <div className="font-display text-lg font-bold text-[var(--cyan)]">{userData?.wins || 0}</div>
              <div className="text-[0.65rem] text-[var(--text-muted)] uppercase tracking-wider">Wins</div>
            </div>
            <div className="p-3 bg-[rgba(0,0,0,0.2)] border border-[var(--border)] rounded-[var(--radius-md)]">
              <div className="font-display text-lg font-bold text-[var(--cyan)]">{userData?.losses || 0}</div>
              <div className="text-[0.65rem] text-[var(--text-muted)] uppercase tracking-wider">Losses</div>
            </div>
            <div className="p-3 bg-[rgba(0,0,0,0.2)] border border-[var(--border)] rounded-[var(--radius-md)]">
              <div className="font-display text-lg font-bold text-[var(--cyan)]">{userData?.totalMatches || 0}</div>
              <div className="text-[0.65rem] text-[var(--text-muted)] uppercase tracking-wider">Matches</div>
            </div>
            <div className="p-3 bg-[rgba(0,0,0,0.2)] border border-[var(--border)] rounded-[var(--radius-md)]">
              <div className="font-display text-lg font-bold text-[var(--cyan)]">{winRate}%</div>
              <div className="text-[0.65rem] text-[var(--text-muted)] uppercase tracking-wider">Win Rate</div>
            </div>
          </div>

          <div className="h-1.5 bg-[rgba(255,255,255,0.06)] rounded-sm overflow-hidden mb-5">
            <div className="h-full rounded-sm transition-all duration-500 ease" style={{ width: `${progress}%`, background: rank.color }} />
          </div>
        </div>

        <div>
          <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-[var(--radius-xl)] p-7 mb-5">
            <h3 className="font-display text-sm font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-5 pb-3 border-b border-[var(--border)]"><i className="fas fa-user"></i> Discord Profile</h3>
            <div className="flex flex-col gap-2.5">
              <div className="flex justify-between py-2 border-b border-[var(--border)]">
                <span className="text-[var(--text-muted)] text-sm">Username</span>
                <span className="font-semibold">{userData?.discordName || userData?.username || '—'}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-[var(--border)]">
                <span className="text-[var(--text-muted)] text-sm">Role</span>
                <span className={`role-badge ${userData?.role || 'player'}`}>{userData?.role || 'Player'}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-[var(--border)]">
                <span className="text-[var(--text-muted)] text-sm">Rank</span>
                <span className="flex items-center gap-1.5 font-semibold" style={{ color: rank.color }}>
                  <img src={rank.icon} alt="" className="rank-icon-img" /> {rankLabel}
                </span>
              </div>
              <div className="flex justify-between py-2">
                <span className="text-[var(--text-muted)] text-sm">Ranking Points</span>
                <span className="font-bold text-[var(--cyan)]">{pts}</span>
              </div>
            </div>
          </div>

          <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-[var(--radius-xl)] p-7 mb-5">
            <h3 className="font-display text-sm font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-5 pb-3 border-b border-[var(--border)]"><i className="fas fa-shield-halved"></i> Epic Games {userData?.epicVerified && <span className="text-[var(--green)] text-[0.7rem] ml-2">✓ Verified</span>}</h3>
            {!userData?.epicVerified ? (
              <div className="flex flex-col gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs text-[var(--text-muted)] uppercase tracking-wider font-semibold">Epic Games Username</label>
                  <input
                    type="text"
                    placeholder="e.g. FaZe_Player"
                    value={epicGamesName}
                    onChange={(e) => setEpicGamesName(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleVerifyEpic()}
                    className="p-3 bg-[rgba(0,0,0,0.3)] border border-[var(--border)] rounded-[var(--radius-md)] text-[var(--text)] text-sm outline-none focus:border-[var(--border-glow-strong)] transition-colors duration-fast"
                  />
                </div>
                <button onClick={handleVerifyEpic} disabled={verifying} className="btn btn-primary">
                  <i className="fas fa-gamepad"></i> {verifying ? 'Verifying...' : 'Verify Epic Account'}
                </button>
              </div>
            ) : (
              <div>
                <div className="flex items-center justify-between p-4 bg-[rgba(34,197,94,0.03)] border border-[rgba(34,197,94,0.2)] rounded-[var(--radius-md)] mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-[var(--radius-md)] flex items-center justify-center text-lg bg-[rgba(46,242,255,0.1)] text-[var(--cyan)]"><i className="fas fa-check-circle"></i></div>
                    <div>
                      <strong className="block text-sm font-semibold">{userData.epicGamesName}</strong>
                      <span className="text-xs text-[var(--text-muted)]">Other players can add you by this name</span>
                    </div>
                  </div>
                  <button onClick={() => setShowUpdateForm(!showUpdateForm)} className="btn btn-ghost btn-sm flex-shrink-0">
                    <i className="fas fa-pen"></i> {showUpdateForm ? 'Cancel' : 'Update'}
                  </button>
                </div>
                {showUpdateForm && (
                  <div className="flex flex-col gap-4 mt-3">
                    <p className="text-xs text-[var(--text-muted)] mb-3">You can change your Epic account once every 7 days.</p>
                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs text-[var(--text-muted)] uppercase tracking-wider font-semibold">New Epic Games Username</label>
                      <input
                        type="text"
                        placeholder="Enter new username"
                        value={epicGamesName}
                        onChange={(e) => setEpicGamesName(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleVerifyEpic()}
                        className="p-3 bg-[rgba(0,0,0,0.3)] border border-[var(--border)] rounded-[var(--radius-md)] text-[var(--text)] text-sm outline-none focus:border-[var(--border-glow-strong)] transition-colors duration-fast"
                      />
                    </div>
                    <div className="flex gap-2">
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

          <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-[var(--radius-xl)] p-7 mb-5">
            <h3 className="font-display text-sm font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-5 pb-3 border-b border-[var(--border)]"><i className="fas fa-chart-simple"></i> Statistics</h3>
            <div className="grid grid-cols-4 gap-2.5 mb-2.5">
              <div className="p-3 bg-[rgba(0,0,0,0.2)] border border-[var(--border)] rounded-[var(--radius-md)]"><div className="font-display text-lg font-bold text-[var(--cyan)]">{userData?.wins || 0}</div><div className="text-[0.65rem] text-[var(--text-muted)] uppercase tracking-wider">Wins</div></div>
              <div className="p-3 bg-[rgba(0,0,0,0.2)] border border-[var(--border)] rounded-[var(--radius-md)]"><div className="font-display text-lg font-bold text-[var(--cyan)]">{userData?.losses || 0}</div><div className="text-[0.65rem] text-[var(--text-muted)] uppercase tracking-wider">Losses</div></div>
              <div className="p-3 bg-[rgba(0,0,0,0.2)] border border-[var(--border)] rounded-[var(--radius-md)]"><div className="font-display text-lg font-bold text-[var(--cyan)]">{userData?.totalMatches || 0}</div><div className="text-[0.65rem] text-[var(--text-muted)] uppercase tracking-wider">Total</div></div>
              <div className="p-3 bg-[rgba(0,0,0,0.2)] border border-[var(--border)] rounded-[var(--radius-md)]"><div className="font-display text-lg font-bold text-[var(--cyan)]">{winRate}%</div><div className="text-[0.65rem] text-[var(--text-muted)] uppercase tracking-wider">Win Rate</div></div>
            </div>
            <div className="grid grid-cols-4 gap-2.5">
              <div className="p-3 bg-[rgba(0,0,0,0.2)] border border-[var(--border)] rounded-[var(--radius-md)]"><div className="font-display text-lg font-bold text-[var(--cyan)]">{userData?.trustScore ?? 100}</div><div className="text-[0.65rem] text-[var(--text-muted)] uppercase tracking-wider">Trust</div></div>
              <div className="p-3 bg-[rgba(0,0,0,0.2)] border border-[var(--border)] rounded-[var(--radius-md)]"><div className="font-display text-lg font-bold text-[var(--cyan)]">{userData?.anticheatScore ?? 100}</div><div className="text-[0.65rem] text-[var(--text-muted)] uppercase tracking-wider">Anti-Cheat</div></div>
              <div className="p-3 bg-[rgba(0,0,0,0.2)] border border-[var(--border)] rounded-[var(--radius-md)]"><div className="font-display text-lg font-bold text-[var(--cyan)]">{userData?.strikes || 0}/3</div><div className="text-[0.65rem] text-[var(--text-muted)] uppercase tracking-wider">Strikes</div></div>
              <div className="p-3 bg-[rgba(0,0,0,0.2)] border border-[var(--border)] rounded-[var(--radius-md)]"><div className="font-display text-lg font-bold text-[var(--cyan)]">{userData?.warnings?.length || 0}</div><div className="text-[0.65rem] text-[var(--text-muted)] uppercase tracking-wider">Warnings</div></div>
            </div>
          </div>

          <button onClick={handleLogout} className="btn btn-danger w-full mt-2">
            <i className="fas fa-sign-out-alt"></i> Log Out
          </button>
        </div>
      </div>
    </div>
  );
};

export default Account;

