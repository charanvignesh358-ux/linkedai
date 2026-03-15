import React from 'react';
import { useApp } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import {
  LayoutDashboard, Search, Briefcase, FileText,
  Users, Settings, Bot, LogOut, Brain, ShieldCheck,
  Figma, Mic, PenTool, MessageSquare,
} from 'lucide-react';

const navItems = [
  { id: 'dashboard',    icon: LayoutDashboard, label: 'Dashboard'    },
  { id: 'jobs',         icon: Search,          label: 'Job Search'   },
  { id: 'applications', icon: Briefcase,        label: 'Applications' },
  { id: 'resumes',      icon: FileText,         label: 'Resumes & CL' },
  { id: 'networking',   icon: Users,            label: 'Networking'   },
  { id: 'settings',     icon: Settings,         label: 'Settings'     },
];

const Sidebar = () => {
  const { activePage, setActivePage, botStatus, setBotStatus } = useApp();
  const { currentUser, userProfile, isAdmin, logOut } = useAuth();

  const initials = (userProfile?.displayName || currentUser?.email || 'U')
    .split(/[\s@]/)
    .map(w => w[0])
    .filter(Boolean)
    .join('')
    .toUpperCase()
    .slice(0, 2) || 'U';

  return (
    <aside className="sidebar">
      {/* Logo */}
      <div className="sidebar-logo">
        <div className="logo-icon">LA</div>
        <div>
          <div className="logo-text">LinkedAI</div>
          <div className="logo-sub">Automation Platform</div>
        </div>
      </div>

      <nav className="sidebar-nav">
        <div className="nav-section-label">Main</div>
        {navItems.map((item, idx) => (
          <div
            key={item.id}
            className={`nav-item ${activePage === item.id ? 'active' : ''}`}
            onClick={() => setActivePage(item.id)}
            style={{ animationDelay: `${idx * 40}ms` }}
          >
            <item.icon size={16} />
            <span>{item.label}</span>
          </div>
        ))}

        <div className="nav-section-label" style={{ marginTop: 8 }}>Creative Tools</div>
        {/* ── Figma — highlighted ── */}
        <div
          className={`nav-item ${activePage === 'figma' ? 'active' : ''}`}
          onClick={() => setActivePage('figma')}
          style={{
            position: 'relative',
            background: activePage === 'figma'
              ? 'rgba(242,78,30,0.12)'
              : 'rgba(242,78,30,0.04)',
            border: `1px solid ${activePage === 'figma' ? 'rgba(242,78,30,0.45)' : 'rgba(242,78,30,0.18)'}`,
            boxShadow: activePage === 'figma' ? '0 0 18px rgba(242,78,30,0.25)' : '0 0 8px rgba(242,78,30,0.08)',
            animation: activePage !== 'figma' ? 'figmaGlow 2.8s ease-in-out infinite' : 'none',
          }}
        >
          <Figma size={16} style={{ color: '#F24E1E' }} />
          <span style={{ color: activePage === 'figma' ? '#F24E1E' : 'var(--text-primary)', fontWeight: 600 }}>Figma Portfolio</span>
          <span className="nav-badge" style={{ background: 'linear-gradient(135deg,#F24E1E,#A259FF)', color: '#fff', fontSize: 9, padding: '2px 7px' }}>✦ NEW</span>
        </div>
        <div
          className={`nav-item ${activePage === 'interview' ? 'active' : ''}`}
          onClick={() => setActivePage('interview')}
        >
          <Mic size={16} />
          <span>Interview Coach</span>
          <span className="nav-badge" style={{ background: 'rgba(0,200,255,0.15)', color: 'var(--accent-cyan)', fontSize: 9 }}>AI</span>
        </div>
        <div
          className={`nav-item ${activePage === 'content' ? 'active' : ''}`}
          onClick={() => setActivePage('content')}
        >
          <PenTool size={16} />
          <span>Content Studio</span>
        </div>

        <div className="nav-section-label" style={{ marginTop: 8 }}>AI Engine</div>
        <div
          className={`nav-item manager-nav-item ${activePage === 'manager' ? 'active' : ''}`}
          onClick={() => setActivePage('manager')}
        >
          <Brain size={16} />
          <span>Manager Agent</span>
          <span className="nav-badge agent-badge">AI</span>
        </div>
        <div
          className={`nav-item ${activePage === 'chatbot' ? 'active' : ''}`}
          onClick={() => setActivePage('chatbot')}
          style={{
            background: activePage === 'chatbot'
              ? 'rgba(0,230,118,0.1)'
              : 'rgba(0,230,118,0.03)',
            borderColor: activePage === 'chatbot'
              ? 'rgba(0,230,118,0.35)'
              : 'rgba(0,230,118,0.12)',
          }}
        >
          <MessageSquare size={16} style={{ color: activePage === 'chatbot' ? 'var(--accent-green)' : undefined }} />
          <span style={{ color: activePage === 'chatbot' ? 'var(--accent-green)' : undefined }}>Application Bot</span>
          <span className="nav-badge" style={{ background: 'rgba(0,230,118,0.15)', color: 'var(--accent-green)', fontSize: 9 }}>AI</span>
        </div>

        {/* Admin link — only visible to admins */}
        {isAdmin && (
          <>
            <div className="nav-section-label" style={{ marginTop: 8 }}>Admin</div>
            <div
              className={`nav-item ${activePage === 'admin' ? 'active' : ''}`}
              onClick={() => setActivePage('admin')}
              style={{
                background: activePage === 'admin'
                  ? 'rgba(255,184,0,0.08)'
                  : 'rgba(255,184,0,0.03)',
                borderColor: activePage === 'admin'
                  ? 'rgba(255,184,0,0.3)'
                  : 'rgba(255,184,0,0.1)',
              }}
            >
              <ShieldCheck size={16} style={{ color: 'var(--accent-amber)' }} />
              <span style={{ color: activePage === 'admin' ? 'var(--accent-amber)' : undefined }}>
                Admin Panel
              </span>
              <span className="nav-badge" style={{ background: 'var(--accent-amber)', color: '#000' }}>
                ADMIN
              </span>
            </div>
          </>
        )}

        <div className="nav-section-label" style={{ marginTop: 8 }}>Bot Status</div>
        <div
          className={`nav-item ${botStatus === 'active' ? 'active' : ''}`}
          onClick={() => setBotStatus(botStatus === 'active' ? 'idle' : 'active')}
        >
          <Bot size={16} />
          <span>Bot Control</span>
          <span className={`nav-badge ${botStatus === 'active' ? 'green' : botStatus === 'idle' ? 'amber' : ''}`}>
            {botStatus === 'active' ? 'ON' : 'IDLE'}
          </span>
        </div>
      </nav>

      {/* Footer — user profile + sign out */}
      <div className="sidebar-footer">
        {/* Bot status card */}
        <div className="bot-status-card" style={{ marginBottom: 8 }}>
          <div className={`bot-status-indicator ${botStatus}`} />
          <div className="bot-status-text">
            <div className="status-label">Bot Engine</div>
            <div className="status-value" style={{ textTransform: 'capitalize' }}>{botStatus}</div>
          </div>
        </div>

        {/* User profile row */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '10px 12px',
          background: 'var(--bg-card)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-md)',
          marginBottom: 4,
        }}>
          <div style={{
            width: 30, height: 30, borderRadius: '50%',
            background: isAdmin
              ? 'linear-gradient(135deg, #ffb800, #ff6b00)'
              : 'var(--gradient-primary)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 11, fontWeight: 800, color: '#fff',
            fontFamily: 'var(--font-display)', flexShrink: 0,
            border: isAdmin ? '1.5px solid rgba(255,184,0,0.5)' : 'none',
          }}>
            {initials}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {userProfile?.displayName || 'User'}
            </div>
            <div style={{ fontSize: 10, color: isAdmin ? 'var(--accent-amber)' : 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
              {isAdmin ? '👑 Admin' : '👤 Member'}
            </div>
          </div>
        </div>

        {/* Sign out */}
        <div
          className="nav-item"
          onClick={logOut}
          style={{ cursor: 'pointer', marginTop: 4 }}
        >
          <LogOut size={14} />
          <span style={{ fontSize: 12 }}>Sign Out</span>
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;
