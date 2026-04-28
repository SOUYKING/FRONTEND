import React, { useState, useEffect } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import '@fortawesome/fontawesome-free/css/all.min.css';
import logo from '../assets/logo.png';

const Sidebar = ({ onLogout }) => {
  const [isAdmin, setIsAdmin] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const userData = JSON.parse(localStorage.getItem('user') || '{}');
    const role = (userData.role || '').toLowerCase();
    setIsAdmin(userData.isAdmin === true || ['admin', 'owner', 'staff', 'content_creator'].includes(role));
  }, []);

  const handleLogout = () => {
    if (typeof onLogout === 'function') {
      onLogout();
      return;
    }
    localStorage.clear();
    sessionStorage.clear();
    navigate('/');
    window.location.reload();
  };

  const closeMobile = () => setMobileOpen(false);

  return (
    <>
      <button
        className="fixed top-4 left-4 z-[101] w-10 h-10 hidden max-md:flex items-center justify-center glass rounded-[var(--radius-md)] text-white text-xl cursor-pointer transition-all duration-[250ms] hover:border-[var(--border-glow)]"
        onClick={() => setMobileOpen(!mobileOpen)}
      >
        <i className={`fas fa-${mobileOpen ? 'times' : 'bars'}`}></i>
      </button>
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-[99] backdrop-blur-sm hidden max-md:block"
          onClick={closeMobile}
        />
      )}
      <div
        className={`fixed top-0 left-0 w-[260px] h-screen bg-[var(--bg-glass-strong)] backdrop-blur-2xl border-r border-[var(--border)] flex flex-col z-[100] transition-transform duration-[250ms] overflow-y-auto max-md:translate-x-[-100%] ${mobileOpen ? 'max-md:translate-x-0' : ''}`}
      >
        <div className="p-6 pb-5 flex items-center gap-3.5 border-b border-[var(--border)]">
          <img src={logo} alt="Fnt Arena" className="w-10 h-10 rounded-[var(--radius-md)] drop-shadow-[0_0_10px_rgba(46,242,255,0.3)]" />
          <div>
            <h1 className="font-display text-xl font-extrabold bg-gradient-to-r from-[var(--cyan)] to-white bg-clip-text text-transparent tracking-wider">Fnt Arena</h1>
            <p className="text-[0.7rem] text-[var(--text-muted)] uppercase tracking-[0.15em] mt-0.5">Tournament Platform</p>
          </div>
        </div>

        <div className="px-5 pt-5 pb-2 text-[0.65rem] font-bold uppercase tracking-[0.15em] text-[var(--text-dim)]">Main</div>
        <ul className="list-none px-2.5 py-1 m-0">
          <li className="mb-0.5">
            <NavLink to="/dashboard" className={({ isActive }) => `flex items-center gap-3 px-3.5 py-2.5 rounded-[var(--radius-md)] text-[var(--text-secondary)] text-[0.88rem] font-medium transition-all duration-[250ms] no-underline relative ${isActive ? 'bg-[rgba(46,242,255,0.08)] text-[var(--cyan)] border border-[rgba(46,242,255,0.1)]' : 'hover:bg-[var(--bg-hover)] hover:text-white'}`} onClick={closeMobile}>
              <i className="fas fa-home w-5 text-center text-[0.95rem] text-[var(--text-muted)] transition-colors duration-[250ms]"></i> Dashboard
            </NavLink>
          </li>
          <li className="mb-0.5">
            <NavLink to="/tournaments" className={({ isActive }) => `flex items-center gap-3 px-3.5 py-2.5 rounded-[var(--radius-md)] text-[var(--text-secondary)] text-[0.88rem] font-medium transition-all duration-[250ms] no-underline relative ${isActive ? 'bg-[rgba(46,242,255,0.08)] text-[var(--cyan)] border border-[rgba(46,242,255,0.1)]' : 'hover:bg-[var(--bg-hover)] hover:text-white'}`} onClick={closeMobile}>
              <i className="fas fa-trophy w-5 text-center text-[0.95rem] text-[var(--text-muted)] transition-colors duration-[250ms]"></i> Tournaments
            </NavLink>
          </li>
          <li className="mb-0.5">
            <NavLink to="/current-game" className={({ isActive }) => `flex items-center gap-3 px-3.5 py-2.5 rounded-[var(--radius-md)] text-[var(--text-secondary)] text-[0.88rem] font-medium transition-all duration-[250ms] no-underline relative ${isActive ? 'bg-[rgba(46,242,255,0.08)] text-[var(--cyan)] border border-[rgba(46,242,255,0.1)]' : 'hover:bg-[var(--bg-hover)] hover:text-white'}`} onClick={closeMobile}>
              <i className="fas fa-gamepad w-5 text-center text-[0.95rem] text-[var(--text-muted)] transition-colors duration-[250ms]"></i> Current Game
            </NavLink>
          </li>
        </ul>

        <div className="h-px bg-[var(--border)] mx-5 my-2" />

        <div className="px-5 pt-5 pb-2 text-[0.65rem] font-bold uppercase tracking-[0.15em] text-[var(--text-dim)]">Your Profile</div>
        <ul className="list-none px-2.5 py-1 m-0">
          <li className="mb-0.5">
            <NavLink to="/account" className={({ isActive }) => `flex items-center gap-3 px-3.5 py-2.5 rounded-[var(--radius-md)] text-[var(--text-secondary)] text-[0.88rem] font-medium transition-all duration-[250ms] no-underline relative ${isActive ? 'bg-[rgba(46,242,255,0.08)] text-[var(--cyan)] border border-[rgba(46,242,255,0.1)]' : 'hover:bg-[var(--bg-hover)] hover:text-white'}`} onClick={closeMobile}>
              <i className="fas fa-user w-5 text-center text-[0.95rem] text-[var(--text-muted)] transition-colors duration-[250ms]"></i> Account
            </NavLink>
          </li>
          <li className="mb-0.5">
            <NavLink to="/match-history" className={({ isActive }) => `flex items-center gap-3 px-3.5 py-2.5 rounded-[var(--radius-md)] text-[var(--text-secondary)] text-[0.88rem] font-medium transition-all duration-[250ms] no-underline relative ${isActive ? 'bg-[rgba(46,242,255,0.08)] text-[var(--cyan)] border border-[rgba(46,242,255,0.1)]' : 'hover:bg-[var(--bg-hover)] hover:text-white'}`} onClick={closeMobile}>
              <i className="fas fa-history w-5 text-center text-[0.95rem] text-[var(--text-muted)] transition-colors duration-[250ms]"></i> Match History
            </NavLink>
          </li>
        </ul>

        {isAdmin && (
          <>
            <div className="h-px bg-[var(--border)] mx-5 my-2" />
            <div className="px-5 pt-5 pb-2 text-[0.65rem] font-bold uppercase tracking-[0.15em] text-[var(--text-dim)]">Admin</div>
            <ul className="list-none px-2.5 py-1 m-0">
              <li className="mb-0.5">
                <NavLink to="/admin-dashboard" className={({ isActive }) => `flex items-center gap-3 px-3.5 py-2.5 rounded-[var(--radius-md)] text-[var(--text-secondary)] text-[0.88rem] font-medium transition-all duration-[250ms] no-underline relative ${isActive ? 'bg-[rgba(46,242,255,0.08)] text-[var(--cyan)] border border-[rgba(46,242,255,0.1)]' : 'hover:bg-[var(--bg-hover)] hover:text-white'}`} onClick={closeMobile}>
                  <i className="fas fa-shield-alt w-5 text-center text-[0.95rem] text-[var(--text-muted)] transition-colors duration-[250ms]"></i> Admin Panel
                </NavLink>
              </li>
            </ul>
          </>
        )}

        <button
          onClick={handleLogout}
          className="mt-auto mb-5 mx-3.5 px-4 py-3 flex items-center gap-2.5 bg-[rgba(239,68,68,0.05)] border border-[rgba(239,68,68,0.15)] rounded-[var(--radius-md)] text-[var(--text-secondary)] text-[0.88rem] font-medium cursor-pointer transition-all duration-[250ms] hover:bg-[rgba(239,68,68,0.12)] hover:border-[rgba(239,68,68,0.3)] hover:text-[var(--red)]"
        >
          <i className="fas fa-sign-out-alt text-[var(--text-muted)] transition-colors duration-[250ms]"></i> Logout
        </button>
      </div>
    </>
  );
};

export default Sidebar;
