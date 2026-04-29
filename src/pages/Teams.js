import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  buildDiscordAvatar,
  createTeam,
  deleteTeam,
  DISCORD_AVATAR_FALLBACK,
  getMyTeamInvites,
  getMyTeams,
  getTeamDetail,
  leaveTeam,
  removeTeamMember,
  respondToTeamInvite,
  searchUsersForTeam,
  sendTeamInvite,
} from '../utils/api';
import './Teams.css';

const Teams = () => {
  const [teams, setTeams] = useState([]);
  const [invites, setInvites] = useState([]);
  const [teamDetail, setTeamDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [teamName, setTeamName] = useState('');
  const [teamSize, setTeamSize] = useState(2);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [selectedTeamId, setSelectedTeamId] = useState('');
  const [selectedMembers, setSelectedMembers] = useState([]);
  const [activeTab, setActiveTab] = useState('my-teams');
  const [actionBusy, setActionBusy] = useState(false);

  const user = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem('user') || '{}');
    } catch {
      return {};
    }
  }, []);
  const role = (user?.role || '').toLowerCase();
  const hasAccess = user?.isAdmin || ['admin', 'owner', 'staff', 'content_creator'].includes(role);
  const selectedTeam = useMemo(() => teams.find((team) => team._id === selectedTeamId) || null, [teams, selectedTeamId]);
  const selectedTeamIsLocked = (selectedTeam?.tournamentLocks || []).length > 0;

  const fetchData = async () => {
    try {
      setError('');
      const [myTeams, myInvites] = await Promise.all([getMyTeams(), getMyTeamInvites()]);
      setTeams(myTeams || []);
      setInvites(myInvites || []);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load teams data');
    } finally {
      setLoading(false);
    }
  };

  const loadTeamDetail = useCallback(async (teamId) => {
    if (!teamId) {
      setTeamDetail(null);
      return;
    }
    try {
      setDetailLoading(true);
      const data = await getTeamDetail(teamId);
      setTeamDetail(data);
    } catch (err) {
      setTeamDetail(null);
      setError(err.response?.data?.message || 'Failed to load team');
    } finally {
      setDetailLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    if (hasAccess && selectedTeamId) loadTeamDetail(selectedTeamId);
    else setTeamDetail(null);
  }, [hasAccess, selectedTeamId, loadTeamDetail]);

  useEffect(() => {
    if (!message) return;
    const t = setTimeout(() => setMessage(''), 4500);
    return () => clearTimeout(t);
  }, [message]);

  const handleCreateTeam = async () => {
    try {
      setActionBusy(true);
      setError('');
      const team = await createTeam({
        name: teamName.trim(),
        size: Number(teamSize),
        memberDiscordIds: selectedMembers.map((m) => m.discordId),
      });
      setTeams((prev) => [team, ...prev]);
      setSelectedTeamId(team._id);
      setTeamName('');
      setSelectedMembers([]);
      setSearchResults([]);
      setSearchQuery('');
      setMessage('Team created');
      await loadTeamDetail(team._id);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to create team');
    } finally {
      setActionBusy(false);
    }
  };

  const handleSearch = async () => {
    const query = searchQuery.trim();
    if (query.length < 2) {
      setSearchResults([]);
      return;
    }
    try {
      const users = await searchUsersForTeam(query);
      setSearchResults(users || []);
    } catch (err) {
      setError(err.response?.data?.message || 'Search failed');
    }
  };

  const handleAddSelectedMember = (userRow) => {
    if (selectedMembers.some((m) => m.discordId === userRow.discordId)) return;
    if (selectedMembers.length >= teamSize - 1) {
      setError(`You can only add ${teamSize - 1} invited players for ${teamSize}v${teamSize}`);
      return;
    }
    setSelectedMembers((prev) => [...prev, userRow]);
  };

  const handleRemoveSelectedMember = (discordId) => {
    setSelectedMembers((prev) => prev.filter((m) => m.discordId !== discordId));
  };

  const handleInviteResponse = async (inviteId, action) => {
    try {
      setActionBusy(true);
      await respondToTeamInvite(inviteId, action);
      setInvites((prev) => prev.filter((i) => i._id !== inviteId));
      setMessage(`Invite ${action}ed`);
      await fetchData();
      if (selectedTeamId) await loadTeamDetail(selectedTeamId);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to update invite');
    } finally {
      setActionBusy(false);
    }
  };

  const handleDeleteTeam = async (teamId) => {
    try {
      setActionBusy(true);
      await deleteTeam(teamId);
      setTeams((prev) => prev.filter((t) => t._id !== teamId));
      if (selectedTeamId === teamId) {
        setSelectedTeamId('');
        setTeamDetail(null);
      }
      setMessage('Team deleted');
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to delete team');
    } finally {
      setActionBusy(false);
    }
  };

  const handleSendInvite = async (targetUser) => {
    if (!selectedTeamId) {
      setError('Select a team first, then invite players.');
      return;
    }
    if (selectedTeamIsLocked) {
      setError('This team is locked in a tournament and cannot be changed.');
      return;
    }
    try {
      setActionBusy(true);
      setError('');
      await sendTeamInvite(selectedTeamId, targetUser.discordId);
      setMessage(`Invite sent to ${targetUser.discordName}`);
      await fetchData();
      await loadTeamDetail(selectedTeamId);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to send invite');
    } finally {
      setActionBusy(false);
    }
  };

  const handleLeaveTeam = async () => {
    if (!selectedTeamId || !teamDetail) return;
    if (!window.confirm('Leave this team? You can be re-invited later.')) return;
    try {
      setActionBusy(true);
      await leaveTeam(selectedTeamId);
      setMessage('You left the team');
      setSelectedTeamId('');
      setTeamDetail(null);
      await fetchData();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to leave team');
    } finally {
      setActionBusy(false);
    }
  };

  const handleRemoveMember = async (memberDiscordId) => {
    if (!selectedTeamId) return;
    if (!window.confirm('Remove this player from the team?')) return;
    try {
      setActionBusy(true);
      await removeTeamMember(selectedTeamId, memberDiscordId);
      setMessage('Member removed');
      await fetchData();
      await loadTeamDetail(selectedTeamId);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to remove member');
    } finally {
      setActionBusy(false);
    }
  };

  useEffect(() => {
    handleSearch();
  }, [searchQuery]);

  useEffect(() => {
    setSelectedMembers((prev) => prev.slice(0, Math.max(0, teamSize - 1)));
  }, [teamSize]);

  const avatarForMember = (m) => buildDiscordAvatar(m.discordId, m.discordAvatar, 128) || DISCORD_AVATAR_FALLBACK;

  const detailStats = useMemo(() => {
    if (!teamDetail?.team) return null;
    const w = teamDetail.team.statsWins ?? 0;
    const l = teamDetail.team.statsLosses ?? 0;
    const total = w + l;
    const pct = total > 0 ? Math.round((w / total) * 100) : null;
    return { w, l, total, pct };
  }, [teamDetail]);

  if (!hasAccess) {
    return (
      <div className="teams-page page-wrapper">
        <div className="empty-state"><span>🔒</span><p>Team mode is admin-only for now.</p></div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="teams-page page-wrapper">
        <div className="skeleton" style={{ height: 120 }} />
      </div>
    );
  }

  return (
    <div className="teams-page page-wrapper">
      <div className="page-header teams-page-header">
        <div>
          <h1>Teams <span className="teams-beta-pill">Admin Beta</span></h1>
          <p className="subtitle">Build a roster, invite by Discord name, queue as one unit in team tournaments.</p>
        </div>
        <button type="button" className="btn btn-ghost teams-refresh-btn" onClick={() => { fetchData(); if (selectedTeamId) loadTeamDetail(selectedTeamId); }} disabled={actionBusy}>
          Refresh
        </button>
      </div>

      <div className="teams-beta-note">
        <span>Beta:</span> Visible to staff roles only. Wins and losses update when team-mode matches complete.
      </div>

      {invites.length > 0 && (
        <div className="teams-invite-banner">
          <strong>Invitations</strong>
          <div className="teams-invite-list">
            {invites.map((invite) => (
              <div key={invite._id} className="teams-invite-row">
                <span>
                  <span className="teams-invite-from">{invite.fromDiscordName}</span>
                  {' invited you to '}
                  <span className="teams-invite-team">{invite.teamId?.name || 'Team'}</span>
                </span>
                <div className="teams-invite-actions">
                  <button type="button" className="btn btn-sm btn-success" disabled={actionBusy} onClick={() => handleInviteResponse(invite._id, 'accept')}>Accept</button>
                  <button type="button" className="btn btn-sm btn-ghost" disabled={actionBusy} onClick={() => handleInviteResponse(invite._id, 'decline')}>Decline</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {error && <div className="tournament-alert error"><span>{error}</span></div>}
      {message && <div className="tournament-alert success"><span>{message}</span></div>}

      <div className="teams-tabs">
        <button type="button" className={activeTab === 'my-teams' ? 'active' : ''} onClick={() => setActiveTab('my-teams')}>My Teams ({teams.length})</button>
        <button type="button" className={activeTab === 'invites' ? 'active' : ''} onClick={() => setActiveTab('invites')}>Invites ({invites.length})</button>
      </div>

      <div className="teams-shell">
        <aside className="teams-sidebar">
          <div className="teams-card teams-card-compact">
            <h3>New team</h3>
            <p className="teams-helper-text">You are captain. Add optional invites now or from the team hub.</p>
            <div className="teams-field-row">
              <div className="teams-field teams-field-name">
                <label className="teams-field-label" htmlFor="teams-new-name">Team name</label>
                <input
                  id="teams-new-name"
                  className="teams-input"
                  placeholder="Enter team name"
                  maxLength={40}
                  value={teamName}
                  onChange={(e) => setTeamName(e.target.value)}
                  autoComplete="off"
                />
                <span className="teams-char-hint">{teamName.length}/40</span>
              </div>
              <div className="teams-field teams-field-size">
                <label className="teams-field-label" htmlFor="teams-new-size">Team size</label>
                <div className="teams-select-shell">
                  <select
                    id="teams-new-size"
                    className="teams-select"
                    value={teamSize}
                    onChange={(e) => setTeamSize(Number(e.target.value))}
                  >
                    <option value={2}>2v2 · 2 players</option>
                    <option value={3}>3v3 · 3 players</option>
                    <option value={4}>4v4 · 4 players</option>
                  </select>
                </div>
              </div>
            </div>
            <div className="teams-members-box">
              <div className="teams-members-head">
                <strong>Draft roster</strong>
                <span>{1 + selectedMembers.length}/{teamSize}</span>
              </div>
              <div className="team-member-row owner">
                <span>{user?.discordName || user?.username || 'You'}</span>
                <small>Captain</small>
              </div>
              {selectedMembers.map((m) => (
                <div key={m.discordId} className="team-member-row">
                  <span>{m.discordName}</span>
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => handleRemoveSelectedMember(m.discordId)}>Remove</button>
                </div>
              ))}
            </div>
            <button
              type="button"
              className="btn btn-primary teams-full-width"
              onClick={handleCreateTeam}
              disabled={actionBusy || !teamName.trim() || selectedMembers.length > teamSize - 1}
            >
              {actionBusy ? 'Please wait...' : 'Create team'}
            </button>
          </div>

          <div className="teams-card teams-card-compact">
            <h3>Find players</h3>
            <p className="teams-helper-text">
              {selectedTeam
                ? `Invites go to: ${selectedTeam.name}`
                : 'Select a team in the list to send invites from search.'}
            </p>
            <label className="teams-field-label teams-field-label-spaced" htmlFor="teams-player-search">Find by Discord name</label>
            <div className="teams-search-row">
              <div className="teams-search-input-wrap">
                <i className="fas fa-magnifying-glass teams-search-icon" aria-hidden />
                <input
                  id="teams-player-search"
                  className="teams-search-input"
                  placeholder="Search players to invite…"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleSearch();
                    }
                  }}
                  autoComplete="off"
                />
              </div>
              <button type="button" className="teams-search-btn" onClick={handleSearch}>
                <i className="fas fa-search" aria-hidden />
                Search
              </button>
            </div>
            <div className="teams-list teams-list-scroll">
              {searchResults.map((u) => (
                <div key={u.discordId} className="team-row">
                  <span className="teams-search-name">{u.discordName}</span>
                  <div className="teams-search-actions">
                    <button type="button" className="btn btn-sm btn-ghost" onClick={() => handleAddSelectedMember(u)}>Draft</button>
                    <button type="button" className="btn btn-sm btn-primary" disabled={actionBusy || !selectedTeamId || selectedTeamIsLocked} onClick={() => handleSendInvite(u)}>Invite</button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {activeTab === 'my-teams' && (
            <div className="teams-card teams-card-compact">
              <h3>Your teams</h3>
              <div className="teams-list teams-list-scroll">
                {teams.length === 0 && <p className="teams-muted">No teams yet — create one above.</p>}
                {teams.map((team) => (
                  <button
                    key={team._id}
                    type="button"
                    className={`teams-list-tile ${selectedTeamId === team._id ? 'active' : ''}`}
                    onClick={() => setSelectedTeamId(team._id)}
                  >
                    <div className="teams-list-tile-top">
                      <span className="teams-list-tile-name">{team.name}</span>
                      <span className="teams-list-tile-mode">{team.size}v{team.size}</span>
                    </div>
                    <div className="teams-list-tile-meta">
                      <span>{team.members?.filter((m) => m.status === 'accepted').length || 0}/{team.size} ready</span>
                      {(team.tournamentLocks?.length || 0) > 0 && <span className="teams-chip locked">Locked</span>}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'invites' && (
            <div className="teams-card teams-card-compact">
              <h3>Pending invites</h3>
              <div className="teams-list">
                {invites.length === 0 && <p className="teams-muted">No pending invites.</p>}
                {invites.map((invite) => (
                  <div key={invite._id} className="team-row team-row-stack">
                    <span>{invite.fromDiscordName} → {invite.teamId?.name || 'Team'}</span>
                    <div className="teams-search-actions">
                      <button type="button" className="btn btn-sm btn-success" disabled={actionBusy} onClick={() => handleInviteResponse(invite._id, 'accept')}>Accept</button>
                      <button type="button" className="btn btn-sm btn-ghost" disabled={actionBusy} onClick={() => handleInviteResponse(invite._id, 'decline')}>Decline</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </aside>

        <section className="teams-hub">
          {!selectedTeamId && (
            <div className="teams-hub-empty">
              <h2>Team hub</h2>
              <p>Select a team on the left to see roster, Discord avatars, record, and invite tools.</p>
            </div>
          )}

          {selectedTeamId && detailLoading && (
            <div className="teams-hub-loading skeleton" style={{ minHeight: 280 }} />
          )}

          {selectedTeamId && !detailLoading && teamDetail && (
            <>
              <div className="teams-hub-header">
                <div>
                  <h2 className="teams-hub-title">{teamDetail.team.name}</h2>
                  <p className="teams-hub-sub">
                    {teamDetail.team.size}v{teamDetail.team.size}
                    {teamDetail.viewer?.isCaptain ? ' · You are captain' : ''}
                  </p>
                </div>
                <div className="teams-hub-header-actions">
                  {teamDetail.viewer?.isCaptain && (
                    <button
                      type="button"
                      className="btn btn-sm btn-ghost teams-danger-outline"
                      disabled={actionBusy || (teamDetail.team.tournamentLocks?.length || 0) > 0}
                      onClick={() => handleDeleteTeam(selectedTeamId)}
                    >
                      Delete team
                    </button>
                  )}
                  {!teamDetail.viewer?.isCaptain && (
                    <button
                      type="button"
                      className="btn btn-sm btn-ghost teams-danger-outline"
                      disabled={actionBusy || (teamDetail.team.tournamentLocks?.length || 0) > 0}
                      onClick={handleLeaveTeam}
                    >
                      Leave team
                    </button>
                  )}
                </div>
              </div>

              {!teamDetail.meta.readyForQueue && (
                <div className="teams-readiness teams-readiness-warn">
                  Everyone must accept before this team can queue together in a team tournament.
                  {' '}
                  <strong>{teamDetail.meta.acceptedCount}/{teamDetail.team.size}</strong> confirmed.
                </div>
              )}

              {teamDetail.meta.readyForQueue && (
                <div className="teams-readiness teams-readiness-ok">
                  Roster complete — captain can queue this team in matching 2v2/3v3/4v4 events.
                </div>
              )}

              {detailStats && (
                <div className="teams-stat-strip">
                  <div className="teams-stat-cell">
                    <span className="teams-stat-label">Wins</span>
                    <span className="teams-stat-value teams-stat-win">{detailStats.w}</span>
                  </div>
                  <div className="teams-stat-cell">
                    <span className="teams-stat-label">Losses</span>
                    <span className="teams-stat-value teams-stat-loss">{detailStats.l}</span>
                  </div>
                  <div className="teams-stat-cell">
                    <span className="teams-stat-label">Matches</span>
                    <span className="teams-stat-value">{detailStats.total}</span>
                  </div>
                  <div className="teams-stat-cell">
                    <span className="teams-stat-label">Win rate</span>
                    <span className="teams-stat-value">{detailStats.pct != null ? `${detailStats.pct}%` : '—'}</span>
                  </div>
                  <div className="teams-stat-cell">
                    <span className="teams-stat-label">Size</span>
                    <span className="teams-stat-value">{teamDetail.team.size}</span>
                  </div>
                </div>
              )}

              <div className="teams-roster-head">
                <h3>Roster</h3>
                <span className="teams-muted">{teamDetail.roster.length} player{teamDetail.roster.length !== 1 ? 's' : ''}</span>
              </div>
              <div className="teams-roster-grid">
                {teamDetail.roster.map((m) => (
                  <div key={m.discordId} className={`teams-player-card ${m.status === 'pending' ? 'pending' : ''}`}>
                    <div className="teams-player-avatar-wrap">
                      <img src={avatarForMember(m)} alt="" className="teams-player-avatar" />
                      {m.isCaptain && <span className="teams-captain-badge" title="Captain">C</span>}
                    </div>
                    <div className="teams-player-name">{m.discordName}</div>
                    <div className="teams-player-meta">
                      {m.status === 'pending' ? <span className="teams-chip pending">Pending</span> : <span className="teams-chip ok">Ready</span>}
                    </div>
                    {teamDetail.viewer?.isCaptain && !m.isCaptain && (teamDetail.team.tournamentLocks?.length || 0) === 0 && (
                      <button type="button" className="btn btn-sm btn-ghost teams-remove-member" disabled={actionBusy} onClick={() => handleRemoveMember(m.discordId)}>
                        Remove
                      </button>
                    )}
                  </div>
                ))}
              </div>

              <div className="teams-hub-footnote">
                Stats count completed team-mode matches only. Avatars come from linked Discord accounts.
                After you queue for a team tournament, the roster stays locked until that tournament is completed, cancelled, or deleted by staff.
              </div>
            </>
          )}

          {selectedTeamId && !detailLoading && !teamDetail && (
            <div className="teams-hub-empty">
              <p>Could not load this team.</p>
            </div>
          )}
        </section>
      </div>
    </div>
  );
};

export default Teams;
