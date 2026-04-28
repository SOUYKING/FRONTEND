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
import AnimatedBackground from './components/GamingIcons';

import { getTokenFromUrl, getOAuthErrorFromUrl, setAuthToken, fetchUserData, verifyToken, getCurrentMatch, SOCKET_BASE_URL } from './utils/api';
import './App.css';

const socket = io(SOCKET_BASE_URL, { autoConnect: true, reconnection: true });

const AuthenticatedApp = ({ user, setUser, setIsAuthenticated, isAdmin, setIsAdmin, currentMatchId, setCurrentMatchId }) => {
  const navigate = useNavigate();

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
      const currentPath = window.location.pathname;
      if (!currentPath.startsWith('/match/')) {
        navigate(`/match/${data.matchId}`, {
          state: {
            matchId: data.matchId,
            self: { id: data.selfId, username: data.selfEpicName || data.selfId, epicName: data.selfEpicName, avatar: data.selfAvatar, rankingPoints: 0 },
            opponent: { id: data.opponentId, username: data.opponent, epicName: data.opponentEpicName || data.opponent, avatar: data.opponentAvatar },
            mapCode: data.mapCode || '',
            tournamentId: data.tournamentId,
          },
          replace: true,
        });
      }
    };

    const onLeftMatch = () => {
      console.log('Left match');
      localStorage.removeItem('currentMatchId');
      setCurrentMatchId(null);
    };

    const onWaiting = (data) => {
      console.log('Waiting for opponent:', data.message);
    };

    const onSocketError = (error) => {
      console.error('Socket error:', error);
    };

    const onAlreadyInGame = (data) => {
      console.error('Already in game:', data.message);
    };

    const onAlreadyInQueue = (data) => {
      console.error('Already in queue:', data.message);
    };

    const onUserBanned = (data) => {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      navigate('/?error=banned&reason=' + encodeURIComponent(data.reason || 'Your account is banned.'), { replace: true });
    };

    socket.on('matchFound', onMatchFound);
    socket.on('leftMatch', onLeftMatch);
    socket.on('waiting', onWaiting);
    socket.on('error', onSocketError);
    socket.on('alreadyInGame', onAlreadyInGame);
    socket.on('alreadyInQueue', onAlreadyInQueue);
    socket.on('user:banned', onUserBanned);

    return () => {
      socket.off('matchFound', onMatchFound);
      socket.off('leftMatch', onLeftMatch);
      socket.off('waiting', onWaiting);
      socket.off('error', onSocketError);
      socket.off('alreadyInGame', onAlreadyInGame);
      socket.off('alreadyInQueue', onAlreadyInQueue);
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
    <div className="flex min-h-screen">
      <Sidebar onLogout={handleLogout} />
      <div className="flex-1 p-[clamp(20px,2.5vw,36px)] min-h-screen overflow-y-auto relative z-10 ml-[260px] transition-all duration-[250ms] max-md:ml-0 max-md:p-4 max-md:pt-20">
        <Routes>
          <Route path="/dashboard" element={<Dashboard user={user} />} />
          <Route path="/tournaments" element={<Tournaments user={user} />} />
          <Route path="/account" element={<Account user={user} />} />
          <Route path="/admin-dashboard" element={<AdminDashboard user={user} />} />
          <Route path="/leaderboard" element={<Leaderboard />} />
          <Route path="/tournament/:id/leaderboard" element={<Leaderboard />} />
          <Route path="/queue/:tournamentId" element={<QueuePage socket={socket} user={user} currentMatchId={currentMatchId} />} />
          <Route path="/match/:matchId" element={<MatchPage socket={socket} user={user} />} />
          <Route path="/current-game" element={<CurrentGame user={user} currentMatchId={currentMatchId} />} />
          <Route path="/match-history" element={<MatchHistoryPage user={user} />} />
          <Route path="/notifications" element={<NotificationPage user={user} />} />
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

      if (isAuthenticated && !window.location.pathname.startsWith('/match/')) {
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

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-[#05081c] text-white">
        <div className="w-[50px] h-[50px] border-[3px] border-solid border-[rgba(46,242,255,0.08)] border-t-[#2EF2FF] rounded-full animate-spin mb-5" />
        <p className="font-display text-[0.85rem] text-white/50 uppercase tracking-[0.15em]">Loading Arena...</p>
      </div>
    );
  }

  return (
    <Router>
      <AnimatedBackground />
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
        <div className="flex min-h-screen relative z-10">
          <div className="flex-1 p-[clamp(20px,2.5vw,36px)] min-h-screen overflow-y-auto relative z-10">
            <Login errorMessage={authError} errorType={authErrorType} />
          </div>
        </div>
      )}
    </Router>
  );
};

export default App;
