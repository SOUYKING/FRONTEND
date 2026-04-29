import React, { useEffect, useMemo, useState } from 'react';
import { createTeam, deleteTeam, getMyTeamInvites, getMyTeams, respondToTeamInvite, searchUsersForTeam } from '../utils/api';
import './Teams.css';

const Teams = () => {
  const [teams, setTeams] = useState([]);
  const [invites, setInvites] = useState([]);
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

  const user = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem('user') || '{}');
    } catch {
      return {};
    }
  }, []);
  const role = (user?.role || '').toLowerCase();
  const hasAccess = user?.isAdmin || ['admin', 'owner', 'staff', 'content_creator'].includes(role);

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

  useEffect(() => {
    fetchData();
  }, []);

  const handleCreateTeam = async () => {
    try {
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
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to create team');
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
      await respondToTeamInvite(inviteId, action);
      setInvites((prev) => prev.filter((i) => i._id !== inviteId));
      setMessage(`Invite ${action}ed`);
      fetchData();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to update invite');
    }
  };

  const handleDeleteTeam = async (teamId) => {
    try {
      await deleteTeam(teamId);
      setTeams((prev) => prev.filter((t) => t._id !== teamId));
      if (selectedTeamId === teamId) setSelectedTeamId('');
      setMessage('Team deleted');
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to delete team');
    }
  };

  useEffect(() => {
    handleSearch();
  }, [searchQuery]);

  useEffect(() => {
    setSelectedMembers((prev) => prev.slice(0, Math.max(0, teamSize - 1)));
  }, [teamSize]);

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
      <div className="page-header">
        <div>
          <h1>Teams (Admin Beta)</h1>
          <p className="subtitle">Create 2v2/3v3/4v4 teams and manage invites</p>
        </div>
      </div>

      {error && <div className="tournament-alert error"><span>{error}</span></div>}
      {message && <div className="tournament-alert success"><span>{message}</span></div>}

      <div className="teams-tabs">
        <button className={activeTab === 'my-teams' ? 'active' : ''} onClick={() => setActiveTab('my-teams')}>My Teams ({teams.length})</button>
        <button className={activeTab === 'invites' ? 'active' : ''} onClick={() => setActiveTab('invites')}>Invites ({invites.length})</button>
      </div>

      <div className="teams-grid">
        <div className="teams-card">
          <h3>Create Team</h3>
          <div className="form-row">
            <input placeholder="Team name" value={teamName} onChange={(e) => setTeamName(e.target.value)} />
            <select value={teamSize} onChange={(e) => setTeamSize(Number(e.target.value))}>
              <option value={2}>2v2</option>
              <option value={3}>3v3</option>
              <option value={4}>4v4</option>
            </select>
          </div>
          <div className="teams-members-box">
            <div className="teams-members-head">
              <strong>Team Members</strong>
              <span>{1 + selectedMembers.length}/{teamSize}</span>
            </div>
            <div className="team-member-row owner">
              <span>{user?.discordName || 'You'}</span>
              <small>You</small>
            </div>
            {selectedMembers.map((m) => (
              <div key={m.discordId} className="team-member-row">
                <span>{m.discordName}</span>
                <button className="btn btn-ghost btn-sm" onClick={() => handleRemoveSelectedMember(m.discordId)}>Remove</button>
              </div>
            ))}
          </div>
          <button
            className="btn btn-primary"
            onClick={handleCreateTeam}
            disabled={!teamName.trim() || selectedMembers.length > teamSize - 1}
          >
            Create Team
          </button>
        </div>

        <div className="teams-card">
          <h3>Find Friend by Discord Name</h3>
          <div className="form-row">
            <input placeholder="Search Discord name..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
            <button className="btn btn-ghost" onClick={handleSearch}>Search</button>
          </div>
          <div className="teams-list">
            {searchResults.map((u) => (
              <div key={u.discordId} className="team-row">
                <span>{u.discordName}</span>
                <button className="btn btn-sm btn-primary" onClick={() => handleAddSelectedMember(u)}>+</button>
              </div>
            ))}
          </div>
        </div>

        {activeTab === 'my-teams' && (
          <div className="teams-card teams-card-wide">
            <h3>My Teams</h3>
            <div className="teams-list">
              {teams.map((team) => (
                <div key={team._id} className={`team-row team-row-wide ${selectedTeamId === team._id ? 'selected' : ''}`}>
                  <button className="team-pill" onClick={() => setSelectedTeamId(team._id)}>
                    {team.name} ({team.size}v{team.size}) · {team.members?.filter((m) => m.status === 'accepted').length || 0}/{team.size}
                  </button>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button className="btn btn-sm btn-primary" onClick={() => setSelectedTeamId(team._id)}>Select</button>
                    <button className="btn btn-sm btn-ghost" onClick={() => handleDeleteTeam(team._id)}>Delete</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'invites' && (
          <div className="teams-card teams-card-wide">
            <h3>Incoming Invites</h3>
            <div className="teams-list">
              {invites.length === 0 && <p style={{ color: 'var(--text-muted)' }}>No pending invites</p>}
              {invites.map((invite) => (
                <div key={invite._id} className="team-row">
                  <span>{invite.fromDiscordName} -> {invite.teamId?.name || 'Team'}</span>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button className="btn btn-sm btn-success" onClick={() => handleInviteResponse(invite._id, 'accept')}>Accept</button>
                    <button className="btn btn-sm btn-ghost" onClick={() => handleInviteResponse(invite._id, 'decline')}>Decline</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Teams;
