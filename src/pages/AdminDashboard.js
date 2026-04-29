import React, { useState, useEffect, useRef, useCallback } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { io } from 'socket.io-client';
import { API_BASE_URL, SOCKET_BASE_URL, buildDiscordAvatar, DISCORD_AVATAR_FALLBACK } from '../utils/api';
import { getRank, getRankLabel } from '../utils/ranks';
import './AdminDashboard.css';
import './Leaderboard.css';

const MAX_FEED_ITEMS = 100;
const POLL_INTERVAL = 20000;

const AdminDashboard = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [stats, setStats] = useState(null);
  const [users, setUsers] = useState({ users: [], pagination: {} });
  const [selectedUser, setSelectedUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notifications, setNotifications] = useState([]);
  const [tournaments, setTournaments] = useState([]);
  const [selectedTournament, setSelectedTournament] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [staffNotifs, setStaffNotifs] = useState({ notifications: [], unreadCount: 0 });
  const [liveFeed, setLiveFeed] = useState([]);
  const [feedOpen, setFeedOpen] = useState(false);
  const [socketStatus, setSocketStatus] = useState('connecting');
  const [prevStats, setPrevStats] = useState(null);
  const [focusedMatchId, setFocusedMatchId] = useState(null);
  const feedEndRef = useRef(null);
  const pollRef = useRef(null);
  const socketRef = useRef(null);

  const api = axios.create({
    baseURL: API_BASE_URL,
    headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
  });

  const showNotification = useCallback((message, type) => {
    const id = Date.now();
    setNotifications(prev => [{ message, type, id }, ...prev.slice(0, 4)]);
    setTimeout(() => setNotifications(prev => prev.filter(n => n.id !== id)), 4000);
  }, []);

  const addFeedItem = useCallback((item) => {
    setLiveFeed(prev => {
      const next = [{ ...item, _id: item._id || Date.now() + Math.random() }, ...prev];
      return next.slice(0, MAX_FEED_ITEMS);
    });
  }, []);

  const getRiskColor = useCallback((score) => {
    if (score >= 80) return '#22c55e';
    if (score >= 50) return '#eab308';
    if (score >= 30) return '#f97316';
    return '#ef4444';
  }, []);

  const getStatusColor = useCallback((status) => {
    const colors = { registration: '#22c55e', active: '#3b82f6', completed: '#64748b', cancelled: '#ef4444' };
    return colors[status] || '#64748b';
  }, []);

  // Socket connection
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) return;

    const socket = io(`${SOCKET_BASE_URL}/admin`, {
      auth: { token },
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 2000,
      reconnectionDelayMax: 10000,
    });
    socketRef.current = socket;

    socket.on('connect', () => {
      setSocketStatus('connected');
      socket.emit('admin:subscribe');
    });

    socket.on('disconnect', () => setSocketStatus('disconnected'));
    socket.on('reconnecting', () => setSocketStatus('reconnecting'));
    socket.on('connect_error', () => setSocketStatus('error'));
    socket.on('admin:connected', () => setSocketStatus('connected'));
    socket.on('admin:subscribed', () => setSocketStatus('connected'));

    socket.on('admin:stats-update', (data) => {
      setPrevStats(s => s || data);
      setStats(data);
    });

    socket.on('admin:login-attempt', (data) => {
      addFeedItem({ type: data.success ? 'login' : 'login-failed', ...data, time: data._ts || Date.now() });
      if (!data.success && data.reason === 'banned') {
        showNotification(`Banned user attempted login: ${data.discordName || 'unknown'}`, 'error');
      }
    });

    socket.on('admin:flag-raised', (data) => {
      addFeedItem({ type: 'flag', ...data, time: data._ts || Date.now() });
      if (data.severity === 'high' || data.severity === 'critical') {
        showNotification(`🚨 ${data.severity.toUpperCase()} flag: ${data.discordName} - ${data.flag}`, 'error');
      }
    });

    socket.on('admin:user-banned', (data) => {
      addFeedItem({ type: 'ban', ...data, time: data._ts || Date.now() });
      showNotification(`User banned: ${data.discordName} by ${data.by}`, 'error');
    });

    socket.on('admin:user-unbanned', (data) => {
      addFeedItem({ type: 'unban', ...data, time: data._ts || Date.now() });
    });

    socket.on('admin:user-warned', (data) => {
      addFeedItem({ type: 'warn', ...data, time: data._ts || Date.now() });
    });

    socket.on('admin:user-striked', (data) => {
      addFeedItem({ type: 'strike', ...data, time: data._ts || Date.now() });
      if (data.autoBanned) showNotification(`Auto-banned after 3 strikes: ${data.discordName}`, 'error');
    });

    socket.on('admin:queue-join', (data) => {
      addFeedItem({ type: 'queue-join', ...data, time: data._ts || Date.now() });
    });

    socket.on('admin:queue-leave', (data) => {
      addFeedItem({ type: 'queue-leave', ...data, time: data._ts || Date.now() });
    });

    socket.on('admin:match-start', (data) => {
      addFeedItem({ type: 'match-start', ...data, time: data._ts || Date.now() });
    });

    socket.on('admin:report-submitted', (data) => {
      addFeedItem({ type: 'report', ...data, time: data._ts || Date.now() });
    });

    return () => socket.close();
  }, [addFeedItem, showNotification]);

  // Auto-refresh fallback polling
  useEffect(() => {
    const poll = () => {
      if (socketStatus !== 'connected') {
        fetchDashboardStats();
        fetchStaffNotifications();
      }
    };
    pollRef.current = setInterval(poll, POLL_INTERVAL);
    return () => clearInterval(pollRef.current);
  }, [socketStatus]);

  // Initial fetch
  useEffect(() => {
    fetchDashboardStats();
    fetchStaffNotifications();
    const interval = setInterval(fetchStaffNotifications, 10000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (activeTab === 'users') fetchUsers();
    if (activeTab === 'tournaments') fetchTournaments();
    if (activeTab === 'staff-alerts') fetchStaffNotifications();
  }, [activeTab]);

  // Auto-scroll feed
  useEffect(() => {
    if (feedOpen && feedEndRef.current) {
      feedEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [liveFeed, feedOpen]);

  const fetchDashboardStats = async () => {
    try {
      const res = await api.get('/admin/dashboard/stats');
      setPrevStats(s => s || res.data);
      setStats(res.data);
    } catch (err) {
      if (err.response?.status === 403) navigate('/');
    } finally {
      setLoading(false);
    }
  };

  const fetchStaffNotifications = async () => {
    try {
      const res = await api.get('/staff-notifications');
      setStaffNotifs(res.data);
    } catch (err) {}
  };

  const fetchUsers = async (page = 1, search = '') => {
    try {
      const res = await api.get(`/admin/users?page=${page}&search=${search}&limit=50`);
      setUsers(res.data);
    } catch (err) {
      showNotification('Failed to fetch users', 'error');
    }
  };

  const fetchTournaments = async () => {
    try {
      const res = await api.get('/admin/tournaments');
      setTournaments(res.data);
    } catch (err) {
      showNotification('Failed to fetch tournaments', 'error');
    }
  };

  const fetchUserDetails = async (discordId) => {
    try {
      const res = await api.get(`/admin/users/${discordId}`);
      setSelectedUser(res.data);
    } catch (err) {
      showNotification('Failed to load user details', 'error');
    }
  };

  const fetchTournamentDetails = async (id) => {
    try {
      const res = await api.get(`/admin/tournaments/${id}`);
      setSelectedTournament(res.data);
    } catch (err) {
      showNotification('Failed to load tournament', 'error');
    }
  };

  const handleUserAction = async (discordId, action, data = {}) => {
    try {
      await api.post(`/admin/users/${discordId}/${action}`, data);
      fetchDashboardStats();
      fetchUsers();
      if (selectedUser?.user?.discordId === discordId) fetchUserDetails(discordId);
      showNotification(`Action "${action}" completed`, 'success');
    } catch (err) {
      showNotification(err.response?.data?.message || 'Action failed', 'error');
    }
  };

  const handleWhitelistIP = async (ip) => {
    if (!ip) return;
    try {
      await api.post('/admin/ip-analysis/whitelist', {
        ip,
        note: `Whitelisted from user panel (${selectedUser?.user?.discordName || 'Unknown'})`,
      });
      showNotification(`Whitelisted IP ${ip}`, 'success');
      if (selectedUser?.user?.discordId) fetchUserDetails(selectedUser.user.discordId);
    } catch (err) {
      showNotification(err.response?.data?.message || 'Failed to whitelist IP', 'error');
    }
  };

  const [confirmModal, setConfirmModal] = useState(null);

  const handleTournamentAction = async (id, action, data = {}) => {
    if (action === 'delete') {
      setConfirmModal({
        message: 'Are you sure you want to DELETE this tournament? This cannot be undone!',
        onConfirm: async () => {
          try {
            await api.delete(`/admin/tournaments/${id}`);
            fetchTournaments();
            setSelectedTournament(null);
            showNotification('Tournament deleted successfully', 'success');
          } catch (err) {
            showNotification(err.response?.data?.message || 'Failed to delete tournament', 'error');
          }
          setConfirmModal(null);
        },
        onCancel: () => setConfirmModal(null),
      });
      return;
    }
    try {
      let endpoint = `/admin/tournaments/${id}/${action}`;
      if (action === 'create') endpoint = '/admin/tournaments';
      const res = await api.post(endpoint, data);
      fetchTournaments();
      setSelectedTournament(null);
      showNotification(res.data.message || `Tournament ${action} successful`, 'success');
    } catch (err) {
      showNotification(err.response?.data?.message || `Failed to ${action} tournament`, 'error');
    }
  };

  const handleTournamentUpdate = async (id, data) => {
    try {
      const res = await api.put(`/admin/tournaments/${id}`, data);
      fetchTournaments();
      showNotification(res.data.message || 'Tournament updated', 'success');
      return res.data;
    } catch (err) {
      showNotification(err.response?.data?.message || 'Update failed', 'error');
      throw err;
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await api.post('/staff-notifications/mark-all-read');
      setStaffNotifs(prev => ({ ...prev, unreadCount: 0 }));
    } catch (err) {}
  };

  const handleNotifClick = async (n) => {
    if (!n.read) {
      try {
        await api.post(`/staff-notifications/${n._id}/read`);
        setStaffNotifs(prev => ({
          ...prev,
          unreadCount: Math.max(0, prev.unreadCount - 1),
          notifications: prev.notifications.map(x => x._id === n._id ? { ...x, read: true } : x),
        }));
      } catch (err) {}
    }
    if (n.matchId) {
      navigate(`/match/${n.matchId}`);
    }
  };

  const notifTypeIcon = (type) => {
    if (type === 'dispute') return '⚖️';
    if (type === 'call_staff') return '🆘';
    if (type === 'match_completed') return '✅';
    return '🔔';
  };

  const feedItemIcon = (type) => {
    const icons = {
      'login': '🔵', 'login-failed': '🔴', 'flag': '⚡', 'ban': '⊘',
      'unban': '✓', 'warn': '⚠', 'strike': '✕', 'queue-join': '▶',
      'queue-leave': '◀', 'match-start': '⚔', 'report': '🚨',
    };
    return icons[type] || '●';
  };

  const feedItemLabel = (item) => {
    switch (item.type) {
      case 'login': return `${item.discordName} logged in`;
      case 'login-failed': return `Login failed: ${item.discordName || 'unknown'} (${item.reason || '?'})`;
      case 'flag': return `Flag: ${item.discordName} - ${item.flag}`;
      case 'ban': return `${item.discordName} banned by ${item.by}`;
      case 'unban': return `${item.discordName} unbanned by ${item.by}`;
      case 'warn': return `${item.discordName} warned by ${item.by}`;
      case 'strike': return `${item.discordName} striked by ${item.by}${item.autoBanned ? ' [auto-ban]' : ''}`;
      case 'queue-join': return `${item.username} joined queue (${item.tournamentId?.substring(0, 8)}...)`;
      case 'queue-leave': return `User left queue (${item.userId?.substring(0, 8)}...)`;
      case 'match-start': return item.teamMatch
        ? `Squad match: ${item.player1} vs ${item.player2}`
        : `Match: ${item.player1} vs ${item.player2}`;
      case 'report': return `Report in match ${item.matchId?.substring(0, 8)}...`;
      default: return `Event: ${JSON.stringify(item).substring(0, 60)}`;
    }
  };

  if (loading) {
    return (
      <div className="admin-loading">
        <div className="cyber-loader"></div>
        <p>INITIALIZING...</p>
      </div>
    );
  }

  return (
    <div className={`admin-dashboard ${sidebarOpen ? 'sidebar-open' : ''}`}>
      <div className="notification-panel">
        {notifications.map(n => (
          <div key={n.id} className={`notification ${n.type}`}>
            <span>{n.type === 'success' ? '✓' : '✗'}</span>
            {n.message}
          </div>
        ))}
      </div>

      <button className="mobile-menu-btn" onClick={() => setSidebarOpen(!sidebarOpen)}>
        {sidebarOpen ? '✕' : '☰'}
      </button>

      <aside className={`admin-sidebar ${sidebarOpen ? 'open' : ''}`}>
        <div className="sidebar-header">
          <div className={`socket-indicator ${socketStatus}`} title={`Socket: ${socketStatus}`} />
          <div className="sidebar-brand">
            <h2>ADMIN</h2>
            <span className={`socket-label ${socketStatus}`}>
              {socketStatus === 'connected' ? 'Live' : socketStatus === 'reconnecting' ? 'Reconnecting...' : socketStatus === 'disconnected' ? 'Disconnected' : 'Connecting...'}
            </span>
          </div>
        </div>

        <nav className="sidebar-nav">
          <button className={activeTab === 'dashboard' ? 'active' : ''} onClick={() => { setActiveTab('dashboard'); setSidebarOpen(false); }}>
            <span className="nav-icon">◈</span>
            <span className="nav-label">Dashboard</span>
          </button>
          <button className={activeTab === 'tournaments' ? 'active' : ''} onClick={() => { setActiveTab('tournaments'); setSidebarOpen(false); }}>
            <span className="nav-icon">🏆</span>
            <span className="nav-label">Tournaments</span>
            <span className="badge">{stats?.overview?.activeTournaments || 0}</span>
          </button>
          <button className={activeTab === 'users' ? 'active' : ''} onClick={() => { setActiveTab('users'); setSidebarOpen(false); }}>
            <span className="nav-icon">◎</span>
            <span className="nav-label">Users</span>
          </button>
          <button className={`${activeTab === 'matches' ? 'active' : ''} has-alerts`} onClick={() => { setActiveTab('matches'); setSidebarOpen(false); }}>
            <span className="nav-icon">⚔</span>
            <span className="nav-label">Matches</span>
            <span className="badge danger">{staffNotifs.unreadCount > 0 ? staffNotifs.unreadCount : ''}</span>
          </button>
          <button className={activeTab === 'staff-alerts' ? 'active' : ''} onClick={() => { setActiveTab('staff-alerts'); setSidebarOpen(false); }}>
            <span className="nav-icon">🔔</span>
            <span className="nav-label">Staff Alerts</span>
            <span className="badge danger">{staffNotifs.unreadCount > 0 ? staffNotifs.unreadCount : ''}</span>
          </button>
          <button className={activeTab === 'anticheat' ? 'active' : ''} onClick={() => { setActiveTab('anticheat'); setSidebarOpen(false); }}>
            <span className="nav-icon">⚡</span>
            <span className="nav-label">Anticheat</span>
            <span className="badge danger">{stats?.overview?.flaggedAccounts || 0}</span>
          </button>

        </nav>

        <div className="sidebar-footer">
          <button onClick={() => navigate('/')} className="back-btn">← Back to Site</button>
        </div>
      </aside>

      <main className="admin-main">
        <div className="admin-main-header">
          <div className="live-feed-toggle" onClick={() => setFeedOpen(!feedOpen)}>
            <span className={`feed-dot ${feedOpen ? 'active' : ''}`} />
            <span>Live Feed {liveFeed.length > 0 ? `(${liveFeed.length})` : ''}</span>
            <span className="feed-arrow">{feedOpen ? '▼' : '▲'}</span>
          </div>
          {socketStatus !== 'connected' && (
            <div className="reconnect-banner">
              <span className="reconnect-pulse" />
              {socketStatus === 'reconnecting' ? 'Reconnecting...' : 'Offline mode - updates delayed'}
            </div>
          )}
        </div>

        {feedOpen && (
          <div className="live-feed-panel">
            <div className="feed-header">
              <strong>Live Activity Feed</strong>
              <button className="feed-clear-btn" onClick={() => setLiveFeed([])}>Clear</button>
            </div>
            <div className="feed-list">
              {liveFeed.length === 0 ? (
                <div className="feed-empty">Waiting for events...</div>
              ) : liveFeed.map((item, i) => (
                <div key={item._id} className={`feed-item ${i === 0 ? 'fresh' : ''}`}>
                  <span className="feed-icon">{feedItemIcon(item.type)}</span>
                  <span className="feed-text">{feedItemLabel(item)}</span>
                  <span className="feed-time">{new Date(item.time).toLocaleTimeString()}</span>
                </div>
              ))}
              <div ref={feedEndRef} />
            </div>
          </div>
        )}

        {activeTab === 'dashboard' && <DashboardTab stats={stats} prevStats={prevStats} onNavigate={(tab) => setActiveTab(tab)} />}
        {activeTab === 'tournaments' && (
          <TournamentsTab
            tournaments={tournaments}
            selectedTournament={selectedTournament}
            onSelectTournament={fetchTournamentDetails}
            onAction={handleTournamentAction}
            onUpdate={handleTournamentUpdate}
            getStatusColor={getStatusColor}
          />
        )}
        {activeTab === 'users' && (
          <UsersTab
            users={users}
            selectedUser={selectedUser}
            onSearch={fetchUsers}
            onSelectUser={fetchUserDetails}
            onAction={handleUserAction}
            onWhitelistIP={handleWhitelistIP}
            getRiskColor={getRiskColor}
          />
        )}
        {activeTab === 'staff-alerts' && (
          <StaffAlertsTab
            notifications={staffNotifs.notifications}
            unreadCount={staffNotifs.unreadCount}
            onRefresh={fetchStaffNotifications}
            onMarkAllRead={handleMarkAllRead}
            onOpenAlert={handleNotifClick}
            notifTypeIcon={notifTypeIcon}
          />
        )}
        {activeTab === 'anticheat' && <AnticheatTab api={api} />}
        {activeTab === 'matches' && <MatchesTab api={api} notify={showNotification} focusedMatchId={focusedMatchId} />}

      </main>

      {sidebarOpen && <div className="sidebar-overlay" onClick={() => setSidebarOpen(false)} />}

      {confirmModal && (
        <div className="modal-overlay" onClick={confirmModal.onCancel}>
          <div className="modal-content confirm-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>⚠️ Confirm Action</h3>
            </div>
            <div className="modal-body">
              <p>{confirmModal.message}</p>
            </div>
            <div className="modal-footer">
              <button className="cancel-btn" onClick={confirmModal.onCancel}>Cancel</button>
              <button className="submit-btn danger" onClick={confirmModal.onConfirm}>Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const AnimatedStat = ({ value, label, icon, iconBg, color, onClick, trend }) => {
  const [prev, setPrev] = useState(value);
  const [changed, setChanged] = useState(false);
  useEffect(() => {
    if (prev !== value) {
      setChanged(true);
      setPrev(value);
      const t = setTimeout(() => setChanged(false), 1200);
      return () => clearTimeout(t);
    }
  }, [value]);
  return (
    <div className={`stat-card ${changed ? 'stat-updated' : ''}`} style={color ? { borderLeftColor: color } : {}} onClick={onClick}>
      <div className="stat-icon" style={iconBg ? { background: iconBg } : {}}>{icon}</div>
      <div className="stat-info">
        <span className="stat-value">{value?.toLocaleString?.() ?? value ?? 0}</span>
        <span className="stat-label">{label}</span>
      </div>
      {trend && <div className={`stat-trend up`}>{trend}</div>}
    </div>
  );
};

const DashboardTab = ({ stats, prevStats, onNavigate }) => (
  <div className="dashboard-tab">
    <div className="tab-title-section">
      <h2>Dashboard Overview</h2>
      <p className="section-subtitle">Real-time platform statistics and activity</p>
    </div>

    <div className="stats-grid">
      <AnimatedStat value={stats?.overview?.totalUsers} label="Total Users" icon="◎" iconBg="rgba(46,242,255,0.15)" onClick={() => onNavigate('users')}
        trend={`+${stats?.overview?.activeUsers || 0} active`} />
      <AnimatedStat value={stats?.overview?.totalMatches} label="Total Matches" icon="⚔" iconBg="rgba(249,115,22,0.15)" />
      <AnimatedStat value={stats?.overview?.activeTournaments} label="Active Tournaments" icon="●" iconBg="rgba(59,130,246,0.15)" />
      <AnimatedStat value={stats?.overview?.activeMatchCount} label="Active Matches" icon="◉" color="#22c55e" iconBg="rgba(34,197,94,0.15)" />
      <AnimatedStat value={stats?.overview?.queueCount} label="In Queue" icon="≡" color="#8b5cf6" iconBg="rgba(139,92,246,0.15)" />
      <AnimatedStat value={stats?.overview?.flaggedAccounts} label="Flagged Accounts" icon="⚡" iconBg="rgba(234,179,8,0.15)" />
      <AnimatedStat value={stats?.overview?.bannedUsers} label="Banned" icon="⊘" iconBg="rgba(239,68,68,0.15)" />
      <AnimatedStat value={stats?.overview?.premiumUsers} label="Premium" icon="★" iconBg="rgba(255,215,0,0.15)" />
    </div>

    <div className="dashboard-sections">
      <section className="recent-activity">
        <h3><span className="section-icon">⊘</span> Recent Bans</h3>
        {stats?.recentBans?.length > 0 ? stats.recentBans.map((ban, i) => (
          <div key={i} className="activity-item ban">
            <span className="activity-icon">⊘</span>
            <div className="activity-info">
              <span className="activity-name">{ban.discordName}</span>
              <span className="activity-reason">{ban.banReason}</span>
            </div>
            <span className="activity-time">{new Date(ban.bannedAt).toLocaleDateString()}</span>
          </div>
        )) : <p className="no-data">No recent bans</p>}
      </section>

      <section className="recent-activity">
        <h3><span className="section-icon">⚡</span> Recent Flags</h3>
        {stats?.recentFlags?.length > 0 ? stats.recentFlags.slice(0, 5).map((user, i) =>
          user.flagHistory?.filter(f => !f.resolved).slice(0, 2).map((flag, fi) => (
            <div key={`${i}-${fi}`} className="activity-item ban">
              <span className="activity-icon">⚡</span>
              <div className="activity-info">
                <span className="activity-name">{user.discordName}</span>
                <span className="activity-reason">{flag.flag}: {flag.description?.substring(0, 80)}</span>
              </div>
              <span className="activity-time" style={{ color: flag.severity === 'high' || flag.severity === 'critical' ? '#ef4444' : '#eab308' }}>
                {flag.severity}
              </span>
            </div>
          ))
        ) : <p className="no-data">No recent flags</p>}
      </section>

      <section className="top-players">
        <h3><span className="section-icon">★</span> Top Players</h3>
        {stats?.topPlayers?.slice(0, 5).map((player, i) => (
          <div key={i} className="leaderboard-item">
            <span className="rank">#{i + 1}</span>
            <span className="player-avatar">
              <img src={buildDiscordAvatar(player.discordId, player.discordAvatar) || DISCORD_AVATAR_FALLBACK} alt="" className="player-avatar" />
            </span>
            <span className="player-name">{player.discordName}</span>
            <span className="player-stats">{player.wins}W / {player.losses}L</span>
            <span className="player-points">{getRankLabel(player.rankingPoints || 0)}</span>
          </div>
        ))}
      </section>

      <section className="anticheat-summary">
        <h3><span className="section-icon">⚡</span> Quick Actions</h3>
        <div className="quick-actions">
          <button onClick={() => onNavigate('tournaments')}><span className="qa-icon">🏆</span> Create Tournament</button>
          <button onClick={() => onNavigate('anticheat')}><span className="qa-icon">⚡</span> View Alerts</button>

        </div>
      </section>
    </div>
  </div>
);

const TournamentsTab = ({ tournaments, selectedTournament, onSelectTournament, onAction, onUpdate, getStatusColor }) => {
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [filter, setFilter] = useState('all');
  const [showDetailModal, setShowDetailModal] = useState(false);

  const filteredTournaments = filter === 'all' ? tournaments : tournaments.filter(t => t.status === filter);

  const handleAction = async (id, action) => {
    await onAction(id, action);
  };

  return (
    <div className="tournaments-tab">
      <div className="tab-title-section">
        <div>
          <h2>Tournament Management</h2>
          <p className="section-subtitle">{tournaments.length} total tournaments</p>
        </div>
        <button className="create-btn" onClick={() => setShowCreateModal(true)}>
          + Create Tournament
        </button>
      </div>

      <div className="filter-tabs">
        <button className={filter === 'all' ? 'active' : ''} onClick={() => setFilter('all')}>All ({tournaments.length})</button>
        <button className={filter === 'registration' ? 'active' : ''} onClick={() => setFilter('registration')}>Registration</button>
        <button className={filter === 'active' ? 'active' : ''} onClick={() => setFilter('active')}>Active</button>
        <button className={filter === 'completed' ? 'active' : ''} onClick={() => setFilter('completed')}>Completed</button>
        <button className={filter === 'cancelled' ? 'active' : ''} onClick={() => setFilter('cancelled')}>Cancelled</button>
      </div>

      <div className="tournaments-grid">
        {filteredTournaments.map(tournament => (
          <div key={tournament._id} className="tournament-card" onClick={() => { onSelectTournament(tournament._id); setShowDetailModal(true); }}>
            <div className="tcard-top">
              <span className="tcard-status" style={{ background: getStatusColor(tournament.status) }}>{tournament.status}</span>
              <span className="tcard-type">{tournament.type || '1v1'}</span>
            </div>
            <div className="tcard-body">
              <h3>{tournament.title}</h3>
              <p>{tournament.description?.substring(0, 100)}...</p>
              <div className="tcard-meta">
                <span><span className="meta-icon">📍</span> {tournament.mapCode}</span>
                <span><span className="meta-icon">👥</span> {tournament.participantCount || 0}/{tournament.maxPlayers}</span>
                <span><span className="meta-icon">🏁</span> {new Date(tournament.startDate).toLocaleDateString()}</span>
              </div>
            </div>
            <div className="tcard-actions" onClick={e => e.stopPropagation()}>
              {tournament.status === 'registration' && (
                <button className="btn-sm success" onClick={() => handleAction(tournament._id, 'activate')}>▶ Activate</button>
              )}
              {tournament.status === 'active' && (
                <button className="btn-sm primary" onClick={() => handleAction(tournament._id, 'complete')}>✓ Complete</button>
              )}
              {(tournament.status === 'registration' || tournament.status === 'active') && (
                <button className="btn-sm warning" onClick={() => {
                  if (window.confirm('Cancel this tournament? This will end all ongoing matches.')) {
                    handleAction(tournament._id, 'cancel');
                  }
                }}>✕ Cancel</button>
              )}
              <button className="btn-sm" onClick={() => { onSelectTournament(tournament._id); setShowDetailModal(true); }}>👁 View</button>
              <button className="btn-sm danger" onClick={() => handleAction(tournament._id, 'delete')}>🗑 Delete</button>
            </div>
          </div>
        ))}
      </div>

      {filteredTournaments.length === 0 && (
        <div className="empty-state">
          <span>🏆</span>
          <p>No tournaments found</p>
          <button onClick={() => setShowCreateModal(true)}>Create your first tournament</button>
        </div>
      )}

      {showCreateModal && (
        <CreateTournamentModal
          onClose={() => setShowCreateModal(false)}
          onSubmit={async (data) => {
            await onAction(null, 'create', data);
            setShowCreateModal(false);
          }}
        />
      )}

      {showDetailModal && selectedTournament && (
        <TournamentDetailModal
          tournament={selectedTournament}
          onClose={() => setShowDetailModal(false)}
          onAction={onAction}
          onUpdate={onUpdate}
          getStatusColor={getStatusColor}
        />
      )}
    </div>
  );
};

const CreateTournamentModal = ({ onClose, onSubmit }) => {
const [form, setForm] = useState({
    title: '', description: '', mapCode: '', mapName: '', type: '1v1',
    bannerImage: '', startDate: '', endDate: '', maxPlayers: 16, prize: '', rules: '',
  });
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);

  const validate = () => {
    const errs = {};
    if (!form.title.trim()) errs.title = 'Title is required';
    if (!form.description.trim()) errs.description = 'Description is required';
    if (!form.mapCode.trim()) errs.mapCode = 'Map code is required';
    if (!form.rules.trim()) errs.rules = 'Rules are required';
    if (!form.startDate) errs.startDate = 'Start date is required';
    if (!form.endDate) errs.endDate = 'End date is required';
    if (form.startDate && form.endDate) {
      const start = new Date(form.startDate);
      const end = new Date(form.endDate);
      if (start >= end) errs.endDate = 'End date must be after start date';
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;
    setSubmitting(true);
    const fixed = { ...form };
    ['startDate', 'endDate'].forEach(k => {
      if (fixed[k]) {
        const d = new Date(fixed[k]);
        fixed[k] = d.toISOString();
      }
    });
    // Backward-compatible with older backend builds that still require this field.
    fixed.registrationDeadline = fixed.startDate;
    try { await onSubmit(fixed); } finally { setSubmitting(false); }
  };

  const updateField = (field, value) => {
    setForm(prev => ({ ...prev, [field]: value }));
    if (errors[field]) setErrors(prev => ({ ...prev, [field]: null }));
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content large" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Create New Tournament</h3>
          <button onClick={onClose} className="close-btn">✕</button>
        </div>
        <div className="modal-body modal-body-scroll">
          <form id="create-tournament-form" onSubmit={handleSubmit}>
            <div className="form-group">
              <label>Tournament Title *</label>
              <input type="text" value={form.title} onChange={e => updateField('title', e.target.value)} placeholder="Enter tournament name..." className={errors.title ? 'error' : ''} />
              {errors.title && <span className="error-msg">{errors.title}</span>}
            </div>
            <div className="form-group">
              <label>Description *</label>
              <textarea value={form.description} onChange={e => updateField('description', e.target.value)} placeholder="Describe your tournament..." className={errors.description ? 'error' : ''} />
              {errors.description && <span className="error-msg">{errors.description}</span>}
            </div>
            <div className="form-group">
              <label>Banner Image URL</label>
              <input
                type="url"
                value={form.bannerImage}
                onChange={e => updateField('bannerImage', e.target.value)}
                placeholder="https://example.com/tournament-banner.jpg"
              />
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>Map Code *</label>
                <input type="text" value={form.mapCode} onChange={e => updateField('mapCode', e.target.value)} placeholder="e.g. FN-1234" className={errors.mapCode ? 'error' : ''} />
                {errors.mapCode && <span className="error-msg">{errors.mapCode}</span>}
              </div>
              <div className="form-group">
                <label>Map Name</label>
                <input type="text" value={form.mapName} onChange={e => updateField('mapName', e.target.value)} placeholder="Optional map name" />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>Type</label>
                <select value={form.type} onChange={e => updateField('type', e.target.value)}>
                  <option value="1v1">1v1</option>
                  <option value="2v2">2v2</option> <option value="3v3">3v3</option> <option value="4v4">4v4</option>
                </select>
              </div>
              <div className="form-group">
                <label>Max Players</label>
                <input type="number" value={form.maxPlayers} onChange={e => updateField('maxPlayers', parseInt(e.target.value))} min="2" max="128" />
              </div>
              <div className="form-group">
                <label>Prize Pool</label>
                <input type="text" value={form.prize} onChange={e => updateField('prize', e.target.value)} placeholder="e.g. $100, V-Bucks" />
              </div>
            </div>
            <div className="date-section">
              <h4>📅 Schedule</h4>
              <div className="form-row">
                <div className="form-group">
                  <label>Start Date *</label>
                  <input type="datetime-local" value={form.startDate} onChange={e => updateField('startDate', e.target.value)} className={errors.startDate ? 'error' : ''} />
                  {errors.startDate && <span className="error-msg">{errors.startDate}</span>}
                </div>
                <div className="form-group">
                  <label>End Date *</label>
                  <input type="datetime-local" value={form.endDate} onChange={e => updateField('endDate', e.target.value)} className={errors.endDate ? 'error' : ''} />
                  {errors.endDate && <span className="error-msg">{errors.endDate}</span>}
                </div>
              </div>
            </div>
            <div className="form-group">
              <label>Rules *</label>
              <textarea value={form.rules} onChange={e => updateField('rules', e.target.value)} placeholder="Enter competition rules..." className={errors.rules ? 'error' : ''} />
              {errors.rules && <span className="error-msg">{errors.rules}</span>}
            </div>
          </form>
        </div>
        <div className="modal-footer">
          <button type="button" onClick={onClose} className="cancel-btn">Cancel</button>
          <button type="submit" form="create-tournament-form" className="submit-btn" disabled={submitting}>
            {submitting ? 'Creating...' : 'Create Tournament'}
          </button>
        </div>
      </div>
    </div>
  );
};

const TournamentDetailModal = ({ tournament, onClose, onAction, onUpdate, getStatusColor }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    title: '',
    description: '',
    bannerImage: '',
    mapCode: '',
    mapName: '',
    rules: '',
    type: '1v1',
    startDate: '',
    endDate: '',
    maxPlayers: 16,
    minSkillRating: 0,
    maxSkillRating: 3000,
    prize: '',
    status: 'registration',
  });

  useEffect(() => {
    if (!tournament) return;
    const toLocalDatetime = (value) => {
      if (!value) return '';
      const d = new Date(value);
      if (Number.isNaN(d.getTime())) return '';
      const pad = (n) => String(n).padStart(2, '0');
      return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
    };
    setForm({
      title: tournament.title || '',
      description: tournament.description || '',
      bannerImage: tournament.bannerImage || '',
      mapCode: tournament.mapCode || '',
      mapName: tournament.mapName || '',
      rules: tournament.rules || '',
      type: tournament.type || '1v1',
      startDate: toLocalDatetime(tournament.startDate),
      endDate: toLocalDatetime(tournament.endDate),
      maxPlayers: tournament.maxPlayers || 16,
      minSkillRating: tournament.minSkillRating || 0,
      maxSkillRating: tournament.maxSkillRating || 3000,
      prize: tournament.prize || '',
      status: tournament.status || 'registration',
    });
    setIsEditing(false);
  }, [tournament?._id]);

  const updateField = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    if (!form.title.trim() || !form.description.trim() || !form.mapCode.trim() || !form.rules.trim()) {
      window.alert('Title, description, map code, and rules are required.');
      return;
    }
    const payload = {
      ...form,
      startDate: form.startDate ? new Date(form.startDate).toISOString() : tournament.startDate,
      endDate: form.endDate ? new Date(form.endDate).toISOString() : tournament.endDate,
      maxPlayers: Number(form.maxPlayers) || 16,
      minSkillRating: Number(form.minSkillRating) || 0,
      maxSkillRating: Number(form.maxSkillRating) || 3000,
      bannerImage: form.bannerImage?.trim() || null,
      mapName: form.mapName?.trim() || null,
      prize: form.prize?.trim() || null,
    };

    try {
      setSaving(true);
      await onUpdate(tournament._id, payload);
      setIsEditing(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content detail-modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <h3>{isEditing ? 'Edit Tournament' : tournament.title}</h3>
            <span className="status-badge" style={{ background: getStatusColor(tournament.status) }}>{tournament.status}</span>
          </div>
          <button onClick={onClose} className="close-btn">✕</button>
        </div>
        <div className="modal-body">
          {isEditing ? (
            <>
              <div className="form-group"><label>Title *</label><input type="text" value={form.title} onChange={(e) => updateField('title', e.target.value)} /></div>
              <div className="form-group"><label>Description *</label><textarea value={form.description} onChange={(e) => updateField('description', e.target.value)} rows={3} /></div>
              <div className="form-group"><label>Banner Image URL (optional)</label><input type="url" value={form.bannerImage} onChange={(e) => updateField('bannerImage', e.target.value)} placeholder="https://..." /></div>
              <div className="form-row">
                <div className="form-group"><label>Map Code *</label><input type="text" value={form.mapCode} onChange={(e) => updateField('mapCode', e.target.value)} /></div>
                <div className="form-group"><label>Map Name</label><input type="text" value={form.mapName} onChange={(e) => updateField('mapName', e.target.value)} /></div>
              </div>
              <div className="form-group"><label>Rules *</label><textarea value={form.rules} onChange={(e) => updateField('rules', e.target.value)} rows={4} /></div>
              <div className="form-row">
                <div className="form-group"><label>Type</label><select value={form.type} onChange={(e) => updateField('type', e.target.value)}>
                  <option value="1v1">1v1</option><option value="2v2">2v2</option><option value="3v3">3v3</option><option value="4v4">4v4</option>
                </select></div>
                <div className="form-group"><label>Status</label><select value={form.status} onChange={(e) => updateField('status', e.target.value)}>
                  <option value="registration">registration</option><option value="active">active</option><option value="completed">completed</option><option value="cancelled">cancelled</option>
                </select></div>
              </div>
              <div className="form-row">
                <div className="form-group"><label>Start Date</label><input type="datetime-local" value={form.startDate} onChange={(e) => updateField('startDate', e.target.value)} /></div>
                <div className="form-group"><label>End Date</label><input type="datetime-local" value={form.endDate} onChange={(e) => updateField('endDate', e.target.value)} /></div>
              </div>
              <div className="form-row">
                <div className="form-group"><label>Max Players</label><input type="number" min="2" max="128" value={form.maxPlayers} onChange={(e) => updateField('maxPlayers', e.target.value)} /></div>
                <div className="form-group"><label>Prize</label><input type="text" value={form.prize} onChange={(e) => updateField('prize', e.target.value)} /></div>
              </div>
              <div className="form-row">
                <div className="form-group"><label>Min Skill</label><input type="number" min="0" value={form.minSkillRating} onChange={(e) => updateField('minSkillRating', e.target.value)} /></div>
                <div className="form-group"><label>Max Skill</label><input type="number" min="0" value={form.maxSkillRating} onChange={(e) => updateField('maxSkillRating', e.target.value)} /></div>
              </div>
            </>
          ) : (
            <>
              <div className="detail-grid">
                <div className="detail-item"><label>Map Code</label><span>{tournament.mapCode}</span></div>
                <div className="detail-item"><label>Type</label><span>{tournament.type}</span></div>
                <div className="detail-item"><label>Max Players</label><span>{tournament.maxPlayers}</span></div>
                <div className="detail-item"><label>Prize</label><span>{tournament.prize || 'None'}</span></div>
                <div className="detail-item"><label>Start</label><span>{new Date(tournament.startDate).toLocaleString()}</span></div>
                <div className="detail-item"><label>End</label><span>{new Date(tournament.endDate).toLocaleString()}</span></div>
              </div>
              <div className="detail-section"><label>Description</label><p>{tournament.description}</p></div>
              <div className="detail-section"><label>Rules</label><p className="rules">{tournament.rules}</p></div>
              <div className="detail-section">
                <label>Participants ({tournament.participants?.length || 0})</label>
                <div className="participants-list">
                  {tournament.participants?.length > 0 ? tournament.participants.map((p, i) => (
                    <div key={i} className="participant-item">
                      <div className="participant-id-block">
                        <span className="name">{p.discordName || p.userId}</span>
                        {p.teamName ? <span className="participant-team-tag">{p.teamName}</span> : null}
                      </div>
                      <span className="epic">{p.epicName || '—'}</span>
                    </div>
                  )) : <p className="no-data">No participants yet</p>}
                </div>
              </div>
            </>
          )}
        </div>
        <div className="modal-footer actions">
          {isEditing ? (
            <>
              <button className="btn" onClick={() => setIsEditing(false)} disabled={saving}>Cancel Edit</button>
              <button className="btn primary" onClick={handleSave} disabled={saving}>{saving ? 'Saving...' : 'Save Changes'}</button>
            </>
          ) : (
            <>
              <button className="btn" onClick={() => setIsEditing(true)}>✏ Edit</button>
              {tournament.status === 'registration' && <button className="btn success" onClick={() => onAction(tournament._id, 'activate')}>▶ Activate</button>}
              {tournament.status === 'active' && <button className="btn primary" onClick={() => onAction(tournament._id, 'complete')}>✓ Complete</button>}
              {(tournament.status === 'registration' || tournament.status === 'active') && (
                <button className="btn warning" onClick={() => { if (window.confirm('Cancel this tournament?')) onAction(tournament._id, 'cancel'); }}>✕ Cancel</button>
              )}
              <button className="btn danger" onClick={() => onAction(tournament._id, 'delete')}>🗑 Delete</button>
              <button className="btn" onClick={onClose}>Close</button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

const UsersTab = ({ users, selectedUser, onSearch, onSelectUser, onAction, onWhitelistIP, getRiskColor }) => {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [showDetail, setShowDetail] = useState(false);
  const totalPages = users.pagination?.pages || 1;

  const handleSearch = (p) => {
    setPage(p);
    onSearch(p, search);
  };

  return (
    <div className="users-tab">
      <div className="tab-title-section">
        <h2>User Management <span style={{ fontSize: 14, color: '#94a3b8', fontWeight: 400 }}>({users.pagination?.total || 0} total)</span></h2>
        <div className="search-box">
          <input type="text" placeholder="Search by name, Discord ID..." value={search}
            onChange={e => setSearch(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleSearch(1)} />
          <button onClick={() => handleSearch(1)}>Search</button>
        </div>
      </div>

      <div className="users-content">
        <div className="users-table-wrap">
          <table>
            <thead>
              <tr>
                <th>User</th>
                <th>Role</th>
                <th>Score</th>
                <th>Rating</th>
                <th>Matches</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {users.users?.map(user => (
                <tr key={user.discordId} onClick={() => { onSelectUser(user.discordId); setShowDetail(true); }}>
                  <td className="user-cell">
                    <img src={buildDiscordAvatar(user.discordId, user.discordAvatar) || DISCORD_AVATAR_FALLBACK} alt="" className="avatar" />
                    <div className="user-info">
                      <span className="name">{user.discordName}</span>
                      <span className="epic">{user.epicGamesName || 'Not verified'}</span>
                    </div>
                  </td>
                  <td><span className={`role-badge ${user.role}`}>{user.role}</span></td>
                  <td>
                    <div className="score-bar">
                      <div className="score-fill" style={{ width: `${user.anticheatScore ?? 100}%`, background: getRiskColor(user.anticheatScore ?? 100) }}></div>
                      <span>{user.anticheatScore ?? 100}</span>
                    </div>
                  </td>
                  <td>{getRankLabel(user.rankingPoints || 0)}</td>
                  <td>{user.wins || 0}W / {user.losses || 0}L</td>
                  <td>
                    <span className={`status-badge ${user.isBanned ? 'banned' : 'active'}`}>
                      {user.isBanned ? 'Banned' : 'Active'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {users.users?.length === 0 && <p className="no-data">No users found</p>}

          {totalPages > 1 && (
            <div className="pagination" style={{ marginTop: 16, justifyContent: 'center' }}>
              <button disabled={page <= 1} onClick={() => handleSearch(page - 1)}>← Prev</button>
              {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                const start = Math.max(1, page - 2);
                const p = start + i;
                if (p > totalPages) return null;
                return (
                  <button key={p} className={p === page ? 'active-page' : ''} onClick={() => handleSearch(p)}>
                    {p}
                  </button>
                );
              })}
              <button disabled={page >= totalPages} onClick={() => handleSearch(page + 1)}>Next →</button>
            </div>
          )}
        </div>

        {showDetail && selectedUser && (
          <div className="user-detail-panel">
            <div className="detail-header">
              <img src={buildDiscordAvatar(selectedUser.user?.discordId, selectedUser.user?.discordAvatar) || DISCORD_AVATAR_FALLBACK} alt="" className="large-avatar" />
              <div>
                <h3>{selectedUser.user?.discordName}</h3>
                <span className="risk-level" style={{ color: getRiskColor(selectedUser.user?.anticheatScore ?? 100) }}>
                  {selectedUser.riskLevel?.toUpperCase() || 'UNKNOWN'} RISK
                </span>
              </div>
              <button onClick={() => setShowDetail(false)} className="close-detail">✕</button>
            </div>
            <div className="stats-grid-mini">
              <div className="stat"><span>Wins</span><strong>{selectedUser.user?.wins || 0}</strong></div>
              <div className="stat"><span>Losses</span><strong>{selectedUser.user?.losses || 0}</strong></div>
              <div className="stat"><span>Rank</span><strong>{getRankLabel(selectedUser.user?.rankingPoints || 0)}</strong></div>
            </div>
            <div className="stats-grid-mini">
              <div className="stat"><span>Warnings</span><strong>{selectedUser.activeWarnings?.length || 0}</strong></div>
              <div className="stat"><span>Strikes</span><strong>{selectedUser.user?.strikes || 0}</strong></div>
              <div className="stat"><span>Role</span><strong>{selectedUser.user?.role || 'player'}</strong></div>
            </div>
            <div className="detail-section"><label>Epic Games</label><p>{selectedUser.user?.epicGamesName || 'Not verified'} {selectedUser.user?.epicVerified ? '✓' : ''}</p></div>
            <div className="detail-section"><label>Chat Status</label><p>{selectedUser.user?.mutedUntil && new Date(selectedUser.user.mutedUntil) > new Date() ? `Muted until ${new Date(selectedUser.user.mutedUntil).toLocaleString()}` : 'Not muted'}</p></div>
            <div className="detail-section"><label>Premium</label><p>{selectedUser.user?.isPremium ? `${selectedUser.user?.premiumTier || 'basic'} (expires ${selectedUser.user?.premiumExpiresAt ? new Date(selectedUser.user.premiumExpiresAt).toLocaleDateString() : 'N/A'})` : 'No premium'}</p></div>
            {selectedUser.activeWarnings?.length > 0 && (
              <div className="detail-section">
                <label>Active Warnings</label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {selectedUser.activeWarnings.slice(0, 5).map((warning) => (
                    <div key={warning.warningId} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, background: 'rgba(15,23,42,0.45)', border: '1px solid #334155', borderRadius: 8, padding: '8px 10px' }}>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: 12, fontWeight: 600, color: '#f59e0b', textTransform: 'uppercase' }}>{warning.type}</div>
                        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{warning.reason || 'No reason'}</div>
                      </div>
                      <button className="btn btn-sm" onClick={() => onAction(selectedUser.user?.discordId, `remove-warning/${warning.warningId}`)}>Remove</button>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {selectedUser.user?.ipAddresses?.length > 0 && (
              <div className="detail-section">
                <label>IP Addresses</label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8 }}>
                  {selectedUser.user.ipAddresses.slice(0, 8).map((ipEntry, i) => (
                    <div key={`${ipEntry.ip}-${i}`} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, background: 'rgba(15,23,42,0.45)', border: '1px solid #334155', borderRadius: 8, padding: '8px 10px' }}>
                      <span style={{ fontFamily: 'monospace', fontSize: 12 }}>{ipEntry.ip}</span>
                      <button className="btn btn-sm" onClick={() => onWhitelistIP(ipEntry.ip)}>Whitelist</button>
                    </div>
                  ))}
                </div>
              </div>
            )}
            <div className="action-buttons">
              <button className="btn" onClick={() => {
                const newEpicName = window.prompt('Enter corrected Epic name:', selectedUser.user?.epicGamesName || '');
                if (newEpicName && newEpicName.trim()) {
                  onAction(selectedUser.user?.discordId, 'update-epic', { epicGamesName: newEpicName.trim(), epicVerified: true });
                }
              }}>Update Epic Name</button>
              <button className="btn reset" onClick={() => {
                if (window.confirm('Reset wins/losses/draws/total matches only?')) {
                  onAction(selectedUser.user?.discordId, 'reset', { resetType: 'stats_only' });
                }
              }}>Reset W/L Stats</button>
              <button className="btn reset" onClick={() => {
                if (window.confirm('Reset rank points only?')) {
                  onAction(selectedUser.user?.discordId, 'reset', { resetType: 'rating_only' });
                }
              }}>Reset Rank</button>
              {selectedUser.user?.isBanned ? (
                <button className="btn unban" onClick={() => onAction(selectedUser.user?.discordId, 'unban')}>Unban</button>
              ) : (
                <button className="btn ban" onClick={() => {
                  const reason = window.prompt('Ban reason:');
                  if (reason) onAction(selectedUser.user?.discordId, 'ban', { reason });
                }}>Ban</button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

const StaffAlertsTab = ({ notifications, unreadCount, onRefresh, onMarkAllRead, onOpenAlert, notifTypeIcon }) => {
  return (
    <div className="staff-alerts-tab">
      <div className="tab-title-section">
        <div>
          <h2>Staff Alerts</h2>
          <p className="section-subtitle">{notifications?.length || 0} total alerts, {unreadCount || 0} unread</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-ghost btn-sm" onClick={onRefresh}>Refresh</button>
          <button className="btn btn-primary btn-sm" onClick={onMarkAllRead}>Mark all read</button>
        </div>
      </div>

      <div className="live-feed-panel" style={{ marginBottom: 0 }}>
        <div className="feed-list" style={{ maxHeight: 'none' }}>
          {!notifications || notifications.length === 0 ? (
            <div className="feed-empty">No staff alerts right now.</div>
          ) : notifications.map((n) => (
            <div
              key={n._id}
              className={`notif-item ${!n.read ? 'unread' : ''}`}
              onClick={() => onOpenAlert(n)}
              title={n.matchId ? 'Open related match' : 'Mark as read'}
            >
              <div className="notif-item-title">{notifTypeIcon(n.type)} {n.title || n.type}</div>
              <div className="notif-item-msg">{n.message}</div>
              <div className="notif-item-time">{new Date(n.createdAt).toLocaleString()}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

const AnticheatTab = ({ api }) => {
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  useEffect(() => { fetchAlerts(); }, []);
  const fetchAlerts = async () => {
    try {
      const res = await api.get('/admin/anticheat/alerts');
      const seen = new Set();
      const deduped = res.data.alerts.filter(a => {
        const key = `${a.userId}:${a.flag}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
      setAlerts(deduped);
    } catch (err) { console.error('Failed to fetch alerts'); }
    finally { setLoading(false); }
  };
  const resolveFlag = async (userId, flagId) => {
    try { await api.post(`/admin/anticheat/resolve/${userId}/${flagId}`); fetchAlerts(); } catch (err) { console.error('Failed to resolve'); }
  };
  const getFlagIcon = (flag) => {
    const icons = { multiAccounting: 'fa-users-slash', vpnUsage: 'fa-eye-slash', boostingDetected: 'fa-arrow-up', suspiciousActivity: 'fa-question-circle', proxyDetected: 'fa-globe', torUsage: 'fa-mask', vpnDetected: 'fa-shield-halved' };
    return icons[flag] || 'fa-flag';
  };
  const getSeverityColor = (severity) => {
    const colors = { critical: '#ef4444', high: '#f97316', medium: '#eab308', low: '#3b82f6' };
    return colors[severity] || '#64748b';
  };
  const getScoreColor = (score) => {
    if (score >= 80) return '#22c55e';
    if (score >= 50) return '#eab308';
    if (score >= 30) return '#f97316';
    return '#ef4444';
  };
  const filtered = filter === 'all' ? alerts : alerts.filter(a => a.severity === filter);
  if (loading) return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {[1,2,3].map(i => <div key={i} className="skeleton" style={{ height: 100 }} />)}
    </div>
  );
  return (
    <div>
      <div className="tab-title-section">
        <div>
          <h2>Anticheat Alerts</h2>
          <p className="section-subtitle">{alerts.length} unresolved alert{alerts.length !== 1 ? 's' : ''}</p>
        </div>
        <div className="filter-tabs">
          <button className={filter === 'all' ? 'active' : ''} onClick={() => setFilter('all')}>All ({alerts.length})</button>
          <button className={filter === 'critical' ? 'active' : ''} onClick={() => setFilter('critical')} style={filter === 'critical' ? { color: '#ef4444' } : {}}>Critical</button>
          <button className={filter === 'high' ? 'active' : ''} onClick={() => setFilter('high')} style={filter === 'high' ? { color: '#f97316' } : {}}>High</button>
          <button className={filter === 'medium' ? 'active' : ''} onClick={() => setFilter('medium')} style={filter === 'medium' ? { color: '#eab308' } : {}}>Medium</button>
          <button className={filter === 'low' ? 'active' : ''} onClick={() => setFilter('low')} style={filter === 'low' ? { color: '#3b82f6' } : {}}>Low</button>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="empty-state"><span>✓</span><p>No alerts to show</p></div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {filtered.map((alert, i) => (
            <div key={i} style={{
              background: 'var(--bg-card)', border: '1px solid var(--border)',
              borderRadius: 'var(--radius-lg)', overflow: 'hidden',
              animation: 'fadeInUp 0.3s ease', animationFillMode: 'both',
              animationDelay: `${i * 0.03}s`,
            }}>
              <div style={{
                display: 'flex', alignItems: 'center', gap: 14, padding: '16px 20px',
                borderBottom: '1px solid var(--border)',
              }}>
                <div style={{
                  width: 40, height: 40, borderRadius: 'var(--radius-md)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '1rem', background: `${getSeverityColor(alert.severity)}15`,
                  color: getSeverityColor(alert.severity), flexShrink: 0,
                }}>
                  <i className={`fas ${getFlagIcon(alert.flag)}`}></i>
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
                    <span style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--text)' }}>{alert.userName}</span>
                    <span style={{
                      padding: '2px 8px', borderRadius: 100, fontSize: '0.65rem',
                      fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em',
                      background: `${getSeverityColor(alert.severity)}15`,
                      color: getSeverityColor(alert.severity),
                      border: `1px solid ${getSeverityColor(alert.severity)}25`,
                    }}>{alert.flag}</span>
                    <span style={{
                      padding: '2px 8px', borderRadius: 100, fontSize: '0.6rem',
                      fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em',
                      background: `${getSeverityColor(alert.severity)}20`,
                      color: getSeverityColor(alert.severity),
                    }}>{alert.severity}</span>
                  </div>
                  <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', lineHeight: 1.4 }}>
                    {alert.description}
                  </div>
                </div>
                <div style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'center',
                  flexShrink: 0, padding: '0 12px',
                }}>
                  <span style={{
                    fontFamily: 'var(--font-display)', fontSize: '1.1rem', fontWeight: 700,
                    color: getScoreColor(alert.anticheatScore),
                  }}>{alert.anticheatScore}</span>
                  <span style={{ fontSize: '0.6rem', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Score</span>
                </div>
                <button onClick={() => resolveFlag(alert.userId, alert._id)} className="btn btn-ghost btn-sm">
                  <i className="fas fa-check"></i> Resolve
                </button>
              </div>
              <div style={{
                padding: '8px 20px', background: 'rgba(0,0,0,0.15)',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                fontSize: '0.75rem', color: 'var(--text-dim)',
              }}>
                <span><i className="far fa-clock"></i> {new Date(alert.createdAt).toLocaleString()}</span>
                <span>User ID: {alert.userId?.substring(0, 12)}...</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

function adminSquadLabelPlayer1(m) {
  if (!m.teamMatch) return null;
  if (m.result === 'player1') return m.winnerTeamName || null;
  if (m.result === 'player2') return m.loserTeamName || null;
  if (m.winnerDiscordId && m.player1?.discordId && m.winnerDiscordId === m.player1.discordId) return m.winnerTeamName;
  if (m.loserDiscordId && m.player1?.discordId && m.loserDiscordId === m.player1.discordId) return m.loserTeamName;
  return null;
}

function adminSquadLabelPlayer2(m) {
  if (!m.teamMatch) return null;
  if (m.result === 'player2') return m.winnerTeamName || null;
  if (m.result === 'player1') return m.loserTeamName || null;
  if (m.winnerDiscordId && m.player2?.discordId && m.winnerDiscordId === m.player2.discordId) return m.winnerTeamName;
  if (m.loserDiscordId && m.player2?.discordId && m.loserDiscordId === m.player2.discordId) return m.loserTeamName;
  return null;
}

function adminFormatMatchResult(m) {
  if (m.result === 'draw') return 'Draw';
  if (m.teamMatch && m.winnerTeamName && m.loserTeamName && (m.result === 'player1' || m.result === 'player2')) {
    return `${m.winnerTeamName} def. ${m.loserTeamName}`;
  }
  if (m.result === 'player1') return `${m.player1?.discordName || 'P1'} win`;
  if (m.result === 'player2') return `${m.player2?.discordName || 'P2'} win`;
  return m.result || '—';
}

function adminMatchDateBadge(date) {
  const d = new Date(date);
  return {
    num: d.getDate(),
    label: d.toLocaleString('en', { month: 'short' }).toUpperCase(),
  };
}

const MatchesTab = ({ api, notify, focusedMatchId }) => {
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [focusedMatch, setFocusedMatch] = useState(null);

  useEffect(() => { fetchMatches(); }, [api, filter, page]);

  const fetchMatches = async () => {
    try {
      const params = { limit: 50, page };
      if (filter === 'disputed') { params.disputed = 'true'; }
      else if (filter !== 'all') params.status = filter;
      const res = await api.get('/admin/matches', { params });
      setMatches(res.data.matches);
      setTotalPages(res.data.pagination?.pages || 1);
    } catch (err) { console.error('Failed to fetch matches'); }
    finally { setLoading(false); }
  };

  const overrideMatch = async (matchId, winner) => {
    try { await api.post(`/admin/matches/${matchId}/override`, { winner }); fetchMatches(); notify('Match overridden', 'success'); }
    catch (err) { notify('Failed to override match', 'error'); }
  };

  useEffect(() => {
    const loadFocusedMatch = async () => {
      if (!focusedMatchId) return;
      try {
        setFilter('all');
        setPage(1);
        const res = await api.get(`/admin/matches/${focusedMatchId}`);
        setFocusedMatch(res.data);
      } catch (err) {
        setFocusedMatch(null);
        notify('Alert match not found anymore', 'error');
      }
    };
    loadFocusedMatch();
  }, [focusedMatchId]);

  if (loading) return <div className="tab-loading">Loading...</div>;

  return (
    <div className="matches-tab">
      <div className="tab-title-section">
        <div>
          <h2>Matches</h2>
          <p className="section-subtitle">1v1 and squad (2v2–4v4): captains in columns, squad names when stored</p>
        </div>
        <div className="filter-tabs sm">
          <button className={filter === 'all' ? 'active' : ''} onClick={() => { setFilter('all'); setPage(1); }}>All</button>
          <button className={filter === 'completed' ? 'active' : ''} onClick={() => { setFilter('completed'); setPage(1); }}>Completed</button>
          <button className={filter === 'disputed' ? 'active' : ''} onClick={() => { setFilter('disputed'); setPage(1); }}>Disputed</button>
          <button className={filter === 'pending' ? 'active' : ''} onClick={() => { setFilter('pending'); setPage(1); }}>Pending</button>
        </div>
      </div>

      {focusedMatch && (
        <div className="admin-focused-match-banner">
          <strong>Focused alert match</strong>
          <span className="admin-focused-match-line">
            {focusedMatch.teamMatch && focusedMatch.winnerTeamName
              ? `${focusedMatch.winnerTeamName || 'Squad'} vs ${focusedMatch.loserTeamName || 'Squad'} · `
              : null}
            Captains {focusedMatch.player1?.discordName || 'P1'} vs {focusedMatch.player2?.discordName || 'P2'}
          </span>
          <span className="admin-focused-match-id">{focusedMatch._id}</span>
        </div>
      )}

      <div className="admin-matches-card-list lb-squad-standings">
        {matches.length === 0 ? (
          <div className="admin-matches-empty empty-state lb-empty">
            <span>⚔️</span>
            <p>No matches in this filter.</p>
          </div>
        ) : (
          matches.map((m) => {
            const mode = m.tournamentType || '1v1';
            const s1 = adminSquadLabelPlayer1(m);
            const s2 = adminSquadLabelPlayer2(m);
            const dateBd = adminMatchDateBadge(m.date);
            const isFocused = focusedMatchId && String(m._id) === String(focusedMatchId);
            const duelTitle = m.teamMatch && (s1 || s2 || m.winnerTeamName)
              ? `${s1 || m.player1?.discordName || 'Side 1'} vs ${s2 || m.player2?.discordName || 'Side 2'}`
              : `${m.player1?.discordName || 'Side 1'} vs ${m.player2?.discordName || 'Side 2'}`;
            return (
              <div
                key={m._id}
                className={`lb-squad-card admin-match-lb-card${m.disputed ? ' admin-match-lb-card--disputed' : ''}${m.teamMatch ? ' admin-match-lb-card--squad' : ''}${isFocused ? ' admin-match-lb-card--focused' : ''}`}
              >
                <div className="lb-squad-card-hit admin-match-lb-row" role="group">
                  <div className={`lb-squad-rank-badge ${m.disputed ? 'bronze' : 'plain'} admin-match-date-badge`}>
                    <span className="lb-squad-rank-num admin-match-date-num">{dateBd.num}</span>
                    <span className="lb-squad-rank-label">{dateBd.label}</span>
                  </div>
                  <div className="lb-squad-card-body">
                    <div className="lb-squad-card-top">
                      <div className="lb-squad-avatar-stack admin-match-avatar-stack" aria-hidden>
                        <span className="lb-squad-stack-face admin-match-stack-p1">
                          <img src={buildDiscordAvatar(m.player1?.discordId, m.player1?.discordAvatar) || DISCORD_AVATAR_FALLBACK} alt="" />
                        </span>
                        <span className="lb-squad-stack-face admin-match-stack-p2">
                          <img src={buildDiscordAvatar(m.player2?.discordId, m.player2?.discordAvatar) || DISCORD_AVATAR_FALLBACK} alt="" />
                        </span>
                      </div>
                      <div className="lb-squad-title-block">
                        <h3 className="lb-squad-team-title admin-match-duel-title">{duelTitle}</h3>
                        <p className="lb-squad-team-sub">
                          {m.tournamentTitle ? (
                            <span title={m.tournamentTitle}>{m.tournamentTitle.length > 42 ? `${m.tournamentTitle.slice(0, 42)}…` : m.tournamentTitle}</span>
                          ) : (
                            <span>Admin match</span>
                          )}
                          <span className="admin-match-sub-id"> · {String(m._id).slice(-8)}</span>
                        </p>
                      </div>
                    </div>
                    <div className="lb-squad-stat-strip">
                      <div className="lb-squad-stat-pill">
                        <span className="lb-squad-stat-k">Format</span>
                        <span className="lb-squad-stat-v admin-match-format-val">
                          <span className={`admin-match-mode-pill mode-${mode}`}>{mode}</span>
                          {m.teamMatch ? <span className="admin-match-squad-tag">Squad</span> : null}
                        </span>
                      </div>
                      <div className="lb-squad-stat-pill">
                        <span className="lb-squad-stat-k">Captains</span>
                        <span className="lb-squad-stat-v admin-match-captains-val">
                          <span className="admin-match-captain-chip">{m.player1?.discordName || '—'}</span>
                          <span className="admin-match-captain-sep">·</span>
                          <span className="admin-match-captain-chip">{m.player2?.discordName || '—'}</span>
                        </span>
                      </div>
                      <div className={`lb-squad-stat-pill lb-squad-stat-pill--accent ${m.disputed ? 'admin-match-result-pill--disputed' : ''}`}>
                        <span className="lb-squad-stat-k">Result</span>
                        <span className={`lb-squad-stat-v match-result ${m.result === 'player1' ? 'p1' : m.result === 'player2' ? 'p2' : ''}`}>
                          {adminFormatMatchResult(m)}
                        </span>
                      </div>
                    </div>
                    {m.teamMatch && (m.result === 'player1' || m.result === 'player2') ? (
                      <p className="admin-match-bracket-note">Bracket: captain outcome on stored sides</p>
                    ) : null}
                  </div>
                  <div className="admin-match-lb-side">
                    <span className={`match-status-badge ${m.disputed ? 'disputed' : m.status || 'completed'}`}>
                      {m.disputed ? 'Disputed' : m.status || 'Done'}
                    </span>
                  </div>
                </div>
                {m.disputed || m.status === 'pending' ? (
                  <div className="lb-squad-roster admin-match-lb-actions">
                    <div className="lb-squad-roster-head admin-match-actions-head">
                      <span className="lb-squad-roster-title">Resolve</span>
                      <span className="lb-squad-roster-team">Override winner</span>
                    </div>
                    <div className="admin-match-action-btns">
                      <button type="button" className="btn-tiny success" title="Side 1 captain wins" onClick={() => overrideMatch(m._id, 'player1')}>
                        Side 1 wins
                      </button>
                      <button type="button" className="btn-tiny danger" title="Side 2 captain wins" onClick={() => overrideMatch(m._id, 'player2')}>
                        Side 2 wins
                      </button>
                      <button type="button" className="btn-tiny" onClick={() => overrideMatch(m._id, 'draw')}>Draw</button>
                    </div>
                  </div>
                ) : null}
              </div>
            );
          })
        )}
      </div>

      {totalPages > 1 && (
        <div className="pagination">
          <button disabled={page <= 1} onClick={() => setPage(p => p - 1)}>← Prev</button>
          <span>{page} / {totalPages}</span>
          <button disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>Next →</button>
        </div>
      )}
    </div>
  );
};

export default AdminDashboard;
