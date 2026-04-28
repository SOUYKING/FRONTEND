import React, { useState, useEffect } from 'react';
import { getMatchHistory, getMatchDetail, buildDiscordAvatar, DISCORD_AVATAR_FALLBACK } from '../utils/api';

const MatchHistoryPage = () => {
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('all');
  const [page, setPage] = useState(1);
  const perPage = 10;
  const [selectedMatch, setSelectedMatch] = useState(null);
  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);

  useEffect(() => {
    const fetchHistory = async () => {
      try {
        const data = await getMatchHistory();
        setMatches(data);
      } catch (err) {
        console.error('Error fetching match history:', err);
        setError('Failed to load match history');
      } finally { setLoading(false); }
    };
    fetchHistory();
  }, []);

  const filtered = filter === 'all' ? matches : matches.filter(m => {
    if (filter === 'win') return m.result === 'Win';
    if (filter === 'loss') return m.result === 'Loss';
    if (filter === 'draw') return m.result === 'Draw';
    if (filter === 'disputed') return m.disputed;
    return true;
  });
  const totalPages = Math.ceil(filtered.length / perPage);
  const paged = filtered.slice((page - 1) * perPage, page * perPage);

  const counts = {
    all: matches.length,
    win: matches.filter(m => m.result === 'Win').length,
    loss: matches.filter(m => m.result === 'Loss').length,
    draw: matches.filter(m => m.result === 'Draw').length,
    disputed: matches.filter(m => m.disputed).length,
  };

  const handleRowClick = async (match) => {
    setSelectedMatch(match);
    setDetail(null);
    setDetailLoading(true);
    try {
      const data = await getMatchDetail(match.id);
      setDetail(data);
    } catch (err) {
      console.error('Error fetching match detail:', err);
      setDetail({ error: 'Failed to load match details' });
    } finally { setDetailLoading(false); }
  };

  const resultClass = (r, d) => {
    if (d || r === 'Disputed') return 'disputed';
    if (r === 'Win') return 'win';
    if (r === 'Loss') return 'loss';
    return 'draw';
  };

  const resultLabel = (r) => {
    if (r === 'Disputed') return 'Disputed';
    if (r === 'Win') return 'Victory';
    if (r === 'Loss') return 'Defeat';
    return 'Draw';
  };

  if (loading) {
    return (
      <div className="page-wrapper animate-fade-in-up">
        <div className="page-header"><h1>Match History</h1></div>
        {[1,2,3].map(i => <div key={i} className="skeleton" style={{ height: 60, marginBottom: 8 }} />)}
      </div>
    );
  }

  return (
    <div className="page-wrapper animate-fade-in-up">
      <div className="page-header">
        <div>
          <h1>Match History</h1>
          <p className="subtitle">Track your competitive journey</p>
        </div>
      </div>

      {error && <div className="p-3 bg-[rgba(239,68,68,0.08)] border border-[rgba(239,68,68,0.2)] rounded-[var(--radius-md)] mb-4 text-[var(--red)] text-sm">{error}</div>}

      <div className="flex gap-2 mb-5 flex-wrap">
        <button className={`px-4 py-2 rounded-[var(--radius-md)] text-sm font-semibold cursor-pointer transition-all duration-base border ${filter === 'all' ? 'bg-[rgba(46,242,255,0.06)] border-[var(--border-glow)] text-[var(--cyan)]' : 'bg-[var(--bg-card)] border-[var(--border)] text-[var(--text-muted)] hover:border-[var(--border-glow)] hover:text-[var(--text-secondary)]'}`} onClick={() => { setFilter('all'); setPage(1); }}>All ({counts.all})</button>
        <button className={`px-4 py-2 rounded-[var(--radius-md)] text-sm font-semibold cursor-pointer transition-all duration-base border ${filter === 'win' ? 'bg-[rgba(46,242,255,0.06)] border-[var(--border-glow)] text-[var(--cyan)]' : 'bg-[var(--bg-card)] border-[var(--border)] text-[var(--text-muted)] hover:border-[var(--border-glow)] hover:text-[var(--text-secondary)]'}`} onClick={() => { setFilter('win'); setPage(1); }}>Wins ({counts.win})</button>
        <button className={`px-4 py-2 rounded-[var(--radius-md)] text-sm font-semibold cursor-pointer transition-all duration-base border ${filter === 'loss' ? 'bg-[rgba(46,242,255,0.06)] border-[var(--border-glow)] text-[var(--cyan)]' : 'bg-[var(--bg-card)] border-[var(--border)] text-[var(--text-muted)] hover:border-[var(--border-glow)] hover:text-[var(--text-secondary)]'}`} onClick={() => { setFilter('loss'); setPage(1); }}>Losses ({counts.loss})</button>
        <button className={`px-4 py-2 rounded-[var(--radius-md)] text-sm font-semibold cursor-pointer transition-all duration-base border ${filter === 'draw' ? 'bg-[rgba(46,242,255,0.06)] border-[var(--border-glow)] text-[var(--cyan)]' : 'bg-[var(--bg-card)] border-[var(--border)] text-[var(--text-muted)] hover:border-[var(--border-glow)] hover:text-[var(--text-secondary)]'}`} onClick={() => { setFilter('draw'); setPage(1); }}>Draws ({counts.draw})</button>
        <button className={`px-4 py-2 rounded-[var(--radius-md)] text-sm font-semibold cursor-pointer transition-all duration-base border ${filter === 'disputed' ? 'bg-[rgba(46,242,255,0.06)] border-[var(--border-glow)] text-[var(--cyan)]' : 'bg-[var(--bg-card)] border-[var(--border)] text-[var(--text-muted)] hover:border-[var(--border-glow)] hover:text-[var(--text-secondary)]'}`} onClick={() => { setFilter('disputed'); setPage(1); }}>Disputed ({counts.disputed})</button>
      </div>

      {matches.length === 0 ? (
        <div className="empty-state">
          <span>📜</span>
          <p>No matches played yet. Join a tournament to start!</p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {paged.map((match, idx) => (
            <div
              key={match.id}
              className="flex items-center p-4 px-5 bg-[var(--bg-card)] border border-[var(--border)] rounded-[var(--radius-lg)] transition-all duration-base cursor-pointer animate-fade-in-up hover:border-[var(--border-glow)] hover:bg-[var(--bg-card-hover)] hover:translate-x-1"
              style={{ animationDelay: `${idx * 0.03}s`, animationFillMode: 'both' }}
              onClick={() => handleRowClick(match)}
            >
              <div className="flex items-center gap-2 flex-shrink-0 mr-4">
                <div className="w-9 h-9 rounded-full overflow-hidden border-2 border-[var(--border-glow)]"><img src={buildDiscordAvatar(JSON.parse(localStorage.getItem('user') || '{}')?.discordId || JSON.parse(localStorage.getItem('user') || '{}')?.id, JSON.parse(localStorage.getItem('user') || '{}')?.discordAvatar) || DISCORD_AVATAR_FALLBACK} alt="" className="w-full h-full object-cover" /></div>
                <span className="text-[0.7rem] text-[var(--text-muted)] font-bold flex-shrink-0">VS</span>
                <div className="w-9 h-9 rounded-full overflow-hidden border-2 border-[var(--border-purple)]"><img src={buildDiscordAvatar(match.opponentId, match.opponentAvatar) || DISCORD_AVATAR_FALLBACK} alt="" className="w-full h-full object-cover" /></div>
              </div>
              <div className="flex-1 ml-4">
                <div className="text-sm font-semibold mb-0.5">You <span className="text-[var(--text-muted)] font-normal mx-1">vs</span> {match.opponent}</div>
                <div className="text-xs text-[var(--text-muted)]">{new Date(match.date).toLocaleDateString()}</div>
              </div>
              <div className={`px-3.5 py-1.5 rounded-full text-xs font-bold flex-shrink-0 ml-3 ${resultClass(match.result, match.disputed) === 'win' ? 'bg-[var(--green-bg)] text-[var(--green)]' : resultClass(match.result, match.disputed) === 'loss' ? 'bg-[var(--red-bg)] text-[var(--red)]' : resultClass(match.result, match.disputed) === 'disputed' ? 'bg-[rgba(249,115,22,0.12)] text-[var(--orange)]' : 'bg-[rgba(255,255,255,0.05)] text-[var(--text-muted)]'}`}>
                {resultLabel(match.result)}
              </div>
            </div>
          ))}
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-4 mt-6">
          <button disabled={page <= 1} onClick={() => setPage(p => Math.max(1, p - 1))} className="px-4 py-2 rounded-[var(--radius-md)] bg-[var(--bg-card)] border border-[var(--border)] text-sm text-[var(--text-muted)] cursor-pointer transition-all duration-base hover:border-[var(--border-glow)] disabled:opacity-40">← Prev</button>
          <span className="text-sm text-[var(--text-muted)]">{page} / {totalPages}</span>
          <button disabled={page >= totalPages} onClick={() => setPage(p => Math.min(totalPages, p + 1))} className="px-4 py-2 rounded-[var(--radius-md)] bg-[var(--bg-card)] border border-[var(--border)] text-sm text-[var(--text-muted)] cursor-pointer transition-all duration-base hover:border-[var(--border-glow)] disabled:opacity-40">Next →</button>
        </div>
      )}

      {selectedMatch && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[1000] backdrop-blur-sm animate-fade-in" onClick={() => { setSelectedMatch(null); setDetail(null); }}>
          <div className="max-w-[600px] w-[90%] bg-[var(--bg-glass-strong)] backdrop-blur-2xl border border-[var(--border-glow)] rounded-[var(--radius-2xl)] shadow-[var(--shadow-xl)] animate-scale-in" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-5 border-b border-[var(--border)]">
              <h3 className="font-display text-lg font-bold">Match Details</h3>
              <button onClick={() => { setSelectedMatch(null); setDetail(null); }} className="text-[var(--text-muted)] text-xl cursor-pointer bg-transparent border-none">&times;</button>
            </div>
            <div className="p-5">
              {detailLoading ? (
                <div className="text-center py-8 text-[var(--text-muted)]">Loading match details...</div>
              ) : detail?.error ? (
                <div className="text-[var(--red)] text-center py-5">{detail.error}</div>
              ) : detail ? (
                <>
                  <div className="text-center pb-6 border-b border-[var(--border)] mb-5">
                    <div className="flex items-center justify-center gap-5 mb-3">
                      <div className="text-center">
                        <img src={buildDiscordAvatar(detail.self?.discordId, detail.self?.discordAvatar) || DISCORD_AVATAR_FALLBACK} alt="" className="w-12 h-12 rounded-full mx-auto mb-1.5 border-2 border-[var(--border)]" />
                        <span className="block text-sm font-semibold">{detail.self?.discordName || 'You'}</span>
                      </div>
                      <div className="font-display text-xl font-black text-[var(--cyan)]">VS</div>
                      <div className="text-center">
                        <img src={buildDiscordAvatar(detail.opponent?.discordId, detail.opponent?.discordAvatar) || DISCORD_AVATAR_FALLBACK} alt="" className="w-12 h-12 rounded-full mx-auto mb-1.5 border-2 border-[var(--border)]" />
                        <span className="block text-sm font-semibold">{detail.opponent?.discordName || 'Opponent'}</span>
                      </div>
                    </div>
                    <span className={`inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full text-sm font-bold ${resultClass(detail.result, detail.disputed) === 'win' ? 'bg-[var(--green-bg)] text-[var(--green)] border border-[rgba(34,197,94,0.2)]' : resultClass(detail.result, detail.disputed) === 'loss' ? 'bg-[var(--red-bg)] text-[var(--red)] border border-[rgba(239,68,68,0.2)]' : resultClass(detail.result, detail.disputed) === 'disputed' ? 'bg-[rgba(249,115,22,0.12)] text-[var(--orange)] border border-[rgba(249,115,22,0.2)]' : 'bg-[rgba(255,255,255,0.05)] text-[var(--text-muted)]'}`}>
                      {resultLabel(detail.result)}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-3 mb-5">
                    <div className="p-3 bg-[rgba(0,0,0,0.15)] border border-[var(--border)] rounded-[var(--radius-md)]"><span className="text-[0.7rem] text-[var(--text-muted)] uppercase tracking-wider block mb-1">Date</span><span className="text-sm font-semibold">{new Date(detail.date).toLocaleString()}</span></div>
                    <div className="p-3 bg-[rgba(0,0,0,0.15)] border border-[var(--border)] rounded-[var(--radius-md)]"><span className="text-[0.7rem] text-[var(--text-muted)] uppercase tracking-wider block mb-1">Winner</span><span className="text-sm font-semibold">{detail.winnerDiscordId === detail.self?.discordId ? detail.self?.discordName : detail.opponent?.discordName}</span></div>
                    <div className="p-3 bg-[rgba(0,0,0,0.15)] border border-[var(--border)] rounded-[var(--radius-md)]"><span className="text-[0.7rem] text-[var(--text-muted)] uppercase tracking-wider block mb-1">Loser</span><span className="text-sm font-semibold">{detail.loserDiscordId === detail.self?.discordId ? detail.self?.discordName : (detail.loserDiscordId === detail.opponent?.discordId ? detail.opponent?.discordName : '—')}</span></div>
                    <div className="p-3 bg-[rgba(0,0,0,0.15)] border border-[var(--border)] rounded-[var(--radius-md)]"><span className="text-[0.7rem] text-[var(--text-muted)] uppercase tracking-wider block mb-1">Status</span><span className="text-sm font-semibold" style={{ color: detail.disputed ? 'var(--orange)' : 'var(--green)' }}>{detail.disputed ? 'Disputed' : detail.status || 'Completed'}</span></div>
                    <div className="p-3 bg-[rgba(0,0,0,0.15)] border border-[var(--border)] rounded-[var(--radius-md)]"><span className="text-[0.7rem] text-[var(--text-muted)] uppercase tracking-wider block mb-1">Reports</span><span className="text-sm font-semibold">{Object.keys(detail.reports || {}).length}/2</span></div>
                    {detail.tournamentId && (
                      <div className="p-3 bg-[rgba(0,0,0,0.15)] border border-[var(--border)] rounded-[var(--radius-md)]"><span className="text-[0.7rem] text-[var(--text-muted)] uppercase tracking-wider block mb-1">Tournament</span><span className="text-[0.75rem] font-semibold">{detail.tournamentId.substring(0, 12)}...</span></div>
                    )}
                    <div className="p-3 bg-[rgba(0,0,0,0.15)] border border-[var(--border)] rounded-[var(--radius-md)] col-span-2"><span className="text-[0.7rem] text-[var(--text-muted)] uppercase tracking-wider block mb-1">Match ID</span><span className="text-[0.7rem] font-semibold font-mono">{detail.id}</span></div>
                  </div>

                  {Object.keys(detail.reports || {}).length > 0 && (
                    <div className="mb-4">
                      <label className="flex items-center gap-1.5 mb-2.5 text-sm"><i className="fas fa-vote-yea text-[var(--cyan)]"></i> Player Votes</label>
                      <div className="flex flex-col gap-1.5">
                        {Object.entries(detail.reports).map(([playerId, report]) => {
                          const isSelf = playerId === detail.self?.discordId;
                          const playerName = isSelf ? detail.self?.discordName : detail.opponent?.discordName;
                          const votedForSelf = report.winnerDiscordId === playerId;
                          return (
                            <div key={playerId} className="flex items-center justify-between p-2.5 bg-[rgba(0,0,0,0.15)] border border-[var(--border)] rounded-[var(--radius-md)]">
                              <div className="flex items-center gap-2.5">
                                <img src={buildDiscordAvatar(playerId, '') || DISCORD_AVATAR_FALLBACK} alt="" className="w-7 h-7 rounded-full" />
                                <span className="text-sm font-semibold">{playerName}</span>
                              </div>
                              <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${votedForSelf ? 'bg-[rgba(34,197,94,0.1)] text-[var(--green)]' : 'bg-[rgba(239,68,68,0.1)] text-[var(--red)]'}`}>
                                <i className={`fas ${votedForSelf ? 'fa-check-circle' : 'fa-times-circle'}`}></i>
                                {' '}{votedForSelf ? 'Claimed Win' : 'Admitted Loss'}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {detail.chatLogs?.length > 0 && (
                    <div className="mb-4">
                      <label className="flex items-center gap-1.5 mb-2.5 text-sm"><i className="fas fa-comments text-[var(--purple)]"></i> Match Chat ({detail.chatLogs.length})</label>
                      <div className="max-h-60 overflow-y-auto flex flex-col gap-1 p-2 bg-[rgba(0,0,0,0.1)] rounded-[var(--radius-md)]">
                        {detail.chatLogs.map((msg, i) => (
                          <div key={i} className={`px-2.5 py-1.5 rounded-[var(--radius-sm)] text-sm ${msg.isSystem ? 'bg-[rgba(46,242,255,0.03)]' : ''}`}>
                            <span className={`font-semibold text-xs mr-2 ${msg.isSystem ? 'text-[var(--text-muted)]' : 'text-[var(--cyan)]'}`}>{msg.isSystem ? 'System' : msg.sender}:</span>
                            <span className={`${msg.isSystem ? 'text-[var(--text-dim)]' : 'text-[var(--text-secondary)]'}`}>{typeof msg.message === 'string' ? msg.message.substring(0, 200) : ''}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {detail.evidence?.length > 0 && (
                    <div className="mb-4">
                      <label className="flex items-center gap-1.5 mb-2.5 text-sm"><i className="fas fa-paperclip text-[var(--orange)]"></i> Evidence ({detail.evidence.length})</label>
                      <div className="flex flex-col gap-2">
                        {detail.evidence.map((ev, i) => (
                          <div key={i} className="p-3 bg-[rgba(0,0,0,0.15)] border border-[var(--border)] rounded-[var(--radius-md)]">
                            <div className="text-[var(--text-muted)] text-xs mb-2"><i className="fas fa-user"></i> Submitted by: {ev.playerDiscordId === detail.self?.discordId ? detail.self?.discordName : detail.opponent?.discordName}</div>
                            <div className="flex gap-2 flex-wrap">
                              {ev.screenshots?.map((url, j) => (
                                <a key={j} href={url} target="_blank" rel="noopener noreferrer" className="btn btn-ghost btn-sm"><i className="fas fa-image"></i> Screenshot {j + 1}</a>
                              ))}
                              {ev.videoLinks?.map((url, j) => (
                                <a key={j} href={url} target="_blank" rel="noopener noreferrer" className="btn btn-ghost btn-sm"><i className="fas fa-video"></i> Video {j + 1}</a>
                              ))}
                              {ev.replayCodes?.map((code, j) => (
                                <span key={j} className="btn btn-ghost btn-sm"><i className="fas fa-code"></i> Replay: {code}</span>
                              ))}
                              {ev.streamLinks?.map((url, j) => (
                                <a key={j} href={url} target="_blank" rel="noopener noreferrer" className="btn btn-ghost btn-sm"><i className="fas fa-broadcast-tower"></i> Stream</a>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              ) : null}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MatchHistoryPage;