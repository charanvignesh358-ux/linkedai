import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useApp } from '../context/AppContext';
import { Send, Bot, User, Sparkles, Copy, CheckCircle, RefreshCw, ChevronDown, AlertCircle } from 'lucide-react';

const BACKEND = (process.env.REACT_APP_BACKEND_URL || 'http://localhost:4000').replace(/\/+$/, '');
const GROQ_KEY = process.env.REACT_APP_GROQ_KEY || '';

// ─── Quick action presets ─────────────────────────────────────────
const QUICK_ACTIONS = [
  { icon: '✍️', label: 'Write Cover Letter',    prompt: 'Write an optimized cover letter for the top job matching my profile. Use my experience, skills, and the job requirements to make it compelling and ATS-friendly.' },
  { icon: '📝', label: 'Optimize My Resume',    prompt: 'Analyze my profile and suggest specific improvements to my resume to get more callbacks. Include ATS keywords, formatting tips, and impact metrics I should add.' },
  { icon: '🎯', label: 'Job Match Analysis',    prompt: 'Which jobs in my pipeline best match my skills and experience? Rank them and explain why each is a good or poor fit, with actionable advice.' },
  { icon: '💬', label: 'LinkedIn Message',      prompt: 'Write a short personalized LinkedIn connection message for a hiring manager at a tech startup. Make it professional but warm, referencing their work.' },
  { icon: '🔍', label: 'Interview Prep',        prompt: 'Give me the top 10 interview questions likely to be asked for a software engineer role at an Indian tech startup, with ideal answer strategies.' },
  { icon: '📊', label: 'Application Strategy', prompt: 'Based on my profile and current job market, what is the best application strategy? How many jobs should I apply to daily, which companies to target, and how to stand out?' },
  { icon: '⚡', label: 'Auto-Fill Answers',    prompt: 'Generate optimized answers for common Easy Apply form questions: years of experience, cover letter, salary expectations, notice period. Tailor to my profile.' },
  { icon: '🧠', label: 'Skills Gap Analysis',  prompt: 'What skills am I missing to qualify for Senior/Staff engineer roles? Create a 30-day learning plan to close the gap.' },
];

// ─── Format bot response — convert ### headers, **bold**, bullet lists ───────
const formatBotText = (text) => {
  if (!text) return '';
  const lines = text.split('\n');
  const result = [];
  let key = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    // ### Heading
    if (line.startsWith('### ')) {
      result.push(
        <div key={key++} style={{ fontWeight: 700, fontSize: 14, color: 'var(--text-primary)', marginTop: 14, marginBottom: 4, borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: 4 }}>
          {line.replace('### ', '')}
        </div>
      );
      continue;
    }
    // ## Heading
    if (line.startsWith('## ')) {
      result.push(
        <div key={key++} style={{ fontWeight: 700, fontSize: 15, color: 'var(--accent-cyan)', marginTop: 16, marginBottom: 6 }}>
          {line.replace('## ', '')}
        </div>
      );
      continue;
    }
    // # Heading
    if (line.startsWith('# ')) {
      result.push(
        <div key={key++} style={{ fontWeight: 800, fontSize: 16, color: 'var(--text-primary)', marginTop: 16, marginBottom: 8 }}>
          {line.replace('# ', '')}
        </div>
      );
      continue;
    }
    // Bullet point
    if (line.startsWith('- ') || line.startsWith('* ')) {
      const content = line.slice(2);
      result.push(
        <div key={key++} style={{ display: 'flex', gap: 8, marginBottom: 4, alignItems: 'flex-start' }}>
          <span style={{ color: 'var(--accent-cyan)', flexShrink: 0, marginTop: 2 }}>•</span>
          <span style={{ fontSize: 13, lineHeight: 1.7, color: 'var(--text-secondary)' }}>{renderInline(content)}</span>
        </div>
      );
      continue;
    }
    // Numbered list
    const numMatch = line.match(/^(\d+)\.\s+(.+)/);
    if (numMatch) {
      result.push(
        <div key={key++} style={{ display: 'flex', gap: 8, marginBottom: 4, alignItems: 'flex-start' }}>
          <span style={{ color: 'var(--accent-cyan)', flexShrink: 0, fontWeight: 700, fontSize: 12, minWidth: 20, marginTop: 2 }}>{numMatch[1]}.</span>
          <span style={{ fontSize: 13, lineHeight: 1.7, color: 'var(--text-secondary)' }}>{renderInline(numMatch[2])}</span>
        </div>
      );
      continue;
    }
    // Empty line = spacer
    if (line.trim() === '') {
      result.push(<div key={key++} style={{ height: 6 }} />);
      continue;
    }
    // Normal paragraph
    result.push(
      <div key={key++} style={{ fontSize: 13, lineHeight: 1.75, color: 'var(--text-primary)', marginBottom: 2 }}>
        {renderInline(line)}
      </div>
    );
  }
  return result;
};

// ─── Render inline bold/italic ──────────────────────────────────
const renderInline = (text) => {
  const parts = text.split(/(\*\*[^*]+\*\*|\*[^*]+\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={i} style={{ color: 'var(--text-primary)', fontWeight: 700 }}>{part.slice(2, -2)}</strong>;
    }
    if (part.startsWith('*') && part.endsWith('*')) {
      return <em key={i} style={{ color: 'var(--text-secondary)' }}>{part.slice(1, -1)}</em>;
    }
    return part;
  });
};

// ─── Message bubble ───────────────────────────────────────────────
const Message = ({ msg, onCopy, copied }) => {
  const isBot = msg.role === 'assistant';
  return (
    <div style={{
      display: 'flex',
      flexDirection: isBot ? 'row' : 'row-reverse',
      gap: 10,
      marginBottom: 20,
      alignItems: 'flex-start',
    }}>
      {/* Avatar */}
      <div style={{
        width: 32, height: 32, borderRadius: '50%', flexShrink: 0,
        background: isBot ? 'rgba(0,200,255,0.15)' : 'rgba(123,63,255,0.2)',
        border: `1px solid ${isBot ? 'rgba(0,200,255,0.3)' : 'rgba(123,63,255,0.4)'}`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 14,
      }}>
        {isBot ? <Bot size={15} style={{ color: 'var(--accent-cyan)' }} /> : <User size={15} style={{ color: 'var(--accent-purple)' }} />}
      </div>

      {/* Bubble */}
      <div style={{
        maxWidth: '82%',
        background: isBot ? 'var(--bg-card)' : 'rgba(123,63,255,0.08)',
        border: `1px solid ${isBot ? 'var(--border)' : 'rgba(123,63,255,0.2)'}`,
        borderRadius: isBot ? '4px 12px 12px 12px' : '12px 4px 12px 12px',
        padding: '14px 16px',
        position: 'relative',
      }}>
        {msg.thinking && (
          <div style={{ display: 'flex', gap: 5, alignItems: 'center', color: 'var(--accent-cyan)', fontSize: 12 }}>
            <div style={{ display: 'flex', gap: 3 }}>
              {[0,1,2].map(i => (
                <div key={i} style={{
                  width: 6, height: 6, borderRadius: '50%',
                  background: 'var(--accent-cyan)',
                  animation: 'bounce 1.2s ease-in-out infinite',
                  animationDelay: `${i * 0.2}s`,
                }} />
              ))}
            </div>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11 }}>Agent thinking...</span>
          </div>
        )}
        {!msg.thinking && (
          <>
            {/* ── Render formatted content for bot, plain for user ── */}
            {isBot
              ? <div style={{ paddingRight: msg.content ? 20 : 0 }}>{formatBotText(msg.content)}</div>
              : <div style={{ fontSize: 13.5, lineHeight: 1.75, color: 'var(--text-primary)', whiteSpace: 'pre-wrap' }}>{msg.content}</div>
            }
            {isBot && msg.content && (
              <button
                onClick={() => onCopy(msg.id, msg.content)}
                style={{
                  position: 'absolute', top: 8, right: 8,
                  background: 'transparent', border: 'none',
                  cursor: 'pointer', padding: 4, borderRadius: 6,
                  color: 'var(--text-muted)', opacity: 0.6,
                  transition: 'all 0.2s',
                }}
                title="Copy response"
              >
                {copied === msg.id
                  ? <CheckCircle size={13} style={{ color: 'var(--accent-green)' }} />
                  : <Copy size={13} />}
              </button>
            )}
          </>
        )}
        <div style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', marginTop: 8, opacity: 0.5 }}>
          {msg.time}
        </div>
      </div>
    </div>
  );
};

// ─── MAIN CHATBOT COMPONENT ───────────────────────────────────────
const ChatBot = () => {
  const { userSettings, jobs, applications, resumes } = useApp();
  const [backendOnline, setBackendOnline] = useState(null);
  const [messages, setMessages] = useState([
    {
      id: 'welcome',
      role: 'assistant',
      content: `## LinkedAI Application Bot Ready! 🤖

I'm your advanced AI job application agent. I can:

- **Write optimized cover letters** tailored to specific roles
- **Auto-generate answers** for Easy Apply form questions
- **Analyze job-profile match** and rank opportunities
- **Craft personalized LinkedIn messages**
- **Build interview prep strategies**
- **Identify skills gaps** and create learning plans

Tell me what you need, or click a quick action below!`,
      time: 'now',
    }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(null);
  const [showActions, setShowActions] = useState(true);
  const chatRef = useRef(null);
  const inputRef = useRef(null);

  // Check backend health
  useEffect(() => {
    const check = async () => {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 4000);
        const res = await fetch(`${BACKEND}/api/health`, { signal: controller.signal });
        clearTimeout(timeoutId);
        setBackendOnline(res.ok);
      } catch {
        setBackendOnline(false);
      }
    };
    check();
    const interval = setInterval(check, 15000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (chatRef.current) chatRef.current.scrollTop = chatRef.current.scrollHeight;
  }, [messages]);

  const handleCopy = useCallback((id, text) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(id);
      setTimeout(() => setCopied(null), 2000);
    });
  }, []);

  const buildContext = useCallback(() => {
    const profile = {
      keywords: userSettings?.searchKeywords || 'Software Engineer',
      location: userSettings?.searchLocation || 'India',
      experience: `${userSettings?.yearsExperience || '3'} years`,
      currentCity: userSettings?.currentCity || 'Chennai',
      noticePeriod: userSettings?.noticePeriod || 'Immediately',
      expectedSalary: userSettings?.expectedSalary ? `₹${userSettings.expectedSalary}` : 'negotiable',
      englishProficiency: userSettings?.englishProficiency || 'Professional',
      coverLetter: userSettings?.coverLetter || '',
      linkedinUrl: userSettings?.linkedinProfileUrl || '',
      portfolioUrl: userSettings?.portfolioUrl || '',
    };
    const topJobs = (jobs || []).filter(j => j.score >= 70).slice(0, 5)
      .map(j => `- ${j.title} @ ${j.company} (${j.location}) — ${j.score}% match`).join('\n') || 'No jobs loaded yet.';
    return `
=== USER PROFILE ===
Role Target: ${profile.keywords}
Location: ${profile.location} (Currently in ${profile.currentCity})
Experience: ${profile.experience}
Notice Period: ${profile.noticePeriod}
Expected Salary: ${profile.expectedSalary}
English: ${profile.englishProficiency}
LinkedIn: ${profile.linkedinUrl || 'not set'}
Portfolio: ${profile.portfolioUrl || 'not set'}
Cover Letter: ${profile.coverLetter ? profile.coverLetter.slice(0, 200) + '...' : 'not provided'}

=== PIPELINE STATUS ===
Total Applications: ${(applications || []).length}
Applied: ${(applications || []).filter(a => a.status === 'applied').length}
Interviews: ${(applications || []).filter(a => a.status === 'interview').length}

=== TOP MATCHING JOBS ===
${topJobs}`.trim();
  }, [userSettings, jobs, applications]);

  // ── Call Groq directly (no backend needed) ────────────────────
  const callGroqDirect = useCallback(async (systemPrompt, history, userMessage) => {
    if (!GROQ_KEY) throw new Error('REACT_APP_GROQ_KEY not set in .env.local');
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${GROQ_KEY}` },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        max_tokens: 1500,
        temperature: 0.7,
        messages: [
          { role: 'system', content: systemPrompt },
          ...history,
          { role: 'user', content: userMessage },
        ],
      }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data?.error?.message || `Groq error ${res.status}`);
    return data.choices?.[0]?.message?.content || 'No response received.';
  }, []);

  const sendMessage = useCallback(async (text) => {
    const content = (text || input).trim();
    if (!content || loading) return;
    setInput('');
    setShowActions(false);

    const userMsg = { id: `u_${Date.now()}`, role: 'user', content, time: new Date().toLocaleTimeString() };
    const thinkingMsg = { id: `t_${Date.now()}`, role: 'assistant', thinking: true, content: '', time: '' };
    setMessages(prev => [...prev, userMsg, thinkingMsg]);
    setLoading(true);

    const context = buildContext();
    const history = messages
      .filter(m => !m.thinking && m.id !== 'welcome')
      .slice(-8)
      .map(m => ({ role: m.role, content: m.content }));

    const systemPrompt = `You are LinkedAI — an advanced AI job application agent. You help users optimize their job search, write cover letters, prep for interviews, and auto-fill application forms.

You have deep knowledge of:
- ATS optimization and resume writing
- Indian tech job market (startups, MNCs, product companies)  
- LinkedIn Easy Apply form strategies
- Behavioral and technical interview preparation
- Salary negotiation tactics for Indian tech roles

IMPORTANT FORMATTING RULES:
- Use ## for section headers
- Use **bold** for key terms and important phrases
- Use bullet lists (- item) for multiple points
- Use numbered lists for steps
- Write complete, ready-to-use text for cover letters and messages
- Be specific — give exact phrases and numbers, not generic advice
- Keep tone professional but warm

${context}`;

    try {
      let reply;
      // Try backend first, fall back to direct Groq
      if (backendOnline) {
        try {
          const response = await fetch(`${BACKEND}/api/chat/message`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ systemPrompt, messages: [...history, { role: 'user', content }] }),
          });
          const data = await response.json();
          if (!response.ok) throw new Error(data.error || `Backend error ${response.status}`);
          reply = data.reply;
        } catch {
          // Fall back to direct Groq
          reply = await callGroqDirect(systemPrompt, history, content);
        }
      } else {
        // Backend offline — use Groq directly
        reply = await callGroqDirect(systemPrompt, history, content);
      }

      setMessages(prev => {
        const filtered = prev.filter(m => !m.thinking);
        return [...filtered, { id: `a_${Date.now()}`, role: 'assistant', content: reply, time: new Date().toLocaleTimeString() }];
      });
    } catch (err) {
      setMessages(prev => {
        const filtered = prev.filter(m => !m.thinking);
        return [...filtered, {
          id: `err_${Date.now()}`,
          role: 'assistant',
          content: `## ❌ Error\n\n${err.message}\n\n**To fix:** Make sure REACT_APP_GROQ_KEY is set in your .env.local file and restart the app.`,
          time: new Date().toLocaleTimeString(),
        }];
      });
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  }, [input, loading, messages, buildContext, backendOnline, callGroqDirect]);

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  };

  const clearChat = () => {
    setMessages([{
      id: 'welcome2',
      role: 'assistant',
      content: '## Chat cleared 🔄\n\nHow can I help with your job applications?',
      time: new Date().toLocaleTimeString(),
    }]);
    setShowActions(true);
  };

  const profileComplete = !!(userSettings?.searchKeywords && userSettings?.yearsExperience);

  return (
    <div className="page-content animate-fade" style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 100px)', minHeight: 500 }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            width: 40, height: 40, borderRadius: 12,
            background: 'linear-gradient(135deg, rgba(0,200,255,0.2), rgba(123,63,255,0.2))',
            border: '1px solid rgba(0,200,255,0.3)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Sparkles size={18} style={{ color: 'var(--accent-cyan)' }} />
          </div>
          <div>
            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 18, margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
              Application Bot
              {backendOnline === true && <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', background: 'rgba(0,230,118,0.12)', border: '1px solid rgba(0,230,118,0.3)', borderRadius: 100, padding: '2px 8px', color: 'var(--accent-green)' }}>ONLINE</span>}
              {backendOnline === false && GROQ_KEY && <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', background: 'rgba(0,200,255,0.12)', border: '1px solid rgba(0,200,255,0.3)', borderRadius: 100, padding: '2px 8px', color: 'var(--accent-cyan)' }}>GROQ DIRECT</span>}
              {backendOnline === false && !GROQ_KEY && <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', background: 'rgba(255,59,92,0.12)', border: '1px solid rgba(255,59,92,0.3)', borderRadius: 100, padding: '2px 8px', color: 'var(--accent-red)' }}>OFFLINE</span>}
            </h2>
            <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', marginTop: 2 }}>
              AI-powered · Writes applications · Optimizes your profile
            </div>
          </div>
        </div>
        <button className="btn btn-secondary btn-sm" onClick={clearChat} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <RefreshCw size={12} /> Clear Chat
        </button>
      </div>

      {/* Status banners */}
      {backendOnline === false && !GROQ_KEY && (
        <div style={{ background: 'rgba(255,59,92,0.1)', border: '1px solid rgba(255,59,92,0.4)', borderRadius: 10, padding: '12px 16px', marginBottom: 12, flexShrink: 0, display: 'flex', alignItems: 'flex-start', gap: 10 }}>
          <AlertCircle size={16} style={{ color: '#ff3b5c', flexShrink: 0, marginTop: 1 }} />
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#ff3b5c', marginBottom: 4 }}>Backend offline & no Groq key</div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
              Either start the backend: <code style={{ background: 'rgba(0,0,0,0.3)', padding: '2px 6px', borderRadius: 4, color: '#00e676' }}>cd backend && node server.js</code><br/>
              Or add <code style={{ background: 'rgba(0,0,0,0.3)', padding: '2px 6px', borderRadius: 4, color: '#00e676' }}>REACT_APP_GROQ_KEY=your_key</code> to .env.local
            </div>
          </div>
        </div>
      )}
      {backendOnline === false && GROQ_KEY && (
        <div style={{ background: 'rgba(0,200,255,0.06)', border: '1px solid rgba(0,200,255,0.2)', borderRadius: 10, padding: '8px 14px', marginBottom: 12, flexShrink: 0, fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--accent-cyan)', display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--accent-cyan)' }} />
          Backend offline — using Groq AI directly (llama-3.3-70b)
        </div>
      )}
      {backendOnline === true && (
        <div style={{ background: 'rgba(0,230,118,0.06)', border: '1px solid rgba(0,230,118,0.2)', borderRadius: 10, padding: '8px 14px', marginBottom: 12, flexShrink: 0, fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--accent-green)', display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--accent-green)', boxShadow: '0 0 6px var(--accent-green)' }} />
          Backend online — powered by Groq AI (llama-3.3-70b)
        </div>
      )}

      {!profileComplete && (
        <div style={{ background: 'rgba(255,184,0,0.08)', border: '1px solid rgba(255,184,0,0.25)', borderRadius: 10, padding: '10px 16px', marginBottom: 12, fontSize: 12, color: 'var(--accent-amber)', flexShrink: 0 }}>
          ⚠️ <strong>Profile incomplete</strong> — go to <strong>Settings</strong> and fill in your experience, keywords, and profile data for personalized responses.
        </div>
      )}

      {profileComplete && (
        <div style={{ background: 'rgba(0,200,255,0.06)', border: '1px solid rgba(0,200,255,0.15)', borderRadius: 10, padding: '8px 14px', marginBottom: 12, fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)', flexShrink: 0, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <span style={{ color: 'var(--accent-cyan)' }}>🧠 Context loaded:</span>
          <span>🎯 {userSettings?.searchKeywords?.split(',')[0]?.trim()}</span>
          <span>📍 {userSettings?.currentCity || 'India'}</span>
          <span>⏱ {userSettings?.yearsExperience}yr exp</span>
          <span>📋 {(applications || []).length} applications</span>
        </div>
      )}

      {/* Chat Area */}
      <div ref={chatRef} style={{ flex: 1, overflowY: 'auto', paddingRight: 4, scrollbarWidth: 'thin' }}>
        {messages.map(msg => (
          <Message key={msg.id} msg={msg} onCopy={handleCopy} copied={copied} />
        ))}

        {/* Quick Actions */}
        {showActions && !loading && (
          <div style={{ marginTop: 8, marginBottom: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, cursor: 'pointer' }} onClick={() => setShowActions(v => !v)}>
              <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>QUICK ACTIONS</span>
              <ChevronDown size={12} style={{ color: 'var(--text-muted)' }} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 8 }}>
              {QUICK_ACTIONS.map(action => (
                <button key={action.label} onClick={() => sendMessage(action.prompt)} style={{
                  background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border)',
                  borderRadius: 10, padding: '10px 14px', cursor: 'pointer', textAlign: 'left',
                  transition: 'all 0.2s', display: 'flex', alignItems: 'center', gap: 8,
                }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(0,200,255,0.4)'; e.currentTarget.style.background = 'rgba(0,200,255,0.05)'; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.background = 'rgba(255,255,255,0.03)'; }}
                >
                  <span style={{ fontSize: 16 }}>{action.icon}</span>
                  <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{action.label}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Input Area */}
      <div style={{ marginTop: 16, flexShrink: 0, background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 14, padding: '12px 16px', display: 'flex', alignItems: 'flex-end', gap: 10 }}>
        <div style={{ flex: 1 }}>
          <textarea
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask me to write a cover letter, optimize your resume, prep for an interview..."
            disabled={loading}
            rows={1}
            style={{ width: '100%', background: 'transparent', border: 'none', outline: 'none', resize: 'none', fontFamily: 'var(--font-body)', fontSize: 13.5, color: 'var(--text-primary)', lineHeight: 1.6, minHeight: 20, maxHeight: 120, overflowY: 'auto' }}
            onInput={e => { e.target.style.height = 'auto'; e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px'; }}
          />
        </div>
        <button onClick={() => sendMessage()} disabled={loading || !input.trim()} style={{
          width: 36, height: 36, borderRadius: 10, border: 'none',
          background: loading || !input.trim() ? 'rgba(255,255,255,0.05)' : 'linear-gradient(135deg, var(--accent-cyan), #0080ff)',
          cursor: loading || !input.trim() ? 'default' : 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, transition: 'all 0.2s',
          color: loading || !input.trim() ? 'var(--text-muted)' : '#fff',
        }}>
          {loading
            ? <div style={{ width: 14, height: 14, border: '2px solid var(--text-muted)', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
            : <Send size={14} />}
        </button>
      </div>

      <div style={{ textAlign: 'center', marginTop: 8, fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', flexShrink: 0 }}>
        Press Enter to send · Shift+Enter for new line
      </div>

      <style>{`@keyframes bounce { 0%,60%,100%{transform:translateY(0)}30%{transform:translateY(-6px)} }`}</style>
    </div>
  );
};

export default ChatBot;
