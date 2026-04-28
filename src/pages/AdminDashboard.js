import React, { useState, useEffect, useRef, useCallback } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { io } from 'socket.io-client';
import { API_BASE_URL, SOCKET_BASE_URL, buildDiscordAvatar, DISCORD_AVATAR_FALLBACK } from '../utils/api';
import { getRank, getRankLabel } from '../utils/ranks';
import './AdminDashboard.css';

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
  const [staffNotifOpen, setStaffNotifOpen] = useState(false);
  const [liveFeed, setLiveFeed] = useState([]);
  const [feedOpen, setFeedOpen] = useState(false);
  const [socketStatus, setSocketStatus] = useState('connecting');
  const [prevStats, setPrevStats] = useState(null);
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
      setActiveTab('matches');
      setStaffNotifOpen(false);
    }
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
      case 'match-start': return `Match: ${item.player1} vs ${item.player2}`;
      case 'report': return `Report in match ${item.matchId?.substring(0, 8)}...`;
      default: return `Event: ${JSON.stringify(item).substring(0, 60)}`;
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-80px)] gap-4">
        <div className="w-8 h-8 border-3 border-[rgba(46,242,255,0.08)] border-t-[var(--cyan)] rounded-full animate-spin"></div>
        <p className="font-display text-sm text-[var(--text-muted)] uppercase tracking-widest animate-pulse">INITIALIZING...</p>
      </div>
    );
  }

  return (
    <div className={`flex min-h-[calc(100vh-40px)] relative animate-fade-in ${sidebarOpen ? '' : ''}`}>
      <div className="fixed top-4 right-4 z-[100] flex flex-col gap-2">
        {notifications.map(n => (
          <div key={n.id} className={`px-4 py-3 rounded-[var(--radius-md)] shadow-[var(--shadow-lg)] animate-slide-in-right text-sm font-semibold flex items-center gap-2 ${n.type === 'success' ? 'bg-[rgba(34,197,94,0.15)] border border-[rgba(34,197,94,0.3)] text-[var(--green)]' : 'bg-[rgba(239,68,68,0.15)] border border-[rgba(239,68,68,0.3)] text-[var(--red)]'}`}>
            <span>{n.type === 'success' ? '✓' : '✗'}</span>
            {n.message}
          </div>
        ))}
      </div>

      <button className="lg:hidden fixed top-4 left-4 z-[60] w-10 h-10 flex items-center justify-center bg-[var(--bg-glass-strong)] backdrop-blur-xl border border-[var(--border)] rounded-[var(--radius-md)] text-lg cursor-pointer" onClick={() => setSidebarOpen(!sidebarOpen)}>
        {sidebarOpen ? '✕' : '☰'}
      </button>

      <aside className={`w-[240px] flex-shrink-0 bg-[var(--bg-glass-strong)] backdrop-blur-xl border border-[var(--border)] rounded-[var(--radius-xl)] p-5 px-3 flex flex-col mr-5 sticky top-5 h-fit max-h-[calc(100vh-40px)] overflow-y-auto lg:block ${sidebarOpen ? 'fixed left-0 top-0 bottom-0 z-50 rounded-none' : 'hidden'}`}>
        <div className="flex items-center gap-2.5 px-2 pb-4 border-b border-[var(--border)] mb-3">
          <div className={`w-2 h-2 rounded-full flex-shrink-0 ${socketStatus === 'connected' ? 'bg-[var(--green)] shadow-[0_0_8px_var(--green-glow)]' : socketStatus === 'disconnected' || socketStatus === 'error' ? 'bg-[var(--red)]' : 'bg-[var(--orange)] animate-pulse'}`} title={`Socket: ${socketStatus}`} />
          <div>
            <h2 className="font-display text-sm font-bold text-[var(--text)]">ADMIN</h2>
            <span className={`text-[0.65rem] uppercase tracking-wider ${socketStatus === 'connected' ? 'text-[var(--green)]' : socketStatus === 'disconnected' ? 'text-[var(--red)]' : 'text-[var(--orange)]'}`}>
              {socketStatus === 'connected' ? 'Live' : socketStatus === 'reconnecting' ? 'Reconnecting...' : socketStatus === 'disconnected' ? 'Disconnected' : 'Connecting...'}
            </span>
          </div>
        </div>

        <nav className="flex flex-col gap-0.5 flex-1">
          <button className={`flex items-center gap-2.5 px-3 py-2.5 rounded-[var(--radius-md)] text-sm font-medium cursor-pointer transition-all duration-fast text-left w-full ${activeTab === 'dashboard' ? 'bg-[rgba(46,242,255,0.06)] text-[var(--cyan)] border border-[rgba(46,242,255,0.08)]' : 'bg-transparent text-[var(--text-muted)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-secondary)]'}`} onClick={() => { setActiveTab('dashboard'); setSidebarOpen(false); }}>
            <span className="w-5 text-center text-sm">◈</span>
            <span>Dashboard</span>
          </button>
          <button className={`flex items-center gap-2.5 px-3 py-2.5 rounded-[var(--radius-md)] text-sm font-medium cursor-pointer transition-all duration-fast text-left w-full ${activeTab === 'tournaments' ? 'bg-[rgba(46,242,255,0.06)] text-[var(--cyan)] border border-[rgba(46,242,255,0.08)]' : 'bg-transparent text-[var(--text-muted)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-secondary)]'}`} onClick={() => { setActiveTab('tournaments'); setSidebarOpen(false); }}>
            <span className="w-5 text-center text-sm">🏆</span>
            <span>Tournaments</span>
            <span className="ml-auto px-2 py-0.5 bg-[rgba(239,68,68,0.12)] rounded-full text-[0.7rem] text-[var(--red)] font-bold">{stats?.overview?.activeTournaments || 0}</span>
          </button>
          <button className={`flex items-center gap-2.5 px-3 py-2.5 rounded-[var(--radius-md)] text-sm font-medium cursor-pointer transition-all duration-fast text-left w-full ${activeTab === 'users' ? 'bg-[rgba(46,242,255,0.06)] text-[var(--cyan)] border border-[rgba(46,242,255,0.08)]' : 'bg-transparent text-[var(--text-muted)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-secondary)]'}`} onClick={() => { setActiveTab('users'); setSidebarOpen(false); }}>
            <span className="w-5 text-center text-sm">◎</span>
            <span>Users</span>
          </button>
          <button className={`flex items-center gap-2.5 px-3 py-2.5 rounded-[var(--radius-md)] text-sm font-medium cursor-pointer transition-all duration-fast text-left w-full relative ${activeTab === 'matches' ? 'bg-[rgba(46,242,255,0.06)] text-[var(--cyan)] border border-[rgba(46,242,255,0.08)]' : 'bg-transparent text-[var(--text-muted)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-secondary)]'}`} onClick={() => { setActiveTab('matches'); setSidebarOpen(false); }}>
            <span className="w-5 text-center text-sm">⚔</span>
            <span>Matches</span>
            <span className="ml-auto px-2 py-0.5 bg-[rgba(239,68,68,0.15)] rounded-full text-[0.7rem] text-[var(--red)] font-bold">{staffNotifs.unreadCount > 0 ? staffNotifs.unreadCount : ''}</span>
          </button>
          <button className={`flex items-center gap-2.5 px-3 py-2.5 rounded-[var(--radius-md)] text-sm font-medium cursor-pointer transition-all duration-fast text-left w-full ${activeTab === 'anticheat' ? 'bg-[rgba(46,242,255,0.06)] text-[var(--cyan)] border border-[rgba(46,242,255,0.08)]' : 'bg-transparent text-[var(--text-muted)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-secondary)]'}`} onClick={() => { setActiveTab('anticheat'); setSidebarOpen(false); }}>
            <span className="w-5 text-center text-sm">⚡</span>
            <span>Anticheat</span>
            <span className="ml-auto px-2 py-0.5 bg-[rgba(239,68,68,0.15)] rounded-full text-[0.7rem] text-[var(--red)] font-bold">{stats?.overview?.flaggedAccounts || 0}</span>
          </button>
          <button className={`flex items-center gap-2.5 px-3 py-2.5 rounded-[var(--radius-md)] text-sm font-medium cursor-pointer transition-all duration-fast text-left w-full ${activeTab === 'broadcast' ? 'bg-[rgba(46,242,255,0.06)] text-[var(--cyan)] border border-[rgba(46,242,255,0.08)]' : 'bg-transparent text-[var(--text-muted)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-secondary)]'}`} onClick={() => { setActiveTab('broadcast'); setSidebarOpen(false); }}>
            <span className="w-5 text-center text-sm">📢</span>
            <span>Broadcast</span>
          </button>
        </nav>

        <div className="pt-3 border-t border-[var(--border)] flex flex-col gap-2">
          <div className="flex items-center gap-2 px-3 py-2 cursor-pointer rounded-[var(--radius-md)] transition-colors duration-fast hover:bg-[var(--bg-hover)] relative" onClick={() => setStaffNotifOpen(!staffNotifOpen)}>
            <span className="text-base">🔔</span>
            {staffNotifs.unreadCount > 0 && <span className="px-1.5 py-px bg-[var(--red)] rounded-full text-[0.65rem] font-bold text-white">{staffNotifs.unreadCount}</span>}
            <span className="text-xs text-[var(--text-muted)]">Staff Alerts</span>
          </div>
          {staffNotifOpen && (
            <div className="absolute bottom-full left-0 right-0 mb-2 bg-[var(--bg-glass-strong)] backdrop-blur-xl border border-[var(--border)] rounded-[var(--radius-lg)] shadow-[var(--shadow-xl)] z-50 max-h-[400px] flex flex-col">
              <div className="flex items-center justify-between px-3.5 py-3 border-b border-[var(--border)] text-xs text-[var(--text-secondary)]">
                <strong>Staff Notifications</strong>
                <button onClick={handleMarkAllRead} className="bg-none border-none text-[var(--cyan)] text-xs cursor-pointer font-semibold">Mark all read</button>
              </div>
              <div className="overflow-y-auto max-h-[340px]">
                {staffNotifs.notifications.length === 0 ? (
                  <div className="text-center p-6 text-[var(--text-muted)] text-xs">No notifications</div>
                ) : staffNotifs.notifications.slice(0, 10).map(n => (
                  <div key={n._id} className={`px-3.5 py-2.5 border-b border-[var(--border)] cursor-pointer transition-colors duration-fast hover:bg-[var(--bg-hover)] ${!n.read ? 'border-l-3 border-l-[var(--cyan)] bg-[rgba(46,242,255,0.02)]' : ''}`} onClick={() => handleNotifClick(n)}>
                    <div className="text-xs font-semibold text-[var(--text)] mb-0.5">{n.title || n.type}</div>
                    <div className="text-xs text-[var(--text-muted)] mb-1 line-clamp-2">{n.message}</div>
                    <div className="text-[0.65rem] text-[var(--text-dim)]">{new Date(n.createdAt).toLocaleString()}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
          <button onClick={() => navigate('/')} className="py-2 px-3 bg-[var(--bg-hover)] border border-[var(--border)] rounded-[var(--radius-md)] text-[var(--text-muted)] text-xs cursor-pointer transition-all duration-fast text-center hover:border-[var(--border-glow)] hover:text-[var(--text)]">← Back to Site</button>
        </div>
      </aside>

      <main className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
          <div className="flex items-center gap-2 px-4 py-2 bg-[var(--bg-card)] border border-[var(--border)] rounded-[var(--radius-md)] cursor-pointer text-sm text-[var(--text-muted)] transition-all duration-fast hover:border-[var(--border-glow)]" onClick={() => setFeedOpen(!feedOpen)}>
            <span className={`w-2 h-2 rounded-full transition-all duration-base ${feedOpen ? 'bg-[var(--green)] shadow-[0_0_8px_var(--green-glow)] animate-pulse' : 'bg-[var(--text-dim)]'}`} />
            <span>Live Feed {liveFeed.length > 0 ? `(${liveFeed.length})` : ''}</span>
            <span>{feedOpen ? '▼' : '▲'}</span>
          </div>
          {socketStatus !== 'connected' && (
            <div className="flex items-center gap-2 px-3.5 py-1.5 bg-[rgba(249,115,22,0.08)] border border-[rgba(249,115,22,0.15)] rounded-[var(--radius-md)] text-xs text-[var(--orange)]">
              <span className="w-1.5 h-1.5 rounded-full bg-[var(--orange)] animate-pulse" />
              {socketStatus === 'reconnecting' ? 'Reconnecting...' : 'Offline mode - updates delayed'}
            </div>
          )}
        </div>

        {feedOpen && (
          <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-[var(--radius-lg)] mb-5 overflow-hidden animate-fade-in">
            <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border)] text-sm">
              <strong>Live Activity Feed</strong>
              <button className="px-3 py-1.5 border border-[var(--border)] rounded-[var(--radius-sm)] bg-[rgba(0,0,0,0.2)] text-[var(--text-muted)] text-xs cursor-pointer transition-all duration-fast hover:border-[var(--border-glow)] hover:text-[var(--text)]" onClick={() => setLiveFeed([])}>Clear</button>
            </div>
            <div className="max-h-[300px] overflow-y-auto p-2 flex flex-col gap-1">
              {liveFeed.length === 0 ? (
                <div className="text-center py-8 text-[var(--text-muted)] text-sm">Waiting for events...</div>
              ) : liveFeed.map((item, i) => (
                <div key={item._id} className={`flex items-center gap-2.5 px-3 py-2 rounded-[var(--radius-sm)] text-xs text-[var(--text-secondary)] transition-colors duration-fast hover:bg-[var(--bg-hover)]`}>
                  <span className="w-5 text-center flex-shrink-0">{feedItemIcon(item.type)}</span>
                  <span className="flex-1 min-w-0 overflow-hidden text-ellipsis whitespace-nowrap">{feedItemLabel(item)}</span>
                  <span className="text-[0.7rem] text-[var(--text-dim)] flex-shrink-0">{new Date(item.time).toLocaleTimeString()}</span>
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
        {activeTab === 'anticheat' && <AnticheatTab api={api} />}
        {activeTab === 'matches' && <MatchesTab api={api} notify={showNotification} />}

        {activeTab === 'broadcast' && <BroadcastTab api={api} notify={showNotification} />}
      </main>

      {sidebarOpen && <div className="fixed inset-0 bg-black/50 z-40 lg:hidden" onClick={() => setSidebarOpen(false)} />}

      {confirmModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[1000] backdrop-blur-sm animate-fade-in" onClick={confirmModal.onCancel}>
          <div className="w-[90%] max-w-md bg-[var(--bg-glass-strong)] backdrop-blur-2xl border border-[var(--border-glow)] rounded-[var(--radius-2xl)] shadow-[var(--shadow-xl)] animate-scale-in" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-5 border-b border-[var(--border)]">
              <h3 className="font-display text-lg font-bold">⚠️ Confirm Action</h3>
            </div>
            <div className="p-5">
              <p className="text-sm text-[var(--text-secondary)]">{confirmModal.message}</p>
            </div>
            <div className="flex justify-end gap-2 p-4 border-t border-[var(--border)]">
              <button className="px-4 py-2 rounded-[var(--radius-md)] bg-[rgba(255,255,255,0.05)] border border-[var(--border)] text-sm text-[var(--text)] cursor-pointer transition-all duration-fast hover:border-[var(--border-glow)]" onClick={confirmModal.onCancel}>Cancel</button>
              <button className="px-4 py-2 rounded-[var(--radius-md)] bg-gradient-to-r from-[var(--red)] to-[#dc2626] text-white text-sm font-bold cursor-pointer shadow-[0_0_20px_rgba(239,68,68,0.2)] transition-all duration-base hover:shadow-[0_0_40px_rgba(239,68,68,0.4)]" onClick={confirmModal.onConfirm}>Delete</button>
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
    <div className={`p-5 bg-[var(--bg-card)] border border-[var(--border)] rounded-[var(--radius-lg)] cursor-pointer transition-all duration-base relative overflow-hidden hover:-translate-y-0.5 hover:border-[var(--border-glow)] hover:shadow-[var(--shadow-cyan)] ${changed ? '' : ''}`} style={color ? { borderLeftColor: color } : {}} onClick={onClick}>
      <div className="text-xl mb-2.5 w-10 h-10 flex items-center justify-center rounded-[var(--radius-md)]" style={iconBg ? { background: iconBg } : {}}>{icon}</div>
      <div>
        <span className="font-display text-[1.6rem] font-extrabold block">{value?.toLocaleString?.() ?? value ?? 0}</span>
        <span className="text-[0.7rem] text-[var(--text-muted)] uppercase tracking-wider mt-0.5 block">{label}</span>
      </div>
      {trend && <div className="text-xs text-[var(--green)] mt-1">{trend}</div>}
    </div>
  );
};

const DashboardTab = ({ stats, prevStats, onNavigate }) => (
  <div className="animate-fade-in-up">
    <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
      <h2 className="font-display text-xl font-bold">Dashboard Overview</h2>
      <p className="text-xs text-[var(--text-muted)] mt-0.5">Real-time platform statistics and activity</p>
    </div>

    <div className="grid grid-cols-4 gap-4 mb-6 max-lg:grid-cols-2 max-sm:grid-cols-1">
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

    <div className="grid grid-cols-2 gap-5 max-lg:grid-cols-1">
      <section className="bg-[var(--bg-card)] border border-[var(--border)] rounded-[var(--radius-lg)] p-5">
        <h3 className="font-display text-sm font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-3 flex items-center gap-2"><span className="w-6 text-center">⊘</span> Recent Bans</h3>
        {stats?.recentBans?.length > 0 ? stats.recentBans.map((ban, i) => (
          <div key={i} className="flex items-center gap-2.5 py-2 border-b border-[var(--border)] last:border-none text-sm">
            <span className="w-6 h-6 flex items-center justify-center rounded-[var(--radius-sm)] text-xs bg-[var(--red-bg)] flex-shrink-0">⊘</span>
            <div className="flex-1">
              <span className="font-semibold block text-sm">{ban.discordName}</span>
              <span className="text-xs text-[var(--text-muted)]">{ban.banReason}</span>
            </div>
            <span className="text-[0.7rem] text-[var(--text-dim)] flex-shrink-0">{new Date(ban.bannedAt).toLocaleDateString()}</span>
          </div>
        )) : <p className="text-center py-5 text-[var(--text-muted)] text-sm">No recent bans</p>}
      </section>

      <section className="bg-[var(--bg-card)] border border-[var(--border)] rounded-[var(--radius-lg)] p-5">
        <h3 className="font-display text-sm font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-3 flex items-center gap-2"><span className="w-6 text-center">⚡</span> Recent Flags</h3>
        {stats?.recentFlags?.length > 0 ? stats.recentFlags.slice(0, 5).map((user, i) =>
          user.flagHistory?.filter(f => !f.resolved).slice(0, 2).map((flag, fi) => (
            <div key={`${i}-${fi}`} className="flex items-center gap-2.5 py-2 border-b border-[var(--border)] last:border-none text-sm">
              <span className="w-6 h-6 flex items-center justify-center rounded-[var(--radius-sm)] text-xs bg-[var(--red-bg)] flex-shrink-0">⚡</span>
              <div className="flex-1">
                <span className="font-semibold block text-sm">{user.discordName}</span>
                <span className="text-xs text-[var(--text-muted)]">{flag.flag}: {flag.description?.substring(0, 80)}</span>
              </div>
              <span className="text-[0.7rem] flex-shrink-0 font-semibold" style={{ color: flag.severity === 'high' || flag.severity === 'critical' ? '#ef4444' : '#eab308' }}>
                {flag.severity}
              </span>
            </div>
          ))
        ) : <p className="text-center py-5 text-[var(--text-muted)] text-sm">No recent flags</p>}
      </section>

      <section className="bg-[var(--bg-card)] border border-[var(--border)] rounded-[var(--radius-lg)] p-5">
        <h3 className="font-display text-sm font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-3 flex items-center gap-2"><span className="w-6 text-center">★</span> Top Players</h3>
        {stats?.topPlayers?.slice(0, 5).map((player, i) => (
          <div key={i} className="flex items-center gap-2.5 py-2 border-b border-[var(--border)] last:border-none text-sm">
            <span className="font-display text-sm font-bold text-[var(--text-muted)] w-6 text-center">#{i + 1}</span>
            <span className="w-7 h-7 rounded-full overflow-hidden border border-[var(--border)] flex-shrink-0">
              <img src={buildDiscordAvatar(player.discordId, player.discordAvatar) || DISCORD_AVATAR_FALLBACK} alt="" className="w-full h-full object-cover" />
            </span>
            <span className="flex-1 font-semibold">{player.discordName}</span>
            <span className="text-xs text-[var(--text-muted)] mr-2">{player.wins}W / {player.losses}L</span>
            <span className="font-display text-sm font-bold text-[var(--cyan)]">{getRankLabel(player.rankingPoints || 0)}</span>
          </div>
        ))}
      </section>

      <section className="bg-[var(--bg-card)] border border-[var(--border)] rounded-[var(--radius-lg)] p-5">
        <h3 className="font-display text-sm font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-3 flex items-center gap-2"><span className="w-6 text-center">⚡</span> Quick Actions</h3>
        <div className="grid grid-cols-2 gap-2">
          <button onClick={() => onNavigate('tournaments')} className="flex items-center gap-2 p-3 bg-[rgba(0,0,0,0.2)] border border-[var(--border)] rounded-[var(--radius-md)] text-[var(--text-secondary)] text-sm font-medium cursor-pointer transition-all duration-fast hover:border-[var(--border-glow)] hover:text-[var(--text)] hover:bg-[var(--bg-hover)]"><span className="text-lg">🏆</span> Create Tournament</button>
          <button onClick={() => onNavigate('anticheat')} className="flex items-center gap-2 p-3 bg-[rgba(0,0,0,0.2)] border border-[var(--border)] rounded-[var(--radius-md)] text-[var(--text-secondary)] text-sm font-medium cursor-pointer transition-all duration-fast hover:border-[var(--border-glow)] hover:text-[var(--text)] hover:bg-[var(--bg-hover)]"><span className="text-lg">⚡</span> View Alerts</button>
          <button onClick={() => onNavigate('broadcast')} className="flex items-center gap-2 p-3 bg-[rgba(0,0,0,0.2)] border border-[var(--border)] rounded-[var(--radius-md)] text-[var(--text-secondary)] text-sm font-medium cursor-pointer transition-all duration-fast hover:border-[var(--border-glow)] hover:text-[var(--text)] hover:bg-[var(--bg-hover)]"><span className="text-lg">📢</span> New Broadcast</button>
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
    <div>
      <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
        <div>
          <h2 className="font-display text-xl font-bold">Tournament Management</h2>
          <p className="text-xs text-[var(--text-muted)] mt-0.5">{tournaments.length} total tournaments</p>
        </div>
        <button className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-[var(--cyan)] to-[var(--electric-blue)] border-none rounded-[var(--radius-md)] text-black font-bold text-sm cursor-pointer whitespace-nowrap transition-all duration-base hover:shadow-[0_0_25px_rgba(46,242,255,0.3)] hover:-translate-y-0.5" onClick={() => setShowCreateModal(true)}>
          + Create Tournament
        </button>
      </div>

      <div className="flex gap-2 mb-5 flex-wrap">
        <button className={`px-4 py-2 rounded-[var(--radius-md)] text-sm font-semibold cursor-pointer transition-all duration-base border ${filter === 'all' ? 'bg-[rgba(46,242,255,0.06)] border-[var(--border-glow)] text-[var(--cyan)]' : 'bg-[var(--bg-card)] border-[var(--border)] text-[var(--text-muted)] hover:border-[var(--border-glow)] hover:text-[var(--text-secondary)]'}`} onClick={() => setFilter('all')}>All ({tournaments.length})</button>
        <button className={`px-4 py-2 rounded-[var(--radius-md)] text-sm font-semibold cursor-pointer transition-all duration-base border ${filter === 'registration' ? 'bg-[rgba(46,242,255,0.06)] border-[var(--border-glow)] text-[var(--cyan)]' : 'bg-[var(--bg-card)] border-[var(--border)] text-[var(--text-muted)] hover:border-[var(--border-glow)] hover:text-[var(--text-secondary)]'}`} onClick={() => setFilter('registration')}>Registration</button>
        <button className={`px-4 py-2 rounded-[var(--radius-md)] text-sm font-semibold cursor-pointer transition-all duration-base border ${filter === 'active' ? 'bg-[rgba(46,242,255,0.06)] border-[var(--border-glow)] text-[var(--cyan)]' : 'bg-[var(--bg-card)] border-[var(--border)] text-[var(--text-muted)] hover:border-[var(--border-glow)] hover:text-[var(--text-secondary)]'}`} onClick={() => setFilter('active')}>Active</button>
        <button className={`px-4 py-2 rounded-[var(--radius-md)] text-sm font-semibold cursor-pointer transition-all duration-base border ${filter === 'completed' ? 'bg-[rgba(46,242,255,0.06)] border-[var(--border-glow)] text-[var(--cyan)]' : 'bg-[var(--bg-card)] border-[var(--border)] text-[var(--text-muted)] hover:border-[var(--border-glow)] hover:text-[var(--text-secondary)]'}`} onClick={() => setFilter('completed')}>Completed</button>
        <button className={`px-4 py-2 rounded-[var(--radius-md)] text-sm font-semibold cursor-pointer transition-all duration-base border ${filter === 'cancelled' ? 'bg-[rgba(46,242,255,0.06)] border-[var(--border-glow)] text-[var(--cyan)]' : 'bg-[var(--bg-card)] border-[var(--border)] text-[var(--text-muted)] hover:border-[var(--border-glow)] hover:text-[var(--text-secondary)]'}`} onClick={() => setFilter('cancelled')}>Cancelled</button>
      </div>

      <div className="grid grid-cols-[repeat(auto-fill,minmax(320px,1fr))] gap-4">
        {filteredTournaments.map(tournament => (
          <div key={tournament._id} className="bg-[var(--bg-card)] border border-[var(--border)] rounded-[var(--radius-lg)] overflow-hidden cursor-pointer transition-all duration-base hover:border-[var(--border-glow)] hover:shadow-[var(--shadow-cyan)] hover:-translate-y-0.5" onClick={() => { onSelectTournament(tournament._id); setShowDetailModal(true); }}>
            <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border)]">
              <span className="px-2.5 py-0.5 rounded-full text-[0.7rem] font-bold uppercase tracking-wider" style={{ background: getStatusColor(tournament.status) }}>{tournament.status}</span>
              <span className="text-xs text-[var(--text-muted)]">{tournament.type || '1v1'}</span>
            </div>
            <div className="p-4">
              <h3 className="font-display text-sm font-bold mb-1.5">{tournament.title}</h3>
              <p className="text-xs text-[var(--text-muted)] mb-3">{tournament.description?.substring(0, 100)}...</p>
              <div className="flex flex-col gap-1.5">
                <span className="text-xs text-[var(--text-muted)] flex items-center gap-1.5">📍 {tournament.mapCode}</span>
                <span className="text-xs text-[var(--text-muted)] flex items-center gap-1.5">👥 {tournament.participantCount || 0}/{tournament.maxPlayers}</span>
                <span className="text-xs text-[var(--text-muted)] flex items-center gap-1.5">🏁 {new Date(tournament.startDate).toLocaleDateString()}</span>
              </div>
            </div>
            <div className="flex gap-1.5 p-3 px-4 border-t border-[var(--border)] flex-wrap" onClick={e => e.stopPropagation()}>
              {tournament.status === 'registration' && (
                <button className="px-3 py-1.5 border border-[rgba(34,197,94,0.2)] rounded-[var(--radius-sm)] bg-[rgba(0,0,0,0.2)] text-[var(--green)] text-xs font-semibold cursor-pointer transition-all duration-fast hover:bg-[var(--green-bg)]" onClick={() => handleAction(tournament._id, 'activate')}>▶ Activate</button>
              )}
              {tournament.status === 'active' && (
                <button className="px-3 py-1.5 border border-[rgba(46,242,255,0.15)] rounded-[var(--radius-sm)] bg-[rgba(0,0,0,0.2)] text-[var(--cyan)] text-xs font-semibold cursor-pointer transition-all duration-fast hover:bg-[rgba(46,242,255,0.08)]" onClick={() => handleAction(tournament._id, 'complete')}>✓ Complete</button>
              )}
              {(tournament.status === 'registration' || tournament.status === 'active') && (
                <button className="px-3 py-1.5 border border-[rgba(249,115,22,0.15)] rounded-[var(--radius-sm)] bg-[rgba(0,0,0,0.2)] text-[var(--orange)] text-xs font-semibold cursor-pointer transition-all duration-fast hover:bg-[rgba(249,115,22,0.08)]" onClick={() => {
                  if (window.confirm('Cancel this tournament? This will end all ongoing matches.')) {
                    handleAction(tournament._id, 'cancel');
                  }
                }}>✕ Cancel</button>
              )}
              <button className="px-3 py-1.5 border border-[var(--border)] rounded-[var(--radius-sm)] bg-[rgba(0,0,0,0.2)] text-[var(--text-secondary)] text-xs font-semibold cursor-pointer transition-all duration-fast hover:border-[var(--border-glow)] hover:text-[var(--text)]" onClick={() => { onSelectTournament(tournament._id); setShowDetailModal(true); }}>👁 View</button>
              <button className="px-3 py-1.5 border border-[rgba(239,68,68,0.15)] rounded-[var(--radius-sm)] bg-[rgba(0,0,0,0.2)] text-[var(--red)] text-xs font-semibold cursor-pointer transition-all duration-fast hover:bg-[var(--red-bg)]" onClick={() => handleAction(tournament._id, 'delete')}>🗑 Delete</button>
            </div>
          </div>
        ))}
      </div>

      {filteredTournaments.length === 0 && (
        <div className="empty-state">
          <span>🏆</span>
          <p>No tournaments found</p>
          <button onClick={() => setShowCreateModal(true)} className="btn btn-primary">Create your first tournament</button>
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
    startDate: '', endDate: '', registrationDeadline: '', maxPlayers: 16, prize: '', rules: '',
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
    if (!form.registrationDeadline) errs.registrationDeadline = 'Registration deadline is required';
    if (form.registrationDeadline && form.startDate) {
      const reg = new Date(form.registrationDeadline);
      const start = new Date(form.startDate);
      if (reg >= start) errs.registrationDeadline = 'Deadline must be before start date';
    }
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
    const offset = new Date().getTimezoneOffset();
    ['startDate', 'endDate', 'registrationDeadline'].forEach(k => {
      if (fixed[k]) {
        const d = new Date(fixed[k]);
        fixed[k] = new Date(d.getTime() + offset * 60000).toISOString();
      }
    });
    try { await onSubmit(fixed); } finally { setSubmitting(false); }
  };

  const updateField = (field, value) => {
    setForm(prev => ({ ...prev, [field]: value }));
    if (errors[field]) setErrors(prev => ({ ...prev, [field]: null }));
  };

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[1000] backdrop-blur-sm animate-fade-in" onClick={onClose}>
      <div className="w-[90%] max-w-3xl bg-[var(--bg-glass-strong)] backdrop-blur-2xl border border-[var(--border-glow)] rounded-[var(--radius-2xl)] shadow-[var(--shadow-xl)] animate-scale-in max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border)]">
          <h3 className="font-display text-lg font-bold">Create New Tournament</h3>
          <button onClick={onClose} className="text-[var(--text-muted)] text-xl cursor-pointer bg-transparent border-none">✕</button>
        </div>
        <div className="p-6 overflow-y-auto flex-1">
          <form id="create-tournament-form" onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs text-[var(--text-muted)] uppercase tracking-wider font-semibold">Tournament Title *</label>
              <input type="text" value={form.title} onChange={e => updateField('title', e.target.value)} placeholder="Enter tournament name..." className={`p-3 bg-[rgba(0,0,0,0.3)] border rounded-[var(--radius-md)] text-[var(--text)] text-sm outline-none transition-colors duration-fast focus:border-[var(--border-glow-strong)] ${errors.title ? 'border-[var(--red)]' : 'border-[var(--border)]'}`} />
              {errors.title && <span className="text-xs text-[var(--red)]">{errors.title}</span>}
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs text-[var(--text-muted)] uppercase tracking-wider font-semibold">Description *</label>
              <textarea value={form.description} onChange={e => updateField('description', e.target.value)} placeholder="Describe your tournament..." className={`p-3 bg-[rgba(0,0,0,0.3)] border rounded-[var(--radius-md)] text-[var(--text)] text-sm outline-none transition-colors duration-fast focus:border-[var(--border-glow-strong)] min-h-[80px] ${errors.description ? 'border-[var(--red)]' : 'border-[var(--border)]'}`} />
              {errors.description && <span className="text-xs text-[var(--red)]">{errors.description}</span>}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs text-[var(--text-muted)] uppercase tracking-wider font-semibold">Map Code *</label>
                <input type="text" value={form.mapCode} onChange={e => updateField('mapCode', e.target.value)} placeholder="e.g. FN-1234" className={`p-3 bg-[rgba(0,0,0,0.3)] border rounded-[var(--radius-md)] text-[var(--text)] text-sm outline-none transition-colors duration-fast focus:border-[var(--border-glow-strong)] ${errors.mapCode ? 'border-[var(--red)]' : 'border-[var(--border)]'}`} />
                {errors.mapCode && <span className="text-xs text-[var(--red)]">{errors.mapCode}</span>}
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs text-[var(--text-muted)] uppercase tracking-wider font-semibold">Map Name</label>
                <input type="text" value={form.mapName} onChange={e => updateField('mapName', e.target.value)} placeholder="Optional map name" className="p-3 bg-[rgba(0,0,0,0.3)] border border-[var(--border)] rounded-[var(--radius-md)] text-[var(--text)] text-sm outline-none transition-colors duration-fast focus:border-[var(--border-glow-strong)]" />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs text-[var(--text-muted)] uppercase tracking-wider font-semibold">Type</label>
                <select value={form.type} onChange={e => updateField('type', e.target.value)} className="p-3 bg-[rgba(0,0,0,0.3)] border border-[var(--border)] rounded-[var(--radius-md)] text-[var(--text)] text-sm outline-none transition-colors duration-fast focus:border-[var(--border-glow-strong)]">
                  <option value="1v1">1v1</option>
                  <option value="2v2">2v2</option> <option value="3v3">3v3</option> <option value="4v4">4v4</option>
                </select>
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs text-[var(--text-muted)] uppercase tracking-wider font-semibold">Max Players</label>
                <input type="number" value={form.maxPlayers} onChange={e => updateField('maxPlayers', parseInt(e.target.value))} min="2" max="128" className="p-3 bg-[rgba(0,0,0,0.3)] border border-[var(--border)] rounded-[var(--radius-md)] text-[var(--text)] text-sm outline-none transition-colors duration-fast focus:border-[var(--border-glow-strong)]" />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs text-[var(--text-muted)] uppercase tracking-wider font-semibold">Prize Pool</label>
                <input type="text" value={form.prize} onChange={e => updateField('prize', e.target.value)} placeholder="e.g. $100, V-Bucks" className="p-3 bg-[rgba(0,0,0,0.3)] border border-[var(--border)] rounded-[var(--radius-md)] text-[var(--text)] text-sm outline-none transition-colors duration-fast focus:border-[var(--border-glow-strong)]" />
              </div>
            </div>
            <div>
              <h4 className="font-display text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-3">📅 Schedule</h4>
              <div className="grid grid-cols-3 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs text-[var(--text-muted)] uppercase tracking-wider font-semibold">Registration Deadline *</label>
                  <input type="datetime-local" value={form.registrationDeadline} onChange={e => updateField('registrationDeadline', e.target.value)} className={`p-3 bg-[rgba(0,0,0,0.3)] border rounded-[var(--radius-md)] text-[var(--text)] text-sm outline-none transition-colors duration-fast focus:border-[var(--border-glow-strong)] ${errors.registrationDeadline ? 'border-[var(--red)]' : 'border-[var(--border)]'}`} />
                  {errors.registrationDeadline && <span className="text-xs text-[var(--red)]">{errors.registrationDeadline}</span>}
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs text-[var(--text-muted)] uppercase tracking-wider font-semibold">Start Date *</label>
                  <input type="datetime-local" value={form.startDate} onChange={e => updateField('startDate', e.target.value)} className={`p-3 bg-[rgba(0,0,0,0.3)] border rounded-[var(--radius-md)] text-[var(--text)] text-sm outline-none transition-colors duration-fast focus:border-[var(--border-glow-strong)] ${errors.startDate ? 'border-[var(--red)]' : 'border-[var(--border)]'}`} />
                  {errors.startDate && <span className="text-xs text-[var(--red)]">{errors.startDate}</span>}
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs text-[var(--text-muted)] uppercase tracking-wider font-semibold">End Date *</label>
                  <input type="datetime-local" value={form.endDate} onChange={e => updateField('endDate', e.target.value)} className={`p-3 bg-[rgba(0,0,0,0.3)] border rounded-[var(--radius-md)] text-[var(--text)] text-sm outline-none transition-colors duration-fast focus:border-[var(--border-glow-strong)] ${errors.endDate ? 'border-[var(--red)]' : 'border-[var(--border)]'}`} />
                  {errors.endDate && <span className="text-xs text-[var(--red)]">{errors.endDate}</span>}
                </div>
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs text-[var(--text-muted)] uppercase tracking-wider font-semibold">Rules *</label>
              <textarea value={form.rules} onChange={e => updateField('rules', e.target.value)} placeholder="Enter competition rules..." className={`p-3 bg-[rgba(0,0,0,0.3)] border rounded-[var(--radius-md)] text-[var(--text)] text-sm outline-none transition-colors duration-fast focus:border-[var(--border-glow-strong)] min-h-[80px] ${errors.rules ? 'border-[var(--red)]' : 'border-[var(--border)]'}`} />
              {errors.rules && <span className="text-xs text-[var(--red)]">{errors.rules}</span>}
            </div>
          </form>
        </div>
        <div className="flex justify-end gap-3 p-4 border-t border-[var(--border)]">
          <button type="button" onClick={onClose} className="px-4 py-2 rounded-[var(--radius-md)] bg-[rgba(255,255,255,0.05)] border border-[var(--border)] text-sm text-[var(--text)] cursor-pointer transition-all duration-fast hover:border-[var(--border-glow)]">Cancel</button>
          <button type="submit" form="create-tournament-form" className="px-6 py-2 rounded-[var(--radius-md)] bg-gradient-to-r from-[var(--cyan)] to-[var(--electric-blue)] text-black text-sm font-bold cursor-pointer shadow-[0_0_20px_rgba(46,242,255,0.2)] transition-all duration-base hover:shadow-[0_0_40px_rgba(46,242,255,0.4)] disabled:opacity-50 disabled:cursor-not-allowed" disabled={submitting}>
            {submitting ? 'Creating...' : 'Create Tournament'}
          </button>
        </div>
      </div>
    </div>
  );
};

const TournamentDetailModal = ({ tournament, onClose, onAction, onUpdate, getStatusColor }) => (
  <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[1000] backdrop-blur-sm animate-fade-in" onClick={onClose}>
    <div className="w-[90%] max-w-[640px] bg-[var(--bg-glass-strong)] backdrop-blur-2xl border border-[var(--border-glow)] rounded-[var(--radius-2xl)] shadow-[var(--shadow-xl)] animate-scale-in max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
      <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border)]">
        <div className="flex items-center gap-3">
          <h3 className="font-display text-lg font-bold">{tournament.title}</h3>
          <span className="px-2.5 py-0.5 rounded-full text-[0.7rem] font-semibold flex items-center gap-1" style={{ background: getStatusColor(tournament.status) }}>{tournament.status}</span>
        </div>
        <button onClick={onClose} className="text-[var(--text-muted)] text-xl cursor-pointer bg-transparent border-none">✕</button>
      </div>
      <div className="p-6 overflow-y-auto">
        <div className="grid grid-cols-2 gap-3 mb-5">
          <div className="p-3 bg-[rgba(0,0,0,0.15)] border border-[var(--border)] rounded-[var(--radius-md)]"><label className="text-[0.7rem] text-[var(--text-muted)] uppercase tracking-wider block mb-1">Map Code</label><span className="text-sm font-semibold">{tournament.mapCode}</span></div>
          <div className="p-3 bg-[rgba(0,0,0,0.15)] border border-[var(--border)] rounded-[var(--radius-md)]"><label className="text-[0.7rem] text-[var(--text-muted)] uppercase tracking-wider block mb-1">Type</label><span className="text-sm font-semibold">{tournament.type}</span></div>
          <div className="p-3 bg-[rgba(0,0,0,0.15)] border border-[var(--border)] rounded-[var(--radius-md)]"><label className="text-[0.7rem] text-[var(--text-muted)] uppercase tracking-wider block mb-1">Max Players</label><span className="text-sm font-semibold">{tournament.maxPlayers}</span></div>
          <div className="p-3 bg-[rgba(0,0,0,0.15)] border border-[var(--border)] rounded-[var(--radius-md)]"><label className="text-[0.7rem] text-[var(--text-muted)] uppercase tracking-wider block mb-1">Prize</label><span className="text-sm font-semibold">{tournament.prize || 'None'}</span></div>
          <div className="p-3 bg-[rgba(0,0,0,0.15)] border border-[var(--border)] rounded-[var(--radius-md)]"><label className="text-[0.7rem] text-[var(--text-muted)] uppercase tracking-wider block mb-1">Start</label><span className="text-sm font-semibold">{new Date(tournament.startDate).toLocaleString()}</span></div>
          <div className="p-3 bg-[rgba(0,0,0,0.15)] border border-[var(--border)] rounded-[var(--radius-md)]"><label className="text-[0.7rem] text-[var(--text-muted)] uppercase tracking-wider block mb-1">End</label><span className="text-sm font-semibold">{new Date(tournament.endDate).toLocaleString()}</span></div>
        </div>
        <div className="mb-4"><label className="text-xs text-[var(--text-muted)] uppercase tracking-wider font-semibold block mb-2">Description</label><p className="text-sm text-[var(--text-secondary)] leading-relaxed">{tournament.description}</p></div>
        <div className="mb-4"><label className="text-xs text-[var(--text-muted)] uppercase tracking-wider font-semibold block mb-2">Rules</label><p className="text-sm text-[var(--text-secondary)] leading-relaxed whitespace-pre-wrap">{tournament.rules}</p></div>
        <div className="mb-4">
          <label className="text-xs text-[var(--text-muted)] uppercase tracking-wider font-semibold block mb-2">Participants ({tournament.participants?.length || 0})</label>
          <div className="flex flex-col gap-1.5 max-h-[200px] overflow-y-auto">
            {tournament.participants?.length > 0 ? tournament.participants.map((p, i) => (
              <div key={i} className="flex items-center justify-between p-2 bg-[rgba(0,0,0,0.15)] border border-[var(--border)] rounded-[var(--radius-sm)] text-sm">
                <span className="font-semibold">{p.discordName || p.userId}</span>
                <span className="text-xs text-[var(--text-muted)] font-mono">{p.epicName || '—'}</span>
              </div>
            )) : <p className="text-sm text-[var(--text-muted)] text-center py-4">No participants yet</p>}
          </div>
        </div>
      </div>
      <div className="flex flex-wrap gap-2 p-4 border-t border-[var(--border)]">
        {tournament.status === 'registration' && <button className="btn btn-success btn-sm" onClick={() => onAction(tournament._id, 'activate')}>▶ Activate</button>}
        {tournament.status === 'active' && <button className="btn btn-primary btn-sm" onClick={() => onAction(tournament._id, 'complete')}>✓ Complete</button>}
        {(tournament.status === 'registration' || tournament.status === 'active') && (
          <button className="btn btn-ghost btn-sm" onClick={() => { if (window.confirm('Cancel this tournament?')) onAction(tournament._id, 'cancel'); }}>✕ Cancel</button>
        )}
        <button className="btn btn-danger btn-sm" onClick={() => onAction(tournament._id, 'delete')}>🗑 Delete</button>
        <button className="btn btn-ghost btn-sm" onClick={onClose}>Close</button>
      </div>
    </div>
  </div>
);

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
    <div>
      <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
        <h2 className="font-display text-xl font-bold">User Management <span className="text-sm text-[#94a3b8] font-normal">({users.pagination?.total || 0} total)</span></h2>
        <div className="flex gap-2">
          <input type="text" placeholder="Search by name, Discord ID..." value={search}
            onChange={e => setSearch(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleSearch(1)}
            className="p-2.5 bg-[rgba(0,0,0,0.3)] border border-[var(--border)] rounded-[var(--radius-md)] text-[var(--text)] text-sm outline-none transition-colors duration-fast focus:border-[var(--border-glow-strong)] min-w-[200px]" />
          <button onClick={() => handleSearch(1)} className="px-4 py-2 rounded-[var(--radius-md)] bg-[rgba(46,242,255,0.1)] border border-[rgba(46,242,255,0.2)] text-[var(--cyan)] text-sm font-semibold cursor-pointer transition-all duration-fast hover:bg-[rgba(46,242,255,0.15)]">Search</button>
        </div>
      </div>

      <div className="flex gap-5">
        <div className="flex-1 overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr>
                <th className="text-left px-4 py-3 text-[0.7rem] uppercase tracking-wider text-[var(--text-muted)] font-bold border-b border-[var(--border)] whitespace-nowrap">User</th>
                <th className="text-left px-4 py-3 text-[0.7rem] uppercase tracking-wider text-[var(--text-muted)] font-bold border-b border-[var(--border)] whitespace-nowrap">Role</th>
                <th className="text-left px-4 py-3 text-[0.7rem] uppercase tracking-wider text-[var(--text-muted)] font-bold border-b border-[var(--border)] whitespace-nowrap">Score</th>
                <th className="text-left px-4 py-3 text-[0.7rem] uppercase tracking-wider text-[var(--text-muted)] font-bold border-b border-[var(--border)] whitespace-nowrap">Rating</th>
                <th className="text-left px-4 py-3 text-[0.7rem] uppercase tracking-wider text-[var(--text-muted)] font-bold border-b border-[var(--border)] whitespace-nowrap">Matches</th>
                <th className="text-left px-4 py-3 text-[0.7rem] uppercase tracking-wider text-[var(--text-muted)] font-bold border-b border-[var(--border)] whitespace-nowrap">Status</th>
              </tr>
            </thead>
            <tbody>
              {users.users?.map(user => (
                <tr key={user.discordId} onClick={() => { onSelectUser(user.discordId); setShowDetail(true); }} className="cursor-pointer transition-colors duration-fast hover:bg-[var(--bg-hover)]">
                  <td className="px-4 py-3 border-b border-[var(--border)] text-sm">
                    <div className="flex items-center gap-2.5">
                      <img src={buildDiscordAvatar(user.discordId, user.discordAvatar) || DISCORD_AVATAR_FALLBACK} alt="" className="w-8 h-8 rounded-full border border-[var(--border)]" />
                      <div>
                        <span className="font-semibold block">{user.discordName}</span>
                        <span className="text-xs text-[var(--text-muted)] font-mono">{user.epicGamesName || 'Not verified'}</span>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 border-b border-[var(--border)] text-sm"><span className={`px-2.5 py-0.5 rounded-full text-[0.7rem] font-semibold ${user.role === 'admin' || user.role === 'owner' ? 'bg-[rgba(46,242,255,0.1)] text-[var(--cyan)]' : user.role === 'staff' ? 'bg-[rgba(168,85,247,0.1)] text-[var(--purple)]' : 'bg-[rgba(255,255,255,0.04)] text-[var(--text-muted)]'}`}>{user.role}</span></td>
                  <td className="px-4 py-3 border-b border-[var(--border)] text-sm">
                    <div className="flex items-center gap-2">
                      <div className="h-1.5 rounded-sm w-[60px]" style={{ background: getRiskColor(user.anticheatScore ?? 100) }}></div>
                      <span className="text-xs font-semibold">{user.anticheatScore ?? 100}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 border-b border-[var(--border)] text-sm">{getRankLabel(user.rankingPoints || 0)}</td>
                  <td className="px-4 py-3 border-b border-[var(--border)] text-sm">{user.wins || 0}W / {user.losses || 0}L</td>
                  <td className="px-4 py-3 border-b border-[var(--border)] text-sm">
                    <span className={`px-2.5 py-0.5 rounded-full text-[0.7rem] font-semibold ${user.isBanned ? 'bg-[var(--red-bg)] text-[var(--red)]' : 'bg-[var(--green-bg)] text-[var(--green)]'}`}>
                      {user.isBanned ? 'Banned' : 'Active'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {users.users?.length === 0 && <p className="text-center py-5 text-[var(--text-muted)] text-sm">No users found</p>}

          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 mt-4">
              <button disabled={page <= 1} onClick={() => handleSearch(page - 1)} className="px-3 py-1.5 rounded-[var(--radius-md)] bg-[var(--bg-card)] border border-[var(--border)] text-xs text-[var(--text-muted)] cursor-pointer transition-all duration-fast hover:border-[var(--border-glow)] disabled:opacity-40">← Prev</button>
              {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                const start = Math.max(1, page - 2);
                const p = start + i;
                if (p > totalPages) return null;
                return (
                  <button key={p} className={`px-3 py-1.5 rounded-[var(--radius-md)] text-xs font-semibold cursor-pointer border ${p === page ? 'bg-[rgba(46,242,255,0.06)] border-[var(--border-glow)] text-[var(--cyan)]' : 'bg-[var(--bg-card)] border-[var(--border)] text-[var(--text-muted)]'}`} onClick={() => handleSearch(p)}>
                    {p}
                  </button>
                );
              })}
              <button disabled={page >= totalPages} onClick={() => handleSearch(page + 1)} className="px-3 py-1.5 rounded-[var(--radius-md)] bg-[var(--bg-card)] border border-[var(--border)] text-xs text-[var(--text-muted)] cursor-pointer transition-all duration-fast hover:border-[var(--border-glow)] disabled:opacity-40">Next →</button>
            </div>
          )}
        </div>

        {showDetail && selectedUser && (
          <div className="w-[320px] flex-shrink-0 bg-[var(--bg-card)] border border-[var(--border)] rounded-[var(--radius-lg)] p-5 sticky top-5 max-h-[calc(100vh-80px)] overflow-y-auto animate-slide-in-right">
            <div className="flex items-center gap-3 mb-4">
              <img src={buildDiscordAvatar(selectedUser.user?.discordId, selectedUser.user?.discordAvatar) || DISCORD_AVATAR_FALLBACK} alt="" className="w-12 h-12 rounded-full border-2 border-[var(--border-glow)]" />
              <div>
                <h3 className="text-base font-bold">{selectedUser.user?.discordName}</h3>
                <span className="text-xs font-semibold" style={{ color: getRiskColor(selectedUser.user?.anticheatScore ?? 100) }}>
                  {selectedUser.riskLevel?.toUpperCase() || 'UNKNOWN'} RISK
                </span>
              </div>
              <button onClick={() => setShowDetail(false)} className="ml-auto text-[var(--text-muted)] cursor-pointer bg-transparent border-none text-lg">✕</button>
            </div>
            <div className="grid grid-cols-3 gap-2 mb-4">
              <div className="text-center p-2.5 bg-[rgba(0,0,0,0.2)] border border-[var(--border)] rounded-[var(--radius-sm)]"><span className="text-[0.65rem] text-[var(--text-muted)] uppercase tracking-wider block mb-1">Wins</span><strong className="font-display text-base font-bold text-[var(--cyan)]">{selectedUser.user?.wins || 0}</strong></div>
              <div className="text-center p-2.5 bg-[rgba(0,0,0,0.2)] border border-[var(--border)] rounded-[var(--radius-sm)]"><span className="text-[0.65rem] text-[var(--text-muted)] uppercase tracking-wider block mb-1">Losses</span><strong className="font-display text-base font-bold text-[var(--cyan)]">{selectedUser.user?.losses || 0}</strong></div>
              <div className="text-center p-2.5 bg-[rgba(0,0,0,0.2)] border border-[var(--border)] rounded-[var(--radius-sm)]"><span className="text-[0.65rem] text-[var(--text-muted)] uppercase tracking-wider block mb-1">Rank</span><strong className="font-display text-base font-bold text-[var(--cyan)]">{getRankLabel(selectedUser.user?.rankingPoints || 0)}</strong></div>
            </div>
            <div className="mb-4"><label className="text-xs text-[var(--text-muted)] uppercase tracking-wider font-semibold block mb-2">Epic Games</label><p className="text-sm text-[var(--text-secondary)]">{selectedUser.user?.epicGamesName || 'Not verified'} {selectedUser.user?.epicVerified ? '✓' : ''}</p></div>
            {selectedUser.user?.ipAddresses?.length > 0 && (
              <div className="mb-4">
                <label className="text-xs text-[var(--text-muted)] uppercase tracking-wider font-semibold block mb-2">IP Addresses</label>
                <div className="flex flex-col gap-2">
                  {selectedUser.user.ipAddresses.slice(0, 8).map((ipEntry, i) => (
                    <div key={`${ipEntry.ip}-${i}`} className="flex justify-between items-center gap-2.5 bg-[rgba(15,23,42,0.45)] border border-[#334155] rounded-lg p-2 px-2.5">
                      <span className="font-mono text-xs">{ipEntry.ip}</span>
                      <button className="px-2 py-1 border border-[var(--border)] rounded-[var(--radius-sm)] bg-[rgba(0,0,0,0.2)] text-[var(--text-muted)] text-xs cursor-pointer transition-all duration-fast hover:border-[var(--border-glow)] hover:text-[var(--text)] btn-sm" onClick={() => onWhitelistIP(ipEntry.ip)}>Whitelist</button>
                    </div>
                  ))}
                </div>
              </div>
            )}
            <div className="flex flex-wrap gap-1.5 mt-4">
              <button className="btn btn-sm" onClick={() => {
                const reason = window.prompt('Warning reason:');
                if (reason) onAction(selectedUser.user?.discordId, 'warn', { type: 'other', reason, daysUntilExpiry: 30 });
              }}>Warn</button>
              <button className="btn btn-sm" onClick={() => {
                const reason = window.prompt('Strike reason:');
                if (reason) onAction(selectedUser.user?.discordId, 'strike', { reason });
              }}>Strike</button>
              <button className="btn btn-sm" onClick={() => {
                if (window.confirm('Reset this user\'s profile? This cannot be undone.')) {
                  onAction(selectedUser.user?.discordId, 'reset', { resetType: 'full' });
                }
              }}>Reset</button>
              <button className="btn btn-sm" onClick={() => onAction(selectedUser.user?.discordId, 'remove-premium')}>Remove Premium</button>
              {selectedUser.user?.isBanned ? (
                <button className="btn btn-success btn-sm" onClick={() => onAction(selectedUser.user?.discordId, 'unban')}>Unban</button>
              ) : (
                <button className="btn btn-danger btn-sm" onClick={() => {
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
    <div className="flex flex-col gap-3">
      {[1,2,3].map(i => <div key={i} className="skeleton" style={{ height: 100 }} />)}
    </div>
  );
  return (
    <div>
      <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
        <div>
          <h2 className="font-display text-xl font-bold">Anticheat Alerts</h2>
          <p className="text-xs text-[var(--text-muted)] mt-0.5">{alerts.length} unresolved alert{alerts.length !== 1 ? 's' : ''}</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button className={`px-4 py-2 rounded-[var(--radius-md)] text-sm font-semibold cursor-pointer transition-all duration-base border ${filter === 'all' ? 'bg-[rgba(46,242,255,0.06)] border-[var(--border-glow)] text-[var(--cyan)]' : 'bg-[var(--bg-card)] border-[var(--border)] text-[var(--text-muted)] hover:border-[var(--border-glow)] hover:text-[var(--text-secondary)]'}`} onClick={() => setFilter('all')}>All ({alerts.length})</button>
          <button className={`px-4 py-2 rounded-[var(--radius-md)] text-sm font-semibold cursor-pointer transition-all duration-base border ${filter === 'critical' ? 'bg-[rgba(46,242,255,0.06)] border-[var(--border-glow)] text-[#ef4444]' : 'bg-[var(--bg-card)] border-[var(--border)] text-[var(--text-muted)] hover:border-[var(--border-glow)] hover:text-[var(--text-secondary)]'}`} onClick={() => setFilter('critical')}>Critical</button>
          <button className={`px-4 py-2 rounded-[var(--radius-md)] text-sm font-semibold cursor-pointer transition-all duration-base border ${filter === 'high' ? 'bg-[rgba(46,242,255,0.06)] border-[var(--border-glow)] text-[#f97316]' : 'bg-[var(--bg-card)] border-[var(--border)] text-[var(--text-muted)] hover:border-[var(--border-glow)] hover:text-[var(--text-secondary)]'}`} onClick={() => setFilter('high')}>High</button>
          <button className={`px-4 py-2 rounded-[var(--radius-md)] text-sm font-semibold cursor-pointer transition-all duration-base border ${filter === 'medium' ? 'bg-[rgba(46,242,255,0.06)] border-[var(--border-glow)] text-[#eab308]' : 'bg-[var(--bg-card)] border-[var(--border)] text-[var(--text-muted)] hover:border-[var(--border-glow)] hover:text-[var(--text-secondary)]'}`} onClick={() => setFilter('medium')}>Medium</button>
          <button className={`px-4 py-2 rounded-[var(--radius-md)] text-sm font-semibold cursor-pointer transition-all duration-base border ${filter === 'low' ? 'bg-[rgba(46,242,255,0.06)] border-[var(--border-glow)] text-[#3b82f6]' : 'bg-[var(--bg-card)] border-[var(--border)] text-[var(--text-muted)] hover:border-[var(--border-glow)] hover:text-[var(--text-secondary)]'}`} onClick={() => setFilter('low')}>Low</button>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="empty-state"><span>✓</span><p>No alerts to show</p></div>
      ) : (
        <div className="flex flex-col gap-2.5">
          {filtered.map((alert, i) => (
            <div key={i} className="bg-[var(--bg-card)] border border-[var(--border)] rounded-[var(--radius-lg)] overflow-hidden animate-fade-in-up"
              style={{ animationFillMode: 'both', animationDelay: `${i * 0.03}s` }}>
              <div className="flex items-center gap-3.5 p-4 px-5 border-b border-[var(--border)]">
                <div className="w-10 h-10 rounded-[var(--radius-md)] flex items-center justify-center text-base flex-shrink-0"
                  style={{ background: `${getSeverityColor(alert.severity)}15`, color: getSeverityColor(alert.severity) }}>
                  <i className={`fas ${getFlagIcon(alert.flag)}`}></i>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="font-semibold text-sm text-[var(--text)]">{alert.userName}</span>
                    <span className="px-2 py-0.5 rounded-full text-[0.65rem] font-bold uppercase tracking-wider"
                      style={{ background: `${getSeverityColor(alert.severity)}15`, color: getSeverityColor(alert.severity), border: `1px solid ${getSeverityColor(alert.severity)}25` }}>{alert.flag}</span>
                    <span className="px-2 py-0.5 rounded-full text-[0.6rem] font-extrabold uppercase tracking-widest"
                      style={{ background: `${getSeverityColor(alert.severity)}20`, color: getSeverityColor(alert.severity) }}>{alert.severity}</span>
                  </div>
                  <div className="text-xs text-[var(--text-muted)] leading-relaxed">{alert.description}</div>
                </div>
                <div className="flex flex-col items-center flex-shrink-0 px-3">
                  <span className="font-display text-lg font-bold" style={{ color: getScoreColor(alert.anticheatScore) }}>{alert.anticheatScore}</span>
                  <span className="text-[0.6rem] text-[var(--text-dim)] uppercase tracking-wider">Score</span>
                </div>
                <button onClick={() => resolveFlag(alert.userId, alert._id)} className="btn btn-ghost btn-sm">
                  <i className="fas fa-check"></i> Resolve
                </button>
              </div>
              <div className="flex items-center justify-between px-5 py-2 bg-[rgba(0,0,0,0.15)] text-xs text-[var(--text-dim)]">
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

const MatchesTab = ({ api, notify }) => {
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  useEffect(() => { fetchMatches(); }, [api, filter, page]);

  const fetchMatches = async () => {
    try {
      const params = { limit: 50, page };
      if (filter === 'disputed') { params.disputed = 'true'; params.status = 'disputed'; }
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

  if (loading) return <div className="text-center py-10 text-[var(--text-muted)]">Loading...</div>;

  return (
    <div>
      <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
        <h2 className="font-display text-xl font-bold">Match History</h2>
        <div className="flex gap-2 flex-wrap">
          <button className={`px-4 py-2 rounded-[var(--radius-md)] text-sm font-semibold cursor-pointer transition-all duration-base border ${filter === 'all' ? 'bg-[rgba(46,242,255,0.06)] border-[var(--border-glow)] text-[var(--cyan)]' : 'bg-[var(--bg-card)] border-[var(--border)] text-[var(--text-muted)] hover:border-[var(--border-glow)] hover:text-[var(--text-secondary)]'}`} onClick={() => { setFilter('all'); setPage(1); }}>All</button>
          <button className={`px-4 py-2 rounded-[var(--radius-md)] text-sm font-semibold cursor-pointer transition-all duration-base border ${filter === 'completed' ? 'bg-[rgba(46,242,255,0.06)] border-[var(--border-glow)] text-[var(--cyan)]' : 'bg-[var(--bg-card)] border-[var(--border)] text-[var(--text-muted)] hover:border-[var(--border-glow)] hover:text-[var(--text-secondary)]'}`} onClick={() => { setFilter('completed'); setPage(1); }}>Completed</button>
          <button className={`px-4 py-2 rounded-[var(--radius-md)] text-sm font-semibold cursor-pointer transition-all duration-base border ${filter === 'disputed' ? 'bg-[rgba(46,242,255,0.06)] border-[var(--border-glow)] text-[var(--cyan)]' : 'bg-[var(--bg-card)] border-[var(--border)] text-[var(--text-muted)] hover:border-[var(--border-glow)] hover:text-[var(--text-secondary)]'}`} onClick={() => { setFilter('disputed'); setPage(1); }}>Disputed</button>
          <button className={`px-4 py-2 rounded-[var(--radius-md)] text-sm font-semibold cursor-pointer transition-all duration-base border ${filter === 'pending' ? 'bg-[rgba(46,242,255,0.06)] border-[var(--border-glow)] text-[var(--cyan)]' : 'bg-[var(--bg-card)] border-[var(--border)] text-[var(--text-muted)] hover:border-[var(--border-glow)] hover:text-[var(--text-secondary)]'}`} onClick={() => { setFilter('pending'); setPage(1); }}>Pending</button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr>
              <th className="text-left px-4 py-3 text-[0.7rem] uppercase tracking-wider text-[var(--text-muted)] font-bold border-b border-[var(--border)] whitespace-nowrap">Date</th>
              <th className="text-left px-4 py-3 text-[0.7rem] uppercase tracking-wider text-[var(--text-muted)] font-bold border-b border-[var(--border)] whitespace-nowrap">Player 1</th>
              <th className="text-left px-4 py-3 text-[0.7rem] uppercase tracking-wider text-[var(--text-muted)] font-bold border-b border-[var(--border)] whitespace-nowrap">Player 2</th>
              <th className="text-left px-4 py-3 text-[0.7rem] uppercase tracking-wider text-[var(--text-muted)] font-bold border-b border-[var(--border)] whitespace-nowrap">Result</th>
              <th className="text-left px-4 py-3 text-[0.7rem] uppercase tracking-wider text-[var(--text-muted)] font-bold border-b border-[var(--border)] whitespace-nowrap">Status</th>
              <th className="text-left px-4 py-3 text-[0.7rem] uppercase tracking-wider text-[var(--text-muted)] font-bold border-b border-[var(--border)] whitespace-nowrap">Actions</th>
            </tr>
          </thead>
          <tbody>
            {matches.map(m => (
              <tr key={m._id} className={m.disputed ? 'bg-[rgba(249,115,22,0.02)]' : ''}>
                <td className="px-4 py-3 border-b border-[var(--border)] text-sm">{new Date(m.date).toLocaleDateString()}</td>
                <td className="px-4 py-3 border-b border-[var(--border)] text-sm">
                  <img src={buildDiscordAvatar(m.player1?.discordId, m.player1?.discordAvatar) || DISCORD_AVATAR_FALLBACK} alt="" className="w-6 h-6 rounded-full align-middle mr-1.5 inline-block" />
                  <span>{m.player1?.discordName || 'Unknown'}</span>
                </td>
                <td className="px-4 py-3 border-b border-[var(--border)] text-sm">
                  <img src={buildDiscordAvatar(m.player2?.discordId, m.player2?.discordAvatar) || DISCORD_AVATAR_FALLBACK} alt="" className="w-6 h-6 rounded-full align-middle mr-1.5 inline-block" />
                  <span>{m.player2?.discordName || 'Unknown'}</span>
                </td>
                <td className="px-4 py-3 border-b border-[var(--border)] text-sm font-semibold">
                  <span className={`${m.result === 'player1' ? 'text-[var(--cyan)]' : m.result === 'player2' ? 'text-[var(--purple)]' : ''}`}>
                    {m.result === 'player1' ? `${m.player1?.discordName || 'P1'} Win` :
                     m.result === 'player2' ? `${m.player2?.discordName || 'P2'} Win` :
                     m.result || '—'}
                  </span>
                </td>
                <td className="px-4 py-3 border-b border-[var(--border)] text-sm">
                  <span className={`px-2.5 py-0.5 rounded-full text-[0.7rem] font-semibold ${m.disputed ? 'bg-[rgba(249,115,22,0.12)] text-[var(--orange)]' : m.status === 'completed' ? 'bg-[var(--green-bg)] text-[var(--green)]' : 'bg-[rgba(255,255,255,0.04)] text-[var(--text-muted)]'}`}>
                    {m.disputed ? '⚠ Disputed' : m.status || 'completed'}
                  </span>
                </td>
                <td className="px-4 py-3 border-b border-[var(--border)] text-sm">
                  <div className="flex gap-1">
                    {m.disputed || m.status === 'pending' ? (
                      <>
                        <button className="px-2.5 py-1 border border-[rgba(34,197,94,0.2)] rounded-[var(--radius-sm)] bg-[rgba(0,0,0,0.2)] text-[var(--green)] text-[0.7rem] cursor-pointer transition-all duration-fast hover:border-[var(--border-glow)] hover:text-[var(--text)]" onClick={() => overrideMatch(m._id, 'player1')}>
                          {m.player1?.discordName?.split(' ')[0] || 'P1'}
                        </button>
                        <button className="px-2.5 py-1 border border-[rgba(239,68,68,0.15)] rounded-[var(--radius-sm)] bg-[rgba(0,0,0,0.2)] text-[var(--red)] text-[0.7rem] cursor-pointer transition-all duration-fast hover:border-[var(--border-glow)] hover:text-[var(--text)]" onClick={() => overrideMatch(m._id, 'player2')}>
                          {m.player2?.discordName?.split(' ')[0] || 'P2'}
                        </button>
                        <button className="px-2.5 py-1 border border-[var(--border)] rounded-[var(--radius-sm)] bg-[rgba(0,0,0,0.2)] text-[var(--text-muted)] text-[0.7rem] cursor-pointer transition-all duration-fast hover:border-[var(--border-glow)] hover:text-[var(--text)]" onClick={() => overrideMatch(m._id, 'draw')}>Draw</button>
                      </>
                    ) : <span className="text-[var(--text-muted)]">—</span>}
                  </div>
                </td>
              </tr>
            ))}
            {matches.length === 0 && <tr><td colSpan="6" className="text-center py-5 text-[var(--text-muted)] text-sm">No matches found</td></tr>}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-4 mt-6">
          <button disabled={page <= 1} onClick={() => setPage(p => p - 1)} className="px-4 py-2 rounded-[var(--radius-md)] bg-[var(--bg-card)] border border-[var(--border)] text-sm text-[var(--text-muted)] cursor-pointer transition-all duration-fast hover:border-[var(--border-glow)] disabled:opacity-40">← Prev</button>
          <span className="text-sm text-[var(--text-muted)]">{page} / {totalPages}</span>
          <button disabled={page >= totalPages} onClick={() => setPage(p => p + 1)} className="px-4 py-2 rounded-[var(--radius-md)] bg-[var(--bg-card)] border border-[var(--border)] text-sm text-[var(--text-muted)] cursor-pointer transition-all duration-fast hover:border-[var(--border-glow)] disabled:opacity-40">Next →</button>
        </div>
      )}
    </div>
  );
};

const BroadcastTab = ({ api, notify }) => {
  const [announcements, setAnnouncements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ title: '', body: '', type: 'info', priority: 'normal', expiresAt: '' });
  useEffect(() => { fetchAnnouncements(); }, []);
  const fetchAnnouncements = async () => {
    try { const res = await api.get('/admin/announcements'); setAnnouncements(res.data.announcements); } catch (err) { console.error('Failed'); }
    finally { setLoading(false); }
  };
  const handleCreate = async () => {
    if (!form.title.trim() || !form.body.trim()) { notify('Title and body required', 'error'); return; }
    try { await api.post('/admin/announcements', form); notify('Announcement published', 'success'); setShowCreate(false); setForm({ title: '', body: '', type: 'info', priority: 'normal', expiresAt: '' }); fetchAnnouncements(); }
    catch (err) { notify('Failed to create', 'error'); }
  };
  const handleDelete = async (id) => { try { await api.delete(`/admin/announcements/${id}`); notify('Deleted', 'success'); fetchAnnouncements(); } catch (err) { notify('Failed to delete', 'error'); } };
  const handleToggleActive = async (id, current) => { try { await api.put(`/admin/announcements/${id}`, { active: !current }); fetchAnnouncements(); } catch (err) { notify('Failed to update', 'error'); } };
  const typeColors = { info: '#3b82f6', warning: '#eab308', update: '#22c55e', maintenance: '#f97316', event: '#a78bfa' };
  if (loading) return <div className="text-center py-10 text-[var(--text-muted)]">Loading...</div>;
  return (
    <div>
      <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
        <h2 className="font-display text-xl font-bold">Broadcast Center</h2>
        <button className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-[var(--cyan)] to-[var(--electric-blue)] border-none rounded-[var(--radius-md)] text-black font-bold text-sm cursor-pointer whitespace-nowrap transition-all duration-base hover:shadow-[0_0_25px_rgba(46,242,255,0.3)] hover:-translate-y-0.5" onClick={() => setShowCreate(true)}>+ New Announcement</button>
      </div>
      <div className="flex flex-col gap-3">
        {announcements.length === 0 ? (
          <div className="empty-state"><span>📢</span><p>No announcements yet</p></div>
        ) : announcements.map(a => (
          <div key={a._id} className={`bg-[var(--bg-card)] border border-[var(--border)] rounded-[var(--radius-lg)] overflow-hidden transition-all duration-base hover:border-[var(--border-glow)] ${!a.active ? 'opacity-60' : ''}`}>
            <div className="flex items-center gap-3 px-4 py-3 border-b border-[var(--border)] flex-wrap">
              <span className="px-2.5 py-0.5 rounded-full text-[0.65rem] font-bold text-white" style={{ background: typeColors[a.type] || '#64748b' }}>{a.type}</span>
              <span className={`px-2 py-0.5 rounded-full text-[0.6rem] font-semibold uppercase tracking-wider ${a.priority === 'urgent' ? 'bg-[rgba(239,68,68,0.15)] text-[var(--red)]' : a.priority === 'high' ? 'bg-[rgba(249,115,22,0.12)] text-[var(--orange)]' : a.priority === 'low' ? 'bg-[rgba(255,255,255,0.03)] text-[var(--text-muted)]' : 'bg-[rgba(255,255,255,0.05)] text-[var(--text-secondary)]'}`}>{a.priority}</span>
              <span className="text-xs text-[var(--text-muted)] ml-auto">{new Date(a.createdAt).toLocaleDateString()}</span>
              <button className="px-2.5 py-1 border border-[var(--border)] rounded-[var(--radius-sm)] bg-[rgba(0,0,0,0.2)] text-[var(--text-muted)] text-xs cursor-pointer transition-all duration-fast hover:border-[var(--border-glow)] hover:text-[var(--text)]" onClick={() => handleToggleActive(a._id, a.active)}>
                {a.active ? 'Active' : 'Inactive'}
              </button>
              <button className="px-2 py-1 border border-[rgba(239,68,68,0.15)] rounded-[var(--radius-sm)] bg-[rgba(0,0,0,0.2)] text-[var(--red)] text-xs cursor-pointer transition-all duration-fast hover:bg-[var(--red-bg)]" onClick={() => handleDelete(a._id)}>🗑</button>
            </div>
            <div className="p-4">
              <h4 className="font-display text-sm font-bold mb-1">{a.title}</h4>
              <p className="text-sm text-[var(--text-secondary)] leading-relaxed">{a.body}</p>
            </div>
            <div className="flex items-center gap-4 px-4 py-2 border-t border-[var(--border)] text-xs text-[var(--text-dim)]">
              <span>By {a.createdBy?.discordName || 'Unknown'}</span>
              {a.expiresAt && <span>Expires {new Date(a.expiresAt).toLocaleDateString()}</span>}
            </div>
          </div>
        ))}
      </div>
      {showCreate && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[1000] backdrop-blur-sm animate-fade-in" onClick={() => setShowCreate(false)}>
          <div className="w-[90%] max-w-md bg-[var(--bg-glass-strong)] backdrop-blur-2xl border border-[var(--border-glow)] rounded-[var(--radius-2xl)] shadow-[var(--shadow-xl)] animate-scale-in" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border)]">
              <h3 className="font-display text-lg font-bold">New Announcement</h3>
              <button onClick={() => setShowCreate(false)} className="text-[var(--text-muted)] text-xl cursor-pointer bg-transparent border-none">✕</button>
            </div>
            <div className="p-6 flex flex-col gap-4">
              <div className="flex flex-col gap-1.5"><label className="text-xs text-[var(--text-muted)] uppercase tracking-wider font-semibold">Title *</label><input type="text" value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} placeholder="Announcement title..." className="p-3 bg-[rgba(0,0,0,0.3)] border border-[var(--border)] rounded-[var(--radius-md)] text-[var(--text)] text-sm outline-none transition-colors duration-fast focus:border-[var(--border-glow-strong)]" /></div>
              <div className="flex flex-col gap-1.5"><label className="text-xs text-[var(--text-muted)] uppercase tracking-wider font-semibold">Body *</label><textarea value={form.body} onChange={e => setForm(p => ({ ...p, body: e.target.value }))} placeholder="Write your announcement..." rows={5} className="p-3 bg-[rgba(0,0,0,0.3)] border border-[var(--border)] rounded-[var(--radius-md)] text-[var(--text)] text-sm outline-none transition-colors duration-fast focus:border-[var(--border-glow-strong)]" /></div>
              <div className="grid grid-cols-3 gap-3">
                <div className="flex flex-col gap-1.5"><label className="text-xs text-[var(--text-muted)] uppercase tracking-wider font-semibold">Type</label><select value={form.type} onChange={e => setForm(p => ({ ...p, type: e.target.value }))} className="p-3 bg-[rgba(0,0,0,0.3)] border border-[var(--border)] rounded-[var(--radius-md)] text-[var(--text)] text-sm outline-none transition-colors duration-fast focus:border-[var(--border-glow-strong)]">
                  <option value="info">Info</option><option value="warning">Warning</option><option value="update">Update</option><option value="maintenance">Maintenance</option><option value="event">Event</option>
                </select></div>
                <div className="flex flex-col gap-1.5"><label className="text-xs text-[var(--text-muted)] uppercase tracking-wider font-semibold">Priority</label><select value={form.priority} onChange={e => setForm(p => ({ ...p, priority: e.target.value }))} className="p-3 bg-[rgba(0,0,0,0.3)] border border-[var(--border)] rounded-[var(--radius-md)] text-[var(--text)] text-sm outline-none transition-colors duration-fast focus:border-[var(--border-glow-strong)]">
                  <option value="low">Low</option><option value="normal">Normal</option><option value="high">High</option><option value="urgent">Urgent</option>
                </select></div>
                <div className="flex flex-col gap-1.5"><label className="text-xs text-[var(--text-muted)] uppercase tracking-wider font-semibold">Expires At</label><input type="datetime-local" value={form.expiresAt} onChange={e => setForm(p => ({ ...p, expiresAt: e.target.value }))} className="p-3 bg-[rgba(0,0,0,0.3)] border border-[var(--border)] rounded-[var(--radius-md)] text-[var(--text)] text-sm outline-none transition-colors duration-fast focus:border-[var(--border-glow-strong)]" /></div>
              </div>
            </div>
            <div className="flex justify-end gap-3 p-4 border-t border-[var(--border)]">
              <button className="px-4 py-2 rounded-[var(--radius-md)] bg-[rgba(255,255,255,0.05)] border border-[var(--border)] text-sm text-[var(--text)] cursor-pointer transition-all duration-fast hover:border-[var(--border-glow)]" onClick={() => setShowCreate(false)}>Cancel</button>
              <button className="px-6 py-2 rounded-[var(--radius-md)] bg-gradient-to-r from-[var(--cyan)] to-[var(--electric-blue)] text-black text-sm font-bold cursor-pointer shadow-[0_0_20px_rgba(46,242,255,0.2)] transition-all duration-base hover:shadow-[0_0_40px_rgba(46,242,255,0.4)]" onClick={handleCreate}>Publish</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminDashboard;

