import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { getTournamentById, getTournamentLeaderboard, getGlobalLeaderboard, buildDiscordAvatar, DISCORD_AVATAR_FALLBACK } from '../utils/api';
import './Leaderboard.css';

const Leaderboard = () => {
  const { id } = useParams();
  const [leaderboard, setLeaderboard] = useState([]);
  const [tournament, setTournament] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [tab, setTab] = useState('points');

  useEffect(() => {
    const fetchLeaderboard = async () => {
      try {
        if (id) {
          const [tourneyData, lbData] = await Promise.all([
            getTournamentById(id).catch(() => null),
            getTournamentLeaderboard(id).catch(() => []),
          ]);
          setTournament(tourneyData);
          const sorted = Array.isArray(lbData) ? [...lbData].sort((a, b) => b.points - a.points) : [];
          setLeaderboard(sorted);
        } else {
          const globalData = await getGlobalLeaderboard();
          const sorted = Array.isArray(globalData) ? [...globalData].sort((a, b) => b.points - a.points) : [];
          setLeaderboard(sorted);
          setTournament(null);
        }
      } catch (err) {
        console.error('Error fetching leaderboard:', err);
        setError('Failed to load leaderboard');
      } finally { setLoading(false); }
    };
    fetchLeaderboard();
  }, [id]);

  const getRankClass = (index) => {
    if (index === 0) return 'border-[rgba(255,215,0,0.15)] bg-[rgba(255,215,0,0.02)]';
    if (index === 1) return 'border-[rgba(192,192,192,0.1)]';
    if (index === 2) return 'border-[rgba(205,127,50,0.1)]';
    return '';
  };

  const getRankDisplay = (index) => {
    if (index === 0) return { label: '1', cls: 'text-[#FFD700]' };
    if (index === 1) return { label: '2', cls: 'text-[#C0C0C0]' };
    if (index === 2) return { label: '3', cls: 'text-[#CD7F32]' };
    return { label: `${index + 1}`, cls: '' };
  };

  if (loading) {
    return (
      <div className="page-wrapper animate-fade-in-up">
        <div className="page-header"><h1>Leaderboard</h1></div>
        {[1,2,3,4,5].map(i => <div key={i} className="skeleton" style={{ height: 56, marginBottom: 8 }} />)}
      </div>
    );
  }

  return (
    <div className="page-wrapper animate-fade-in-up">
      <div className="page-header">
        <div>
          <h1>{tournament?.title || 'Global'} Leaderboard</h1>
          <p className="subtitle">{tournament?.title ? 'Tournament rankings' : 'Top players worldwide'}</p>
        </div>
      </div>

      {error && <div className="p-3 bg-[rgba(239,68,68,0.08)] border border-[rgba(239,68,68,0.2)] rounded-[var(--radius-md)] mb-4 text-[var(--red)] text-sm">{error}</div>}

      <div className="flex gap-2 mb-6">
        <button className={`px-6 py-2.5 rounded-[var(--radius-md)] text-sm font-semibold cursor-pointer transition-all duration-base border font-display uppercase tracking-wider ${tab === 'points' ? 'bg-[rgba(46,242,255,0.06)] border-[var(--border-glow)] text-[var(--cyan)]' : 'bg-[var(--bg-card)] border-[var(--border)] text-[var(--text-muted)] hover:border-[var(--border-glow)] hover:text-[var(--text-secondary)]'}`} onClick={() => setTab('points')}>
          <i className="fas fa-trophy"></i> Rankings
        </button>
      </div>

      {leaderboard.length === 0 ? (
        <div className="empty-state">
          <span>🏆</span>
          <p>No leaderboard data available yet.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-1.5">
          {leaderboard.map((entry, index) => {
            const rank = getRankDisplay(index);
            return (
              <div key={entry.userId || index} className={`flex items-center gap-3.5 p-3.5 px-4.5 bg-[var(--bg-card)] border rounded-[var(--radius-lg)] transition-all duration-base hover:border-[var(--border-glow)] hover:bg-[var(--bg-card-hover)] ${getRankClass(index)}`}>
                <div className={`font-display text-lg font-extrabold w-10 text-center flex-shrink-0 ${rank.cls}`}>{rank.label}</div>
                <div className="w-10 h-10 rounded-full overflow-hidden border-2 border-[var(--border-glow)] flex-shrink-0">
                  <img src={buildDiscordAvatar(entry.discordId, entry.discordAvatar) || DISCORD_AVATAR_FALLBACK} alt="" className="w-full h-full object-cover" />
                </div>
                <div className="flex-1 font-semibold text-sm">{entry.discordName}</div>
                <div className="hidden sm:flex gap-4 flex-shrink-0">
                  <span className="text-xs text-[var(--text-muted)]">Wins <strong className="text-[var(--text)]">{entry.wins || 0}</strong></span>
                  <span className="text-xs text-[var(--text-muted)]">Losses <strong className="text-[var(--text)]">{entry.losses || 0}</strong></span>
                </div>
                <div className="font-display text-base font-bold text-[var(--cyan)] min-w-[60px] text-right flex-shrink-0">{entry.points || 0}</div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default Leaderboard;
