import React, { useMemo, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import {
  AreaChart, Area, XAxis, YAxis, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell
} from 'recharts';
import { TrendingUp, Send, Calendar, Users, Zap, ArrowUpRight, Bot, Target, RefreshCw } from 'lucide-react';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase/config';

const CustomTooltip = ({ active, payload }) => {
  if (active && payload?.length) {
    return (
      <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-accent)', borderRadius: 8, padding: '8px 12px', fontSize: 12 }}>
        {payload.map((p, i) => (
          <div key={i} style={{ color: p.color }}>{p.name}: <strong>{p.value}</strong></div>
        ))}
      </div>
    );
  }
  return null;
};

const Dashboard = () => {
  const { stats, setStats, forceRefreshStats, applications, botStatus, notifications, firebaseReady, firebaseError, userSettings } = useApp();
  // FIX #3: useAuth gives us currentUser cleanly — no direct firebase/config import needed
  const { currentUser } = useAuth();

  // FIX #2: forceRefreshStats now has stable identity (empty deps in AppContext)
  // so this effect runs exactly once on mount, not on every render.
  useEffect(() => {
    if (forceRefreshStats) forceRefreshStats();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const recentApps = applications.slice(0, 5);

  // ── Build real pie data from actual applications ──────────────
  const pieData = useMemo(() => {
    const counts = { applied: 0, interview: 0, offer: 0, rejected: 0 };
    applications.forEach(a => {
      const s = (a.status || '').toLowerCase();
      if (counts[s] !== undefined) counts[s]++;
    });
    return [
      { name: 'Applied',    value: counts.applied,   color: '#00c8ff' },
      { name: 'Interview',  value: counts.interview,  color: '#00e676' },
      { name: 'Offer',      value: counts.offer,      color: '#ffb800' },
      { name: 'Rejected',   value: counts.rejected,   color: '#ff3b5c' },
    ].filter(d => d.value > 0);
  }, [applications]);

  // ── Build weekly chart from real application timestamps ───────
  const weeklyData = useMemo(() => {
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const today = new Date();
    const result = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(today);
      d.setDate(today.getDate() - (6 - i));
      return { day: days[d.getDay()], date: d.toDateString(), applied: 0, found: 0 };
    });

    applications.forEach(app => {
      const raw = app.createdAt?.toDate ? app.createdAt.toDate() : app.createdAt ? new Date(app.createdAt) : null;
      if (!raw) return;
      const ds = raw.toDateString();
      const slot = result.find(r => r.date === ds);
      if (slot) slot.applied++;
    });

    return result;
  }, [applications]);

  const statusColor = { applied: 'cyan', interview: 'green', offer: 'amber', rejected: 'red' };

  // FIX #3: resetStats uses currentUser from useAuth (not direct firebase import)
  // This is always in sync with the React auth state.
  const resetStats = async () => {
    if (!window.confirm('Reset all stats to zero? This cannot be undone.')) return;
    const userId = currentUser?.uid;
    if (!userId) return alert('Not logged in');
    const zeros = { jobsFound: 0, applied: 0, interviews: 0, connections: 0, responseRate: 0, matchScore: 0, updatedAt: serverTimestamp() };
    try {
      await setDoc(doc(db, 'stats', userId), zeros);
      setStats(zeros);
      alert('✅ Stats reset to zero!');
    } catch (err) {
      console.error('resetStats failed:', err);
      alert('❌ Failed to reset stats: ' + err.message);
    }
  };

  const activityFeed = notifications.map(n => ({
    icon: n.type === 'success' ? '✅' : n.type === 'warning' ? '⚠️' : '💡',
    text: n.message,
    time: n.time,
    color: n.type === 'success' ? 'rgba(0,230,118,0.12)' : n.type === 'warning' ? 'rgba(255,184,0,0.12)' : 'rgba(0,200,255,0.12)',
  }));

  return (
    <div className="page-content animate-fade">

      {/* ── DEBUG STATUS BAR ── */}
      <div style={{
        background: 'rgba(0,0,0,0.4)',
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: 10, padding: '10px 16px', marginBottom: 16,
        display: 'flex', flexWrap: 'wrap', gap: 12, fontSize: 11,
        fontFamily: 'monospace',
      }}>
        <span style={{ color: currentUser ? '#00e676' : '#ff3b5c' }}>
          {currentUser ? '✅ Auth: ' + currentUser.email : '❌ Auth: Not logged in'}
        </span>
        <span style={{ color: firebaseReady ? '#00e676' : '#ffb800' }}>
          {firebaseReady ? '✅ Firebase: Connected' : '⚠️ Firebase: ' + (firebaseError || 'Connecting...')}
        </span>
        <span style={{ color: userSettings?.linkedinEmail ? '#00e676' : '#ff3b5c' }}>
          {userSettings?.linkedinEmail ? '✅ LinkedIn: ' + userSettings.linkedinEmail : '❌ LinkedIn: No credentials saved'}
        </span>
        <span style={{ color: userSettings?.searchKeywords ? '#00e676' : '#ffb800' }}>
          {userSettings?.searchKeywords ? '✅ Keywords: ' + userSettings.searchKeywords.slice(0,30) + '...' : '⚠️ Keywords: Not set'}
        </span>
        <span style={{ color: '#7a8fbb' }}>
          Stats in DB → Jobs: {stats.jobsFound ?? 0} | Applied: {stats.applied ?? 0} | Connections: {stats.connections ?? 0}
        </span>
      </div>

      {/* ── Firebase connection banner ── */}
      {!firebaseReady && (
        <div style={{
          background: firebaseError ? 'rgba(255,59,92,0.08)' : 'rgba(255,184,0,0.08)',
          border: `1px solid ${firebaseError ? 'rgba(255,59,92,0.3)' : 'rgba(255,184,0,0.3)'}`,
          borderRadius: 10, padding: '10px 18px', marginBottom: 16,
          display: 'flex', alignItems: 'center', gap: 10, fontSize: 13,
        }}>
          <span>{firebaseError ? '🔴' : '🟡'}</span>
          <span style={{ color: 'var(--text-secondary)' }}>
            {firebaseError
              ? `Firebase not connected — ${firebaseError} — showing 0s until connected.`
              : 'Connecting to Firebase…'}
          </span>
        </div>
      )}

      {/* ── Action buttons ── */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginBottom: 12 }}>
        <button
          className="btn btn-primary btn-sm"
          onClick={forceRefreshStats}
          style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}
        >
          <RefreshCw size={12} /> Refresh Stats
        </button>
        <button
          className="btn btn-secondary btn-sm"
          onClick={resetStats}
          style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}
        >
          Reset to Zero
        </button>
      </div>

      {/* ── Stats Grid (100% live from Firestore) ── */}
      <div className="stats-grid">
        {[
          { label: 'Jobs Found',     value: stats.jobsFound   ?? 0, icon: <Target size={18} />,   change: 'From your job scans',    dir: 'up',      color: 'rgba(0,200,255,0.12)',  iconColor: 'var(--accent-cyan)'   },
          { label: 'Applied',        value: stats.applied     ?? 0, icon: <Send size={18} />,      change: 'Total applications sent', dir: 'up',     color: 'rgba(0,230,118,0.12)',  iconColor: 'var(--accent-green)'  },
          { label: 'Interviews',     value: stats.interviews  ?? 0, icon: <Calendar size={18} />,  change: 'Scheduled / completed',  dir: 'up',      color: 'rgba(255,184,0,0.12)',  iconColor: 'var(--accent-amber)'  },
          { label: 'Connections',    value: stats.connections ?? 0, icon: <Users size={18} />,     change: 'LinkedIn connections',   dir: 'up',      color: 'rgba(123,63,255,0.12)', iconColor: 'var(--accent-purple)' },
          { label: 'Response Rate',  value: `${stats.responseRate ?? 0}%`, icon: <TrendingUp size={18} />, change: 'Interview / Applied', dir: 'up', color: 'rgba(0,200,255,0.12)',  iconColor: 'var(--accent-cyan)'   },
          { label: 'Avg Match Score',value: `${stats.matchScore   ?? 0}%`, icon: <Zap size={18} />,       change: 'Across all jobs',    dir: 'neutral', color: 'rgba(0,230,118,0.12)', iconColor: 'var(--accent-green)'  },
        ].map((s, i) => (
          <div key={i} className="stat-card">
            <div className="stat-icon" style={{ background: s.color, color: s.iconColor }}>{s.icon}</div>
            <div className="stat-value">{s.value}</div>
            <div className="stat-label">{s.label}</div>
            <div className={`stat-change ${s.dir}`}>
              {s.dir === 'up' && <ArrowUpRight size={11} />}
              {s.change}
            </div>
          </div>
        ))}
      </div>

      {/* Charts Row */}
      <div className="grid-2-1 mb-20">
        <div className="card">
          <div className="card-header">
            <div>
              <div className="card-title"><TrendingUp size={15} /> Weekly Activity</div>
              <div className="card-subtitle">Applications sent — last 7 days</div>
            </div>
          </div>
          <div className="card-body">
            {applications.length === 0 ? (
              <div className="empty-state" style={{ height: 200 }}>
                <div className="empty-state-icon">📊</div>
                <p className="text-secondary text-sm">No applications yet — start applying to see your chart!</p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <AreaChart data={weeklyData}>
                  <defs>
                    <linearGradient id="colorApplied" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#00e676" stopOpacity={0.15} />
                      <stop offset="95%" stopColor="#00e676" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="day" stroke="#3d5070" tick={{ fontSize: 11, fill: '#7a8fbb' }} />
                  <YAxis stroke="#3d5070" tick={{ fontSize: 11, fill: '#7a8fbb' }} allowDecimals={false} />
                  <Tooltip content={<CustomTooltip />} />
                  <Area type="monotone" dataKey="applied" stroke="#00e676" strokeWidth={2} fill="url(#colorApplied)" name="Applied" />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <div className="card-title">Application Status</div>
          </div>
          <div className="card-body flex-center flex-col gap-16">
            {applications.length === 0 ? (
              <div className="empty-state" style={{ height: 180 }}>
                <div className="empty-state-icon">🍩</div>
                <p className="text-secondary text-sm">No applications yet</p>
              </div>
            ) : (
              <>
                <ResponsiveContainer width="100%" height={150}>
                  <PieChart>
                    <Pie data={pieData} cx="50%" cy="50%" innerRadius={45} outerRadius={68} dataKey="value" strokeWidth={0}>
                      {pieData.map((entry, index) => (
                        <Cell key={index} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
                <div className="flex flex-wrap gap-8 justify-center">
                  {pieData.map((d, i) => (
                    <div key={i} className="flex items-center gap-6">
                      <div style={{ width: 8, height: 8, borderRadius: '50%', background: d.color }} />
                      <span className="text-xs text-secondary">{d.name}: <strong style={{ color: 'var(--text-primary)' }}>{d.value}</strong></span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Bottom Row */}
      <div className="grid-2">
        {/* Recent Applications */}
        <div className="card">
          <div className="card-header">
            <div className="card-title"><Send size={14} /> Recent Applications</div>
            <span className="badge badge-cyan">{applications.length} total</span>
          </div>
          <div className="card-body" style={{ padding: 0 }}>
            {recentApps.length === 0 ? (
              <div className="empty-state" style={{ padding: 32 }}>
                <div className="empty-state-icon">📋</div>
                <p className="text-secondary text-sm">No applications yet. Apply to a job to see it here.</p>
              </div>
            ) : (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Company</th>
                    <th>Role</th>
                    <th>Status</th>
                    <th>Score</th>
                  </tr>
                </thead>
                <tbody>
                  {recentApps.map(app => (
                    <tr key={app.id}>
                      <td><strong style={{ color: 'var(--text-primary)' }}>{app.company}</strong></td>
                      <td>{app.title}</td>
                      <td><span className={`badge badge-${statusColor[app.status] || 'muted'}`}>{app.status}</span></td>
                      <td className="font-mono text-cyan">{app.score ? `${app.score}%` : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Bot Activity */}
        <div className="card">
          <div className="card-header">
            <div className="card-title"><Bot size={14} /> Bot Activity</div>
            <div className="flex items-center gap-8">
              <div className={`bot-status-indicator ${botStatus}`} style={{ width: 7, height: 7 }} />
              <span className="text-xs font-mono text-secondary">{botStatus}</span>
            </div>
          </div>
          <div className="card-body" style={{ padding: '8px 20px' }}>
            {activityFeed.length === 0 ? (
              <div className="empty-state" style={{ padding: '24px 0' }}>
                <div className="empty-state-icon">🤖</div>
                <p className="text-secondary text-sm">No activity yet — run the pipeline to start!</p>
              </div>
            ) : activityFeed.map((item, i) => (
              <div key={i} className="activity-item">
                <div className="activity-icon" style={{ background: item.color }}>{item.icon}</div>
                <div className="activity-body">
                  <div className="activity-text">{item.text}</div>
                  <div className="activity-time">{item.time}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
