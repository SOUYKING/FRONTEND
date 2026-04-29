import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { getCurrentMatch, getMyRegisteredTournaments, leaveTournament, DISCORD_AVATAR_FALLBACK, resolveDisplayAvatar } from '../utils/api';
import { getRankLabel } from '../utils/ranks';
import './CurrentGame.css';

const isTeamFormat = (t) => t && ['2v2', '3v3', '4v4'].includes(t.type);

function sortRegisteredTournaments(list, activeTournamentId) {
  return [...list].sort((a, b) => {
    const aActive = activeTournamentId && String(a._id) === String(activeTournamentId);
    const bActive = activeTournamentId && String(b._id) === String(activeTournamentId);
    if (aActive !== bActive) return aActive ? -1 : 1;
    if (!!a.queueOpen !== !!b.queueOpen) return a.queueOpen ? -1 : 1;
    return new Date(a.startDate) - new Date(b.startDate);
  });
}

const CurrentGame = () => {
  const navigate = useNavigate();
  const [currentMatch, setCurrentMatch] = useState(null);
  const [registeredTournaments, setRegisteredTournaments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [refreshTick, setRefreshTick] = useState(0);

  useEffect(() => {
    const fetchCurrentState = async () => {
      try {
        setError('');
        const [matchData, registered] = await Promise.all([
          getCurrentMatch(),
          getMyRegisteredTournaments(),
        ]);
        setCurrentMatch(matchData);
        const upcomingOrActive = (registered || []).filter(
          (t) => t.lifecycleStage !== 'completed' && t.lifecycleStage !== 'cancelled',
        );
        const activeTournamentId =
          matchData?.inMatch && matchData?.tournamentId ? matchData.tournamentId : null;
        setRegisteredTournaments(sortRegisteredTournaments(upcomingOrActive, activeTournamentId));
      } catch (err) {
        console.error('Error fetching current match:', err);
        setError('Failed to load current game info');
      } finally {
        setLoading(false);
      }
    };
    fetchCurrentState();
    const intervalId = setInterval(fetchCurrentState, 15000);
    return () => clearInterval(intervalId);
  }, [refreshTick]);

  const matchTournament = useMemo(() => {
    if (!currentMatch?.inMatch || !currentMatch?.tournamentId) return null;
    const tid = String(currentMatch.tournamentId);
    return registeredTournaments.find((t) => String(t._id) === tid) || null;
  }, [currentMatch, registeredTournaments]);

  const isTeamMatch = Boolean(
    currentMatch?.inMatch &&
      currentMatch?.opponentId &&
      String(currentMatch.opponentId).startsWith('team:'),
  );

  const handleLeaveTournament = async (tournamentId) => {
    if (!tournamentId) return;
    try {
      const res = await leaveTournament(tournamentId);
      setMessage(res.message || 'You left the tournament.');
      setRegisteredTournaments((prev) => prev.filter((t) => String(t._id) !== String(tournamentId)));
    } catch (err) {
      setMessage(err.response?.data?.message || 'Failed to leave tournament.');
    }
  };

  const canLeaveTournament = useCallback((t) => Boolean(t && !t.queueOpen), []);

  const selfImg = currentMatch?.inMatch
    ? resolveDisplayAvatar(currentMatch.selfId, currentMatch.selfAvatar) || DISCORD_AVATAR_FALLBACK
    : null;
  const oppImg = currentMatch?.inMatch
    ? resolveDisplayAvatar(currentMatch.opponentId, currentMatch.opponentAvatar) || DISCORD_AVATAR_FALLBACK
    : null;

  const openMatchState = currentMatch?.inMatch
    ? {
        matchId: currentMatch.matchId,
        self: {
          id: currentMatch.selfId,
          username: currentMatch.selfName,
          epicName: currentMatch.selfEpicName || currentMatch.selfName,
          avatar: currentMatch.selfAvatar,
          avatarUrl: resolveDisplayAvatar(currentMatch.selfId, currentMatch.selfAvatar) || undefined,
        },
        opponent: {
          id: currentMatch.opponentId,
          username: currentMatch.opponent,
          epicName: currentMatch.opponentEpicName || currentMatch.opponent,
          avatar: currentMatch.opponentAvatar,
          avatarUrl: resolveDisplayAvatar(currentMatch.opponentId, currentMatch.opponentAvatar) || undefined,
        },
        mapCode: currentMatch.mapCode || '',
      }
    : null;

  if (loading) {
    return (
      <div className="current-game-page page-wrapper">
        <div className="current-game-card">
          <div className="skeleton" style={{ width: 100, height: 100, borderRadius: '50%', margin: '0 auto 20px' }} />
          <div className="skeleton" style={{ width: 200, height: 24, margin: '0 auto 12px' }} />
          <div className="skeleton" style={{ width: 160, height: 16, margin: '0 auto' }} />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="current-game-page page-wrapper">
        <div className="current-game-card">
          <p style={{ color: 'var(--red)', marginBottom: 16 }}>{error}</p>
          <button type="button" onClick={() => navigate('/tournaments')} className="btn btn-ghost">Back to Tournaments</button>
        </div>
      </div>
    );
  }

  if (!currentMatch || !currentMatch.inMatch) {
    return (
      <div className="current-game-page page-wrapper">
        {registeredTournaments.length > 0 ? (
          <div className="no-game-card current-multi-card">
            <div className="no-game-icon">🏁</div>
            <h2>Your tournaments</h2>
            <p className="current-card-subtext">
              You can stay registered for multiple events. When a tournament is live, open its queue. Squad modes need a full team under Profile → Teams.
            </p>
            <ul className="current-tournament-list">
              {registeredTournaments.map((t) => (
                <li key={t._id} className="current-tournament-row">
                  <div className="current-tournament-row-top">
                    <div className="current-tournament-row-head">
                      <span className="current-tournament-title">{t.title || 'Tournament'}</span>
                      <span className="current-tournament-type-pill">{t.type || '1v1'}</span>
                    </div>
                    {isTeamFormat(t) && (
                      <Link to="/teams" className="current-tournament-team-link">
                        <i className="fas fa-users" /> Teams
                      </Link>
                    )}
                  </div>
                  <div className="current-tournament-row-details">
                    <span><i className="fas fa-calendar" /> {t.startDate ? new Date(t.startDate).toLocaleString() : 'TBA'}</span>
                    <span><i className="fas fa-clock" /> {t.queueOpen ? 'Queue open' : 'Waiting for start'}</span>
                    <span><i className="fas fa-layer-group" /> {(t.lifecycleStage || '—').toUpperCase()}</span>
                  </div>
                  <div className="current-tournament-row-actions">
                    <button
                      type="button"
                      className="btn btn-primary btn-sm"
                      disabled={!t.queueOpen}
                      onClick={() => navigate(`/queue/${t._id}`)}
                    >
                      {t.queueOpen ? 'Join queue' : 'Queue opens with event'}
                    </button>
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      disabled={!canLeaveTournament(t)}
                      title={canLeaveTournament(t) ? '' : 'You can only leave before the event starts'}
                      onClick={() => handleLeaveTournament(t._id)}
                    >
                      Leave
                    </button>
                  </div>
                </li>
              ))}
            </ul>
            <div className="current-game-actions current-game-actions-footer">
              <button type="button" onClick={() => navigate('/tournaments')} className="btn btn-ghost">
                Browse all tournaments
              </button>
              <button type="button" onClick={() => setRefreshTick((n) => n + 1)} className="btn btn-ghost">
                Refresh
              </button>
            </div>
            {message && <p className="current-game-inline-msg">{message}</p>}
          </div>
        ) : (
          <div className="no-game-card">
            <div className="no-game-icon">🎮</div>
            <h2>No active tournament</h2>
            <p>You are not in a match and have no open registrations. Join a live or upcoming event to get started.</p>
            <div className="current-game-actions">
              <button type="button" onClick={() => navigate('/tournaments')} className="btn btn-primary">
                Browse tournaments
              </button>
              <button type="button" onClick={() => setRefreshTick((n) => n + 1)} className="btn btn-ghost">
                Refresh
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="current-game-page page-wrapper">
      <div className="current-game-card">
        <h2 className="current-game-title">Live match</h2>
        <p className="current-game-subtitle">
          Rejoin the room to chat and submit results on time.
          {matchTournament && (
            <span className="current-game-tournament-pill">
              {' '}
              · {matchTournament.title}
              {matchTournament.type ? ` (${matchTournament.type})` : ''}
            </span>
          )}
        </p>
        {isTeamMatch && (
          <p className="current-game-mode-hint">
            <i className="fas fa-users" /> Squad match — only captains submit the final score.
          </p>
        )}

        <div className="current-vs-area">
          <div className="current-player-card">
            <div className="current-player-avatar">
              <img src={selfImg} alt="" />
            </div>
            <div className="current-player-name">{currentMatch.selfName || 'You'}</div>
            <div className="current-player-rank">{getRankLabel(currentMatch.selfSkillRating || 0)} · {currentMatch.selfSkillRating || 0} RP</div>
            <div className="current-player-tag">{isTeamMatch ? 'YOUR SQUAD' : 'YOU'}</div>
          </div>

          <div className="current-vs-divider">
            <div className="current-vs-line" />
            <div className="current-vs-text">VS</div>
            <div className="current-vs-line" />
          </div>

          <div className="current-player-card">
            <div className="current-player-avatar" style={{ borderColor: 'var(--border-purple)', boxShadow: '0 0 15px var(--purple-glow)' }}>
              <img src={oppImg} alt="" />
            </div>
            <div className="current-player-name">{currentMatch.opponent}</div>
            <div className="current-player-rank">{getRankLabel(currentMatch.opponentSkillRating || 0)} · {currentMatch.opponentSkillRating || 0} RP</div>
            <div className="current-player-tag">{isTeamMatch ? 'OPPONENT SQUAD' : 'OPPONENT'}</div>
          </div>
        </div>

        <div className="current-match-info">
          {currentMatch.mapCode && (
            <span className="current-info-tag"><i className="fas fa-map-pin" /> {currentMatch.mapCode}</span>
          )}
          <span className="current-info-tag"><i className="fas fa-circle" style={{ color: 'var(--green)' }} /> Live</span>
        </div>

        <button
          type="button"
          onClick={() => navigate(`/match/${currentMatch.matchId}`, { state: openMatchState })}
          className="btn btn-primary btn-lg"
          style={{ width: '100%' }}
        >
          <i className="fas fa-arrow-right" /> Open match room
        </button>

        {registeredTournaments.length > 1 && (
          <p className="current-game-other-events">
            You have other open registrations — they show on <Link to="/current-game">Current game</Link> again after this match ends.
          </p>
        )}
      </div>
    </div>
  );
};

export default CurrentGame;
