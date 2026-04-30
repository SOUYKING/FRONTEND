import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { io } from 'socket.io-client';

import Sidebar from './components/Sidebar';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Tournaments from './pages/Tournaments';
import Account from './pages/Account';
import AdminDashboard from './pages/AdminDashboard';
import Leaderboard from './pages/Leaderboard';
import QueuePage from './pages/QueuePage';
import MatchPage from './pages/MatchPage';
import CurrentGame from './pages/CurrentGame';
import MatchHistoryPage from './pages/MatchHistoryPage';
import NotificationPage from './pages/NotificationPage';
import Teams from './pages/Teams';
import AnimatedBackground from './components/GamingIcons';

import { getTokenFromUrl, getOAuthErrorFromUrl, setAuthToken, fetchUserData, verifyToken, getCurrentMatch, SOCKET_BASE_URL } from './utils/api';
import './App.css';

const socket = io(SOCKET_BASE_URL, { autoConnect: true, reconnection: true });

const AuthenticatedApp = ({ user, setUser, setIsAuthenticated, isAdmin, setIsAdmin, currentMatchId, setCurrentMatchId }) => {
  const navigate = useNavigate();

  useEffect(() => {
    const onMatchEnded = () => {
      localStorage.removeItem('currentMatchId');
      setCurrentMatchId(null);
    };
    window.addEventListener('current-match-ended', onMatchEnded);
    return () => window.removeEventListener('current-match-ended', onMatchEnded);
  }, [setCurrentMatchId]);

  useEffect(() => {
    socket.on('connect', () => {
      const storedUser = localStorage.getItem('user');
      if (storedUser) {
        try {
          const u = JSON.parse(storedUser);
          const uid = u?.discordId || u?.id;
          if (uid) socket.emit('register', { userId: uid });
        } catch {}
      }
    });

    return () => {
      socket.off('connect');
    };
  }, []);

  useEffect(() => {
    const onMatchFound = (data) => {
      console.log('Match found:', data);
      localStorage.setItem('currentMatchId', data.matchId);
      setCurrentMatchId(data.matchId);
      let storedProfile = {};
      try {
        storedProfile = JSON.parse(localStorage.getItem('user') || '{}');
      } catch {}
      const selfDisplayName =
        storedProfile.discordName || storedProfile.username || data.selfEpicName || 'You';
      const currentPath = window.location.pathname;
      if (!currentPath.startsWith('/match/')) {
        navigate(`/match/${data.matchId}`, {
          state: {
            matchId: data.matchId,
            self: {
              id: data.selfId,
              username: selfDisplayName,
              epicName: data.selfEpicName,
              avatar: data.selfAvatar,
              rankingPoints: storedProfile.rankingPoints ?? 0,
            },
            opponent: {
              id: data.opponentId,
              username: data.opponent,
              epicName: data.opponentEpicName || data.opponent,
              avatar: data.opponentAvatar,
            },
            mapCode: data.mapCode || '',
            tournamentId: data.tournamentId,
          },
          replace: true,
        });
      }
    };

    const onWaiting = (data) => {
      console.log('Waiting for opponent:', data.message);
    };

    const onSocketError = (error) => {
      console.error('Socket error:', error);
    };

    const onUserBanned = (data) => {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      navigate('/?error=banned&reason=' + encodeURIComponent(data.reason || 'Your account is banned.'), { replace: true });
    };

    socket.on('matchFound', onMatchFound);
    socket.on('waiting', onWaiting);
    socket.on('error', onSocketError);
    socket.on('user:banned', onUserBanned);

    return () => {
      socket.off('matchFound', onMatchFound);
      socket.off('waiting', onWaiting);
      socket.off('error', onSocketError);
      socket.off('user:banned', onUserBanned);
    };
  }, [navigate, setCurrentMatchId]);

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    localStorage.removeItem('currentMatchId');
    sessionStorage.clear();
    setIsAuthenticated(false);
    setIsAdmin(false);
    setUser(null);
    setCurrentMatchId(null);
    if (socket.connected) socket.disconnect();
    navigate('/', { replace: true });
  };

  return (
    <div className="app-container">
      <AnimatedBackground />
      <Sidebar onLogout={handleLogout} liveMatchId={currentMatchId} />
      <div className="main-content">
        <Routes>
          <Route path="/dashboard" element={<Dashboard user={user} />} />
          <Route path="/tournaments" element={<Tournaments user={user} socket={socket} />} />
          <Route path="/account" element={<Account user={user} />} />
          <Route path="/admin-dashboard" element={<AdminDashboard user={user} />} />
          <Route path="/leaderboard" element={<Leaderboard />} />
          <Route path="/tournament/:id/leaderboard" element={<Leaderboard />} />
          <Route path="/queue/:tournamentId" element={<QueuePage socket={socket} user={user} currentMatchId={currentMatchId} />} />
          <Route path="/match/:matchId" element={<MatchPage socket={socket} user={user} />} />
          <Route path="/current-game" element={<CurrentGame user={user} currentMatchId={currentMatchId} />} />
          <Route path="/match-history" element={<MatchHistoryPage user={user} />} />
          <Route path="/notifications" element={<NotificationPage user={user} />} />
          <Route path="/teams" element={<Teams user={user} />} />
          <Route path="/" element={<Navigate to="/dashboard" />} />
        </Routes>
      </div>
    </div>
  );
};

const App = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [currentMatchId, setCurrentMatchId] = useState(null);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState('');
  const [authErrorType, setAuthErrorType] = useState('');

  useEffect(() => {
    const initializeAuth = async () => {
      setLoading(true);
      setAuthError('');
      let authenticatedSession = false;

      const oauthError = getOAuthErrorFromUrl();
      if (oauthError) {
        setAuthError(oauthError.message);
        setAuthErrorType(oauthError.type || '');
      }

      const registerSocket = () => {
        const storedUser = localStorage.getItem('user');
        if (storedUser) {
          try {
            const u = JSON.parse(storedUser);
            const uid = u?.discordId || u?.id;
            if (uid) socket.emit('register', { userId: uid });
          } catch {}
        }
      };

      const urlToken = getTokenFromUrl();

      if (urlToken) {
        try {
          const userData = await fetchUserData();
          setUser(userData);
          setIsAuthenticated(true);
          setIsAdmin(userData.isAdmin || false);
          authenticatedSession = true;
          localStorage.setItem('user', JSON.stringify(userData));
          registerSocket();
        } catch (error) {
          const errMsg = error.response?.data?.message
            || error.authErrorMessage
            || (error.response?.status === 429 ? 'Too many login attempts. Please wait a moment before trying again.' : null)
            || 'Login failed. If the problem persists, contact an admin.';
          setAuthError(errMsg);
          setAuthToken(null);
          setIsAuthenticated(false);
        }
      } else {
        const storedToken = localStorage.getItem('token');
        const storedUser = localStorage.getItem('user');

        if (storedToken && storedUser) {
          try {
            await verifyToken();
            const userData = JSON.parse(storedUser);
            setUser(userData);
            setIsAuthenticated(true);
            setIsAdmin(userData.isAdmin || false);
            authenticatedSession = true;
            registerSocket();
          } catch (error) {
            const errMsg = error.response?.data?.message || error.message || 'Token validation failed';
            if (errMsg.toLowerCase().includes('banned')) {
              setAuthError(errMsg);
            } else {
              setAuthError('Session expired. Please log in again.');
            }
            setAuthToken(null);
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            setIsAuthenticated(false);
          }
        }
      }

      if (authenticatedSession && !window.location.pathname.startsWith('/match/')) {
        try {
          const activeCheck = await getCurrentMatch();
          if (activeCheck && activeCheck.inMatch && activeCheck.matchId) {
            localStorage.setItem('currentMatchId', activeCheck.matchId);
            setCurrentMatchId(activeCheck.matchId);
          }
        } catch (e) {}
      }

      setLoading(false);
    };

    initializeAuth();
  }, []);

  useEffect(() => {
    const syncUserFromStorage = () => {
      try {
        const storedUser = localStorage.getItem('user');
        if (!storedUser) return;
        const parsed = JSON.parse(storedUser);
        setUser(parsed);
        setIsAdmin(!!parsed?.isAdmin);
      } catch {}
    };

    window.addEventListener('storage', syncUserFromStorage);
    window.addEventListener('user-updated', syncUserFromStorage);
    return () => {
      window.removeEventListener('storage', syncUserFromStorage);
      window.removeEventListener('user-updated', syncUserFromStorage);
    };
  }, []);

  if (loading) {
    return (
      <div style={{
        display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center',
        height: '100vh', backgroundColor: '#05081c', color: 'white',
      }}>
        <div style={{
          width: 50, height: 50, border: '3px solid rgba(46,242,255,0.08)',
          borderTopColor: '#2EF2FF', borderRadius: '50%',
          animation: 'spin 0.8s linear infinite', marginBottom: 20,
        }} />
        <p style={{ fontFamily: "'Orbitron',sans-serif", fontSize: '0.85rem', color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: '0.15em' }}>Loading Arena...</p>
        <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
      </div>
    );
  }

  return (
    <Router>
      {isAuthenticated ? (
        <AuthenticatedApp
          user={user}
          setUser={setUser}
          setIsAuthenticated={setIsAuthenticated}
          isAdmin={isAdmin}
          setIsAdmin={setIsAdmin}
          currentMatchId={currentMatchId}
          setCurrentMatchId={setCurrentMatchId}
        />
      ) : (
        <div className="app-container">
          <AnimatedBackground />
          <div className="main-content" style={{ marginLeft: 0 }}>
            <Login errorMessage={authError} errorType={authErrorType} />
          </div>
        </div>
      )}
    </Router>
  );
};

export default App;