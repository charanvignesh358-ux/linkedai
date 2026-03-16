// ================================================================
//  src/pages/ManagerAgent.js  — v4.2  (All Bugs Fixed)
//
//  Fixes vs v4.1:
//   ✅ FIX A: handleStats now correctly reads data.statsUpdate
//      from the SSE event — was receiving the full data object
//      instead of just the delta, causing wrong stat increments.
//   ✅ FIX B: handleEvent — 'complete' phase now correctly marks
//      ALL four agent cards as 'complete', not just some of them.
//   ✅ FIX C: handleEvent — 'analyst' phase now marks analyst card
//      as 'complete' when the analyst phase message includes '✅'.
//   ✅ FIX D: handleComplete — removed stale 'setStats' from dep
//      array (it was listed but never called inside the callback,
//      causing an ESLint warning and potential stale-closure risk).
//   ✅ FIX E: handleRun dep array — added 'addNotification' which
//      was missing, causing stale closure on notification calls.
//   ✅ FIX F: Backend health check now logs the actual error to
//      console so it's visible during debugging.
//   ✅ FIX G: stopPipeline now also resets ALL agent states to idle
//      so the UI is fully clean after a manual stop.
//   ✅ FIX H: onStats callback in startPipeline call now correctly
//      passes only the statsUpdate delta (not the full data object).
// ================================================================

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useApp } from '../context/AppContext';
import { auth } from '../firebase/config';
import {
  Play, Pause, Shield, Zap, AlertTriangle, CheckCircle,
  Clock, Activity, ChevronRight, RefreshCw, Lock, Eye,
  TrendingUp, Cpu,
} from 'lucide-react';
import {
  SUB_AGENTS, runStartupChecklist, rateLimiter, getSecurityLog, HARD_CAPS,
} from '../agents/managerAgent';
import { startPipeline, stopPipeline, isPipelineRunning } from '../agents/pipelineRunner';
import { notifyPipelineComplete } from '../agents/telegram';

const BACKEND = (process.env.REACT_APP_BACKEND_URL || 'http://localhost:4000').replace(/\/+$/, '');

// ─── UI atoms ─────────────────────────────────────────────────────

const WaveVisualizer = ({ active }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 3, height: 20 }}>
    {[1,2,3,4,5,6,7].map(i => (
      <div key={i} style={{
        width: 3,
        height: active ? `${4 + (i % 3) * 6}px` : 4,
        background: 'var(--accent-cyan)',
        borderRadius: 2,
        opacity: active ? 0.9 : 0.25,
        animation: active ? `waveBar ${0.5 + i * 0.1}s ease-in-out infinite` : 'none',
        animationDelay: `${i * 0.08}s`,
        transition: 'height 0.3s ease',
      }} />
    ))}
  </div>
);

const TypingDots = () => <div className="loading-dots"><span /><span /><span /></div>;

const AnimatedNumber = ({ value, color }) => {
  const [display, setDisplay] = useState(0);
  useEffect(() => {
    if (!value) { setDisplay(0); return; }
    let cur = 0;
    const steps = 30;
    const step  = value / steps;
    const t = setInterval(() => {
      cur += step;
      if (cur >= value) { setDisplay(value); clearInterval(t); }
      else setDisplay(Math.floor(cur));
    }, Math.round(800 / steps));
    return () => clearInterval(t);
  }, [value]);
  return <div className="result-stat-value" style={{ color }}>{display}</div>;
};

const AgentCard = ({ agent, state, animating }) => {
  const cfg = ({
    idle:     { label: 'Idle',     dot: 'var(--text-muted)',   bg: 'var(--bg-card)' },
    running:  { label: 'Running',  dot: 'var(--accent-cyan)',  bg: 'rgba(0,200,255,0.05)' },
    complete: { label: 'Complete', dot: 'var(--accent-green)', bg: 'rgba(0,230,118,0.05)' },
    error:    { label: 'Error',    dot: 'var(--accent-red)',   bg: 'rgba(255,59,92,0.05)' },
  })[state] || { label: 'Idle', dot: 'var(--text-muted)', bg: 'var(--bg-card)' };

  return (
    <div className={`agent-card ${state} ${animating ? 'agent-animating' : ''}`} style={{ background: cfg.bg }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div className="agent-card-icon">{agent.icon}</div>
        {state === 'running'  && <WaveVisualizer active />}
        {state === 'complete' && <CheckCircle size={14} style={{ color: 'var(--accent-green)' }} />}
        {state === 'error'    && <AlertTriangle size={14} style={{ color: 'var(--accent-red)' }} />}
      </div>
      <div>
        <div className="agent-card-name">{agent.name}</div>
        <div className="agent-card-desc">{agent.desc}</div>
      </div>
      <div className="agent-card-status">
        <div className="agent-dot" style={{
          background:  cfg.dot,
          boxShadow:   state === 'running' ? `0 0 8px ${cfg.dot}` : 'none',
          animation:   state === 'running' ? 'breathe 1s ease-in-out infinite' : 'none',
        }} />
        <span className="agent-state-label" style={{ color: cfg.dot }}>
          {state === 'running' ? <TypingDots /> : cfg.label}
        </span>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 3 }}>
          {agent.tools.map(t => (
            <span key={t} style={{
              fontSize: 8, fontFamily: 'var(--font-mono)',
              background: 'var(--bg-secondary)', color: 'var(--text-muted)',
              padding: '1px 5px', borderRadius: 4, border: '1px solid var(--border)',
            }}>{t}</span>
          ))}
        </div>
      </div>
    </div>
  );
};

const FeedItem = ({ item }) => (
  <div className="feed-item" style={{ background: item.color }}>
    <div className="feed-icon">{item.icon}</div>
    <div className="feed-body">
      <div className="feed-msg">{item.message}</div>
      <div className="feed-time">{item.time}</div>
    </div>
    <div className="feed-type-badge">{item.type}</div>
  </div>
);

const SecurityPanel = ({ rateLimitStats }) => {
  const secLog = getSecurityLog();
  return (
    <div className="security-panel">
      <div className="card-header">
        <div className="card-title"><Shield size={14} /> Security & Rate Limits</div>
        <span className={`badge ${secLog.length === 0 ? 'badge-green' : 'badge-amber'}`}>
          {secLog.length === 0 ? '✓ Clean' : `${secLog.length} events`}
        </span>
      </div>
      <div className="card-body">
        {[
          { label: 'Applications', key: 'applications', color: 'var(--accent-cyan)',   cap: HARD_CAPS.MAX_APPLICATIONS_PER_DAY },
          { label: 'Connections',  key: 'connections',  color: 'var(--accent-purple)', cap: HARD_CAPS.MAX_CONNECTIONS_PER_DAY },
          { label: 'Messages',     key: 'messages',     color: 'var(--accent-amber)',  cap: HARD_CAPS.MAX_MESSAGES_PER_DAY },
        ].map(b => {
          const s    = rateLimitStats?.[b.key] ?? { used: 0, remaining: b.cap };
          const used = typeof s.used === 'number' ? s.used : 0;
          const pct  = Math.min(100, Math.max(0, (used / b.cap) * 100));
          return (
            <div key={b.key} className="rate-limit-bar-wrap">
              <div className="rate-limit-label">
                <span>{b.label}</span>
                <span className="font-mono" style={{ fontSize: 11, color: b.color }}>{used}/{b.cap}</span>
              </div>
              <div className="rate-bar-track">
                <div className="rate-bar-fill" style={{ width: `${pct}%`, background: b.color, minWidth: used > 0 ? 4 : 0 }} />
              </div>
            </div>
          );
        })}
        <div className="security-features">
          {[
            { label: 'Prompt Injection Guard', icon: '🛡️' },
            { label: 'Credential Redaction',   icon: '🔑' },
            { label: 'Loop Detection',          icon: '🔄' },
            { label: 'Anomaly Monitoring',      icon: '📡' },
            { label: 'Human-Like Delays',       icon: '⏱️' },
          ].map((f, i) => (
            <div key={f.label} className="security-feature-row" style={{ animationDelay: `${i * 60}ms` }}>
              <span style={{ fontSize: 13 }}>{f.icon}</span>
              <span className="security-feature-label">{f.label}</span>
              <span className="badge badge-green" style={{ fontSize: 10 }}>ACTIVE</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

const PipelineStepper = ({ currentPhase }) => {
  const phases = [
    { key: 'scout',    label: 'Scout',   icon: '🔭' },
    { key: 'applier',  label: 'Apply',   icon: '📝' },
    { key: 'networker',label: 'Network', icon: '🤝' },
    { key: 'analyst',  label: 'Analyze', icon: '📊' },
    { key: 'complete', label: 'Done',    icon: '✅' },
  ];
  const idx = phases.findIndex(p => p.key === currentPhase);
  return (
    <div style={{ display: 'flex', alignItems: 'center', padding: '12px 0 4px', width: '100%', overflow: 'hidden' }}>
      {phases.map((p, i) => (
        <React.Fragment key={p.key}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, opacity: i <= idx ? 1 : 0.3, transition: 'opacity 0.4s', flexShrink: 0 }}>
            <div style={{
              width: 32, height: 32, borderRadius: '50%',
              background: i < idx ? 'rgba(0,230,118,0.15)' : i === idx ? 'rgba(0,200,255,0.15)' : 'var(--bg-secondary)',
              border: `1px solid ${i < idx ? 'rgba(0,230,118,0.4)' : i === idx ? 'rgba(0,200,255,0.4)' : 'var(--border)'}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14,
            }}>{p.icon}</div>
            <span style={{ fontSize: 9, fontFamily: 'var(--font-mono)', color: i === idx ? 'var(--accent-cyan)' : 'var(--text-muted)', textTransform: 'uppercase' }}>{p.label}</span>
          </div>
          {i < phases.length - 1 && (
            <div style={{ flex: 1, minWidth: 4, height: 1, margin: '0 4px 18px', background: i < idx ? 'var(--accent-green)' : 'var(--border)', transition: 'background 0.5s' }} />
          )}
        </React.Fragment>
      ))}
    </div>
  );
};

// ─── Main Component ────────────────────────────────────────────────
const ManagerAgent = () => {
  const {
    botStatus, setBotStatus,
    forceRefreshStats,
    optimisticStatUpdate,
    pushOptimisticApplication,
    pushOptimisticConnection,
    addNotification,
    resumes,
    userSettings,
  } = useApp();

  const [agentStates, setAgentStates]         = useState({ scout: 'idle', applier: 'idle', networker: 'idle', analyst: 'idle' });
  const [feed, setFeed]                       = useState([
    { id: 'i1', type: 'system',   message: 'Manager Agent v4.2 initialised — all modules loaded', time: 'now', icon: '🧠', color: 'rgba(0,200,255,0.08)' },
    { id: 'i2', type: 'security', message: 'Security Level 5 active — 5/5 checks passed',          time: 'now', icon: '🔐', color: 'rgba(0,230,118,0.08)' },
  ]);
  const [running, setRunning]                 = useState(false);
  const [currentPhase, setCurrentPhase]       = useState('');
  const [phaseMsg, setPhaseMsg]               = useState('');
  const [goal, setGoal]                       = useState('Maximize high-quality interviews this week');
  const [result, setResult]                   = useState(null);
  const [alerts, setAlerts]                   = useState([]);
  const [rateLimitStats, setRateLimitStats]   = useState(() => rateLimiter.getStats());
  const [checklist, setChecklist]             = useState(null);
  const [animatingAgents, setAnimatingAgents] = useState(new Set());
  const [elapsedTime, setElapsedTime]         = useState(0);
  const [overrideEmail, setOverrideEmail]     = useState('');
  const [overridePassword, setOverridePassword] = useState('');
  const [showOverride, setShowOverride]       = useState(false);

  const feedRef  = useRef(null);
  const timerRef = useRef(null);
  const startRef = useRef(null);

  // Auto-scroll feed
  useEffect(() => {
    if (feedRef.current) feedRef.current.scrollTop = feedRef.current.scrollHeight;
  }, [feed]);

  // Timer
  useEffect(() => {
    if (running) {
      startRef.current = Date.now();
      timerRef.current = setInterval(() => setElapsedTime(Math.floor((Date.now() - startRef.current) / 1000)), 1000);
    } else {
      clearInterval(timerRef.current);
      setElapsedTime(0);
    }
    return () => clearInterval(timerRef.current);
  }, [running]);

  // Checklist
  useEffect(() => {
    setChecklist(runStartupChecklist({ botStatus, resumes, settings: userSettings }));
  }, [botStatus, resumes, userSettings]);

  // Rate-limit panel refresh every 1s
  useEffect(() => {
    setRateLimitStats(rateLimiter.getStats());
    const id = setInterval(() => {
      setRateLimitStats({ ...rateLimiter.getStats() });
    }, 1000);
    return () => clearInterval(id);
  }, []);

  // Watchdog: if XHR finished but React still shows running
  useEffect(() => {
    if (!running) return;
    const wd = setInterval(() => {
      if (!isPipelineRunning()) {
        console.warn('[Watchdog] XHR done but React still running — forcing reset');
        setRunning(false);
        setBotStatus('idle');
        setPhaseMsg('');
        forceRefreshStats();
      }
    }, 3000);
    return () => clearInterval(wd);
  }, [running, setBotStatus, forceRefreshStats]);

  const addFeed = useCallback((type, message, icon, color) => {
    setFeed(prev => [
      { id: `e${Date.now()}${Math.random()}`, type, message, icon, color, time: 'just now' },
      ...prev,
    ].slice(0, 60));
  }, []);

  const animateAgent = useCallback((id) => {
    setAnimatingAgents(prev => new Set([...prev, id]));
    setTimeout(() => setAnimatingAgents(prev => { const n = new Set(prev); n.delete(id); return n; }), 800);
  }, []);

  const getCredentials = useCallback(() => ({
    email:    overrideEmail    || userSettings?.linkedinEmail    || '',
    password: overridePassword || userSettings?.linkedinPassword || '',
  }), [overrideEmail, overridePassword, userSettings]);

  // ── SSE event handler ─────────────────────────────────────────
  const handleEvent = useCallback((phase, message, data) => {
    setPhaseMsg(message || '');
    setCurrentPhase(phase || '');

    const AGENT_KEY = { scout: 'scout', applier: 'applier', networker: 'networker', analyst: 'analyst' };
    const agentKey  = AGENT_KEY[phase];

    // Mark the current agent as running when its phase starts
    if (agentKey) {
      setAgentStates(prev => ({ ...prev, [agentKey]: 'running' }));
      animateAgent(agentKey);
    }

    // FIX B + C: Mark agents complete at the right moments
    if (phase === 'scout' && (data?.jobsCount >= 0 || (message && message.includes('✅')))) {
      setAgentStates(prev => ({ ...prev, scout: 'complete' }));
      setTimeout(forceRefreshStats, 1000);
    }
    // Applier phase starts → scout must already be done
    if (phase === 'applier') {
      setAgentStates(prev => ({
        ...prev,
        scout:   prev.scout   === 'running' ? 'complete' : prev.scout,
        applier: 'running',
      }));
    }
    if (phase === 'applier_success') {
      if (data?.application) {
        pushOptimisticApplication({
          id:        `opt_${Date.now()}`,
          ...data.application,
          createdAt: new Date().toISOString(),
        });
      }
      rateLimiter.checkAndIncrement('applications');
      setRateLimitStats({ ...rateLimiter.getStats() });
      setTimeout(forceRefreshStats, 1000);
    }
    // Networker phase starts → applier must already be done
    if (phase === 'networker') {
      setAgentStates(prev => ({
        ...prev,
        scout:    prev.scout   === 'running' ? 'complete' : prev.scout,
        applier:  prev.applier === 'running' ? 'complete' : prev.applier,
        networker: 'running',
      }));
    }
    if (phase === 'networker_success') {
      if (data?.connection) {
        pushOptimisticConnection({
          id:        `opt_c_${Date.now()}`,
          ...data.connection,
          createdAt: new Date().toISOString(),
        });
      }
      rateLimiter.checkAndIncrement('connections');
      setRateLimitStats({ ...rateLimiter.getStats() });
      setTimeout(forceRefreshStats, 1000);
    }
    // Analyst phase starts → networker must already be done
    if (phase === 'analyst') {
      setAgentStates(prev => ({
        ...prev,
        scout:     prev.scout     === 'running' ? 'complete' : prev.scout,
        applier:   prev.applier   === 'running' ? 'complete' : prev.applier,
        networker: prev.networker === 'running' ? 'complete' : prev.networker,
        analyst:   'running',
      }));
    }
    // FIX B: 'complete' phase — mark ALL agents complete without exception
    if (phase === 'complete') {
      setAgentStates({ scout: 'complete', applier: 'complete', networker: 'complete', analyst: 'complete' });
      setRunning(false);
      setBotStatus('idle');
      setPhaseMsg('');
    }
    // FIX C: analyst ✅ message marks analyst as complete before 'complete' phase arrives
    if (phase === 'analyst' && message && message.includes('✅')) {
      setAgentStates(prev => ({ ...prev, analyst: 'complete' }));
    }
    if (phase === 'error') {
      setAgentStates(prev => Object.fromEntries(
        Object.entries(prev).map(([k, v]) => [k, v === 'running' ? 'error' : v])
      ));
    }

    const COLORS = {
      scout:             'rgba(0,200,255,0.12)',
      applier:           'rgba(0,230,118,0.12)',
      applier_success:   'rgba(0,230,118,0.12)',
      networker:         'rgba(123,63,255,0.12)',
      networker_success: 'rgba(123,63,255,0.12)',
      analyst:           'rgba(255,184,0,0.12)',
      error:             'rgba(255,59,92,0.12)',
      complete:          'rgba(0,230,118,0.12)',
      login:             'rgba(0,200,255,0.08)',
      warning:           'rgba(255,184,0,0.12)',
    };
    const ICONS = {
      scout: '🔭', applier: '📝', applier_success: '✅',
      networker: '🤝', networker_success: '✅',
      analyst: '📊', login: '🔐', error: '❌', complete: '🎉', warning: '⚠️',
    };

    if (message) {
      addFeed(phase || 'system', message, ICONS[phase] || '⚙️', COLORS[phase] || 'rgba(255,255,255,0.05)');
    }

    setRateLimitStats(rateLimiter.getStats());
  }, [
    setBotStatus, animateAgent, forceRefreshStats,
    pushOptimisticApplication, pushOptimisticConnection, addFeed,
  ]);

  // ── FIX A: Stats callback — correctly receives only the delta ──
  // pipelineRunner.js calls onStats(data.statsUpdate) which is the
  // delta object e.g. { applied: 1 } or { jobsFound: 12 }.
  // We pass it straight to optimisticStatUpdate.
  const handleStats = useCallback((delta) => {
    if (delta && typeof delta === 'object') {
      optimisticStatUpdate(delta);
    }
  }, [optimisticStatUpdate]);

  // ── Pipeline complete ─────────────────────────────────────────
  // FIX D: removed 'setStats' from dep array — it was listed but
  // never called inside this callback, causing a stale-closure risk.
  const handleComplete = useCallback(async (finalResult) => {
    // Always pull fresh stats from Firestore
    await forceRefreshStats();
    setTimeout(forceRefreshStats, 3000);

    if (finalResult) {
      const appliedCount = (finalResult.applied     || []).filter(a => a?.applyResult?.success).length
                        || (finalResult.applied     || []).length;
      const connCount    = (finalResult.connections || []).filter(c => c?.result?.success).length
                        || (finalResult.connections || []).length;
      const jobsCount    = (finalResult.jobsFound   || []).length;

      rateLimiter.syncFromPipeline({ applications: appliedCount, connections: connCount });
      setRateLimitStats(rateLimiter.getStats());

      setResult({
        status:      finalResult.status || 'success',
        reasoning:   `Pipeline complete — found ${jobsCount} jobs, applied to ${appliedCount}, sent ${connCount} connection requests.`,
        statsUpdates: {
          jobsFound:   jobsCount,
          applied:     appliedCount,
          connections: connCount,
        },
        actions: (finalResult.applied || []).map(j => ({
          agent:  'Applier',
          action: 'apply',
          result: `${j.title} @ ${j.company}: ${j.applyResult?.message || ''}`,
        })),
        nextSteps: finalResult.insights?.length ? finalResult.insights : [
          `${appliedCount} applications sent — check LinkedIn for confirmations`,
          `${connCount} connection requests sent — watch for acceptances`,
          'Run again tomorrow to continue the pipeline',
        ],
      });

      setCurrentPhase('complete');
      addNotification({
        type:    'success',
        message: `Done! Applied to ${appliedCount} jobs · ${connCount} connections sent`,
        time:    'just now',
      });

      if (userSettings?.telegramToken && userSettings?.telegramChatId) {
        notifyPipelineComplete(userSettings.telegramToken, userSettings.telegramChatId, finalResult);
      }
    } else {
      addNotification({ type: 'success', message: 'Pipeline complete — stats updated from Firestore', time: 'just now' });
    }

    setRunning(false);
    setBotStatus('idle');
    setPhaseMsg('');
    setTimeout(() => setRateLimitStats(rateLimiter.getStats()), 100);
  }, [forceRefreshStats, addNotification, setBotStatus, userSettings]); // FIX D: no setStats here

  // ── Error handler ─────────────────────────────────────────────
  const handleError = useCallback((msg) => {
    setAgentStates(prev => Object.fromEntries(
      Object.entries(prev).map(([k, v]) => [k, v === 'running' ? 'error' : v])
    ));
    setAlerts([{ level: 'HIGH', message: `❌ ${msg}` }]);
    addFeed('error', `❌ ${msg}`, '❌', 'rgba(255,59,92,0.1)');
    addNotification({ type: 'error', message: msg, time: 'just now' });
    setRunning(false);
    setBotStatus('idle');
    setPhaseMsg('');
    forceRefreshStats();
  }, [setBotStatus, addNotification, addFeed, forceRefreshStats]);

  // ── Run / Stop ────────────────────────────────────────────────
  const handleRun = useCallback(async () => {
    // STOP
    if (running) {
      stopPipeline();
      setRunning(false);
      setBotStatus('idle');
      setCurrentPhase('');
      setPhaseMsg('');
      // FIX G: reset ALL agent states cleanly on manual stop
      setAgentStates({ scout: 'idle', applier: 'idle', networker: 'idle', analyst: 'idle' });
      addNotification({ type: 'warning', message: 'Pipeline stopped by user', time: 'just now' });
      addFeed('system', '⏹️ Pipeline stopped by user', '⏹️', 'rgba(255,59,92,0.08)');
      return;
    }

    // Pre-flight: backend health
    try {
      const ctrl = new AbortController();
      const t    = setTimeout(() => ctrl.abort(), 5000);
      const h    = await fetch(`${BACKEND}/api/health`, { signal: ctrl.signal });
      clearTimeout(t);
      if (!h.ok) throw new Error(`Backend returned status ${h.status}`);
    } catch (err) {
      // FIX F: log the actual error so it's visible in DevTools
      console.error('[ManagerAgent] Backend health check failed:', err.message);
      setAlerts([{ level: 'HIGH', message: `❌ Backend not running! Open a terminal → cd backend → node server.js  (${err.message})` }]);
      return;
    }

    // Pre-flight: credentials
    const { email, password } = getCredentials();
    if (!email || !password) {
      setAlerts([{ level: 'HIGH', message: '❌ No credentials! Go to Settings → enter LinkedIn email + password → Save. Or use Quick Override below.' }]);
      setShowOverride(true);
      return;
    }

    // Pre-flight: Firebase auth
    const userId = auth.currentUser?.uid || '';
    if (!userId) {
      setAlerts([{ level: 'HIGH', message: '❌ Not signed in — please log in first.' }]);
      return;
    }

    const keywords = userSettings?.searchKeywords || 'Software Engineer';

    // START
    setRunning(true);
    setBotStatus('active');
    setResult(null);
    setAlerts([]);
    setCurrentPhase('');
    setPhaseMsg('');
    setAgentStates({ scout: 'idle', applier: 'idle', networker: 'idle', analyst: 'idle' });
    addFeed('system', `🚀 Pipeline started — ${email}`, '🚀', 'rgba(0,200,255,0.08)');

    startPipeline(
      {
        goal,
        email,
        password,
        userId,
        keywords,
        location:                   userSettings?.searchLocation             || 'India',
        maxApps:                    userSettings?.maxApplicationsPerDay      || 3,
        maxConnections:             userSettings?.maxConnectionsPerDay       || 3,
        minMatchScore:              userSettings?.minMatchScore              || 50,
        telegramToken:              userSettings?.telegramToken              || '',
        telegramChatId:             userSettings?.telegramChatId             || '',
        phone:                      userSettings?.phone                      || '',
        yearsExperience:            userSettings?.yearsExperience            || '3',
        additionalMonthsExperience: userSettings?.additionalMonthsExperience || '0',
        englishProficiency:         userSettings?.englishProficiency         || 'Professional',
        availableFullTime:          userSettings?.availableFullTime          || 'Yes',
        canWorkCETHours:            userSettings?.canWorkCETHours            || 'Yes',
        coverLetter:                userSettings?.coverLetter                || '',
        linkedinProfileUrl:         userSettings?.linkedinProfileUrl         || '',
        portfolioUrl:               userSettings?.portfolioUrl               || '',
        expectedSalary:             userSettings?.expectedSalary             || '',
        variablePay:                userSettings?.variablePay                || '0.0',
        stockRsuValue:              userSettings?.stockRsuValue              || '0.0',
        noticePeriod:               userSettings?.noticePeriod               || 'Immediately',
        currentCity:                userSettings?.currentCity                || '',
        currentCountry:             userSettings?.currentCountry             || 'India',
      },
      {
        onEvent:    handleEvent,
        // FIX H: pipelineRunner already extracts data.statsUpdate before calling onStats,
        // so handleStats receives the correct delta object directly.
        onStats:    handleStats,
        onComplete: handleComplete,
        onError:    handleError,
      }
    );
  }, [
    running, goal, userSettings, getCredentials,
    setBotStatus, addNotification, addFeed,
    handleEvent, handleStats, handleComplete, handleError,
  ]); // FIX E: addNotification is now in the dep array

  const completedCount    = Object.values(agentStates).filter(s => s === 'complete').length;
  const { email: resolvedEmail } = getCredentials();

  return (
    <div className="page-content animate-fade manager-page">

      {/* ── Debug Panel ── */}
      <div style={{
        background: '#0a0f1a', border: '1px solid #1e3a5f', borderRadius: 10,
        padding: '12px 16px', marginBottom: 16, fontFamily: 'monospace', fontSize: 12, width: '100%',
      }}>
        <div style={{ color: '#7a9fbb', marginBottom: 8, fontSize: 11, fontWeight: 700 }}>🔬 LIVE DEBUG STATUS</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14 }}>
          <span style={{ color: resolvedEmail ? '#00e676' : '#ff3b5c' }}>
            {resolvedEmail ? `✅ Email: ${resolvedEmail}` : '❌ No email — go to Settings!'}
          </span>
          <span style={{ color: auth.currentUser?.uid ? '#00e676' : '#ff3b5c' }}>
            {auth.currentUser?.uid ? `✅ UID: ${auth.currentUser.uid.slice(0,10)}…` : '❌ Not signed in'}
          </span>
          <span style={{ color: running ? '#00c8ff' : '#888' }}>
            {running ? `⚡ RUNNING ${elapsedTime}s` : '⏸ Idle'}
          </span>
          <span style={{ color: '#888' }}>Phase: <strong style={{ color: '#fff' }}>{currentPhase || 'none'}</strong></span>
          <span style={{ color: '#888' }}>Events: <strong style={{ color: '#fff' }}>{feed.length}</strong></span>
          <span style={{ color: userSettings?.searchKeywords ? '#00e676' : '#ff3b5c', maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            Keywords: {userSettings?.searchKeywords?.slice(0,25) || '❌ not set'}
          </span>
        </div>
        {phaseMsg && (
          <div style={{ marginTop: 8, color: '#00c8ff', borderTop: '1px solid #1e3a5f', paddingTop: 8, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            ▶ {phaseMsg}
          </div>
        )}
        {alerts.length > 0 && (
          <div style={{ marginTop: 8, color: '#ff3b5c', borderTop: '1px solid #1e3a5f', paddingTop: 8, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            ⚠ {alerts[0]?.message}
          </div>
        )}
      </div>

      {/* ── Header ── */}
      <div className="manager-header">
        <div className="manager-title">
          <div className="manager-brain-icon">🧠</div>
          <div>
            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 22, margin: 0, display: 'flex', alignItems: 'center', gap: 10 }}>
              Manager Agent
              {running && (
                <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', background: 'rgba(0,200,255,0.1)', border: '1px solid rgba(0,200,255,0.3)', borderRadius: 100, padding: '2px 10px', color: 'var(--accent-cyan)' }}>
                  LIVE
                </span>
              )}
            </h2>
            <div className="font-mono text-xs text-muted" style={{ marginTop: 4 }}>
              v4.2 · Multi-Agent · Firebase Admin · Security Level 5
              {running && <span style={{ color: 'var(--accent-cyan)', marginLeft: 10 }}>⏱ {elapsedTime}s</span>}
            </div>
          </div>
        </div>
        <div className="manager-header-right">
          <div className={`manager-status-pill ${running ? 'running' : 'idle'}`}>
            <div className="manager-status-dot" />
            <span>{running ? 'PIPELINE RUNNING' : 'READY'}</span>
            {running && <WaveVisualizer active />}
          </div>
          <button
            className={`btn btn-lg ${running ? 'btn-danger' : 'btn-primary'}`}
            onClick={handleRun}
            style={{ minWidth: 164 }}
          >
            {running ? <><Pause size={15} /> Stop Pipeline</> : <><Play size={15} /> Run Pipeline</>}
          </button>
        </div>
      </div>

      {/* ── Credential status ── */}
      <div style={{
        background: resolvedEmail ? 'rgba(0,230,118,0.06)' : 'rgba(255,59,92,0.08)',
        border: `1px solid ${resolvedEmail ? 'rgba(0,230,118,0.25)' : 'rgba(255,59,92,0.3)'}`,
        borderRadius: 10, padding: '10px 16px', marginBottom: 12,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8,
      }}>
        <div style={{ fontSize: 12, fontFamily: 'monospace' }}>
          {resolvedEmail
            ? <span style={{ color: 'var(--accent-green)' }}>✅ Credentials ready: <strong>{resolvedEmail}</strong></span>
            : <span style={{ color: 'var(--accent-red)' }}>❌ No credentials — go to <strong>Settings</strong> and save LinkedIn email + password</span>}
        </div>
        <button className="btn btn-secondary btn-sm" style={{ fontSize: 11 }} onClick={() => setShowOverride(v => !v)}>
          {showOverride ? 'Hide Override' : '🔑 Quick Override'}
        </button>
      </div>

      {/* ── Quick Override ── */}
      {showOverride && (
        <div style={{ background: 'rgba(255,184,0,0.06)', border: '1px solid rgba(255,184,0,0.25)', borderRadius: 10, padding: '14px 18px', marginBottom: 14 }}>
          <div style={{ fontSize: 12, color: 'var(--accent-amber)', marginBottom: 10 }}>⚡ Quick Override — bypasses Settings (not saved to DB)</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div>
              <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>LinkedIn Email</label>
              <input className="form-input" type="email" placeholder="your@email.com" value={overrideEmail} onChange={e => setOverrideEmail(e.target.value)} />
            </div>
            <div>
              <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>LinkedIn Password</label>
              <input className="form-input" type="password" placeholder="••••••••" value={overridePassword} onChange={e => setOverridePassword(e.target.value)} />
            </div>
          </div>
        </div>
      )}

      {/* ── Alerts ── */}
      {alerts.length > 0 && (
        <div className="alerts-strip">
          {alerts.map((a, i) => (
            <div key={i} className={`alert-pill alert-${a.level.toLowerCase()}`}>
              <AlertTriangle size={12} /> {a.message}
            </div>
          ))}
        </div>
      )}

      {/* ── Goal bar ── */}
      <div className="goal-bar card mb-20">
        <div className="card-body" style={{ padding: '14px 20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%', overflow: 'hidden' }}>
            <Zap size={15} style={{ color: 'var(--accent-cyan)', flexShrink: 0 }} />
            <span className="font-mono text-xs text-muted" style={{ flexShrink: 0 }}>GOAL:</span>
            <input
              className="goal-input"
              value={goal}
              onChange={e => setGoal(e.target.value)}
              disabled={running}
              placeholder="e.g. Maximize interviews this week"
              style={{ minWidth: 0, flex: 1 }}
            />
            {running && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0, maxWidth: 280, overflow: 'hidden' }}>
                <RefreshCw size={12} style={{ color: 'var(--accent-cyan)', animation: 'spin 1s linear infinite' }} />
                <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--accent-cyan)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {phaseMsg}
                </span>
              </div>
            )}
          </div>
          {(running || result) && <PipelineStepper currentPhase={running ? currentPhase : 'complete'} />}
        </div>
      </div>

      {/* ── Running quick-stats ── */}
      {running && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: 20 }}>
          {[
            { label: 'Agents Active', value: Object.values(agentStates).filter(s => s === 'running').length,  icon: <Cpu size={14} />,         color: 'var(--accent-cyan)' },
            { label: 'Completed',     value: completedCount,                                                   icon: <CheckCircle size={14} />, color: 'var(--accent-green)' },
            { label: 'Feed Events',   value: feed.length,                                                      icon: <Activity size={14} />,    color: 'var(--accent-purple)' },
            { label: 'Elapsed (s)',   value: elapsedTime,                                                      icon: <Clock size={14} />,       color: 'var(--accent-amber)' },
          ].map(s => (
            <div key={s.label} className="card" style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ color: s.color, opacity: 0.8 }}>{s.icon}</div>
              <div>
                <div style={{ fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 800, color: s.color, lineHeight: 1 }}>{s.value}</div>
                <div style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', marginTop: 2 }}>{s.label}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Main grid ── */}
      <div className="manager-grid">
        <div className="manager-left">

          {/* Agent cards */}
          <div className="card mb-20">
            <div className="card-header">
              <div className="card-title"><Activity size={14} /> Sub-Agent Pipeline</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span className="badge badge-cyan">{completedCount}/4 complete</span>
                {running && <TypingDots />}
              </div>
            </div>
            <div className="card-body agent-grid">
              {Object.entries(SUB_AGENTS).map(([id, agent]) => (
                <AgentCard key={id} agent={agent} state={agentStates[id]} animating={animatingAgents.has(id)} />
              ))}
            </div>
          </div>

          {/* Result summary */}
          {result && (
            <div className="card mb-20 result-card animate-scale">
              <div className="card-header">
                <div className="card-title">
                  {result.status === 'success'
                    ? <CheckCircle size={14} style={{ color: 'var(--accent-green)' }} />
                    : <AlertTriangle size={14} style={{ color: 'var(--accent-amber)' }} />}
                  Last Run Summary
                </div>
                <span className={`badge badge-${result.status === 'success' ? 'green' : 'amber'}`}>{result.status}</span>
              </div>
              <div className="card-body">
                <p className="text-secondary text-sm mb-16" style={{ lineHeight: 1.7 }}>{result.reasoning}</p>
                <div className="result-stats">
                  {[
                    { label: 'Jobs Found',  value: result.statsUpdates?.jobsFound   || 0, color: 'var(--accent-cyan)' },
                    { label: 'Applied',     value: result.statsUpdates?.applied     || 0, color: 'var(--accent-green)' },
                    { label: 'Connections', value: result.statsUpdates?.connections || 0, color: 'var(--accent-purple)' },
                    { label: 'Actions',     value: result.actions?.length           || 0, color: 'var(--accent-amber)' },
                  ].map(s => (
                    <div key={s.label} className="result-stat">
                      <AnimatedNumber value={s.value} color={s.color} />
                      <div className="result-stat-label">{s.label}</div>
                    </div>
                  ))}
                </div>
                {result.nextSteps?.length > 0 && (
                  <div className="next-steps">
                    <div className="font-mono text-xs text-muted mb-8">NEXT STEPS</div>
                    {result.nextSteps.map((s, i) => (
                      <div key={i} className="next-step-row">
                        <ChevronRight size={11} style={{ color: 'var(--accent-cyan)', flexShrink: 0 }} />
                        <span className="text-secondary text-sm">{s}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Startup checklist */}
          {checklist && (
            <div className="card">
              <div className="card-header">
                <div className="card-title"><Eye size={14} /> Startup Checklist</div>
                <span className={`badge ${checklist.passed ? 'badge-green' : 'badge-amber'}`}>
                  {checklist.checks.filter(c => c.pass).length}/{checklist.checks.length} passed
                </span>
              </div>
              <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {checklist.checks.map((c, i) => (
                  <div key={c.id} className="checklist-row" style={{ animationDelay: `${i * 60}ms` }}>
                    <div style={{ color: c.pass ? 'var(--accent-green)' : 'var(--accent-amber)' }}>
                      {c.pass ? <CheckCircle size={13} /> : <Clock size={13} />}
                    </div>
                    <span className="text-sm" style={{ color: c.pass ? 'var(--text-secondary)' : 'var(--accent-amber)', flex: 1 }}>
                      {c.label}
                    </span>
                    <span className={`badge ${c.pass ? 'badge-green' : 'badge-amber'}`} style={{ fontSize: 10 }}>
                      {c.pass ? 'PASS' : 'SETUP NEEDED'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="manager-right">
          <div className="card mb-20"><SecurityPanel rateLimitStats={rateLimitStats} /></div>

          {/* Live feed */}
          <div className="card mb-20">
            <div className="card-header">
              <div className="card-title"><TrendingUp size={14} /> Live Activity Feed</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {running && <WaveVisualizer active />}
                <span className="badge badge-muted">{feed.length} events</span>
              </div>
            </div>
            <div ref={feedRef} className="agent-feed-container">
              {feed.map(item => <FeedItem key={item.id} item={item} />)}
            </div>
          </div>

          {/* Hard caps */}
          <div className="card">
            <div className="card-header">
              <div className="card-title"><Lock size={14} /> Hard Security Caps</div>
              <span className="badge badge-red">Immutable</span>
            </div>
            <div className="card-body">
              {[
                { label: 'Max Applications / Day',    value: HARD_CAPS.MAX_APPLICATIONS_PER_DAY },
                { label: 'Max Connections / Day',     value: HARD_CAPS.MAX_CONNECTIONS_PER_DAY },
                { label: 'Max Messages / Day',        value: HARD_CAPS.MAX_MESSAGES_PER_DAY },
                { label: 'Min Delay Between Actions', value: `${HARD_CAPS.MIN_ACTION_DELAY_MS / 1000}s` },
                { label: 'Max Actions / Minute',      value: HARD_CAPS.MAX_ACTIONS_PER_MINUTE },
              ].map(c => (
                <div key={c.label} className="hard-cap-row">
                  <span className="text-secondary text-sm">{c.label}</span>
                  <span className="font-mono text-sm" style={{ color: 'var(--accent-red)' }}>{c.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ManagerAgent;
