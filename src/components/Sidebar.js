import React, { useState, useEffect } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import '@fortawesome/fontawesome-free/css/all.min.css';
import './Sidebar.css';
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
      <button className="mobile-menu-btn" onClick={() => setMobileOpen(!mobileOpen)}>
        <i className={`fas fa-${mobileOpen ? 'times' : 'bars'}`}></i>
      </button>
      {mobileOpen && <div className="sidebar-overlay" onClick={closeMobile} />}
      <div className={`sidebar ${mobileOpen ? 'sidebar-open' : ''}`}>
        <div className="sidebar-brand">
          <img src={logo} alt="Fnt Arena" className="sidebar-logo-img" />
          <div>
            <h1 className="sidebar-logo">Fnt Arena</h1>
            <p className="sidebar-subtitle">Tournament Platform</p>
          </div>
        </div>

        <div className="sidebar-section-label">Main</div>
        <ul className="sidebar-menu">
          <li>
            <NavLink to="/dashboard" className={({ isActive }) => (isActive ? 'active-nav' : '')} onClick={closeMobile}>
              <i className="fas fa-home"></i> Dashboard
            </NavLink>
          </li>
          <li>
            <NavLink to="/tournaments" className={({ isActive }) => (isActive ? 'active-nav' : '')} onClick={closeMobile}>
              <i className="fas fa-trophy"></i> Tournaments
            </NavLink>
          </li>
          <li>
            <NavLink to="/current-game" className={({ isActive }) => (isActive ? 'active-nav' : '')} onClick={closeMobile}>
              <i className="fas fa-gamepad"></i> Current Game
            </NavLink>
          </li>
        </ul>

        <div className="sidebar-divider" />

        <div className="sidebar-section-label">Your Profile</div>
        <ul className="sidebar-menu">
          <li>
            <NavLink to="/account" className={({ isActive }) => (isActive ? 'active-nav' : '')} onClick={closeMobile}>
              <i className="fas fa-user"></i> Account
            </NavLink>
          </li>
          <li>
            <NavLink to="/match-history" className={({ isActive }) => (isActive ? 'active-nav' : '')} onClick={closeMobile}>
              <i className="fas fa-history"></i> Match History
            </NavLink>
          </li>
        </ul>

        {isAdmin && (
          <>
            <div className="sidebar-divider" />
            <div className="sidebar-section-label">Admin</div>
            <ul className="sidebar-menu">
              <li>
                <NavLink to="/admin-dashboard" className={({ isActive }) => (isActive ? 'active-nav' : '')} onClick={closeMobile}>
                  <i className="fas fa-shield-alt"></i> Admin Panel
                </NavLink>
              </li>
              <li>
                <NavLink to="/teams" className={({ isActive }) => (isActive ? 'active-nav' : '')} onClick={closeMobile}>
                  <i className="fas fa-users"></i> Teams
                </NavLink>
              </li>
            </ul>
          </>
        )}

        <button onClick={handleLogout} className="sidebar-logout-button">
          <i className="fas fa-sign-out-alt"></i> Logout
        </button>
      </div>
    </>
  );
};

export default Sidebar;
