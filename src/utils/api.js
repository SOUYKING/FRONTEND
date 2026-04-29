import axios from "axios";

export const DISCORD_AVATAR_FALLBACK = 'https://cdn.discordapp.com/embed/avatars/0.png';

export function buildDiscordAvatar(discordId, hash, size = 256) {
  if (!discordId || !hash) return null;
  if (hash.startsWith('http://') || hash.startsWith('https://')) return hash;
  const ext = hash.startsWith('a_') ? 'gif' : 'png';
  return `https://cdn.discordapp.com/avatars/${discordId}/${hash}.${ext}?size=${size}`;
}

const isProduction = typeof window !== 'undefined' && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1';
const PRODUCTION_API_URL = "https://backend-97zg.onrender.com";
const LOCAL_API_URL = "http://localhost:5000";
const rawApiBaseUrl = isProduction
  ? PRODUCTION_API_URL
  : (process.env.REACT_APP_API_URL || LOCAL_API_URL);

export const API_BASE_URL = rawApiBaseUrl.replace(/\/+$/, "");
export const SOCKET_BASE_URL = (process.env.REACT_APP_SOCKET_URL || API_BASE_URL).replace(/\/+$/, "");

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15000,
  headers: {
    "Content-Type": "application/json",
  },
});

apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error.response?.status;
    const msg = error.response?.data?.message || '';

    if (status === 401) {
      localStorage.removeItem("token");
      localStorage.removeItem("user");
      window.location.href = "/";
    } else if (status === 403 && msg.toLowerCase().includes('banned')) {
      localStorage.removeItem("token");
      localStorage.removeItem("user");
      window.location.href = `/?error=banned&reason=${encodeURIComponent(msg)}`;
    }
    return Promise.reject(error);
  }
);

// ACCOUNT ROUTES
export const fetchUserData = async () => {
  try {
    const res = await apiClient.get(`/account`);
    return res.data;
  } catch (error) {
    console.error("Fetch user data error:", error.response?.data || error.message);
    throw error;
  }
};

export const updateEpicGamesName = async (epicGamesName) => {
  try {
    const res = await apiClient.post(`/account/update`, { epicGamesName });
    return res.data;
  } catch (error) {
    console.error("Update Epic Games name error:", error.response?.data || error.message);
    throw error;
  }
};

// EPIC VERIFICATION
export const verifyEpicAccount = async (epicIdOrName, epicName) => {
  const normalizedEpicName = (epicName || epicIdOrName || '').trim();
  const normalizedEpicId = (epicIdOrName || epicName || '').trim();
  try {
    const res = await apiClient.post(`/auth/verify-epic`, {
      epicId: normalizedEpicId,
      epicName: normalizedEpicName,
    });
    return res.data;
  } catch (error) {
    console.error("Epic verification error:", error.response?.data || error.message);
    throw error;
  }
};

// TOURNAMENT ROUTES
export const getTournaments = async () => {
  try {
    const res = await apiClient.get(`/tournament`);
    return res.data;
  } catch (error) {
    console.error("Get tournaments error:", error.response?.data || error.message);
    throw error;
  }
};

export const getTournamentById = async (id) => {
  try {
    const res = await apiClient.get(`/tournament/${id}`);
    return res.data;
  } catch (error) {
    console.error("Get tournament by ID error:", error.response?.data || error.message);
    throw error;
  }
};

export const getTournamentLeaderboard = async (id) => {
  try {
    const res = await apiClient.get(`/tournament/${id}/leaderboard`);
    return res.data;
  } catch (error) {
    console.error("Get tournament leaderboard error:", error.response?.data || error.message);
    throw error;
  }
};

export const createTournament = async (tournamentData) => {
  try {
    const res = await apiClient.post(`/tournament`, tournamentData);
    return res.data;
  } catch (error) {
    console.error("Create tournament error:", error.response?.data || error.message);
    throw error;
  }
};

export const updateTournament = async (id, tournamentData) => {
  try {
    const res = await apiClient.put(`/tournament/${id}`, tournamentData);
    return res.data;
  } catch (error) {
    console.error("Update tournament error:", error.response?.data || error.message);
    throw error;
  }
};

export const deleteTournament = async (id) => {
  try {
    const res = await apiClient.delete(`/tournament/${id}`);
    return res.data;
  } catch (error) {
    console.error("Delete tournament error:", error.response?.data || error.message);
    throw error;
  }
};

export const activateTournament = async (id) => {
  try {
    const res = await apiClient.post(`/tournament/${id}/activate`);
    return res.data;
  } catch (error) {
    console.error("Activate tournament error:", error.response?.data || error.message);
    throw error;
  }
};

export const joinTournament = async (tournamentId) => {
  try {
    const res = await apiClient.post(`/tournament/${tournamentId}/join`);
    return res.data;
  } catch (error) {
    console.error("Join tournament error:", error.response?.data || error.message);
    throw error;
  }
};

export const leaveTournament = async (tournamentId) => {
  try {
    const res = await apiClient.post(`/tournament/${tournamentId}/leave`);
    return res.data;
  } catch (error) {
    console.error("Leave tournament error:", error.response?.data || error.message);
    throw error;
  }
};

export const getMyRegisteredTournaments = async () => {
  try {
    const res = await apiClient.get(`/tournament/mine/registered`);
    return res.data;
  } catch (error) {
    console.error("Get registered tournaments error:", error.response?.data || error.message);
    throw error;
  }
};

// MATCHMAKING ROUTES
export const joinMatchmaking = async (tournamentId, epicName, teamId = null) => {
  try {
    const res = await apiClient.post(`/matchmaking/join`, { tournamentId, epicName, teamId });
    return res.data;
  } catch (error) {
    console.error("Join matchmaking error:", error.response?.data || error.message);
    throw error;
  }
};

export const getMyTeams = async (size) => {
  try {
    const res = await apiClient.get('/teams/mine', { params: size ? { size } : {} });
    return res.data;
  } catch (error) {
    console.error("Get my teams error:", error.response?.data || error.message);
    throw error;
  }
};

export const searchUsersForTeam = async (query) => {
  try {
    const res = await apiClient.get('/teams/search-users', { params: { q: query } });
    return res.data;
  } catch (error) {
    console.error("Search users for team error:", error.response?.data || error.message);
    throw error;
  }
};

export const createTeam = async ({ name, size, memberDiscordIds = [] }) => {
  try {
    const res = await apiClient.post('/teams/create', { name, size, memberDiscordIds });
    return res.data;
  } catch (error) {
    console.error("Create team error:", error.response?.data || error.message);
    throw error;
  }
};

export const deleteTeam = async (teamId) => {
  try {
    const res = await apiClient.delete(`/teams/${teamId}`);
    return res.data;
  } catch (error) {
    console.error("Delete team error:", error.response?.data || error.message);
    throw error;
  }
};

export const sendTeamInvite = async (teamId, targetDiscordId) => {
  try {
    const res = await apiClient.post(`/teams/${teamId}/invite`, { targetDiscordId });
    return res.data;
  } catch (error) {
    console.error("Send team invite error:", error.response?.data || error.message);
    throw error;
  }
};

export const getMyTeamInvites = async () => {
  try {
    const res = await apiClient.get('/teams/invites');
    return res.data;
  } catch (error) {
    console.error("Get team invites error:", error.response?.data || error.message);
    throw error;
  }
};

export const respondToTeamInvite = async (inviteId, action) => {
  try {
    const res = await apiClient.post(`/teams/invites/${inviteId}/respond`, { action });
    return res.data;
  } catch (error) {
    console.error("Respond to team invite error:", error.response?.data || error.message);
    throw error;
  }
};

export const leaveMatchmaking = async () => {
  try {
    const res = await apiClient.post(`/matchmaking/leave`);
    return res.data;
  } catch (error) {
    console.error("Leave matchmaking error:", error.response?.data || error.message);
    throw error;
  }
};

// MATCH ROUTES
export const getMatchHistory = async () => {
  try {
    const res = await apiClient.get(`/match/history`);
    return res.data;
  } catch (error) {
    console.error("Get match history error:", error.response?.data || error.message);
    throw error;
  }
};

export const getMatchChat = async (matchId) => {
  try {
    const res = await apiClient.get(`/match/${matchId}/match-chat`);
    return res.data.chatLogs || [];
  } catch (error) {
    console.error("Get match chat error:", error.response?.data || error.message);
    return [];
  }
};

export const getMatchDetail = async (matchId) => {
  try {
    const res = await apiClient.get(`/match/${matchId}/details`);
    return res.data;
  } catch (error) {
    console.error("Get match detail error:", error.response?.data || error.message);
    throw error;
  }
};

export const getCurrentMatch = async () => {
  try {
    const res = await apiClient.get(`/match/current`);
    return res.data;
  } catch (error) {
    console.error("Get current match error:", error.response?.data || error.message);
    throw error;
  }
};

export const getActiveMatchInfo = async (matchId) => {
  try {
    const res = await apiClient.get(`/match/${matchId}/active-info`);
    return res.data;
  } catch (error) {
    console.error("Get active match info error:", error.response?.data || error.message);
    throw error;
  }
};

export const submitMatchResult = async (matchId, winnerDiscordId) => {
  try {
    const res = await apiClient.post(`/match/${matchId}/result`, { winnerDiscordId });
    return res.data;
  } catch (error) {
    console.error("Submit match result error:", error.response?.data || error.message);
    throw error;
  }
};

export const resolveMatchDispute = async (matchId, winnerDiscordId) => {
  try {
    const res = await apiClient.post(`/match/${matchId}/resolve`, { winnerDiscordId });
    return res.data;
  } catch (error) {
    console.error("Resolve dispute error:", error.response?.data || error.message);
    throw error;
  }
};

// AUTH ROUTES
export const getDiscordAuthUrl = () => {
  const clientId = process.env.REACT_APP_DISCORD_CLIENT_ID || "1256251737938071643";
  const redirectUri = encodeURIComponent(`${API_BASE_URL}/auth/callback`);
  const scope = "identify guilds";
  return `https://discord.com/api/oauth2/authorize?client_id=${clientId}&redirect_uri=${redirectUri}&response_type=code&scope=${scope}`;
};

export const verifyToken = async () => {
  try {
    const res = await apiClient.get(`/auth/verify`);
    return res.data;
  } catch (error) {
    console.error("Verify token error:", error.response?.data || error.message);
    throw error;
  }
};

export const logout = () => {
  localStorage.removeItem("token");
  localStorage.removeItem("user");
  window.location.href = "/";
};

export const fetchProfileData = async () => {
  try {
    const res = await apiClient.get(`/account/profile`);
    return res.data;
  } catch (error) {
    console.error("Fetch profile error:", error.response?.data || error.message);
    throw error;
  }
};

export const getPublicPlayerProfile = async (discordId) => {
  try {
    const res = await apiClient.get(`/account/public/${discordId}`);
    return res.data;
  } catch (error) {
    console.error("Get public player profile error:", error.response?.data || error.message);
    throw error;
  }
};

export const getGlobalLeaderboard = async () => {
  try {
    const res = await apiClient.get(`/account/leaderboard/global`);
    return res.data;
  } catch (error) {
    console.error("Global leaderboard error:", error.response?.data || error.message);
    throw error;
  }
};

export const setAuthToken = (token) => {
  if (token) {
    localStorage.setItem("token", token);
    apiClient.defaults.headers.common["Authorization"] = `Bearer ${token}`;
  } else {
    localStorage.removeItem("token");
    delete apiClient.defaults.headers.common["Authorization"];
  }
};

export const getTokenFromUrl = () => {
  const params = new URLSearchParams(window.location.search);
  const token = params.get("token");
  const error = params.get("error");
  
  if (error) {
    console.error("OAuth error:", error);
    return null;
  }
  
  if (token) {
    setAuthToken(token);
    window.history.replaceState({}, document.title, window.location.pathname);
    return token;
  }
  
  return null;
};

export const getOAuthErrorFromUrl = () => {
  const params = new URLSearchParams(window.location.search);
  const error = params.get("error");
  const reason = params.get("reason");
  const retryAfter = params.get("retryAfter");

  if (!error) return null;

  const messages = {
    no_code: { message: "Login failed: missing OAuth code.", type: error },
    oauth_failed: { message: "Discord login failed. Wait a few seconds and try once (avoid multiple rapid clicks).", type: error },
    not_server_member: { message: "Discord server membership is optional. You can continue logging in.", type: error },
    banned: { message: reason ? `Login blocked: ${decodeURIComponent(reason)}` : "Login blocked: your account is banned.", type: error },
    ip_blocked: { message: reason ? decodeURIComponent(reason) : "Login blocked by IP security policy.", type: error },
    server_error: { message: "Server error, please try again.", type: error },
    rate_limited: { message: retryAfter ? `Too many login attempts. Please wait ${retryAfter} seconds before trying again.` : "Too many login attempts. Please wait and try again.", type: error },
  };

  return messages[error] || { message: `Login failed: ${error}`, type: error };
};

export const getAnnouncements = async () => {
  try {
    const res = await apiClient.get(`/announcements`);
    return res.data;
  } catch (error) {
    console.error("Get announcements error:", error.response?.data || error.message);
    throw error;
  }
};

export const getStaffNotifications = async () => {
  try {
    const res = await apiClient.get(`/staff-notifications`);
    return res.data;
  } catch (error) {
    console.error("Get staff notifications error:", error.response?.data || error.message);
    throw error;
  }
};

export const markStaffNotificationRead = async (id) => {
  try {
    const res = await apiClient.post(`/staff-notifications/${id}/read`);
    return res.data;
  } catch (error) {
    console.error("Mark notification read error:", error.response?.data || error.message);
    throw error;
  }
};

export const markAllStaffNotificationsRead = async () => {
  try {
    const res = await apiClient.post(`/staff-notifications/mark-all-read`);
    return res.data;
  } catch (error) {
    console.error("Mark all read error:", error.response?.data || error.message);
    throw error;
  }
};

export const getAdminMatches = async (params = {}) => {
  try {
    const res = await apiClient.get(`/admin/matches`, { params });
    return res.data;
  } catch (error) {
    console.error("Get admin matches error:", error.response?.data || error.message);
    throw error;
  }
};

export const overrideMatchResult = async (matchId, winner) => {
  try {
    const res = await apiClient.post(`/admin/matches/${matchId}/override`, { winner });
    return res.data;
  } catch (error) {
    console.error("Override match error:", error.response?.data || error.message);
    throw error;
  }
};

export default apiClient;