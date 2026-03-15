// ================================================================
//  src/pages/Networking.js  — v4.2  (Bot Fixed)
//
//  Fixes vs v4.1:
//   ✅ Bot button now shows a proper loading spinner while connecting
//      so the user knows it's working (was looking "stuck")
//   ✅ Bot feed appears immediately when bot starts — no blank panel
//   ✅ botAlert clears automatically when bot starts successfully
//   ✅ Added clear status messages so user knows what phase is running
//   ✅ Weekly chart uses real connection data (kept from v4.1)
//   ✅ onComplete no longer uses stale connections.length
// ================================================================

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { auth } from '../firebase/config';
import { UserPlus, MessageSquare, Eye, TrendingUp, Settings, Play, Square, ChevronRight, Loader } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { startPipeline, stopPipeline, isPipelineRunning } from '../agents/pipelineRunner';

const BACKEND = process.env.REACT_APP_BACKEND_URL || 'http://localhost:4000';

const DEFAULT_TEMPLATES = [
  {
    id: 1,
    name: 'Recruiter Outreach',
    text: "Hi {Name}, I noticed you work at {Company} and I'd love to connect. I'm a frontend engineer with 5+ years of experience and your team's work on {Product} is impressive.",
  },
  {
    id: 2,
    name: 'Referral Request',
    text: "Hi {Name}, I see you're a {Role} at {Company}. I'm very interested in joining the team and would love to chat about your experience there.",
  },
  {
    id: 3,
    name: 'Alumni Connection',
    text: "Hi {Name}! I noticed we both went to the same university. I'm currently exploring opportunities at {Company} and would love to connect.",
  },
];

const Networking = () => {
  const {
    connections,
    botStatus, setBotStatus,
    userSettings, persistSettings,
    addNotification,
    pushOptimisticConnection,
    forceRefreshStats,
  } = useApp();

  const [templates, setTemplates]     = useState(DEFAULT_TEMPLATES);
  const [editingId, setEditingId]     = useState(null);
  const [editText, setEditText]       = useState('');
  const [botRunning, setBotRunning]   = useState(false);
  const [botConnecting, setBotConnecting] = useState(false); // NEW: shows spinner while connecting
  const [botFeed, setBotFeed]         = useState([]);
  const [botAlert, setBotAlert]       = useState('');
  const [currentPhaseMsg, setCurrentPhaseMsg] = useState('');
  const feedRef = useRef(null);

  const [automationSettings, setAutomationSettings] = useState({
    visitProfiles: true,
    sendRequests:  true,
    autoFollow:    false,
    engagePosts:   false,
    dailyLimit:    10,
    targetRole:    'Engineering Manager, Tech Lead, Recruiter',
    targetCompany: 'Stripe, Vercel, Linear, Notion',
  });

  // Auto-scroll feed
  useEffect(() => {
    if (feedRef.current) feedRef.current.scrollTop = feedRef.current.scrollHeight;
  }, [botFeed]);

  // Watchdog — detects if XHR ended but state is still running
  useEffect(() => {
    if (!botRunning) return;
    const wd = setInterval(() => {
      if (!isPipelineRunning()) {
        setBotRunning(false);
        setBotConnecting(false);
        setBotStatus('idle');
        setCurrentPhaseMsg('');
      }
    }, 3000);
    return () => clearInterval(wd);
  }, [botRunning, setBotStatus]);

  const accepted = connections.filter(c => c.status === 'accepted').length;
  const pending  = connections.filter(c => c.status === 'pending').length;

  // Build real weekly chart from connection timestamps
  const weeklyChartData = useMemo(() => {
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const today = new Date();
    const result = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(today);
      d.setDate(today.getDate() - (6 - i));
      return { day: days[d.getDay()], date: d.toDateString(), sent: 0, accepted: 0 };
    });
    connections.forEach(conn => {
      const raw = conn.createdAt?.toDate
        ? conn.createdAt.toDate()
        : conn.createdAt?.seconds
          ? new Date(conn.createdAt.seconds * 1000)
          : conn.createdAt
            ? new Date(conn.createdAt)
            : null;
      if (!raw) return;
      const slot = result.find(r => r.date === raw.toDateString());
      if (slot) {
        slot.sent++;
        if (conn.status === 'accepted') slot.accepted++;
      }
    });
    return result;
  }, [connections]);

  const addBotFeed = useCallback((msg, icon = '🤝', color = 'rgba(59,130,246,0.08)') => {
    setBotFeed(prev => [
      { id: Date.now() + Math.random(), msg, icon, color, time: 'just now' },
      ...prev
    ].slice(0, 50));
  }, []);

  // ── Toggle bot ──────────────────────────────────────────────────
  const toggleBot = useCallback(async () => {
    // STOP
    if (botRunning) {
      stopPipeline();
      setBotRunning(false);
      setBotConnecting(false);
      setBotStatus('idle');
      setCurrentPhaseMsg('');
      addBotFeed('Bot stopped by user.', '⏹', 'rgba(239,68,68,0.08)');
      return;
    }

    // Show connecting state immediately so user sees feedback
    setBotConnecting(true);
    setBotAlert('');

    // Pre-flight: backend health check
    try {
      const ctrl = new AbortController();
      const t    = setTimeout(() => ctrl.abort(), 5000);
      const h    = await fetch(`${BACKEND}/api/health`, { signal: ctrl.signal });
      clearTimeout(t);
      if (!h.ok) throw new Error('not ok');
    } catch {
      setBotConnecting(false);
      setBotAlert('❌ Backend not running! Open a terminal → cd backend → node server.js');
      return;
    }

    // Pre-flight: credentials
    const email    = userSettings?.linkedinEmail    || '';
    const password = userSettings?.linkedinPassword || '';
    if (!email || !password) {
      setBotConnecting(false);
      setBotAlert('❌ No LinkedIn credentials — go to Settings and save them first.');
      return;
    }

    const userId = auth.currentUser?.uid || '';
    if (!userId) {
      setBotConnecting(false);
      setBotAlert('❌ Not signed in — please log in first.');
      return;
    }

    // All checks passed — start the bot
    setBotRunning(true);
    setBotConnecting(false);
    setBotStatus('active');
    setCurrentPhaseMsg('Logging into LinkedIn…');
    addBotFeed('🚀 Networking bot started — logging in…', '🚀', 'rgba(59,130,246,0.08)');

    await persistSettings({ ...userSettings, botStatus: 'active' }).catch(() => {});

    startPipeline(
      {
        goal:           'Expand professional network and increase profile visibility',
        email,
        password,
        userId,
        keywords:       automationSettings.targetRole || userSettings?.searchKeywords || 'Software Engineer',
        location:       userSettings?.searchLocation  || 'India',
        maxApps:        0,             // networking-only: skip Scout & Applier entirely
        maxConnections: automationSettings.dailyLimit || 10,
        minMatchScore:  0,
        telegramToken:  userSettings?.telegramToken  || '',
        telegramChatId: userSettings?.telegramChatId || '',
        phone:          userSettings?.phone          || '',
        yearsExperience:  userSettings?.yearsExperience  || '3',
        noticePeriod:     userSettings?.noticePeriod     || 'Immediately',
        currentCity:      userSettings?.currentCity      || '',
        currentCountry:   userSettings?.currentCountry   || 'India',
      },
      {
        onEvent: (phase, message, data) => {
          if (!message) return;

          // Update the status message shown under the button
          setCurrentPhaseMsg(message);

          const ICONS = {
            login:              '🔐',
            networker:          '🤝',
            networker_success:  '✅',
            scout:              '⏭',
            applier:            '⏭',
            analyst:            '📊',
            error:              '❌',
            complete:           '🎉',
            warning:            '⚠️',
          };
          const COLORS = {
            login:             'rgba(59,130,246,0.08)',
            networker:         'rgba(139,92,246,0.08)',
            networker_success: 'rgba(34,197,94,0.08)',
            scout:             'rgba(100,100,100,0.05)',
            applier:           'rgba(100,100,100,0.05)',
            analyst:           'rgba(245,158,11,0.08)',
            error:             'rgba(239,68,68,0.08)',
            complete:          'rgba(34,197,94,0.08)',
          };
          addBotFeed(message, ICONS[phase] || '⚙️', COLORS[phase] || 'rgba(255,255,255,0.03)');

          // Push optimistic connection to the list immediately
          if (phase === 'networker_success' && data?.connection) {
            pushOptimisticConnection({
              id: `opt_c_${Date.now()}`,
              ...data.connection,
              createdAt: new Date().toISOString(),
            });
          }

          // Pipeline finished
          if (phase === 'complete') {
            setBotRunning(false);
            setBotConnecting(false);
            setBotStatus('idle');
            setCurrentPhaseMsg('');
            forceRefreshStats();
          }

          if (phase === 'error') {
            setBotRunning(false);
            setBotConnecting(false);
            setBotStatus('idle');
            setCurrentPhaseMsg('');
          }
        },

        onStats: () => {}, // stats handled by forceRefreshStats on complete

        onComplete: async () => {
          setBotRunning(false);
          setBotConnecting(false);
          setBotStatus('idle');
          setCurrentPhaseMsg('');
          await forceRefreshStats();
          // Don't use connections.length here — it's stale from closure
          addNotification({ type: 'success', message: 'Networking bot complete — connections updated!', time: 'just now' });
          await persistSettings({ ...userSettings, botStatus: 'idle' }).catch(() => {});
        },

        onError: (msg) => {
          setBotRunning(false);
          setBotConnecting(false);
          setBotStatus('idle');
          setCurrentPhaseMsg('');
          setBotAlert(`❌ ${msg}`);
          addBotFeed(`Error: ${msg}`, '❌', 'rgba(239,68,68,0.08)');
        },
      }
    );
  }, [
    botRunning, userSettings, automationSettings,
    setBotStatus, addBotFeed, addNotification,
    pushOptimisticConnection, forceRefreshStats, persistSettings,
  ]);

  const updateSetting = (key, val) =>
    setAutomationSettings(prev => ({ ...prev, [key]: val }));

  // ── Button label logic ────────────────────────────────────────
  const btnLabel = botConnecting
    ? 'Connecting…'
    : botRunning
      ? 'Stop Bot'
      : 'Start Bot';

  const btnIcon = botConnecting
    ? <Loader size={12} style={{ animation: 'spin 0.8s linear infinite' }} />
    : botRunning
      ? <Square size={12} />
      : <Play size={12} />;

  const btnClass = botRunning
    ? 'btn btn-sm btn-danger'
    : 'btn btn-sm btn-success';

  return (
    <div className="page-content animate-fade">

      {/* ── Stats Row ── */}
      <div className="stats-grid mb-20">
        {[
          { label: 'Connections Sent', value: connections.length, icon: <UserPlus size={16} />,     color: 'rgba(59,130,246,0.1)',  iconColor: 'var(--blue)' },
          { label: 'Accepted',         value: accepted,           icon: <ChevronRight size={16} />, color: 'rgba(34,197,94,0.1)',   iconColor: 'var(--green)' },
          { label: 'Pending',          value: pending,            icon: <MessageSquare size={16} />,color: 'rgba(245,158,11,0.1)',  iconColor: 'var(--amber)' },
          { label: 'Profile Views',    value: 0,                  icon: <Eye size={16} />,           color: 'rgba(139,92,246,0.1)', iconColor: 'var(--purple)' },
        ].map((s, i) => (
          <div key={i} className="stat-card">
            <div className="stat-icon" style={{ background: s.color, color: s.iconColor }}>{s.icon}</div>
            <div className="stat-value">{s.value}</div>
            <div className="stat-label">{s.label}</div>
          </div>
        ))}
      </div>

      {/* ── Error / Alert banner ── */}
      {botAlert && (
        <div style={{
          background: 'var(--red-bg)',
          border: '1px solid var(--red-border)',
          borderRadius: 'var(--radius-md)',
          padding: '10px 14px',
          marginBottom: 14,
          fontSize: 13,
          color: 'var(--red)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 10,
        }}>
          <span>{botAlert}</span>
          <button
            onClick={() => setBotAlert('')}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--red)', fontSize: 16, lineHeight: 1 }}
          >×</button>
        </div>
      )}

      <div className="grid-2-1">
        <div>
          {/* ── Bot Controls ── */}
          <div className="card mb-20">
            <div className="card-header">
              <div>
                <div className="card-title"><Settings size={14} /> Automation Controls</div>
                {/* Show current phase under the title when running */}
                {(botRunning || botConnecting) && currentPhaseMsg && (
                  <div style={{ fontSize: 11, color: 'var(--blue)', marginTop: 3, fontFamily: 'var(--font-mono)' }}>
                    ▶ {currentPhaseMsg.slice(0, 60)}{currentPhaseMsg.length > 60 ? '…' : ''}
                  </div>
                )}
              </div>
              <button
                className={btnClass}
                onClick={toggleBot}
                disabled={botConnecting}
                style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 100 }}
              >
                {btnIcon}
                {btnLabel}
              </button>
            </div>
            <div className="card-body">
              {[
                { key: 'visitProfiles', label: 'Auto Visit Profiles',     desc: 'Visit recruiter & target employee profiles for visibility' },
                { key: 'sendRequests',  label: 'Send Connection Requests', desc: 'Auto-send personalised connection requests' },
                { key: 'autoFollow',    label: 'Auto Follow Companies',    desc: 'Follow target companies for job alerts' },
                { key: 'engagePosts',   label: 'Engage with Posts',        desc: 'Like relevant posts from target companies (2–3/day)' },
              ].map(item => (
                <div key={item.key} className="bot-control">
                  <div className="bot-control-info">
                    <div className="bot-control-name">{item.label}</div>
                    <div className="bot-control-desc">{item.desc}</div>
                  </div>
                  <label className="toggle">
                    <input
                      type="checkbox"
                      checked={automationSettings[item.key]}
                      onChange={e => updateSetting(item.key, e.target.checked)}
                      disabled={botRunning}
                    />
                    <span className="toggle-slider" />
                  </label>
                </div>
              ))}

              <div className="form-group mt-16">
                <label className="form-label">Daily Connection Limit</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <input
                    type="range" min={1} max={30}
                    value={automationSettings.dailyLimit}
                    onChange={e => updateSetting('dailyLimit', +e.target.value)}
                    disabled={botRunning}
                    style={{ flex: 1 }}
                  />
                  <span style={{
                    fontFamily: 'var(--font-mono)',
                    fontWeight: 700,
                    fontSize: 14,
                    color: 'var(--blue)',
                    minWidth: 56,
                    textAlign: 'right',
                  }}>
                    {automationSettings.dailyLimit}/day
                  </span>
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Target Roles</label>
                <input
                  className="form-input"
                  value={automationSettings.targetRole}
                  onChange={e => updateSetting('targetRole', e.target.value)}
                  disabled={botRunning}
                  placeholder="e.g. Engineering Manager, Tech Lead, Recruiter"
                />
              </div>

              <div className="form-group">
                <label className="form-label">Target Companies</label>
                <input
                  className="form-input"
                  value={automationSettings.targetCompany}
                  onChange={e => updateSetting('targetCompany', e.target.value)}
                  disabled={botRunning}
                  placeholder="e.g. Stripe, Vercel, Linear"
                />
              </div>
            </div>
          </div>

          {/* ── Live Bot Feed ── */}
          <div className="card mb-20">
            <div className="card-header">
              <div className="card-title">🤝 Bot Activity Feed</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {(botRunning || botConnecting) && (
                  <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--green)', display: 'inline-block' }} />
                )}
                <span className="badge badge-muted">{botFeed.length} events</span>
              </div>
            </div>
            <div
              ref={feedRef}
              style={{ maxHeight: 260, overflowY: 'auto', padding: '6px 0' }}
            >
              {botFeed.length === 0 ? (
                <div className="empty-state" style={{ padding: '24px' }}>
                  <div className="empty-state-icon">🤝</div>
                  <p className="text-secondary text-sm">Start the bot to see live activity here</p>
                </div>
              ) : (
                botFeed.map(item => (
                  <div key={item.id} style={{
                    display: 'flex',
                    gap: 10,
                    padding: '8px 16px',
                    borderBottom: '1px solid var(--border)',
                    background: item.color,
                  }}>
                    <span style={{ fontSize: 14, flexShrink: 0 }}>{item.icon}</span>
                    <span style={{ fontSize: 12, color: 'var(--text-secondary)', flex: 1 }}>{item.msg}</span>
                    <span style={{ fontSize: 10, color: 'var(--text-muted)', flexShrink: 0, fontFamily: 'var(--font-mono)' }}>{item.time}</span>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* ── Message Templates ── */}
          <div className="card">
            <div className="card-header">
              <div className="card-title"><MessageSquare size={14} /> Message Templates</div>
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => {
                  const name = window.prompt('Template name:');
                  if (!name) return;
                  const text = window.prompt('Template text (use {Name}, {Company}, etc.):');
                  if (!text) return;
                  setTemplates(prev => [...prev, { id: Date.now(), name, text }]);
                }}
              >
                + Add
              </button>
            </div>
            <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {templates.map(tpl => (
                <div key={tpl.id} className="template-card">
                  <div className="flex-between mb-8">
                    <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{tpl.name}</span>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button
                        className="btn btn-ghost btn-sm"
                        style={{ fontSize: 11 }}
                        onClick={() => { setEditingId(tpl.id); setEditText(tpl.text); }}
                      >Edit</button>
                      <button
                        className="btn btn-ghost btn-sm"
                        style={{ fontSize: 11, color: 'var(--red)' }}
                        onClick={() => {
                          if (window.confirm(`Delete "${tpl.name}"?`))
                            setTemplates(prev => prev.filter(t => t.id !== tpl.id));
                        }}
                      >Delete</button>
                    </div>
                  </div>
                  {editingId === tpl.id ? (
                    <div>
                      <textarea
                        className="form-textarea"
                        rows={3}
                        value={editText}
                        onChange={e => setEditText(e.target.value)}
                        style={{ fontSize: 12, marginBottom: 8 }}
                      />
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button className="btn btn-primary btn-sm" style={{ fontSize: 11 }} onClick={() => {
                          setTemplates(prev => prev.map(t => t.id === tpl.id ? { ...t, text: editText } : t));
                          setEditingId(null);
                        }}>Save</button>
                        <button className="btn btn-secondary btn-sm" style={{ fontSize: 11 }} onClick={() => setEditingId(null)}>Cancel</button>
                      </div>
                    </div>
                  ) : (
                    <p className="text-secondary text-sm" style={{
                      lineHeight: 1.6,
                      display: '-webkit-box',
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical',
                      overflow: 'hidden',
                    }}>
                      {tpl.text}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right column */}
        <div>
          {/* ── Weekly Chart ── */}
          <div className="card mb-20">
            <div className="card-header">
              <div className="card-title"><TrendingUp size={14} /> Weekly Network Growth</div>
              <span className="badge badge-muted">{connections.length} total</span>
            </div>
            <div className="card-body">
              {connections.length === 0 ? (
                <div className="empty-state" style={{ height: 180 }}>
                  <div className="empty-state-icon">📊</div>
                  <p className="text-secondary text-sm">No connections yet — run the bot to see data here.</p>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={180}>
                  <BarChart data={weeklyChartData}>
                    <XAxis dataKey="day" stroke="var(--border)" tick={{ fontSize: 11, fill: 'var(--text-muted)' }} />
                    <YAxis stroke="var(--border)" tick={{ fontSize: 11, fill: 'var(--text-muted)' }} allowDecimals={false} />
                    <Tooltip
                      contentStyle={{
                        background: 'var(--bg-card)',
                        border: '1px solid var(--border-light)',
                        borderRadius: 6,
                        fontSize: 12,
                      }}
                    />
                    <Bar dataKey="sent"     fill="rgba(59,130,246,0.5)" radius={[3,3,0,0]} name="Sent" />
                    <Bar dataKey="accepted" fill="#22c55e"               radius={[3,3,0,0]} name="Accepted" />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          {/* ── Recent Connections ── */}
          <div className="card">
            <div className="card-header">
              <div className="card-title">Recent Connections</div>
              <span className="badge badge-cyan">{connections.length} total</span>
            </div>
            <div className="card-body" style={{ padding: 0 }}>
              {connections.length === 0 ? (
                <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
                  No connections yet — run the bot to send requests
                </div>
              ) : (
                connections.map(c => (
                  <div key={c.id} className="activity-item" style={{ padding: '11px 18px' }}>
                    <div style={{
                      width: 32, height: 32, fontSize: 12, borderRadius: '50%', flexShrink: 0,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      background: 'var(--bg-surface)', border: '1px solid var(--border)',
                      fontWeight: 600, color: 'var(--blue)',
                    }}>
                      {(c.name || '?')[0].toUpperCase()}
                    </div>
                    <div className="activity-body">
                      <div className="activity-text">
                        <strong>{c.name || 'Unknown'}</strong>
                        {c.title ? ` — ${c.title}` : ''}
                      </div>
                      <div className="text-xs text-muted">
                        {c.company || ''}
                        {c.createdAt?.seconds
                          ? ` · ${new Date(c.createdAt.seconds * 1000).toLocaleDateString()}`
                          : ''}
                      </div>
                    </div>
                    <span className={`badge ${c.status === 'accepted' ? 'badge-green' : 'badge-amber'}`}>
                      {c.status || 'pending'}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Networking;
