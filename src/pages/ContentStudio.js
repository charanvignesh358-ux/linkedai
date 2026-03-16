// ================================================================
//  ContentStudio.js — Real LinkedIn Content Engine
//  Connects to backend /api/content/* which uses Playwright
//  to scrape real data from your LinkedIn account.
// ================================================================

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import {
  Wand2, Calendar, BarChart2, MessageSquare, Users,
  Zap, Copy, Send, Clock, TrendingUp, Eye, Heart,
  Repeat2, Play, CheckCircle,
  ChevronRight, RefreshCw, Sparkles, Target,
  PenTool, Hash, ArrowUpRight, Star, Filter, Plus,
  Download, Loader, Wifi, WifiOff, ExternalLink,
  X, AlertTriangle, RotateCcw, ImagePlus, Video, Upload
} from 'lucide-react';

// ── Cloudinary config (reuse from Resumes) ────────────────────────
const CLOUDINARY_CLOUD_NAME = 'dp995t0rs';
const CLOUDINARY_UPLOAD_PRESET = 'sjktua8o';

const GROQ_KEY = process.env.REACT_APP_GROQ_KEY || '';
const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';
const MODEL    = 'llama-3.3-70b-versatile';
const BACKEND = (process.env.REACT_APP_BACKEND_URL || 'http://localhost:4000').replace(/\/+$/, '');

async function groq(system, user, maxTokens = 800) {
  const res = await fetch(GROQ_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${GROQ_KEY}` },
    body: JSON.stringify({
      model: MODEL, max_tokens: maxTokens, temperature: 0.75,
      messages: [{ role: 'system', content: system }, { role: 'user', content: user }],
    }),
  });
  const data = await res.json();
  return data.choices?.[0]?.message?.content?.trim() || '';
}

// ── SSE Stream helper ─────────────────────────────────────────────
function streamSSE(url, body, onEvent, onDone) {
  const controller = new AbortController();

  fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: controller.signal,
  }).then(async (res) => {
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
      onEvent({ phase: 'error', message: `❌ ${err.error || 'Backend error'}` });
      onDone();
      return;
    }
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop();
      for (const line of lines) {
        if (line.startsWith('data: ')) {
          try {
            const payload = JSON.parse(line.slice(6));
            onEvent(payload);
          } catch (_) {}
        }
      }
    }
    onDone();
  }).catch(err => {
    if (err.name !== 'AbortError') {
      onEvent({ phase: 'error', message: `❌ Cannot reach backend — is it running? (${err.message})` });
      onDone();
    }
  });

  return controller;
}

// ── POST TONE OPTIONS ─────────────────────────────────────────────
const TONES = [
  { id: 'storytelling',  label: '📖 Storytelling',   desc: 'Personal narrative arc' },
  { id: 'thought-leader',label: '🧠 Thought Leader',  desc: 'Bold insights & opinions' },
  { id: 'educational',   label: '🎓 Educational',      desc: 'Teach something valuable' },
  { id: 'controversial', label: '🔥 Controversial',    desc: 'Challenge the status quo' },
  { id: 'inspirational', label: '✨ Inspirational',    desc: 'Motivate & uplift' },
  { id: 'list-based',    label: '📋 List Post',        desc: 'Scannable numbered tips' },
];

const FORMATS = [
  { id: 'hook-story-cta',   label: 'Hook → Story → CTA' },
  { id: 'problem-solution', label: 'Problem → Solution' },
  { id: 'before-after',     label: 'Before → After' },
  { id: 'numbered-list',    label: 'Numbered List' },
  { id: 'carousel-text',    label: 'Carousel Script' },
  { id: 'poll-post',        label: 'Poll Post' },
];

const VIRAL_HOOKS = [
  "Nobody talks about this, but...",
  "I made a mistake that cost me 6 months. Here's what I learned:",
  "Unpopular opinion: [your field] is broken. Here's why:",
  "I went from 0 to [achievement] in [timeframe]. The secret?",
  "Stop doing [common thing]. Do this instead:",
  "The #1 thing holding back most [professionals] is...",
  "3 years ago I was [struggling]. Today [transformation]. Thread 🧵",
  "What [successful people] won't tell you about [topic]:",
];

// ─────────────────────────────────────────────────────────────────
// SUB-COMPONENTS
// ─────────────────────────────────────────────────────────────────

const StatPill = ({ icon, value, label, color, sub }) => (
  <div style={{
    display: 'flex', alignItems: 'center', gap: 12, padding: '14px 18px',
    background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12,
  }}>
    <div style={{ color, fontSize: 20, flexShrink: 0 }}>{icon}</div>
    <div>
      <div style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1 }}>{value}</div>
      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{label}</div>
      {sub && <div style={{ fontSize: 10, color, marginTop: 2 }}>{sub}</div>}
    </div>
  </div>
);

const LeadBadge = ({ status }) => {
  const cfg = {
    hot:  { color: '#ff3b5c', bg: 'rgba(255,59,92,0.1)',  label: '🔥 Hot'  },
    warm: { color: '#ffb800', bg: 'rgba(255,184,0,0.1)', label: '☀️ Warm' },
    new:  { color: '#00c8ff', bg: 'rgba(0,200,255,0.1)', label: '✨ New'  },
  };
  const c = cfg[status] || cfg.new;
  return (
    <span style={{ background: c.bg, color: c.color, border: `1px solid ${c.color}30`, padding: '2px 8px', borderRadius: 20, fontSize: 11, fontWeight: 700, fontFamily: 'var(--font-mono)' }}>
      {c.label}
    </span>
  );
};

// ── Live Status Log ───────────────────────────────────────────────
const LiveLog = ({ logs }) => {
  const ref = useRef(null);
  useEffect(() => { if (ref.current) ref.current.scrollTop = ref.current.scrollHeight; }, [logs]);
  return (
    <div ref={ref} style={{
      background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 10,
      padding: '12px 14px', maxHeight: 140, overflowY: 'auto', fontFamily: 'var(--font-mono)', fontSize: 11,
    }}>
      {logs.map((l, i) => (
        <div key={i} style={{ color: l.includes('❌') ? 'var(--accent-red)' : l.includes('✅') ? 'var(--accent-green)' : 'var(--text-secondary)', marginBottom: 3 }}>
          {l}
        </div>
      ))}
      {logs.length === 0 && <div style={{ color: 'var(--text-muted)' }}>Waiting for LinkedIn sync...</div>}
    </div>
  );
};

// ── LinkedIn Sync Banner ──────────────────────────────────────────
const SyncBanner = ({ syncing, lastSync, onSync, hasCredentials }) => (
  <div style={{
    display: 'flex', alignItems: 'center', gap: 12,
    padding: '12px 18px', borderRadius: 12,
    background: syncing ? 'rgba(0,200,255,0.06)' : lastSync ? 'rgba(0,230,118,0.06)' : 'rgba(255,184,0,0.06)',
    border: `1px solid ${syncing ? 'rgba(0,200,255,0.25)' : lastSync ? 'rgba(0,230,118,0.2)' : 'rgba(255,184,0,0.2)'}`,
    marginBottom: 20,
  }}>
    <div style={{ fontSize: 18 }}>
      {syncing ? <Loader size={18} style={{ animation: 'spin 1s linear infinite', color: 'var(--accent-cyan)' }} />
               : lastSync ? <Wifi size={18} style={{ color: 'var(--accent-green)' }} />
               : <WifiOff size={18} style={{ color: 'var(--accent-amber)' }} />}
    </div>
    <div style={{ flex: 1 }}>
      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
        {syncing ? 'Syncing with LinkedIn...' : lastSync ? `Live data — synced ${lastSync}` : 'Not synced yet — using placeholder data'}
      </div>
      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
        {hasCredentials ? 'Uses your LinkedIn credentials from Settings' : '⚠️ Add LinkedIn credentials in Settings first'}
      </div>
    </div>
    <button
      className="btn btn-primary btn-sm"
      onClick={onSync}
      disabled={syncing || !hasCredentials}
      style={{ fontSize: 11, whiteSpace: 'nowrap' }}
    >
      {syncing ? <><Loader size={11} style={{ animation: 'spin 1s linear infinite' }} /> Syncing...</>
               : <><RefreshCw size={11} /> Sync LinkedIn</>}
    </button>
  </div>
);

// ── Post Card ─────────────────────────────────────────────────────
const PostCard = ({ post }) => (
  <div style={{
    display: 'flex', alignItems: 'center', gap: 14, padding: '14px 20px',
    borderBottom: '1px solid var(--border)', transition: 'background 0.2s',
  }}>
    <div style={{
      width: 40, height: 40, borderRadius: 10, flexShrink: 0,
      background: post.status === 'published' ? 'rgba(0,230,118,0.1)' : 'rgba(0,200,255,0.1)',
      border: `1px solid ${post.status === 'published' ? 'rgba(0,230,118,0.2)' : 'rgba(0,200,255,0.2)'}`,
      display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18,
    }}>
      {post.status === 'published' ? '✅' : '⏰'}
    </div>
    <div style={{ flex: 1, minWidth: 0 }}>
      <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--text-primary)', marginBottom: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {post.text || post.title || 'Post'}
      </div>
      <div style={{ fontSize: 11, color: 'var(--text-muted)', display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        <span>📅 {post.date}</span>
        {post.likes > 0    && <span>❤️ {post.likes}</span>}
        {post.comments > 0 && <span>💬 {post.comments}</span>}
        {post.reposts > 0  && <span>🔁 {post.reposts}</span>}
        {post.timeText     && <span>🕐 {post.timeText}</span>}
      </div>
    </div>
    {post.url && (
      <a href={post.url} target="_blank" rel="noreferrer" style={{ color: 'var(--accent-cyan)', flexShrink: 0 }}>
        <ExternalLink size={13} />
      </a>
    )}
  </div>
);

// ── Message Modal ─────────────────────────────────────────────────
const MessageModal = ({ lead, onClose, onSend, sending }) => {
  const [msg, setMsg] = useState('');

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(8px)',
      zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
    }}>
      <div style={{
        background: 'var(--bg-card)', border: '1px solid var(--border-accent)',
        borderRadius: 'var(--radius-xl)', width: '100%', maxWidth: 460,
        boxShadow: '0 32px 80px rgba(0,0,0,0.6)',
        animation: 'scaleIn 0.3s cubic-bezier(0.16,1,0.3,1)',
      }}>
        <div style={{ padding: '18px 22px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 15, display: 'flex', alignItems: 'center', gap: 8 }}>
            <MessageSquare size={15} style={{ color: 'var(--accent-cyan)' }} /> Message {lead.name}
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: 18 }}><X size={16} /></button>
        </div>
        <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{lead.title}</div>
          <textarea
            className="form-textarea"
            style={{ minHeight: 120, resize: 'none' }}
            placeholder={`Hi ${lead.name.split(' ')[0]}, I noticed you engaged with my content...`}
            value={msg}
            onChange={e => setMsg(e.target.value)}
          />
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={onClose} className="btn btn-secondary" style={{ flex: 1 }}>Cancel</button>
            <button onClick={() => onSend(lead, msg)} className="btn btn-primary" style={{ flex: 2 }} disabled={!msg.trim() || sending}>
              {sending ? <><Loader size={13} style={{ animation: 'spin 1s linear infinite' }} /> Sending...</> : <><Send size={13} /> Send Message</>}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// ── Publish to LinkedIn Modal ─────────────────────────────────────
const PublishModal = ({ post, onClose, onPublish, publishing, publishLog }) => (
  <div style={{
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(8px)',
    zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
  }}>
    <div style={{
      background: 'var(--bg-card)', border: '1px solid var(--border-accent)',
      borderRadius: 'var(--radius-xl)', width: '100%', maxWidth: 500,
      boxShadow: '0 32px 80px rgba(0,0,0,0.6)',
      animation: 'scaleIn 0.3s cubic-bezier(0.16,1,0.3,1)',
    }}>
      <div style={{ padding: '18px 22px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 15, display: 'flex', alignItems: 'center', gap: 8 }}>
          <Send size={15} style={{ color: 'var(--accent-green)' }} /> Publish to LinkedIn
        </div>
        {!publishing && <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}><X size={16} /></button>}
      </div>
      <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{
          background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 10, padding: '12px 14px',
          fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.7, maxHeight: 160, overflowY: 'auto',
        }}>
          {post}
        </div>

        {publishLog.length > 0 && <LiveLog logs={publishLog} />}

        {!publishing && publishLog.length === 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ background: 'rgba(255,184,0,0.07)', border: '1px solid rgba(255,184,0,0.2)', borderRadius: 8, padding: '10px 14px', fontSize: 12, color: 'var(--accent-amber)' }}>
              ⚠️ This will open a real browser window and publish directly to your LinkedIn feed.
            </div>
            <div style={{ background: 'rgba(0,200,255,0.06)', border: '1px solid rgba(0,200,255,0.15)', borderRadius: 8, padding: '10px 14px', fontSize: 12, color: 'var(--text-muted)' }}>
              💡 <strong style={{ color: 'var(--accent-cyan)' }}>Tip:</strong> Keep an eye on the browser window that opens — if it pauses, you can click <strong>Post</strong> manually.
            </div>
          </div>
        )}

        {!publishing && publishLog.length === 0 && (
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={onClose} className="btn btn-secondary" style={{ flex: 1 }}>Cancel</button>
            <button onClick={onPublish} className="btn btn-primary" style={{ flex: 2, background: 'linear-gradient(135deg, #00b96b, #00e676)' }}>
              <Send size={13} /> Publish Now
            </button>
          </div>
        )}

        {publishing && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: 'var(--accent-cyan)', fontSize: 13 }}>
            <Loader size={14} style={{ animation: 'spin 1s linear infinite' }} /> Publishing to LinkedIn... <span style={{ color: 'var(--text-muted)', fontSize: 11 }}>(check the browser window)</span>
          </div>
        )}

        {/* Show close button after a failed attempt so user can try manually */}
        {!publishing && publishLog.some(l => l.includes('❌')) && (
          <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
            <button onClick={onClose} className="btn btn-secondary" style={{ flex: 1 }}>Close</button>
            <button onClick={onPublish} className="btn btn-primary" style={{ flex: 1 }}>
              <RefreshCw size={12} /> Retry
            </button>
          </div>
        )}
      </div>
    </div>
  </div>
);

// ─────────────────────────────────────────────────────────────────
// MAIN PAGE
// ─────────────────────────────────────────────────────────────────
const ContentStudio = () => {
  const { userSettings, addNotification } = useApp();
  const [activeTab, setActiveTab] = useState('generator');

  // ── Real data state ──
  const [realPosts,    setRealPosts]    = useState([]);
  const [realLeads,    setRealLeads]    = useState([]);
  const [realComments, setRealComments] = useState([]);
  const [profileStats, setProfileStats] = useState({});
  const [syncing,      setSyncing]      = useState(false);
  const [syncLog,      setSyncLog]      = useState([]);
  const [lastSync,     setLastSync]     = useState('');

  // ── Generator state ──
  const [topic,           setTopic]           = useState('');
  const [selectedTone,    setSelectedTone]    = useState('thought-leader');
  const [selectedFormat,  setSelectedFormat]  = useState('hook-story-cta');
  const [generatedPost,   setGeneratedPost]   = useState('');
  const [generating,      setGenerating]      = useState(false);
  const [copied,          setCopied]          = useState(false);
  const [activeHook,      setActiveHook]      = useState(null);
  const [scheduleDate,    setScheduleDate]    = useState('');
  const [scheduleTime,    setScheduleTime]    = useState('09:00');
  const [scheduledPosts,  setScheduledPosts]  = useState([]);

  // ── Media upload state ──
  const [mediaFile,       setMediaFile]       = useState(null); // { url, type, name, preview }
  const [uploadingMedia,  setUploadingMedia]  = useState(false);
  const [uploadMediaErr,  setUploadMediaErr]  = useState('');
  const mediaInputRef = useRef(null);

  // ── Comment/Lead actions ──
  const [generatingReply, setGeneratingReply] = useState(null);
  const [fetchingLeads,   setFetchingLeads]   = useState(false);
  const [leadsLog,        setLeadsLog]        = useState([]);
  const [messagingLead,   setMessagingLead]   = useState(null);
  const [sendingMessage,  setSendingMessage]  = useState(false);

  // ── Publish ──
  const [showPublish,     setShowPublish]     = useState(false);
  const [publishing,      setPublishing]      = useState(false);
  const [publishLog,      setPublishLog]      = useState([]);

  const sseRef = useRef(null);

  // Abort any in-flight SSE on unmount
  useEffect(() => {
    return () => { sseRef.current?.abort(); };
  }, []);

  // ── Get credentials from settings ────────────────────────────────
  const email    = userSettings?.linkedinEmail    || '';
  const password = userSettings?.linkedinPassword || '';
  const hasCredentials = !!(email && password);

  // ── Full LinkedIn Sync ────────────────────────────────────────────
  const syncLinkedIn = useCallback(() => {
    if (!hasCredentials) {
      addNotification({ type: 'error', message: '⚠️ Add your LinkedIn credentials in Settings first' });
      return;
    }
    setSyncing(true);
    setSyncLog([]);

    sseRef.current = streamSSE(
      `${BACKEND}/api/content/sync`,
      { email, password },
      (evt) => {
        setSyncLog(prev => [...prev, evt.message]);

        if (evt.profileStats) setProfileStats(evt.profileStats);
        if (evt.posts)        setRealPosts(evt.posts);
        if (evt.comments)     setRealComments(evt.comments);
        if (evt.leads)        setRealLeads(evt.leads);

        if (evt.phase === 'complete' && evt.results) {
          const r = evt.results;
          if (r.profileStats) setProfileStats(r.profileStats);
          if (r.posts)        setRealPosts(r.posts);
          if (r.comments)     setRealComments(r.comments);
          if (r.leads)        setRealLeads(r.leads);
        }

        if (evt.phase === 'complete' || evt.phase === 'error') {
          setSyncing(false);
          const now = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
          setLastSync(now);
          if (!evt.error) {
            addNotification({ type: 'success', message: '✅ LinkedIn data synced successfully!', time: 'just now' });
          }
        }
      },
      () => setSyncing(false)
    );
  }, [hasCredentials, email, password, addNotification]);

  // ── Fetch Leads Only ──────────────────────────────────────────────
  const fetchLeads = useCallback(() => {
    if (!hasCredentials) {
      addNotification({ type: 'error', message: '⚠️ Add LinkedIn credentials in Settings' });
      return;
    }
    setFetchingLeads(true);
    setLeadsLog([]);

    streamSSE(
      `${BACKEND}/api/content/leads`,
      { email, password },
      (evt) => {
        setLeadsLog(prev => [...prev, evt.message]);
        if (evt.leads)          setRealLeads(evt.leads);
        if (evt.phase === 'complete' && evt.leads) {
          setRealLeads(evt.leads);
          addNotification({ type: 'success', message: `🎯 Found ${evt.leads.length} real leads from LinkedIn!`, time: 'just now' });
        }
        if (evt.phase === 'complete' || evt.phase === 'error') setFetchingLeads(false);
      },
      () => setFetchingLeads(false)
    );
  }, [hasCredentials, email, password, addNotification]);

  // ── Publish post to LinkedIn ──────────────────────────────────────
  const publishToLinkedIn = useCallback(() => {
    if (!hasCredentials) return;
    setPublishing(true);
    setPublishLog([]);

    streamSSE(
      `${BACKEND}/api/content/post`,
      { email, password, text: generatedPost },
      (evt) => {
        setPublishLog(prev => [...prev, evt.message]);
        if (evt.phase === 'complete') {
          setPublishing(false);
          if (evt.success !== false) {
            addNotification({ type: 'success', message: '🎉 Post published to LinkedIn!', time: 'just now' });
            setTimeout(() => setShowPublish(false), 2000);
          }
        }
        if (evt.phase === 'error') setPublishing(false);
      },
      () => setPublishing(false)
    );
  }, [hasCredentials, email, password, generatedPost, addNotification]);

  // ── Send message to lead ──────────────────────────────────────────
  const sendLeadMessage = useCallback((lead, message) => {
    if (!hasCredentials) return;
    setSendingMessage(true);

    streamSSE(
      `${BACKEND}/api/content/message`,
      { email, password, profileUrl: lead.profileLink, message },
      (evt) => {
        if (evt.phase === 'complete') {
          setSendingMessage(false);
          setMessagingLead(null);
          if (evt.success !== false) {
            addNotification({ type: 'success', message: `✅ Message sent to ${lead.name}!`, time: 'just now' });
          } else {
            addNotification({ type: 'error', message: `⚠️ ${evt.error || 'Message failed'}` });
          }
        }
        if (evt.phase === 'error') setSendingMessage(false);
      },
      () => setSendingMessage(false)
    );
  }, [hasCredentials, email, password, addNotification]);

  // ── AI reply ─────────────────────────────────────────────────────
  const generateReply = useCallback(async (comment) => {
    setGeneratingReply(comment.id);
    try {
      const reply = await groq(
        `You write authentic LinkedIn replies. Be genuine, max 280 chars, no emojis, warm & professional.`,
        `Post: "${comment.post}"\nComment by ${comment.author}: "${comment.text}"\nWrite a thoughtful reply.`,
        150
      );
      setRealComments(prev => prev.map(c => c.id === comment.id ? { ...c, replied: true, reply } : c));
      addNotification({ type: 'success', message: `💬 AI reply generated for ${comment.author}`, time: 'just now' });
    } catch (_) {}
    setGeneratingReply(null);
  }, [addNotification]);

  // ── Generate AI post ─────────────────────────────────────────────
  const generatePost = useCallback(async () => {
    if (!topic.trim()) return;
    setGenerating(true);
    setGeneratedPost('');
    try {
      const toneObj   = TONES.find(t => t.id === selectedTone);
      const formatObj = FORMATS.find(f => f.id === selectedFormat);
      const mediaCtx  = mediaFile
        ? `\n\nMedia: A ${mediaFile.type} called "${mediaFile.name}" will accompany this post. Reference the visual naturally.`
        : '';
      const result    = await groq(
        `You are a world-class LinkedIn content strategist. Write viral LinkedIn posts. Use short lines, 3-5 emojis naturally placed, end with a question/CTA. No hashtags in body — 3 hashtags at end only. Max 1300 chars.`,
        `Post about: "${topic || mediaFile?.name}"\nTone: ${toneObj?.label}\nFormat: ${formatObj?.label}\n${activeHook ? `Start hook: "${activeHook}"` : ''}${mediaCtx}`,
        800
      );
      setGeneratedPost(result);
      addNotification({ type: 'success', message: `✨ Post generated${mediaFile ? ' with media' : ''}: "${(topic || mediaFile?.name || '').slice(0, 30)}..."`, time: 'just now' });
    } catch (err) {
      setGeneratedPost('❌ Generation failed — check connection and try again.');
    }
    setGenerating(false);
  }, [topic, selectedTone, selectedFormat, activeHook, mediaFile, addNotification]);

  // ── Upload media to Cloudinary ────────────────────────────
  const uploadMedia = useCallback(async (file) => {
    if (!file) return;
    const isImage = file.type.startsWith('image/');
    const isVideo = file.type.startsWith('video/');
    if (!isImage && !isVideo) { setUploadMediaErr('Only images or videos allowed.'); return; }
    if (file.size > 50 * 1024 * 1024) { setUploadMediaErr('File must be under 50MB.'); return; }
    setUploadingMedia(true); setUploadMediaErr('');
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);
      formData.append('folder', 'linkedin_content');
      const resourceType = isVideo ? 'video' : 'image';
      const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/${resourceType}/upload`, { method: 'POST', body: formData });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error?.message || 'Upload failed');
      setMediaFile({ url: data.secure_url, type: isVideo ? 'video' : 'image', name: file.name, preview: data.secure_url });
      addNotification({ type: 'success', message: `🖼️ ${isVideo ? 'Video' : 'Photo'} uploaded! AI will reference it in your post.`, time: 'just now' });
    } catch (err) {
      setUploadMediaErr(err.message || 'Upload failed');
      setMediaFile({ url: URL.createObjectURL(file), type: isVideo ? 'video' : 'image', name: file.name, preview: URL.createObjectURL(file), localOnly: true });
    } finally { setUploadingMedia(false); }
  }, [addNotification]);

  const copyPost = useCallback(() => {
    navigator.clipboard.writeText(generatedPost);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [generatedPost]);

  const schedulePost = useCallback(() => {
    if (!generatedPost || !scheduleDate) return;
    setScheduledPosts(prev => [{
      id: Date.now(), text: topic || generatedPost.slice(0, 80), date: scheduleDate,
      time: scheduleTime, status: 'scheduled', tone: selectedTone,
      content: generatedPost,
    }, ...prev]);
    addNotification({ type: 'success', message: `📅 Post scheduled for ${scheduleDate} at ${scheduleTime}`, time: 'just now' });
    setScheduleDate('');
  }, [generatedPost, scheduleDate, scheduleTime, topic, selectedTone, addNotification]);

  // ── Derived data ──────────────────────────────────────────────────
  const allPosts    = [...realPosts, ...scheduledPosts];
  const displayLeads    = realLeads;
  const displayComments = realComments;

  const TABS = [
    { id: 'generator', label: '✨ AI Generator',     icon: <Wand2 size={14} />         },
    { id: 'posts',     label: '📋 My Posts',          icon: <Play size={14} />           },
    { id: 'analytics', label: '📊 Analytics',          icon: <BarChart2 size={14} />      },
    { id: 'comments',  label: `💬 Comments${displayComments.length ? ` (${displayComments.length})` : ''}`, icon: <MessageSquare size={14} /> },
    { id: 'leads',     label: `🎯 Leads${displayLeads.length ? ` (${displayLeads.length})` : ''}`,          icon: <Users size={14} />         },
  ];

  return (
    <div className="page-content animate-fade" style={{ maxWidth: '100%' }}>

      {/* ── PAGE HEADER ── */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-header">
          <div className="card-title">
            <Sparkles size={14} /> Content Studio
          </div>
        </div>
        <div className="card-body" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-muted)' }}>
              Generate, schedule and analyze your LinkedIn content.
            </div>
          </div>
          <div style={{ display: 'flex', gap: 20 }}>
            {[
              { label: 'Posts',     value: realPosts.length   || '--', color: 'var(--accent-green)' },
              { label: 'Leads',     value: realLeads.length   || '--', color: 'var(--accent-red)'   },
              { label: 'Comments',  value: realComments.length || '--', color: 'var(--accent-cyan)'  },
            ].map(s => (
              <div key={s.label} style={{ textAlign: 'center' }}>
                <div style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 700, color: s.color }}>{s.value}</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── SYNC BANNER ── */}
      <SyncBanner syncing={syncing} lastSync={lastSync} onSync={syncLinkedIn} hasCredentials={hasCredentials} />

      {/* Live sync log */}
      {(syncing || syncLog.length > 0) && <div style={{ marginBottom: 16 }}><LiveLog logs={syncLog} /></div>}

      {/* ── TAB BAR ── */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 24, flexWrap: 'wrap' }}>
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`btn btn-sm ${activeTab === tab.id ? 'btn-primary' : 'btn-secondary'}`}
          >
            {tab.icon} {tab.label}
          </button>
        ))}
      </div>

      {/* ══ AI GENERATOR ══ */}
      {activeTab === 'generator' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div className="card">
              <div className="card-header"><div className="card-title"><PenTool size={14} /> What to post about?</div></div>
              <div className="card-body">
                <textarea className="form-textarea" style={{ minHeight: 80, resize: 'none' }}
                  placeholder="e.g. My journey from junior to senior engineer, lessons learned..."
                  value={topic} onChange={e => setTopic(e.target.value)} />
              </div>
            </div>

            <div className="card">
              <div className="card-header"><div className="card-title"><Zap size={14} /> Viral Hook Templates</div><span className="badge badge-amber">Pick one</span></div>
              <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {VIRAL_HOOKS.map((hook, i) => (
                  <div key={i} onClick={() => setActiveHook(activeHook === hook ? null : hook)} style={{
                    padding: '8px 12px', background: activeHook === hook ? 'rgba(0,200,255,0.08)' : 'var(--bg-secondary)',
                    border: `1px solid ${activeHook === hook ? 'rgba(0,200,255,0.3)' : 'var(--border)'}`,
                    borderRadius: 8, cursor: 'pointer', fontSize: 12,
                    color: activeHook === hook ? 'var(--text-primary)' : 'var(--text-secondary)',
                    transition: 'all 0.2s', display: 'flex', alignItems: 'center', gap: 8,
                  }}>
                    {activeHook === hook ? <CheckCircle size={12} style={{ color: 'var(--accent-cyan)', flexShrink: 0 }} /> : <ChevronRight size={12} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />}
                    {hook}
                  </div>
                ))}
              </div>
            </div>

            <div className="card">
              <div className="card-header"><div className="card-title"><Sparkles size={14} /> Tone of Voice</div></div>
              <div className="card-body" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                {TONES.map(tone => (
                  <div key={tone.id} onClick={() => setSelectedTone(tone.id)} style={{
                    padding: '10px 12px', borderRadius: 8, cursor: 'pointer',
                    background: selectedTone === tone.id ? 'rgba(123,63,255,0.1)' : 'var(--bg-secondary)',
                    border: `1px solid ${selectedTone === tone.id ? 'rgba(123,63,255,0.35)' : 'var(--border)'}`,
                    transition: 'all 0.2s',
                  }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: selectedTone === tone.id ? 'var(--text-primary)' : 'var(--text-secondary)' }}>{tone.label}</div>
                    <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>{tone.desc}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="card">
              <div className="card-header"><div className="card-title"><Hash size={14} /> Post Format</div></div>
              <div className="card-body" style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {FORMATS.map(fmt => (
                  <span key={fmt.id} className={`chip ${selectedFormat === fmt.id ? 'active' : ''}`}
                    onClick={() => setSelectedFormat(fmt.id)} style={{ cursor: 'pointer' }}>{fmt.label}</span>
                ))}
              </div>
            </div>

            {/* ── Media Upload ── */}
            <div className="card" style={{ border: '1px dashed rgba(0,200,255,0.25)', background: 'rgba(0,200,255,0.03)' }}>
              <div className="card-header" style={{ padding: '12px 16px' }}>
                <div className="card-title" style={{ fontSize: 13 }}><ImagePlus size={14} /> Add Photo / Video (optional)</div>
                {mediaFile && (
                  <button onClick={() => { setMediaFile(null); setUploadMediaErr(''); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}><X size={14} /></button>
                )}
              </div>
              <div style={{ padding: '12px 16px' }}>
                <input ref={mediaInputRef} type="file" accept="image/*,video/*" style={{ display: 'none' }}
                  onChange={e => uploadMedia(e.target.files[0])} />
                {!mediaFile && !uploadingMedia && (
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button className="btn btn-secondary btn-sm" style={{ flex: 1, fontSize: 11 }} onClick={() => mediaInputRef.current?.click()}>
                      <Upload size={12} /> Upload Photo
                    </button>
                    <button className="btn btn-secondary btn-sm" style={{ flex: 1, fontSize: 11 }} onClick={() => mediaInputRef.current?.click()}>
                      <Video size={12} /> Upload Video
                    </button>
                  </div>
                )}
                {uploadingMedia && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--accent-cyan)' }}>
                    <Loader size={14} style={{ animation: 'spin 1s linear infinite' }} /> Uploading...
                  </div>
                )}
                {uploadMediaErr && (
                  <div style={{ fontSize: 11, color: 'var(--accent-red)', marginTop: 6 }}>⚠️ {uploadMediaErr}</div>
                )}
                {mediaFile && (
                  <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                    {mediaFile.type === 'image' ? (
                      <img src={mediaFile.preview} alt={mediaFile.name} style={{ width: 60, height: 60, objectFit: 'cover', borderRadius: 8, border: '1px solid var(--border)' }} />
                    ) : (
                      <div style={{ width: 60, height: 60, borderRadius: 8, background: 'rgba(123,63,255,0.1)', border: '1px solid rgba(123,63,255,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24 }}>🎬</div>
                    )}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{mediaFile.name}</div>
                      <div style={{ fontSize: 10, color: 'var(--accent-green)', marginTop: 2 }}>✅ {mediaFile.localOnly ? 'Ready (local)' : 'Uploaded'} — AI will reference this</div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <button className="btn btn-primary btn-lg w-full" onClick={generatePost} disabled={generating || (!topic.trim() && !mediaFile)}>
              {generating ? <><Loader size={15} style={{ animation: 'spin 1s linear infinite' }} /> Generating...</> : <><Wand2 size={15} /> Generate LinkedIn Post</>}
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div className="card" style={{ flex: 1 }}>
              <div className="card-header">
                <div className="card-title"><Sparkles size={14} /> Generated Post</div>
                <div style={{ display: 'flex', gap: 8 }}>
                  {generatedPost && (
                    <>
                      <button className="btn btn-secondary btn-sm" onClick={copyPost}>
                        {copied ? <><CheckCircle size={12} /> Copied!</> : <><Copy size={12} /> Copy</>}
                      </button>
                      <button className="btn btn-secondary btn-sm" onClick={generatePost} disabled={generating}>
                        <RefreshCw size={12} /> Regen
                      </button>
                    </>
                  )}
                </div>
              </div>
              <div className="card-body">
                {!generatedPost && !generating && (
                  <div className="empty-state" style={{ padding: '40px 20px' }}>
                    <div className="empty-state-icon">✍️</div>
                    <h3>No post yet</h3>
                    <p>Pick a topic, tone, and format — then click Generate</p>
                  </div>
                )}
                {generating && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: '20px 0' }}>
                    {[100, 80, 90, 60, 75].map((w, i) => (
                      <div key={i} style={{ height: 14, borderRadius: 7, width: `${w}%`, background: 'var(--bg-surface)', animation: `shimmer 1.5s ${i * 0.1}s infinite`, backgroundSize: '200% 100%', backgroundImage: 'linear-gradient(90deg, var(--bg-surface) 0%, rgba(0,200,255,0.1) 50%, var(--bg-surface) 100%)' }} />
                    ))}
                  </div>
                )}
                {generatedPost && (
                  <textarea className="form-textarea" style={{ minHeight: 280, fontFamily: 'var(--font-body)', lineHeight: 1.8, fontSize: 13.5, resize: 'none', border: '1px solid rgba(123,63,255,0.2)', background: 'rgba(123,63,255,0.03)' }}
                    value={generatedPost} onChange={e => setGeneratedPost(e.target.value)} />
                )}
              </div>
            </div>

            {generatedPost && (
              <>
                {/* Publish to LinkedIn button */}
                <button className="btn btn-success w-full" onClick={() => { setShowPublish(true); setPublishLog([]); }}
                  disabled={!hasCredentials} style={{ background: 'linear-gradient(135deg,#00b96b,#00e676)', boxShadow: '0 4px 20px rgba(0,230,118,0.25)', fontSize: 13 }}>
                  <Send size={14} /> {hasCredentials ? 'Publish to LinkedIn Now' : 'Add LinkedIn credentials in Settings to publish'}
                </button>

                {/* Schedule */}
                <div className="card" style={{ animation: 'slideInUp 0.3s cubic-bezier(0.16,1,0.3,1)' }}>
                  <div className="card-header"><div className="card-title"><Clock size={14} /> Schedule This Post</div></div>
                  <div className="card-body">
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: 10, alignItems: 'end' }}>
                      <div>
                        <label className="form-label">Date</label>
                        <input type="date" className="form-input" value={scheduleDate} min={new Date().toISOString().split('T')[0]} onChange={e => setScheduleDate(e.target.value)} />
                      </div>
                      <div>
                        <label className="form-label">Time</label>
                        <input type="time" className="form-input" value={scheduleTime} onChange={e => setScheduleTime(e.target.value)} />
                      </div>
                      <button className="btn btn-success" onClick={schedulePost} disabled={!scheduleDate}><Calendar size={13} /> Save</button>
                    </div>
                    <div style={{ marginTop: 10, padding: '8px 12px', background: 'rgba(0,230,118,0.05)', border: '1px solid rgba(0,230,118,0.15)', borderRadius: 8, fontSize: 11, color: 'var(--text-muted)' }}>
                      💡 Best times: <strong style={{ color: 'var(--accent-green)' }}>Tue–Thu 8–10am</strong> or <strong style={{ color: 'var(--accent-green)' }}>5–6pm</strong>
                    </div>
                  </div>
                </div>

                {/* Post stats */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10 }}>
                  {[
                    { label: 'Characters',    value: generatedPost.length, color: generatedPost.length > 1300 ? 'var(--accent-red)' : 'var(--accent-green)' },
                    { label: 'Est. Read Time', value: `${Math.ceil(generatedPost.split(' ').length / 200)}m`, color: 'var(--accent-cyan)' },
                    { label: 'Lines',          value: generatedPost.split('\n').filter(Boolean).length, color: 'var(--accent-purple)' },
                  ].map(s => (
                    <div key={s.label} style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 10, padding: '10px 14px', textAlign: 'center' }}>
                      <div style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 800, color: s.color }}>{s.value}</div>
                      <div style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', marginTop: 2 }}>{s.label}</div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* ══ MY POSTS (real) ══ */}
      {activeTab === 'posts' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: 16, fontWeight: 700 }}>Your LinkedIn Posts</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                {realPosts.length > 0 ? `${realPosts.length} posts fetched from LinkedIn` : 'Sync to load your real posts'}
              </div>
            </div>
            <button className="btn btn-primary btn-sm" onClick={syncLinkedIn} disabled={syncing || !hasCredentials}>
              {syncing ? <><Loader size={12} style={{ animation: 'spin 1s linear infinite' }} /> Syncing...</> : <><RefreshCw size={12} /> Refresh</>}
            </button>
          </div>

          <div className="card">
            <div className="card-header">
              <div className="card-title"><Play size={14} /> Recent Posts</div>
              <span className="badge badge-green">{realPosts.length} live</span>
            </div>
            <div className="card-body" style={{ padding: 0 }}>
              {allPosts.length === 0 ? (
                <div className="empty-state" style={{ padding: '40px 24px' }}>
                  <div style={{ fontSize: 36, marginBottom: 12 }}>📭</div>
                  <h3>No posts yet</h3>
                  <p>Click "Sync LinkedIn" above to fetch your real posts</p>
                </div>
              ) : (
                allPosts.map(p => <PostCard key={p.id} post={p} />)
              )}
            </div>
          </div>
        </div>
      )}

      {/* ══ ANALYTICS (real data) ══ */}
      {activeTab === 'analytics' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {!lastSync && (
            <div style={{ background: 'rgba(255,184,0,0.07)', border: '1px solid rgba(255,184,0,0.2)', borderRadius: 12, padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 12 }}>
              <AlertTriangle size={16} style={{ color: 'var(--accent-amber)' }} />
              <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Sync with LinkedIn to see real analytics data.</span>
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
            <StatPill icon={<Users size={18} />}      value={profileStats.followers        || '--'} label="Followers"          color="var(--accent-cyan)"   sub={profileStats.followers        ? '↑ from LinkedIn' : 'Sync to load'} />
            <StatPill icon={<Eye size={18} />}         value={profileStats.profileViews     || '--'} label="Profile Views (7d)" color="var(--accent-purple)" sub={profileStats.profileViews     ? '↑ from LinkedIn' : 'Sync to load'} />
            <StatPill icon={<TrendingUp size={18} />}  value={profileStats.postImpressions  || '--'} label="Post Impressions"   color="var(--accent-green)"  sub={profileStats.postImpressions  ? '↑ from LinkedIn' : 'Sync to load'} />
            <StatPill icon={<Heart size={18} />}        value={realPosts.reduce((a,p)=>a+(p.likes||0),0)     || '--'} label="Total Likes"    color="var(--accent-red)"    />
            <StatPill icon={<MessageSquare size={18} />}value={realPosts.reduce((a,p)=>a+(p.comments||0),0)  || '--'} label="Total Comments" color="var(--accent-amber)"  />
            <StatPill icon={<Repeat2 size={18} />}     value={realPosts.reduce((a,p)=>a+(p.reposts||0),0)   || '--'} label="Total Reposts"  color="var(--accent-cyan)"   />
          </div>

          {realPosts.length > 0 && (
            <div className="card">
              <div className="card-header">
                <div className="card-title"><TrendingUp size={14} /> Top Posts by Engagement</div>
                <span className="badge badge-green">{realPosts.length} live posts</span>
              </div>
              <div className="card-body" style={{ padding: 0 }}>
                <table className="data-table">
                  <thead><tr><th>Post Preview</th><th>Likes</th><th>Comments</th><th>Reposts</th><th>Link</th></tr></thead>
                  <tbody>
                    {[...realPosts].sort((a, b) => ((b.likes||0) + (b.comments||0) + (b.reposts||0)) - ((a.likes||0) + (a.comments||0) + (a.reposts||0))).map(post => (
                      <tr key={post.id}>
                        <td style={{ maxWidth: 250, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          <strong style={{ color: 'var(--text-primary)' }}>{post.text || post.title || 'Post'}</strong>
                        </td>
                        <td className="font-mono" style={{ color: 'var(--accent-red)'    }}>{post.likes    || 0}</td>
                        <td className="font-mono" style={{ color: 'var(--accent-purple)' }}>{post.comments || 0}</td>
                        <td className="font-mono" style={{ color: 'var(--accent-amber)'  }}>{post.reposts  || 0}</td>
                        <td>{post.url && <a href={post.url} target="_blank" rel="noreferrer" style={{ color: 'var(--accent-cyan)' }}><ExternalLink size={12} /></a>}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ══ COMMENTS (real) ══ */}
      {activeTab === 'comments' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
            <div>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: 16, fontWeight: 700 }}>Comment AI Auto-Reply</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                {displayComments.length > 0 ? `${displayComments.length} real comments from LinkedIn` : 'Sync to load real comments'}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <span className="badge badge-amber">{displayComments.filter(c => !c.replied).length} pending</span>
              <span className="badge badge-green">{displayComments.filter(c => c.replied).length} replied</span>
            </div>
          </div>

          {displayComments.length === 0 ? (
            <div className="card">
              <div className="empty-state" style={{ padding: '48px 24px' }}>
                <div style={{ fontSize: 36, marginBottom: 12 }}>💬</div>
                <h3>No comments yet</h3>
                <p>Sync your LinkedIn account to fetch real comments from your posts</p>
                <button className="btn btn-primary" onClick={syncLinkedIn} disabled={syncing || !hasCredentials} style={{ marginTop: 12 }}>
                  <RefreshCw size={13} /> Sync LinkedIn
                </button>
              </div>
            </div>
          ) : (
            displayComments.map(comment => (
              <div key={comment.id} className="card" style={{ border: comment.replied ? '1px solid rgba(0,230,118,0.2)' : '1px solid var(--border)', transition: 'all 0.3s' }}>
                <div className="card-body">
                  <div style={{ display: 'flex', gap: 12, marginBottom: 12 }}>
                    <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'var(--gradient-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 800, color: '#fff', flexShrink: 0 }}>
                      {comment.author[0]}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                        <strong style={{ fontSize: 13, color: 'var(--text-primary)' }}>{comment.author}</strong>
                        {comment.title && <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{comment.title}</span>}
                        <span className="badge badge-muted" style={{ fontSize: 9 }}>on: {comment.post?.slice(0, 40)}</span>
                      </div>
                      <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6 }}>{comment.text}</div>
                    </div>
                  </div>
                  {comment.replied ? (
                    <div style={{ marginLeft: 48, padding: '10px 14px', background: 'rgba(0,230,118,0.05)', border: '1px solid rgba(0,230,118,0.15)', borderRadius: 8 }}>
                      <div style={{ fontSize: 10, color: 'var(--accent-green)', fontFamily: 'var(--font-mono)', marginBottom: 4 }}>✅ AI REPLY</div>
                      <div style={{ fontSize: 12.5, color: 'var(--text-secondary)', lineHeight: 1.6 }}>{comment.reply}</div>
                    </div>
                  ) : (
                    <div style={{ marginLeft: 48, display: 'flex', gap: 8 }}>
                      <button className="btn btn-primary btn-sm" onClick={() => generateReply(comment)} disabled={generatingReply === comment.id}>
                        {generatingReply === comment.id ? <><Loader size={12} style={{ animation: 'spin 1s linear infinite' }} /> Generating...</> : <><Wand2 size={12} /> AI Reply</>}
                      </button>
                      <button className="btn btn-secondary btn-sm"><PenTool size={12} /> Write Manually</button>
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* ══ LEADS (real) ══ */}
      {activeTab === 'leads' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: 16, fontWeight: 700 }}>LinkedIn Lead Fetcher</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                {displayLeads.length > 0
                  ? `${displayLeads.length} real people who engaged with your content — AI-scored`
                  : 'People who viewed your profile & reacted to posts — synced from LinkedIn'}
              </div>
            </div>
            <button className="btn btn-primary" onClick={fetchLeads} disabled={fetchingLeads || !hasCredentials}>
              {fetchingLeads ? <><Loader size={14} style={{ animation: 'spin 1s linear infinite' }} /> Fetching...</> : <><Target size={14} /> Fetch Live Leads</>}
            </button>
          </div>

          {/* Live log */}
          {(fetchingLeads || leadsLog.length > 0) && <LiveLog logs={leadsLog} />}

          {/* Stats */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
            <StatPill icon="🔥" value={displayLeads.filter(l => l.status === 'hot').length  || '--'} label="Hot Leads"  color="var(--accent-red)"   />
            <StatPill icon="☀️" value={displayLeads.filter(l => l.status === 'warm').length || '--'} label="Warm Leads" color="var(--accent-amber)" />
            <StatPill icon="✨" value={displayLeads.filter(l => l.status === 'new').length  || '--'} label="New Leads"  color="var(--accent-cyan)"  />
          </div>

          <div className="card">
            <div className="card-header">
              <div className="card-title"><Users size={14} /> Leads ({displayLeads.length})</div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                {displayLeads.length > 0 && <span className="badge badge-green">🔴 Live from LinkedIn</span>}
                <button className="btn btn-secondary btn-sm"><Filter size={12} /> Filter</button>
              </div>
            </div>
            <div className="card-body" style={{ padding: 0 }}>
              {displayLeads.length === 0 ? (
                <div className="empty-state" style={{ padding: '48px 24px' }}>
                  <div style={{ fontSize: 36, marginBottom: 12 }}>🎯</div>
                  <h3>No leads yet</h3>
                  <p>Click "Fetch Live Leads" to get real people who engaged with your LinkedIn content</p>
                </div>
              ) : (
                displayLeads.map(lead => (
                  <div key={lead.id} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 20px', borderBottom: '1px solid var(--border)', transition: 'background 0.2s' }}>
                    <div style={{ width: 40, height: 40, borderRadius: '50%', flexShrink: 0, background: 'var(--gradient-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 800, color: '#fff' }}>
                      {lead.name[0]}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--text-primary)', marginBottom: 2 }}>{lead.name}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 3 }}>{lead.title}</div>
                      <div style={{ fontSize: 10, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4 }}>
                        <div style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--accent-green)', flexShrink: 0, animation: 'breathe 2s infinite' }} />
                        {lead.action}
                      </div>
                    </div>
                    <div style={{ textAlign: 'center', minWidth: 60 }}>
                      <div style={{ fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 800, color: lead.score >= 90 ? 'var(--accent-red)' : lead.score >= 80 ? 'var(--accent-amber)' : 'var(--accent-cyan)' }}>{lead.score}</div>
                      <div style={{ fontSize: 9, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>AI SCORE</div>
                    </div>
                    <LeadBadge status={lead.status} />
                    <div style={{ display: 'flex', gap: 6 }}>
                      {lead.profileLink && (
                        <a href={lead.profileLink} target="_blank" rel="noreferrer" className="btn btn-primary btn-sm" style={{ fontSize: 11, textDecoration: 'none' }}>
                          <Send size={11} /> Connect
                        </a>
                      )}
                      <button className="btn btn-secondary btn-sm" style={{ fontSize: 11 }}
                        onClick={() => setMessagingLead(lead)}
                        disabled={!lead.profileLink}>
                        <MessageSquare size={11} /> Message
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Modals ── */}
      {messagingLead && (
        <MessageModal lead={messagingLead} onClose={() => setMessagingLead(null)} onSend={sendLeadMessage} sending={sendingMessage} />
      )}
      {showPublish && (
        <PublishModal post={generatedPost} onClose={() => setShowPublish(false)} onPublish={publishToLinkedIn} publishing={publishing} publishLog={publishLog} />
      )}
    </div>
  );
};

export default ContentStudio;
