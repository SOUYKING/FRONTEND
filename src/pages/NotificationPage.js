import React, { useState, useEffect } from 'react';
import { getAnnouncements } from '../utils/api';
import './NotificationPage.css';

const NotificationPage = () => {
  const [announcements, setAnnouncements] = useState([]);
  const [localNotifications, setLocalNotifications] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const data = await getAnnouncements();
        setAnnouncements(Array.isArray(data) ? data : []);
      } catch (err) { console.error('Failed to fetch announcements'); }
      const saved = localStorage.getItem('notifications');
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed)) setLocalNotifications(parsed);
        } catch {
          localStorage.removeItem('notifications');
        }
      }
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
    const classes = { info: 'info', warning: 'warning', success: 'match', error: 'warning' };
    return classes[type] || 'info';
  };

  const typeToIcon = { info: 'fa-info-circle', warning: 'fa-exclamation-triangle', update: 'fa-rotate', maintenance: 'fa-wrench', event: 'fa-calendar-alt' };

  if (loading) {
    return (
      <div className="notifications-page page-wrapper">
        <div className="page-header"><h1>Notifications</h1></div>
        {[1,2,3].map(i => <div key={i} className="skeleton" style={{ height: 60, marginBottom: 8 }} />)}
      </div>
    );
  }

  const hasContent = announcements.length > 0 || localNotifications.length > 0;

  return (
    <div className="notifications-page page-wrapper">
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
          <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '0.8rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
            <i className="fas fa-bullhorn" style={{ color: 'var(--cyan)' }}></i> Announcements
          </h3>
          <div className="notifications-list" style={{ marginBottom: 24 }}>
            {announcements.map((a) => (
              <div key={a._id} className="notification-item">
                <div className={`notif-icon ${getIconClass(a.type)}`}>
                  <i className={`fas ${typeToIcon[a.type] || 'fa-info-circle'}`}></i>
                </div>
                <div className="notif-content">
                  <span className="notif-title">{a.title}</span>
                  <span className="notif-message">{a.body}</span>
                </div>
                <span className="notif-time">{new Date(a.createdAt).toLocaleDateString()}</span>
              </div>
            ))}
          </div>
        </>
      )}

      <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '0.8rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
        <i className="fas fa-bell" style={{ color: 'var(--purple)' }}></i> Activity
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
        <div className="notifications-list">
          {[...localNotifications].reverse().map((n, index) => (
            <div key={n.id || index} className="notification-item">
              <div className={`notif-icon ${getIconClass(n.type)}`}>
                <i className={`fas ${getIcon(n.type)}`}></i>
              </div>
              <div className="notif-content">
                <span className="notif-message">{n.message}</span>
              </div>
              {n.time && <span className="notif-time">{n.time}</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default NotificationPage;
