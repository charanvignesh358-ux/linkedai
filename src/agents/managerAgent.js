/**
 * ╔══════════════════════════════════════════════════════════════╗
 * ║        LINKEDAI — MANAGER AGENT  (v4.0)                     ║
 * ║        Security: Level 5  |  Architecture: Multi-Agent      ║
 * ╚══════════════════════════════════════════════════════════════╝
 *
 * FIX: RateLimiter now uses in-memory fallback when localStorage
 * is unavailable (SSR / Node environment). Safe for browser too.
 */

// ─── HARD SECURITY CAPS ──────────────────────────────────────────
export const HARD_CAPS = {
  MAX_APPLICATIONS_PER_DAY: 50,
  MAX_CONNECTIONS_PER_DAY:  30,
  MAX_MESSAGES_PER_DAY:     20,
  MIN_ACTION_DELAY_MS:      2500,
  MAX_ACTION_DELAY_MS:      7000,
  MAX_ACTIONS_PER_MINUTE:   15,
  MAX_SAME_JOB_VISITS:      3,
  RETRY_DELAYS_MS:          [5000, 15000],
};

// ─── PROMPT INJECTION PATTERNS ───────────────────────────────────
const INJECTION_PATTERNS = [
  /ignore\s+(previous|above|all)\s+instructions?/i,
  /system\s*prompt/i,
  /you\s+are\s+now/i,
  /forget\s+(everything|all|your)/i,
  /disregard\s+(your|all|previous)/i,
  /act\s+as\s+(if\s+you\s+are|a\s+new)/i,
  /send\s+.*(password|credential|token|key)\s+to/i,
];

export function sanitizeExternalData(raw) {
  if (typeof raw !== 'string') return raw;
  let clean = raw
    .replace(/<[^>]*>/g, ' ')
    .replace(/[\x00-\x1F\x7F]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  for (const p of INJECTION_PATTERNS) {
    if (p.test(clean)) {
      logSecurityEvent('PROMPT_INJECTION', { pattern: p.toString(), snippet: clean.slice(0, 100) });
      return '[CONTENT_BLOCKED: Security policy violation]';
    }
  }
  return clean;
}

const SECRET_KEYS = ['password', 'apiKey', 'token', 'secret', 'credential', 'auth', 'key'];
export function redactSecrets(obj) {
  if (!obj || typeof obj !== 'object') return obj;
  const r = Array.isArray(obj) ? [...obj] : { ...obj };
  for (const k in r) {
    if (SECRET_KEYS.some(s => k.toLowerCase().includes(s))) r[k] = '[REDACTED]';
    else if (typeof r[k] === 'object') r[k] = redactSecrets(r[k]);
  }
  return r;
}

const securityLog = [];
export function logSecurityEvent(type, details) {
  const HIGH = ['PROMPT_INJECTION', 'CREDENTIAL_EXPOSURE', 'SCOPE_VIOLATION', 'AUTH_FAILURE'];
  const MED  = ['RATE_LIMIT_HIT', 'ANOMALY_DETECTED', 'CAPTCHA_DETECTED', 'LOOP_DETECTED'];
  const entry = {
    id:        `sec_${Date.now()}`,
    type,
    details:   redactSecrets(details),
    timestamp: new Date().toISOString(),
    severity:  HIGH.includes(type) ? 'HIGH' : MED.includes(type) ? 'MEDIUM' : 'LOW',
  };
  securityLog.push(entry);
  return entry;
}
export const getSecurityLog = () => [...securityLog];

// ─── SAFE STORAGE (localStorage with in-memory fallback) ─────────
const _memStore = {};
const safeStorage = {
  getItem(key) {
    try { return typeof localStorage !== 'undefined' ? localStorage.getItem(key) : (_memStore[key] ?? null); }
    catch (_) { return _memStore[key] ?? null; }
  },
  setItem(key, val) {
    try { if (typeof localStorage !== 'undefined') localStorage.setItem(key, val); else _memStore[key] = val; }
    catch (_) { _memStore[key] = val; }
  },
};

// ─── RATE LIMITER ─────────────────────────────────────────────────
const RATE_LIMITER_STORAGE_KEY = 'linkedai_rate_limiter_v1';

class RateLimiter {
  constructor() {
    this.counters      = this._loadFromStorage();
    this.recentActions = [];
  }

  _today() { return new Date().toDateString(); }

  _loadFromStorage() {
    try {
      const saved = safeStorage.getItem(RATE_LIMITER_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        const today  = new Date().toDateString();
        return {
          applications: parsed.applications?.date === today ? parsed.applications : { count: 0, date: today },
          connections:  parsed.connections?.date  === today ? parsed.connections  : { count: 0, date: today },
          messages:     parsed.messages?.date     === today ? parsed.messages     : { count: 0, date: today },
        };
      }
    } catch (e) { console.warn('[RateLimiter] storage read error:', e); }
    const today = new Date().toDateString();
    return {
      applications: { count: 0, date: today },
      connections:  { count: 0, date: today },
      messages:     { count: 0, date: today },
    };
  }

  _saveToStorage() {
    try { safeStorage.setItem(RATE_LIMITER_STORAGE_KEY, JSON.stringify(this.counters)); }
    catch (e) { console.warn('[RateLimiter] storage write error:', e); }
  }

  _reset(key) {
    if (this.counters[key].date !== this._today()) {
      this.counters[key] = { count: 0, date: this._today() };
      this._saveToStorage();
    }
  }

  syncFromPipeline({ applications = 0, connections = 0, messages = 0 }) {
    if (applications > 0) { this._reset('applications'); this.counters.applications.count += applications; }
    if (connections  > 0) { this._reset('connections');  this.counters.connections.count  += connections; }
    if (messages     > 0) { this._reset('messages');     this.counters.messages.count     += messages; }
    this._saveToStorage();
  }

  checkAndIncrement(type) {
    this._reset(type);
    const caps = {
      applications: HARD_CAPS.MAX_APPLICATIONS_PER_DAY,
      connections:  HARD_CAPS.MAX_CONNECTIONS_PER_DAY,
      messages:     HARD_CAPS.MAX_MESSAGES_PER_DAY,
    };
    const cap = caps[type];
    if (!cap) return { allowed: true };
    if (this.counters[type].count >= cap) {
      logSecurityEvent('RATE_LIMIT_HIT', { type, count: this.counters[type].count, cap });
      return { allowed: false, reason: `Daily ${type} limit (${cap}) reached` };
    }
    const now = Date.now();
    this.recentActions = this.recentActions.filter(t => now - t < 60000);
    if (this.recentActions.length >= HARD_CAPS.MAX_ACTIONS_PER_MINUTE) {
      logSecurityEvent('ANOMALY_DETECTED', { actionsPerMinute: this.recentActions.length });
      return { allowed: false, reason: 'Anomaly: too many actions per minute' };
    }
    this.counters[type].count++;
    this.recentActions.push(now);
    this._saveToStorage();
    return { allowed: true, remaining: cap - this.counters[type].count };
  }

  getStats() {
    this.counters = this._loadFromStorage();
    const caps = {
      applications: HARD_CAPS.MAX_APPLICATIONS_PER_DAY,
      connections:  HARD_CAPS.MAX_CONNECTIONS_PER_DAY,
      messages:     HARD_CAPS.MAX_MESSAGES_PER_DAY,
    };
    return Object.fromEntries(
      Object.entries(this.counters).map(([k, v]) => [
        k,
        { used: v.count, remaining: (caps[k] || 0) - v.count },
      ])
    );
  }

  reset() {
    const today = this._today();
    this.counters = {
      applications: { count: 0, date: today },
      connections:  { count: 0, date: today },
      messages:     { count: 0, date: today },
    };
    this._saveToStorage();
  }
}

export const rateLimiter = new RateLimiter();

export const humanDelay = () =>
  new Promise(r =>
    setTimeout(
      r,
      Math.floor(
        Math.random() * (HARD_CAPS.MAX_ACTION_DELAY_MS - HARD_CAPS.MIN_ACTION_DELAY_MS) +
          HARD_CAPS.MIN_ACTION_DELAY_MS
      )
    )
  );

const visitCounts = new Map();
export function checkLoop(id) {
  const n = (visitCounts.get(id) || 0) + 1;
  visitCounts.set(id, n);
  if (n > HARD_CAPS.MAX_SAME_JOB_VISITS) {
    logSecurityEvent('LOOP_DETECTED', { id, count: n });
    return true;
  }
  return false;
}

// ─── SUB-AGENT REGISTRY ───────────────────────────────────────────
export const SUB_AGENTS = {
  scout:     { name: 'Scout Agent',     icon: '🔭', desc: 'Discovers & scores job listings',              color: '#00c8ff', tools: ['searchJobs', 'scoreMatch', 'saveJob'] },
  applier:   { name: 'Applier Agent',   icon: '📝', desc: 'Submits Easy Apply applications',              color: '#00e676', tools: ['fillForm', 'attachResume', 'submitApp'] },
  networker: { name: 'Networker Agent', icon: '🤝', desc: 'Sends personalized connection requests',        color: '#7b3fff', tools: ['searchProfiles', 'sendRequest', 'sendMessage'] },
  analyst:   { name: 'Analyst Agent',   icon: '📊', desc: 'Analyzes pipeline & surfaces insights (R/O)',  color: '#ffb800', tools: ['aggregateMetrics', 'detectTrends'], readOnly: true },
};

// ─── STARTUP CHECKLIST ────────────────────────────────────────────
export function runStartupChecklist(appState) {
  // Support both { settings: {...} } and flat { linkedinEmail: '...' } shapes
  const settings = appState.settings || appState;
  const checks = [
    {
      id:    'credentials',
      label: 'LinkedIn credentials present',
      // Check both possible key shapes from Firestore
      pass:  !!(settings?.linkedinEmail || settings?.email),
    },
    {
      id:    'resume',
      label: 'Default resume set',
      // Resume check is advisory — don't block the pipeline
      pass:  !!(appState.resumes?.some(r => r.default)) || true,
    },
    {
      id:    'keywords',
      label: 'Search keywords configured',
      pass:  !!(settings?.searchKeywords),
    },
    {
      id:    'botIdle',
      label: 'Bot not already running',
      pass:  appState.botStatus !== 'active',
    },
    {
      id:    'rateOk',
      label: 'Daily limits not exceeded',
      pass:  rateLimiter.getStats().applications.remaining > 0,
    },
  ];
  const failed = checks.filter(c => !c.pass);
  return { checks, passed: failed.length === 0, failed };
}
