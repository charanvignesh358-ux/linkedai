import React, { useState, useEffect, useRef } from 'react';
import { useApp } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { Bell, Menu } from 'lucide-react';

const pageTitles = {
  dashboard:    'Dashboard',
  jobs:         'Job Search',
  applications: 'Applications Tracker',
  resumes:      'Resumes & Cover Letters',
  networking:   'Networking Bot',
  settings:     'Settings',
  manager:      'Manager Agent',
  admin:        'Admin Panel',
  figma:        'Figma Portfolio',
  content:      'Content Studio',
  interview:    'Interview Coach',
  chatbot:      'Application Bot',
};

const Topbar = ({ onMenuToggle }) => {
  const { activePage, notifications, unreadCount, markAllRead } = useApp();
  const { currentUser, userProfile } = useAuth();
  const [showNotifs, setShowNotifs] = useState(false);
  const notifRef = useRef(null);

  useEffect(() => {
    if (!showNotifs) return;
    const handler = (e) => {
      if (notifRef.current && !notifRef.current.contains(e.target)) {
        setShowNotifs(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showNotifs]);

  const notifIcon = { success: '✅', info: '💡', warning: '⚠️', error: '❌' };

  const initials = (userProfile?.displayName || currentUser?.email || 'U')
    .split(/[\s@]/)
    .map(w => w[0])
    .filter(Boolean)
    .join('')
    .toUpperCase()
    .slice(0, 2);

  return (
    <header className="topbar">
      <div className="topbar-left">
        {/* Mobile hamburger */}
        <button className="mobile-menu-btn" onClick={onMenuToggle} aria-label="Open menu">
          <Menu size={18} />
        </button>
        <span className="page-breadcrumb font-mono">LinkedAI /</span>
        <h2 className="page-title">{pageTitles[activePage] || activePage}</h2>
      </div>

      <div className="topbar-right" style={{ position: 'relative' }} ref={notifRef}>
        <div
          className="topbar-btn"
          onClick={() => {
            setShowNotifs(v => !v);
            if (!showNotifs) markAllRead();
          }}
        >
          <Bell size={16} />
          {unreadCount > 0 && <div className="notification-dot" />}
        </div>

        <div className="user-avatar" title={currentUser?.email}>{initials}</div>

        {showNotifs && (
          <div
            style={{
              position: 'absolute', top: '46px', right: 0,
              width: 340,
              background: 'var(--bg-card)',
              border: '1px solid var(--border-accent)',
              borderRadius: 'var(--radius-lg)',
              boxShadow: '0 16px 60px rgba(0,0,0,0.6)',
              zIndex: 300,
              overflow: 'hidden',
            }}
          >
            <div className="card-header">
              <div className="card-title" style={{ fontSize: 13 }}>
                <Bell size={14} /> Notifications
              </div>
              <span className="badge badge-cyan">{notifications.length}</span>
            </div>
            <div style={{ maxHeight: 320, overflowY: 'auto' }}>
              {notifications.length === 0 && (
                <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 12 }}>
                  No notifications yet
                </div>
              )}
              {notifications.map(n => (
                <div
                  key={n.id}
                  className="activity-item"
                  style={{ padding: '10px 18px', borderBottom: '1px solid var(--border)' }}
                >
                  <div className="activity-icon" style={{ fontSize: 14, width: 28, height: 28 }}>
                    {notifIcon[n.type] || '📢'}
                  </div>
                  <div className="activity-body">
                    <div className="activity-text">{n.message}</div>
                    <div className="activity-time">{n.time}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </header>
  );
};

export default Topbar;
