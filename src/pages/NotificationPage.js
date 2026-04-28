import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { API_BASE_URL } from '../utils/api';

const NotificationPage = () => {
  const [announcements, setAnnouncements] = useState([]);
  const [localNotifications, setLocalNotifications] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await axios.get(`${API_BASE_URL}/announcements`, {
          headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
        });
        setAnnouncements(res.data);
      } catch (err) { console.error('Failed to fetch announcements'); }
      const saved = localStorage.getItem('notifications');
      if (saved) setLocalNotifications(JSON.parse(saved));
      setLoading(false);
    };
    fetchData();
  }, []);

  const clearAll = () => {
    setLocalNotifications([]);
    localStorage.removeItem('notifications');
  };

  const getIcon = (type) => {
    const icons = { success: 'fa-check-circle', warning: 'fa-exclamation-triangle', error: 'fa-times-circle' };
    return icons[type] || 'fa-info-circle';
  };

  const getIconClass = (type) => {
    const classes = { info: 'bg-[rgba(46,242,255,0.08)] text-[var(--cyan)]', warning: 'bg-[rgba(249,115,22,0.08)] text-[var(--orange)]', success: 'bg-[rgba(168,85,247,0.08)] text-[var(--purple)]', error: 'bg-[rgba(249,115,22,0.08)] text-[var(--orange)]' };
    return classes[type] || 'bg-[rgba(46,242,255,0.08)] text-[var(--cyan)]';
  };

  const typeToIcon = { info: 'fa-info-circle', warning: 'fa-exclamation-triangle', update: 'fa-rotate', maintenance: 'fa-wrench', event: 'fa-calendar-alt' };

  if (loading) {
    return (
      <div className="page-wrapper animate-fade-in-up">
        <div className="page-header"><h1>Notifications</h1></div>
        {[1,2,3].map(i => <div key={i} className="skeleton" style={{ height: 60, marginBottom: 8 }} />)}
      </div>
    );
  }

  const hasContent = announcements.length > 0 || localNotifications.length > 0;

  return (
    <div className="page-wrapper animate-fade-in-up">
      <div className="page-header">
        <div>
          <h1>Notifications</h1>
          <p className="subtitle">Stay up to date with announcements</p>
        </div>
        {localNotifications.length > 0 && (
          <button onClick={clearAll} className="btn btn-ghost btn-sm">
            <i className="fas fa-trash"></i> Clear All
          </button>
        )}
      </div>

      {announcements.length > 0 && (
        <>
          <h3 className="font-display text-xs text-[var(--text-muted)] uppercase tracking-wider mb-3 flex items-center gap-2">
            <i className="fas fa-bullhorn text-[var(--cyan)]"></i> Announcements
          </h3>
          <div className="flex flex-col gap-2 mb-6">
            {announcements.map((a) => (
              <div key={a._id} className="flex items-center gap-3.5 p-4 px-5 bg-[var(--bg-card)] border border-[var(--border)] rounded-[var(--radius-lg)] transition-all duration-base animate-fade-in-up hover:border-[var(--border-glow)] hover:bg-[var(--bg-card-hover)] hover:translate-x-1" style={{ animationFillMode: 'both' }}>
                <div className={`w-10 h-10 rounded-[var(--radius-md)] flex items-center justify-center text-lg flex-shrink-0 ${getIconClass(a.type)}`}>
                  <i className={`fas ${typeToIcon[a.type] || 'fa-info-circle'}`}></i>
                </div>
                <div className="flex-1">
                  <span className="font-semibold text-sm block">{a.title}</span>
                  <span className="text-xs text-[var(--text-muted)] mt-0.5 block">{a.body}</span>
                </div>
                <span className="text-[0.7rem] text-[var(--text-dim)] flex-shrink-0">{new Date(a.createdAt).toLocaleDateString()}</span>
              </div>
            ))}
          </div>
        </>
      )}

      <h3 className="font-display text-xs text-[var(--text-muted)] uppercase tracking-wider mb-3 flex items-center gap-2">
        <i className="fas fa-bell text-[var(--purple)]"></i> Activity
      </h3>

      {!hasContent ? (
        <div className="empty-state">
          <span>🔔</span>
          <p>No notifications yet. Stay tuned!</p>
        </div>
      ) : localNotifications.length === 0 ? (
        <div className="empty-state">
          <span>🔔</span>
          <p>No recent activity notifications</p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {[...localNotifications].reverse().map((n, index) => (
            <div key={n.id || index} className="flex items-center gap-3.5 p-4 px-5 bg-[var(--bg-card)] border border-[var(--border)] rounded-[var(--radius-lg)] transition-all duration-base animate-fade-in-up hover:border-[var(--border-glow)] hover:bg-[var(--bg-card-hover)] hover:translate-x-1" style={{ animationFillMode: 'both' }}>
              <div className={`w-10 h-10 rounded-[var(--radius-md)] flex items-center justify-center text-lg flex-shrink-0 ${getIconClass(n.type)}`}>
                <i className={`fas ${getIcon(n.type)}`}></i>
              </div>
              <div className="flex-1">
                <span className="text-xs text-[var(--text-muted)] block">{n.message}</span>
              </div>
              {n.time && <span className="text-[0.7rem] text-[var(--text-dim)] flex-shrink-0">{n.time}</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default NotificationPage;