// Reusable Premium UI Components for FNT Arena
// Tailwind CSS + dark gaming theme

import React from 'react';

/* ─── BUTTONS ─── */
export const PrimaryButton = ({ children, className = '', disabled, onClick, ...props }) => (
  <button
    onClick={onClick}
    disabled={disabled}
    className={`inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl font-bold text-sm bg-gradient-to-r from-[#2EF2FF] to-[#1DAEFF] text-black shadow-[0_0_20px_rgba(46,242,255,0.2)] hover:shadow-[0_0_40px_rgba(46,242,255,0.4)] hover:-translate-y-0.5 active:translate-y-0 transition-all duration-250 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none ${className}`}
    {...props}
  >
    {children}
  </button>
);

export const SecondaryButton = ({ children, className = '', disabled, onClick, ...props }) => (
  <button
    onClick={onClick}
    disabled={disabled}
    className={`inline-flex items-center justify-center gap-2 px-5 py-2 rounded-xl font-semibold text-sm bg-white/5 text-white border border-white/10 hover:bg-white/10 hover:border-white/20 hover:-translate-y-0.5 active:translate-y-0 transition-all duration-250 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none ${className}`}
    {...props}
  >
    {children}
  </button>
);

export const DangerButton = ({ children, className = '', disabled, onClick, ...props }) => (
  <button
    onClick={onClick}
    disabled={disabled}
    className={`inline-flex items-center justify-center gap-2 px-5 py-2 rounded-xl font-semibold text-sm bg-gradient-to-r from-[#EF4444] to-[#dc2626] text-white shadow-[0_0_20px_rgba(239,68,68,0.2)] hover:shadow-[0_0_40px_rgba(239,68,68,0.4)] hover:-translate-y-0.5 active:translate-y-0 transition-all duration-250 disabled:opacity-50 disabled:cursor-not-allowed ${className}`}
    {...props}
  >
    {children}
  </button>
);

export const SuccessButton = ({ children, className = '', disabled, onClick, ...props }) => (
  <button
    onClick={onClick}
    disabled={disabled}
    className={`inline-flex items-center justify-center gap-2 px-5 py-2 rounded-xl font-semibold text-sm bg-gradient-to-r from-[#22C55E] to-[#16a34a] text-white shadow-[0_0_20px_rgba(34,197,94,0.2)] hover:shadow-[0_0_40px_rgba(34,197,94,0.4)] hover:-translate-y-0.5 active:translate-y-0 transition-all duration-250 disabled:opacity-50 disabled:cursor-not-allowed ${className}`}
    {...props}
  >
    {children}
  </button>
);

export const PurpleButton = ({ children, className = '', disabled, onClick, ...props }) => (
  <button
    onClick={onClick}
    disabled={disabled}
    className={`inline-flex items-center justify-center gap-2 px-5 py-2 rounded-xl font-semibold text-sm bg-gradient-to-r from-[#A855F7] to-[#7A5CFF] text-white shadow-[0_0_20px_rgba(168,85,247,0.2)] hover:shadow-[0_0_40px_rgba(168,85,247,0.4)] hover:-translate-y-0.5 active:translate-y-0 transition-all duration-250 disabled:opacity-50 disabled:cursor-not-allowed ${className}`}
    {...props}
  >
    {children}
  </button>
);

export const DiscordButton = ({ children, className = '', onClick, ...props }) => (
  <button
    onClick={onClick}
    className={`inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-bold text-sm bg-[#5865F2] text-white shadow-[0_4px_24px_rgba(88,101,242,0.35)] hover:shadow-[0_8px_32px_rgba(88,101,242,0.5)] hover:-translate-y-0.5 active:translate-y-0 transition-all duration-250 ${className}`}
    {...props}
  >
    {children}
  </button>
);

/* ─── CARDS ─── */
export const GlowCard = ({ children, className = '', onClick, hover = true, ...props }) => (
  <div
    onClick={onClick}
    className={`rounded-xl bg-[rgba(15,25,55,0.7)] backdrop-blur-xl border border-[rgba(255,255,255,0.06)] ${hover ? 'hover:border-[rgba(46,242,255,0.15)] hover:shadow-[0_0_20px_rgba(46,242,255,0.1)] hover:-translate-y-1' : ''} transition-all duration-250 ${className}`}
    {...props}
  >
    {children}
  </div>
);

export const StatCard = ({ value, label, icon, color = '#2EF2FF', className = '' }) => (
  <div className={`rounded-xl bg-[rgba(15,25,55,0.7)] backdrop-blur-xl border border-white/5 p-5 text-center hover:border-[rgba(46,242,255,0.15)] hover:shadow-[0_0_20px_rgba(46,242,255,0.1)] hover:-translate-y-0.5 transition-all duration-250 ${className}`}>
    {icon && <div className="text-2xl mb-2">{icon}</div>}
    <div className="font-display text-2xl font-extrabold" style={{ color }}>{value}</div>
    <div className="text-xs text-white/45 uppercase tracking-wider mt-1">{label}</div>
  </div>
);

export const GlassCard = ({ children, className = '', ...props }) => (
  <div className={`rounded-xl bg-[rgba(10,20,45,0.55)] backdrop-blur-2xl border border-white/[0.06] ${className}`} {...props}>
    {children}
  </div>
);

/* ─── BADGES ─── */
export const Badge = ({ children, color = '#2EF2FF', className = '' }) => (
  <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[0.65rem] font-bold uppercase tracking-wider ${className}`}
    style={{
      background: `${color}15`,
      color,
      border: `1px solid ${color}25`,
    }}
  >
    {children}
  </span>
);

export const StatusBadge = ({ status = 'active' }) => {
  const map = {
    active: { label: 'LIVE', color: '#2EF2FF' },
    live: { label: 'LIVE', color: '#2EF2FF' },
    open: { label: 'OPEN', color: '#22C55E' },
    completed: { label: 'ENDED', color: '#64748b' },
    ended: { label: 'ENDED', color: '#64748b' },
    cancelled: { label: 'CANCELLED', color: '#EF4444' },
    closed: { label: 'CLOSED', color: '#64748b' },
    win: { label: 'WIN', color: '#22C55E' },
    loss: { label: 'LOSS', color: '#EF4444' },
    draw: { label: 'DRAW', color: '#F97316' },
    disputed: { label: 'DISPUTED', color: '#F97316' },
  };
  const s = map[status] || { label: status?.toUpperCase() || 'UNKNOWN', color: '#64748b' };
  return <Badge color={s.color}>{s.label}</Badge>;
};

export const SeverityBadge = ({ severity = 'low' }) => {
  const colors = { critical: '#EF4444', high: '#F97316', medium: '#EAB308', low: '#3B82F6' };
  return <Badge color={colors[severity] || '#64748b'}>{severity}</Badge>;
};

/* ─── INPUT ─── */
export const InputField = ({ label, error, className = '', ...props }) => (
  <div className="mb-4">
    {label && <label className="block text-xs font-semibold text-white/75 uppercase tracking-wider mb-1.5">{label}</label>}
    <input
      className={`w-full px-4 py-3 rounded-xl bg-black/30 border ${error ? 'border-red-500' : 'border-white/10'} text-white text-sm outline-none focus:border-[rgba(46,242,255,0.4)] focus:shadow-[0_0_20px_rgba(46,242,255,0.1)] transition-all duration-250 ${className}`}
      {...props}
    />
    {error && <p className="text-red-500 text-xs mt-1">{error}</p>}
  </div>
);

/* ─── MODAL ─── */
export const Modal = ({ open, onClose, title, children, className = '' }) => {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md animate-fade-in" onClick={onClose}>
      <div className={`bg-[rgba(10,20,45,0.75)] backdrop-blur-2xl border border-white/10 rounded-2xl shadow-xl max-w-lg w-[90%] max-h-[90vh] overflow-y-auto animate-scale-in ${className}`} onClick={e => e.stopPropagation()}>
        {title && (
          <div className="flex items-center justify-between px-6 py-5 border-b border-white/10">
            <h3 className="font-display text-lg">{title}</h3>
            <button onClick={onClose} className="text-white/45 hover:text-white text-xl transition-colors">&times;</button>
          </div>
        )}
        <div className="p-6">{children}</div>
      </div>
    </div>
  );
};

/* ─── SKELETON ─── */
export const Skeleton = ({ className = '' }) => (
  <div className={`bg-gradient-to-r from-white/[0.03] via-white/[0.06] to-white/[0.03] bg-[length:200%_100%] animate-shimmer rounded-xl ${className}`} />
);

/* ─── EMPTY STATE ─── */
export const EmptyState = ({ icon = '📭', message = 'No data available' }) => (
  <div className="flex flex-col items-center justify-center py-16 text-center text-white/45">
    <span className="text-5xl mb-4 opacity-30">{icon}</span>
    <p className="text-base">{message}</p>
  </div>
);

/* ─── AVATAR ─── */
export const DiscordAvatar = ({ id, hash, size = 36, className = '' }) => {
  const url = id && hash
    ? `https://cdn.discordapp.com/avatars/${id}/${hash}.${hash.startsWith('a_') ? 'gif' : 'png'}?size=128`
    : 'https://cdn.discordapp.com/embed/avatars/0.png';
  return <img src={url} alt="" className={`rounded-full border-2 border-white/10 object-cover ${className}`} style={{ width: size, height: size }} />;
};

/* ─── PAGINATION ─── */
export const Pagination = ({ page, totalPages, onPageChange }) => {
  if (totalPages <= 1) return null;
  return (
    <div className="flex items-center justify-center gap-2 mt-5">
      <button disabled={page <= 1} onClick={() => onPageChange(page - 1)}
        className="px-3.5 py-2 rounded-xl bg-white/5 border border-white/10 text-white/75 text-sm disabled:opacity-40 disabled:cursor-not-allowed hover:border-cyan/30 hover:text-cyan transition-all">
        ← Prev
      </button>
      <span className="text-sm text-white/45">{page} / {totalPages}</span>
      <button disabled={page >= totalPages} onClick={() => onPageChange(page + 1)}
        className="px-3.5 py-2 rounded-xl bg-white/5 border border-white/10 text-white/75 text-sm disabled:opacity-40 disabled:cursor-not-allowed hover:border-cyan/30 hover:text-cyan transition-all">
        Next →
      </button>
    </div>
  );
};

/* ─── FILTER TABS ─── */
export const FilterTabs = ({ tabs, active, onChange }) => (
  <div className="flex gap-1 p-1 rounded-xl bg-black/20 overflow-x-auto">
    {tabs.map(t => (
      <button key={t.key}
        onClick={() => onChange(t.key)}
        className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all duration-150 ${active === t.key ? 'bg-[rgba(46,242,255,0.1)] text-[#2EF2FF] shadow-[0_0_10px_rgba(46,242,255,0.05)]' : 'text-white/45 hover:text-white/75 hover:bg-white/5'}`}
      >
        {t.label}
      </button>
    ))}
  </div>
);
