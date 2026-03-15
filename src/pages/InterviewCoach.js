// ================================================================
//  InterviewCoach.js — AI-powered interview preparation page
// ================================================================
import React, { useState, useRef, useEffect } from 'react';
import { Brain, Mic, MicOff, RefreshCw, ChevronRight, Star, Volume2, Target, Zap, BookOpen, CheckCircle } from 'lucide-react';

const GROQ_API_KEY = process.env.REACT_APP_GROQ_KEY || '';
const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';

const CATEGORIES = [
  { id: 'behavioral',  label: 'Behavioral',    icon: '🧠', color: 'var(--accent-cyan)' },
  { id: 'technical',   label: 'Technical',     icon: '⚙️', color: 'var(--accent-purple)' },
  { id: 'system',      label: 'System Design', icon: '🏗️', color: 'var(--accent-amber)' },
  { id: 'leadership',  label: 'Leadership',    icon: '🌟', color: 'var(--accent-green)' },
  { id: 'situational', label: 'Situational',   icon: '🎯', color: '#F24E1E' },
];

const DIFFICULTY_LEVELS = ['Junior', 'Mid', 'Senior', 'Staff'];

async function groqAsk(messages, maxTokens = 800) {
  const res = await fetch(GROQ_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${GROQ_API_KEY}` },
    body: JSON.stringify({ model: 'llama-3.3-70b-versatile', max_tokens: maxTokens, messages }),
  });
  const data = await res.json();
  return data.choices?.[0]?.message?.content || '';
}

// ── Score badge ───────────────────────────────────────────────────
const ScoreBadge = ({ score }) => {
  const color = score >= 85 ? 'var(--accent-green)' : score >= 65 ? 'var(--accent-cyan)' : 'var(--accent-amber)';
  return (
    <div style={{
      display: 'inline-flex', alignItems: 'center', gap: 6,
      padding: '6px 14px', borderRadius: 100,
      background: `${color}18`, border: `1px solid ${color}40`,
      fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: 13, color,
    }}>
      <Star size={12} /> {score}/100
    </div>
  );
};

// ── Question Card ─────────────────────────────────────────────────
const QuestionCard = ({ q, onSelect, selected }) => (
  <div
    onClick={() => onSelect(q)}
    style={{
      padding: '14px 16px', borderRadius: 'var(--radius-md)',
      background: selected ? 'rgba(0,200,255,0.08)' : 'var(--bg-secondary)',
      border: `1px solid ${selected ? 'rgba(0,200,255,0.35)' : 'var(--border)'}`,
      cursor: 'pointer', transition: 'all 0.22s',
      transform: selected ? 'translateX(4px)' : 'none',
    }}
    onMouseEnter={e => { if (!selected) e.currentTarget.style.borderColor = 'var(--border-accent)'; }}
    onMouseLeave={e => { if (!selected) e.currentTarget.style.borderColor = 'var(--border)'; }}
  >
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <div style={{ fontSize: 16 }}>{q.icon}</div>
      <p style={{ fontSize: 13, color: selected ? 'var(--text-primary)' : 'var(--text-secondary)', lineHeight: 1.5, margin: 0 }}>
        {q.text}
      </p>
    </div>
    <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
      <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 20, background: 'var(--bg-card)', color: 'var(--text-muted)', border: '1px solid var(--border)', fontFamily: 'var(--font-mono)' }}>
        {q.category}
      </span>
      <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 20, background: 'var(--bg-card)', color: 'var(--text-muted)', border: '1px solid var(--border)', fontFamily: 'var(--font-mono)' }}>
        {q.difficulty}
      </span>
    </div>
  </div>
);

// ── Feedback Panel ────────────────────────────────────────────────
const FeedbackPanel = ({ feedback }) => {
  if (!feedback) return null;
  const sections = ['strengths', 'improvements', 'starStructure', 'followUp'];
  const labels = { strengths: '✅ Strengths', improvements: '🔧 Areas to Improve', starStructure: '⭐ STAR Analysis', followUp: '❓ Follow-up Question' };
  const colors = { strengths: 'var(--accent-green)', improvements: 'var(--accent-amber)', starStructure: 'var(--accent-cyan)', followUp: 'var(--accent-purple)' };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {sections.map(s => feedback[s] && (
        <div key={s} style={{
          padding: '12px 14px', borderRadius: 'var(--radius-md)',
          background: `${colors[s]}0c`, border: `1px solid ${colors[s]}25`,
        }}>
          <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: colors[s], marginBottom: 6, fontWeight: 700 }}>{labels[s]}</div>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6, margin: 0 }}>{feedback[s]}</p>
        </div>
      ))}
    </div>
  );
};

// ── MAIN PAGE ─────────────────────────────────────────────────────
const InterviewCoach = () => {
  const [role, setRole]           = useState('Frontend Engineer');
  const [company, setCompany]     = useState('');
  const [category, setCategory]   = useState('behavioral');
  const [difficulty, setDifficulty] = useState('Mid');
  const [questions, setQuestions] = useState([]);
  const [selected, setSelected]   = useState(null);
  const [answer, setAnswer]       = useState('');
  const [feedback, setFeedback]   = useState(null);
  const [score, setScore]         = useState(null);
  const [loading, setLoading]     = useState(false);
  const [genLoading, setGenLoading] = useState(false);
  const [recording, setRecording] = useState(false);
  const [history, setHistory]     = useState([]);
  const mediaRef = useRef(null);

  // Cleanup recording on unmount
  useEffect(() => {
    return () => {
      if (mediaRef.current) {
        try { mediaRef.current.abort(); } catch (_) {}
        mediaRef.current = null;
      }
    };
  }, []);

  // ── Generate Questions ─────────────────────────────────────────
  const generateQuestions = async () => {
    setGenLoading(true);
    try {
      const prompt = `Generate 6 ${difficulty}-level ${category} interview questions for a ${role} role${company ? ` at ${company}` : ''}.
Return ONLY valid JSON array — no markdown fences:
[{"text":"...","icon":"<emoji>","category":"${category}","difficulty":"${difficulty}"}]`;

      const raw = await groqAsk([
        { role: 'system', content: 'You are a senior technical interviewer. Return only valid JSON.' },
        { role: 'user', content: prompt },
      ], 600);

      const cleaned = raw.replace(/```json|```/g, '').trim();
      const parsed = JSON.parse(cleaned);
      setQuestions(parsed);
      setSelected(null);
      setAnswer('');
      setFeedback(null);
      setScore(null);
    } catch (e) {
      // Fallback questions
      setQuestions([
        { text: 'Tell me about a challenging project you worked on and how you overcame obstacles.', icon: '🏔️', category, difficulty },
        { text: `What makes you a strong candidate for this ${role} role?`, icon: '⭐', category, difficulty },
        { text: 'Describe a situation where you had to collaborate with a difficult team member.', icon: '🤝', category, difficulty },
        { text: 'How do you prioritize tasks when multiple deadlines are competing?', icon: '⏰', category, difficulty },
        { text: 'Tell me about a time you received critical feedback and how you responded.', icon: '💬', category, difficulty },
        { text: 'What is your greatest professional accomplishment?', icon: '🏆', category, difficulty },
      ]);
    }
    setGenLoading(false);
  };

  // ── Submit Answer for Feedback ─────────────────────────────────
  const submitAnswer = async () => {
    if (!answer.trim() || !selected) return;
    setLoading(true);
    setFeedback(null);
    setScore(null);

    try {
      const prompt = `Interview question: "${selected.text}"
Candidate answer: "${answer}"
Role: ${role}${company ? `, Company: ${company}` : ''}

Score this answer 0-100 and give structured feedback.
Return ONLY valid JSON (no markdown):
{"score":<number>,"strengths":"...","improvements":"...","starStructure":"...","followUp":"..."}`;

      const raw = await groqAsk([
        { role: 'system', content: 'You are a senior hiring manager. Give concise, specific feedback. Return only valid JSON.' },
        { role: 'user', content: prompt },
      ], 700);

      const cleaned = raw.replace(/```json|```/g, '').trim();
      const parsed = JSON.parse(cleaned);

      setFeedback(parsed);
      setScore(parsed.score);
      setHistory(prev => [{ question: selected.text, answer, score: parsed.score, feedback: parsed, time: new Date().toLocaleTimeString() }, ...prev.slice(0, 9)]);
    } catch (e) {
      setFeedback({ strengths: 'Good effort!', improvements: 'Try to structure your answer using the STAR method.', starStructure: 'Situation → Task → Action → Result', followUp: 'Can you give a specific example?' });
      setScore(70);
    }
    setLoading(false);
  };

  // ── Voice Recording (Web Speech API) ──────────────────────────
  const toggleRecording = () => {
    if (!('webkitSpeechRecognition' in window || 'SpeechRecognition' in window)) {
      alert('Speech recognition not supported in this browser. Try Chrome.');
      return;
    }
    if (recording) {
      mediaRef.current?.stop();
      setRecording(false);
      return;
    }
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SR();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';
    recognition.onresult = (e) => {
      const transcript = Array.from(e.results).map(r => r[0].transcript).join(' ');
      setAnswer(transcript);
    };
    recognition.onend = () => setRecording(false);
    recognition.start();
    mediaRef.current = recognition;
    setRecording(true);
  };

  const avgScore = history.length > 0 ? Math.round(history.reduce((s, h) => s + h.score, 0) / history.length) : null;

  return (
    <div className="page-content animate-fade">

      {/* ── HEADER ── */}
      <div style={{
        padding: '28px 32px', marginBottom: 24,
        background: 'linear-gradient(135deg, rgba(0,200,255,0.06), rgba(123,63,255,0.06))',
        border: '1px solid rgba(0,200,255,0.12)', borderRadius: 'var(--radius-xl)',
        position: 'relative', overflow: 'hidden',
      }}>
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: 'linear-gradient(90deg, var(--accent-cyan), var(--accent-purple))' }} />
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
            <div style={{
              width: 56, height: 56, borderRadius: 16, fontSize: 26,
              background: 'linear-gradient(135deg, rgba(0,200,255,0.15), rgba(123,63,255,0.15))',
              border: '1px solid rgba(0,200,255,0.3)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              animation: 'breathe 3s ease-in-out infinite',
            }}>🎤</div>
            <div>
              <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 24, fontWeight: 800, margin: 0 }}>
                AI Interview Coach
              </h2>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', marginTop: 4 }}>
                Practice interviews · Real AI feedback · Improve your score
              </div>
            </div>
          </div>
          {avgScore && (
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: 32, fontWeight: 800, color: avgScore >= 80 ? 'var(--accent-green)' : 'var(--accent-cyan)', lineHeight: 1 }}>{avgScore}</div>
              <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Avg Score</div>
            </div>
          )}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.4fr', gap: 20, alignItems: 'start' }}>

        {/* LEFT — Config + Questions */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* Config */}
          <div className="card">
            <div className="card-header">
              <div className="card-title"><Target size={14} /> Setup</div>
            </div>
            <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <label className="form-label">Target Role</label>
                <input className="form-input" value={role} onChange={e => setRole(e.target.value)} placeholder="e.g. Senior React Developer" />
              </div>
              <div>
                <label className="form-label">Company (optional)</label>
                <input className="form-input" value={company} onChange={e => setCompany(e.target.value)} placeholder="e.g. Google, Stripe" />
              </div>
              <div>
                <label className="form-label">Category</label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {CATEGORIES.map(c => (
                    <button
                      key={c.id}
                      onClick={() => setCategory(c.id)}
                      style={{
                        padding: '5px 12px', borderRadius: 100, cursor: 'pointer', fontSize: 12,
                        background: category === c.id ? `${c.color}18` : 'transparent',
                        border: `1px solid ${category === c.id ? c.color : 'var(--border)'}`,
                        color: category === c.id ? c.color : 'var(--text-muted)',
                        transition: 'all 0.2s', fontWeight: 600,
                      }}
                    >
                      {c.icon} {c.label}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="form-label">Difficulty</label>
                <div style={{ display: 'flex', gap: 6 }}>
                  {DIFFICULTY_LEVELS.map(d => (
                    <button
                      key={d}
                      onClick={() => setDifficulty(d)}
                      style={{
                        flex: 1, padding: '6px 0', borderRadius: 8, cursor: 'pointer', fontSize: 12,
                        background: difficulty === d ? 'rgba(0,200,255,0.12)' : 'transparent',
                        border: `1px solid ${difficulty === d ? 'rgba(0,200,255,0.4)' : 'var(--border)'}`,
                        color: difficulty === d ? 'var(--accent-cyan)' : 'var(--text-muted)',
                        transition: 'all 0.2s', fontWeight: 600,
                      }}
                    >
                      {d}
                    </button>
                  ))}
                </div>
              </div>
              <button className="btn btn-primary w-full" onClick={generateQuestions} disabled={genLoading}>
                {genLoading ? <><div className="spinner" style={{ width: 14, height: 14, borderWidth: 2 }} /> Generating...</> : <><Brain size={14} /> Generate Questions</>}
              </button>
            </div>
          </div>

          {/* Questions List */}
          {questions.length > 0 && (
            <div className="card">
              <div className="card-header">
                <div className="card-title"><BookOpen size={14} /> Questions</div>
                <span className="badge badge-cyan">{questions.length}</span>
              </div>
              <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {questions.map((q, i) => (
                  <QuestionCard key={i} q={q} onSelect={setSelected} selected={selected?.text === q.text} />
                ))}
              </div>
            </div>
          )}

          {/* History */}
          {history.length > 0 && (
            <div className="card">
              <div className="card-header">
                <div className="card-title"><Zap size={14} /> Session History</div>
                <span className="badge badge-muted">{history.length} answered</span>
              </div>
              <div className="card-body" style={{ padding: '0 20px' }}>
                {history.map((h, i) => (
                  <div key={i} style={{ padding: '10px 0', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 12, color: 'var(--text-secondary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 200 }}>{h.question}</div>
                      <div style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>{h.time}</div>
                    </div>
                    <ScoreBadge score={h.score} />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* RIGHT — Practice Area */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          {selected ? (
            <>
              {/* Question */}
              <div style={{
                padding: '20px 24px',
                background: 'linear-gradient(135deg, rgba(0,200,255,0.06), rgba(123,63,255,0.06))',
                border: '1px solid rgba(0,200,255,0.2)', borderRadius: 'var(--radius-lg)',
              }}>
                <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--accent-cyan)', letterSpacing: '0.1em', marginBottom: 10 }}>INTERVIEW QUESTION</div>
                <p style={{ fontFamily: 'var(--font-display)', fontSize: 17, fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1.5, margin: 0 }}>
                  {selected.icon} {selected.text}
                </p>
                <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                  <span className="badge badge-cyan">{selected.category}</span>
                  <span className="badge badge-purple">{selected.difficulty}</span>
                </div>
              </div>

              {/* STAR method guide */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
                {[
                  { letter: 'S', word: 'Situation', tip: 'Set the scene', color: '#00c8ff' },
                  { letter: 'T', word: 'Task', tip: 'Your responsibility', color: '#7b3fff' },
                  { letter: 'A', word: 'Action', tip: 'Steps you took', color: '#00e676' },
                  { letter: 'R', word: 'Result', tip: 'The outcome', color: '#ffb800' },
                ].map(s => (
                  <div key={s.letter} style={{
                    padding: '10px', textAlign: 'center', borderRadius: 10,
                    background: `${s.color}0c`, border: `1px solid ${s.color}25`,
                  }}>
                    <div style={{ fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 900, color: s.color }}>{s.letter}</div>
                    <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-primary)' }}>{s.word}</div>
                    <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>{s.tip}</div>
                  </div>
                ))}
              </div>

              {/* Answer area */}
              <div className="card">
                <div className="card-header">
                  <div className="card-title">Your Answer</div>
                  <button
                    onClick={toggleRecording}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px',
                      borderRadius: 8, cursor: 'pointer', fontSize: 12, fontWeight: 600,
                      background: recording ? 'rgba(255,59,92,0.1)' : 'rgba(0,200,255,0.08)',
                      border: `1px solid ${recording ? 'rgba(255,59,92,0.3)' : 'rgba(0,200,255,0.2)'}`,
                      color: recording ? 'var(--accent-red)' : 'var(--accent-cyan)',
                      animation: recording ? 'borderGlow 1s ease-in-out infinite' : 'none',
                    }}
                  >
                    {recording ? <><MicOff size={13} /> Stop Recording</> : <><Mic size={13} /> Record Answer</>}
                  </button>
                </div>
                <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <textarea
                    className="form-textarea"
                    style={{ minHeight: 140, resize: 'vertical', lineHeight: 1.7 }}
                    placeholder="Type your answer here, or click 'Record Answer' to speak... Use the STAR method above for structure."
                    value={answer}
                    onChange={e => setAnswer(e.target.value)}
                  />
                  <div style={{ display: 'flex', gap: 10 }}>
                    <button
                      className="btn btn-secondary"
                      onClick={() => { setAnswer(''); setFeedback(null); setScore(null); }}
                      style={{ flexShrink: 0 }}
                    >
                      <RefreshCw size={12} /> Clear
                    </button>
                    <button
                      className="btn btn-primary w-full"
                      onClick={submitAnswer}
                      disabled={loading || !answer.trim()}
                    >
                      {loading ? <><div className="spinner" style={{ width: 14, height: 14, borderWidth: 2 }} /> Analyzing...</> : <><Brain size={14} /> Get AI Feedback</>}
                    </button>
                  </div>
                </div>
              </div>

              {/* Feedback */}
              {feedback && score !== null && (
                <div className="card animate-scale">
                  <div className="card-header">
                    <div className="card-title"><CheckCircle size={14} style={{ color: 'var(--accent-green)' }} /> AI Feedback</div>
                    <ScoreBadge score={score} />
                  </div>
                  <div className="card-body">
                    <FeedbackPanel feedback={feedback} />
                    <button
                      className="btn btn-secondary w-full"
                      onClick={() => { setSelected(null); setAnswer(''); setFeedback(null); setScore(null); }}
                      style={{ marginTop: 14 }}
                    >
                      <ChevronRight size={13} /> Next Question
                    </button>
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="card">
              <div className="empty-state" style={{ padding: '60px 24px' }}>
                <div style={{ fontSize: 48, marginBottom: 16 }}>🎤</div>
                <h3>Ready to Practice?</h3>
                <p style={{ marginBottom: 20, maxWidth: 280 }}>Generate questions using the panel on the left, then select one to start practicing.</p>
                <button className="btn btn-primary" onClick={generateQuestions} disabled={genLoading}>
                  {genLoading ? 'Generating...' : <><Brain size={14} /> Generate Questions</>}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default InterviewCoach;
