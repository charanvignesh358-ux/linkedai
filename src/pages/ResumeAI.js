// ================================================================
//  ResumeAI.js — World-Class AI Resume Creator
//  The most advanced resume builder in LinkedAI
//  Features:
//  ✅ Multi-step wizard (5 steps)
//  ✅ Real-time streaming generation (word by word)
//  ✅ 20-factor scoring with sub-breakdown
//  ✅ Radar chart visualization
//  ✅ Before/After comparison diff
//  ✅ Score history chart
//  ✅ LinkedIn summary + cover letter generator
//  ✅ Interview Q predictor with answer coaching
//  ✅ One-click smart fixes per issue
//  ✅ 6 industries × 4 styles × 6 levels
//  ✅ Resume templates (Classic, Modern, Minimal)
//  ✅ ATS simulation scan
//  ✅ Export: TXT, MD, copy
// ================================================================

import React, { useState, useRef, useCallback, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import {
  FileText, Zap, Target, BarChart2, Lightbulb,
  ChevronRight, ChevronLeft, RefreshCw, Copy,
  CheckCircle, Download, Save, Star, TrendingUp,
  AlertTriangle, ArrowUp, Eye, Brain, Sparkles,
} from 'lucide-react';

const GROQ_URL  = 'https://api.groq.com/openai/v1/chat/completions';
const GROQ_KEY  = process.env.REACT_APP_GROQ_KEY || '';
const MODEL     = 'llama-3.3-70b-versatile';

// ─── Groq helper ─────────────────────────────────────────────────
async function askGroq(system, user, maxTokens = 2000, temp = 0.35) {
  if (!GROQ_KEY) throw new Error('REACT_APP_GROQ_KEY not set in .env.local');
  const res = await fetch(GROQ_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${GROQ_KEY}` },
    body: JSON.stringify({
      model: MODEL, max_tokens: maxTokens, temperature: temp,
      messages: [{ role: 'system', content: system }, { role: 'user', content: user }],
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error?.message || `Groq ${res.status}`);
  return data.choices?.[0]?.message?.content?.trim() || '';
}

function parseJSON(raw) {
  try {
    const clean = raw.replace(/```json|```/g, '').replace(/^[^[{]*/, '').replace(/[^}\]]*$/, '').trim();
    return JSON.parse(clean);
  } catch { return null; }
}

// ─── Constants ────────────────────────────────────────────────────
const INDUSTRIES = [
  { id: 'tech',    label: '💻 Tech',        kw: 'React, Node.js, Python, AWS, Docker, CI/CD, agile, microservices' },
  { id: 'finance', label: '💰 Finance',     kw: 'financial modeling, risk analysis, Excel, Bloomberg, compliance, P&L' },
  { id: 'mktg',    label: '📣 Marketing',   kw: 'SEO, Google Analytics, campaign management, conversion optimization, CRM' },
  { id: 'design',  label: '🎨 Design',      kw: 'UI/UX, Figma, user research, wireframing, design systems, A/B testing' },
  { id: 'data',    label: '📊 Data',        kw: 'Python, SQL, Machine Learning, TensorFlow, Power BI, data pipelines' },
  { id: 'ops',     label: '⚙️ Operations',  kw: 'supply chain, lean, Six Sigma, process optimization, KPI, logistics' },
];

const STYLES = [
  { id: 'modern',   label: '✨ Modern',    desc: 'Clean & impactful — startups & product companies' },
  { id: 'exec',     label: '🌟 Executive', desc: 'Strategic & board-level — Director/VP/C-suite' },
  { id: 'fresher',  label: '🎓 Fresher',   desc: 'Education-first — 0-2 years experience' },
  { id: 'pivot',    label: '🚀 Career Pivot', desc: 'Reframe experience for a new industry' },
];

const LEVELS = [
  { id: 'intern', label: 'Intern' },
  { id: 'entry',  label: 'Entry (0-2y)' },
  { id: 'mid',    label: 'Mid (3-6y)' },
  { id: 'senior', label: 'Senior (7-12y)' },
  { id: 'lead',   label: 'Lead / Manager' },
  { id: 'exec',   label: 'Director / VP' },
];

const QUICK_FIXES = [
  { emoji: '📈', label: 'Add Metrics',    prompt: 'Add specific numbers, percentages, team sizes, and revenue figures to every bullet point. Quantify every achievement.' },
  { emoji: '🔥', label: 'Power Verbs',    prompt: 'Replace every weak verb with a strong action verb: Led, Architected, Scaled, Spearheaded, Engineered, Delivered, Launched, Optimized, Transformed, Streamlined.' },
  { emoji: '🎯', label: 'Keyword Boost',  prompt: 'Naturally integrate more industry and role-specific keywords from the job description throughout skills, summary, and experience sections.' },
  { emoji: '✏️', label: 'Better Summary', prompt: 'Rewrite the Professional Summary to be a 4-line powerhouse: start with a strong hook, mention years of experience, include 3 quantified achievements, end with career goal.' },
  { emoji: '✂️', label: 'Make Concise',   prompt: 'Cut every bullet to max 2 lines. Remove filler words. Make every word count. Keep only the most impactful information.' },
  { emoji: '🏆', label: 'Add Impact',     prompt: 'Enhance every experience section with the business impact: what improved, what was saved, what grew. Make the reader understand WHY this matters.' },
];

const SCORE_DIMS = [
  { key: 'content_quality',   label: 'Content Quality',   pct: '20%', color: '#06b6d4', icon: '📝' },
  { key: 'ats_compatibility', label: 'ATS Compatibility', pct: '20%', color: '#22c55e', icon: '🤖' },
  { key: 'keyword_alignment', label: 'Keyword Match',     pct: '25%', color: '#3b82f6', icon: '🎯' },
  { key: 'impact_score',      label: 'Impact & Results',  pct: '20%', color: '#f59e0b', icon: '📈' },
  { key: 'best_practices',    label: 'Best Practices',    pct: '15%', color: '#8b5cf6', icon: '✅' },
];

// ─── Animated score ring ─────────────────────────────────────────
const ScoreRing = ({ score, size = 90 }) => {
  const r = size / 2 - 7;
  const c = 2 * Math.PI * r;
  const offset = c - (score / 100) * c;
  const col = score >= 85 ? '#22c55e' : score >= 70 ? '#06b6d4' : score >= 55 ? '#f59e0b' : '#ef4444';
  const label = score >= 85 ? 'Excellent' : score >= 70 ? 'Good' : score >= 55 ? 'Fair' : 'Needs Work';
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={7}/>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={col} strokeWidth={7}
          strokeDasharray={c} strokeDashoffset={offset} strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 1.2s ease' }}
        />
        <text x={size/2} y={size/2} textAnchor="middle" dominantBaseline="central"
          style={{ fill: col, fontSize: size * 0.27, fontWeight: 900, fontFamily: 'Inter,sans-serif',
            transform: 'rotate(90deg)', transformOrigin: `${size/2}px ${size/2}px` }}>
          {score}
        </text>
      </svg>
      <span style={{ fontSize: 11, fontWeight: 700, color: col, fontFamily: 'var(--font-mono)' }}>{label}</span>
    </div>
  );
};

// ─── Mini bar ────────────────────────────────────────────────────
const ScoreBar = ({ val, color, label, icon }) => (
  <div>
    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
      <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{icon} {label}</span>
      <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color, fontWeight: 800 }}>{val ?? 0}</span>
    </div>
    <div style={{ height: 5, background: 'rgba(255,255,255,0.06)', borderRadius: 3, overflow: 'hidden' }}>
      <div style={{ height: '100%', width: `${val ?? 0}%`, background: `linear-gradient(90deg,${color}70,${color})`, borderRadius: 3, transition: 'width 1.2s ease' }}/>
    </div>
  </div>
);

// ─── Radar chart (SVG) ───────────────────────────────────────────
const RadarChart = ({ scores, size = 180 }) => {
  if (!scores) return null;
  const dims = SCORE_DIMS;
  const cx = size / 2, cy = size / 2, R = size / 2 - 20;
  const N = dims.length;
  const pts = (vals) => dims.map((d, i) => {
    const angle = (i / N) * 2 * Math.PI - Math.PI / 2;
    const r = R * (vals[i] / 100);
    return [cx + r * Math.cos(angle), cy + r * Math.sin(angle)];
  });
  const gridPts = (ratio) => dims.map((_, i) => {
    const angle = (i / N) * 2 * Math.PI - Math.PI / 2;
    return [cx + R * ratio * Math.cos(angle), cy + R * ratio * Math.sin(angle)];
  });
  const toPath = (pts) => pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ') + 'Z';

  const dataVals = dims.map(d => scores[d.key] ?? 0);
  const dataPts  = pts(dataVals);

  return (
    <svg width={size} height={size}>
      {[0.2,0.4,0.6,0.8,1].map(r => (
        <polygon key={r} points={gridPts(r).map(p => p.join(',')).join(' ')}
          fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth={1}/>
      ))}
      {dims.map((_, i) => {
        const angle = (i / N) * 2 * Math.PI - Math.PI / 2;
        return <line key={i} x1={cx} y1={cy} x2={cx + R * Math.cos(angle)} y2={cy + R * Math.sin(angle)} stroke="rgba(255,255,255,0.07)" strokeWidth={1}/>;
      })}
      <path d={toPath(dataPts)} fill="rgba(59,130,246,0.18)" stroke="#3b82f6" strokeWidth={2}/>
      {dataPts.map((p, i) => <circle key={i} cx={p[0]} cy={p[1]} r={3} fill={dims[i].color}/>)}
      {dims.map((d, i) => {
        const angle = (i / N) * 2 * Math.PI - Math.PI / 2;
        const lx = cx + (R + 14) * Math.cos(angle);
        const ly = cy + (R + 14) * Math.sin(angle);
        return (
          <text key={i} x={lx} y={ly} textAnchor="middle" dominantBaseline="central"
            style={{ fontSize: 9, fill: d.color, fontFamily: 'Inter,sans-serif', fontWeight: 700 }}>
            {d.icon}
          </text>
        );
      })}
    </svg>
  );
};

// ─── Mini score history sparkline ────────────────────────────────
const Sparkline = ({ history }) => {
  if (history.length < 2) return null;
  const W = 120, H = 32;
  const min = Math.min(...history.map(h => h.score)) - 2;
  const max = Math.max(...history.map(h => h.score)) + 2;
  const xStep = W / (history.length - 1);
  const pts = history.map((h, i) => `${i * xStep},${H - ((h.score - min) / (max - min)) * H}`);
  const last = history[history.length - 1];
  const prev = history[history.length - 2];
  const delta = last.score - prev.score;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <svg width={W} height={H}>
        <polyline points={pts.join(' ')} fill="none" stroke="#3b82f6" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"/>
        {pts.map((p, i) => { const [x, y] = p.split(','); return <circle key={i} cx={x} cy={y} r={2.5} fill={i === pts.length - 1 ? '#22c55e' : '#3b82f6'}/>; })}
      </svg>
      <span style={{ fontSize: 12, fontWeight: 800, color: delta >= 0 ? '#22c55e' : '#ef4444' }}>
        {delta >= 0 ? '↑' : '↓'}{Math.abs(delta)}
      </span>
    </div>
  );
};

// ─── Step indicator ──────────────────────────────────────────────
const Steps = ({ current, total, labels }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 0, marginBottom: 24 }}>
    {labels.map((label, i) => {
      const done = i < current;
      const active = i === current;
      return (
        <React.Fragment key={i}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
            <div style={{
              width: 32, height: 32, borderRadius: '50%',
              background: done ? '#22c55e' : active ? '#3b82f6' : 'rgba(255,255,255,0.07)',
              border: `2px solid ${done ? '#22c55e' : active ? '#3b82f6' : 'rgba(255,255,255,0.12)'}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 13, fontWeight: 800,
              color: done || active ? '#fff' : 'var(--text-muted)',
              transition: 'all 0.3s',
            }}>
              {done ? '✓' : i + 1}
            </div>
            <span style={{ fontSize: 9, color: active ? '#60a5fa' : done ? '#4ade80' : 'var(--text-muted)', fontWeight: 600, whiteSpace: 'nowrap', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              {label}
            </span>
          </div>
          {i < total - 1 && (
            <div style={{ flex: 1, height: 2, background: done ? '#22c55e' : 'rgba(255,255,255,0.08)', marginBottom: 20, transition: 'background 0.4s' }}/>
          )}
        </React.Fragment>
      );
    })}
  </div>
);

// ================================================================
//  MAIN PAGE
// ================================================================
const ResumeAI = () => {
  const { userSettings, persistSettings } = useApp();

  // ─── Form state ─────────────────────────────────────────────
  const [step, setStep]             = useState(0); // 0-4
  const [name, setName]             = useState('');
  const [email, setEmail]           = useState('');
  const [phone, setPhone]           = useState('');
  const [location, setLocation]     = useState('');
  const [linkedin, setLinkedin]     = useState('');
  const [portfolio, setPortfolio]   = useState('');
  const [title, setTitle]           = useState('');
  const [industry, setIndustry]     = useState('tech');
  const [style, setStyle]           = useState('modern');
  const [level, setLevel]           = useState('mid');
  const [skills, setSkills]         = useState('');
  const [experience, setExperience] = useState('');
  const [education, setEducation]   = useState('');
  const [awards, setAwards]         = useState('');
  const [summary, setSummary]       = useState('');
  const [jobDesc, setJobDesc]       = useState('');

  // ─── Output state ───────────────────────────────────────────
  const [resume,       setResume]       = useState('');
  const [streamText,   setStreamText]   = useState('');
  const [scores,       setScores]       = useState(null);
  const [scoreHistory, setScoreHistory] = useState([]);
  const [beforeResume, setBeforeResume] = useState('');
  const [compareMode,  setCompareMode]  = useState(false);

  // ─── Insights ────────────────────────────────────────────────
  const [linkedinAbout,  setLinkedinAbout]  = useState('');
  const [coverLetter,    setCoverLetter]    = useState('');
  const [interviewQs,    setInterviewQs]    = useState([]);
  const [atsScan,        setAtsScan]        = useState(null);
  const [insightTab,     setInsightTab]     = useState('linkedin');

  // ─── UI state ────────────────────────────────────────────────
  const [phase,         setPhase]         = useState('idle'); // idle|writing|scoring|done
  const [outputTab,     setOutputTab]     = useState('resume'); // resume|score|insights
  const [improveOpen,   setImproveOpen]   = useState(false);
  const [improveTip,    setImproveTip]    = useState('');
  const [copied,        setCopied]        = useState(false);
  const [saved,         setSaved]         = useState(false);
  const [error,         setError]         = useState('');
  const [loadingInsight,setLoadingInsight]= useState('');

  const isLoading = phase === 'writing' || phase === 'scoring' || !!loadingInsight;

  // Pre-fill from settings
  useEffect(() => {
    if (userSettings) {
      if (userSettings.phone)              setPhone(userSettings.phone);
      if (userSettings.linkedinProfileUrl) setLinkedin(userSettings.linkedinProfileUrl);
      if (userSettings.portfolioUrl)       setPortfolio(userSettings.portfolioUrl);
      if (userSettings.currentCity)        setLocation(userSettings.currentCity + (userSettings.currentCountry ? `, ${userSettings.currentCountry}` : ''));
      if (userSettings.searchKeywords)     setTitle(userSettings.searchKeywords.split(',')[0]?.trim() || '');
    }
  }, [userSettings]);

  // ─── Build full profile context ─────────────────────────────
  const buildProfile = useCallback(() => {
    const ind = INDUSTRIES.find(i => i.id === industry);
    const lvl = LEVELS.find(l => l.id === level);
    const sty = STYLES.find(s => s.id === style);
    return [
      `NAME: ${name}`,
      email    ? `EMAIL: ${email}`       : '',
      phone    ? `PHONE: ${phone}`       : '',
      location ? `LOCATION: ${location}` : '',
      linkedin ? `LINKEDIN: ${linkedin}` : '',
      portfolio? `PORTFOLIO: ${portfolio}`: '',
      `TARGET ROLE: ${title}`,
      `INDUSTRY: ${ind?.label}`,
      `CAREER LEVEL: ${lvl?.label}`,
      `RESUME STYLE: ${sty?.label} — ${sty?.desc}`,
      skills     ? `\nCORE SKILLS: ${skills}`              : '',
      summary    ? `\nCANDIDATE SUMMARY: ${summary}`       : '',
      experience ? `\nWORK EXPERIENCE:\n${experience}`     : '',
      education  ? `\nEDUCATION:\n${education}`            : '',
      awards     ? `\nAWARDS/CERTS/PROJECTS:\n${awards}`   : '',
      userSettings?.yearsExperience ? `TOTAL EXPERIENCE: ${userSettings.yearsExperience} years` : '',
      userSettings?.noticePeriod    ? `NOTICE PERIOD: ${userSettings.noticePeriod}`              : '',
      jobDesc ? `\n\nTARGET JOB DESCRIPTION (for keyword matching):\n${jobDesc}` : '',
    ].filter(Boolean).join('\n');
  }, [name,email,phone,location,linkedin,portfolio,title,industry,level,style,skills,summary,experience,education,awards,jobDesc,userSettings]);

  // ─── PHASE 1: Generate Resume ────────────────────────────────
  const generate = useCallback(async () => {
    if (!name.trim() || !title.trim() || !skills.trim()) {
      setError('Please fill in Name, Target Role, and Skills before generating.');
      return;
    }
    setError('');
    setPhase('writing');
    setResume(''); setStreamText(''); setScores(null);
    setCompareMode(false); setBeforeResume('');
    setLinkedinAbout(''); setCoverLetter(''); setInterviewQs([]); setAtsScan(null);
    setOutputTab('resume');

    try {
      const profile = buildProfile();
      const ind = INDUSTRIES.find(i => i.id === industry);
      const lvl = LEVELS.find(l => l.id === level);
      const sty = STYLES.find(s => s.id === style);

      const styleGuide = {
        modern:  'Modern startup style: punchy summary, skills matrix, achievement-led bullets. Every bullet = impact + metric. Perfect for tech/startup hiring managers.',
        exec:    'Executive style: open with board-level strategic impact, revenue/cost impact, team scale. Quantify everything at scale (e.g. $50M budget, 200-person org). C-suite gravitas.',
        fresher: 'Fresher style: lead with education, GPA, relevant coursework. Projects section is primary showcase. Internships detailed. Transferable skills. Certifications prominent.',
        pivot:   'Career pivot style: strong transferable skills summary, reframe ALL previous experience in terms of the new role\'s needs. Clear narrative arc. Bridge-building language.',
      };

      // WORLD-CLASS SYSTEM PROMPT
      const SYSTEM = `You are the world's best executive resume writer — you've placed candidates at Google, McKinsey, Goldman Sachs, and Series A startups. You've written 100,000+ resumes and know exactly what makes the difference between a callback and rejection.

## STYLE DIRECTIVE
${styleGuide[style]}

## INDUSTRY CONTEXT
${ind?.label} — naturally embed these keywords throughout: ${ind?.kw}

## CAREER LEVEL
${lvl?.label} — calibrate scope, responsibility, and language accordingly.

## NON-NEGOTIABLE RULES
1. EVERY bullet starts with a STRONG PAST-TENSE ACTION VERB (Engineered, Scaled, Led, Reduced, Grew, Launched, Architected, Delivered, Spearheaded, Transformed, Drove, Pioneered)
2. EVERY achievement MUST include at least one metric: %, $, x (multiplier), number of users/customers/team members, time saved
   ✗ BAD: "Worked on performance improvements"
   ✓ GOOD: "Engineered caching layer that reduced API latency by 67% and saved $18K/month in cloud costs"
3. PROFESSIONAL SUMMARY: 4-5 lines = [who you are] + [X years in field] + [2-3 quantified achievements] + [your unique value] + [what you seek]
4. ATS FORMAT: Single column, ALL CAPS section headers, bullet points with •, consistent date format (Mon YYYY), NO tables/graphics/columns
5. Sections in ORDER: [HEADER — Name, Contact, LinkedIn, Portfolio] → [PROFESSIONAL SUMMARY] → [CORE COMPETENCIES / TECHNICAL SKILLS (organized by category)] → [PROFESSIONAL EXPERIENCE (reverse chronological)] → [EDUCATION] → [CERTIFICATIONS / PROJECTS / ACHIEVEMENTS]
6. Skills: group into categories: Languages: ... | Frameworks: ... | Cloud: ... | Tools: ...
7. Each role: company name + 1-line description of the company → role title → dates → 4-6 bullets
8. Keywords from JD must appear verbatim where relevant (ATS exact-match)
9. Length: 1 page for <5 years, 2 pages for 5+ years — fill it properly, no padding
10. Make it GENUINELY IMPRESSIVE — the kind that gets callbacks at top companies`;

      const generated = await askGroq(SYSTEM,
        `Create a COMPLETE, submission-ready resume for the following candidate. Every bullet must be specific, quantified, and powerful.\n\n${profile}\n\nWrite the full resume now. Include every section. Make it outstanding.`,
        2400
      );

      // Stream it word-by-word for great UX
      const words = generated.split(/(\s+)/);
      let acc = '';
      for (let i = 0; i < words.length; i++) {
        acc += words[i];
        if (i % 6 === 0) {
          setStreamText(acc + '▊');
          await new Promise(r => setTimeout(r, 12));
        }
      }
      setStreamText('');
      setResume(generated);
      setPhase('scoring');
      await runScore(generated);
    } catch (err) {
      setError(err.message);
      setPhase('idle');
    }
  }, [buildProfile, industry, level, style, name, title, skills]);

  // ─── PHASE 2: Run 20-factor score ───────────────────────────
  const runScore = useCallback(async (resumeText) => {
    const ind = INDUSTRIES.find(i => i.id === industry);
    const lvl = LEVELS.find(l => l.id === level);
    const SCORE_SYSTEM = `You are the most rigorous AI resume scorer used by top recruiting firms. You evaluate resumes with precision. Return ONLY a valid JSON object — no markdown, no text outside the braces.`;

    const SCORE_PROMPT = `Score this resume for the role of "${title}" (${ind?.label}, ${lvl?.label}).
${jobDesc ? `\nJob Description:\n${jobDesc}\n` : ''}

Resume:
${resumeText}

Return ONLY valid JSON (no markdown, no text before/after):
{
  "overall_score": <0-100, weighted average>,
  "content_quality": <0-100>,
  "ats_compatibility": <0-100>,
  "keyword_alignment": <0-100>,
  "impact_score": <0-100>,
  "best_practices": <0-100>,
  "sub": {
    "professional_summary_quality": <0-100>,
    "experience_depth": <0-100>,
    "skills_relevance": <0-100>,
    "education_quality": <0-100>,
    "achievement_specificity": <0-100>,
    "action_verb_strength": <0-100>,
    "quantification_rate": <0-100>,
    "keyword_density": <0-100>,
    "format_clarity": <0-100>,
    "section_completeness": <0-100>,
    "consistency": <0-100>,
    "length_fit": <0-100>,
    "industry_fit": <0-100>,
    "progression_clarity": <0-100>,
    "uniqueness": <0-100>
  },
  "hire_probability": "<low|medium|high|very_high>",
  "application_ready": <true|false>,
  "action_verb_quality": "<poor|fair|good|excellent>",
  "quantification_rate": <0-100>,
  "strengths": ["<specific strength 1>", "<specific strength 2>", "<specific strength 3>"],
  "improvements": ["<fix 1>", "<fix 2>", "<fix 3>"],
  "missing_keywords": "<comma-separated keywords missing from resume>",
  "best_bullet": "<copy the single best bullet from the resume>",
  "worst_bullet": "<copy the single weakest bullet from the resume>",
  "verdict": "<2-sentence professional assessment>",
  "recruiter_take": "<what a recruiter thinks in the first 6 seconds>",
  "competitive_edge": "<what uniquely sets this candidate apart>"
}

Scoring weights: content_quality(20%) + ats_compatibility(20%) + keyword_alignment(25%) + impact_score(20%) + best_practices(15%)
Be strict and accurate. A score of 85+ means truly exceptional.`;

    try {
      const raw = await askGroq(SCORE_SYSTEM, SCORE_PROMPT, 1400, 0.1);
      const parsed = parseJSON(raw);
      if (parsed && parsed.overall_score) {
        setScores(parsed);
        setScoreHistory(prev => [...prev, {
          score: parsed.overall_score,
          label: `v${prev.length + 1}`,
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        }]);
        setOutputTab('score');
      }
    } catch (err) {
      console.warn('Score error:', err);
    }
    setPhase('done');
  }, [industry, level, title, jobDesc]);

  // ─── Improve resume ─────────────────────────────────────────
  const improve = useCallback(async (tip) => {
    if (!resume || !tip) return;
    setBeforeResume(resume);
    setPhase('writing');
    setImproveOpen(false);
    try {
      const improved = await askGroq(
        `You are an elite resume editor. Apply the requested improvement with absolute precision. Rules:
        - Keep ALL factual information 100% intact (names, dates, companies, titles, education)
        - Only enhance language, add inferred metrics, improve structure
        - Apply the change COMPREHENSIVELY throughout the entire document
        - Return ONLY the complete improved resume — no commentary, no explanation`,
        `RESUME:\n${resume}\n\nIMPROVEMENT: ${tip}\n\nReturn the complete improved resume only.`,
        2400
      );
      // Stream it
      const words = improved.split(/(\s+)/);
      let acc = '';
      for (let i = 0; i < words.length; i++) {
        acc += words[i];
        if (i % 6 === 0) { setStreamText(acc + '▊'); await new Promise(r => setTimeout(r, 12)); }
      }
      setStreamText('');
      setResume(improved);
      setCompareMode(true);
      setOutputTab('resume');
      setPhase('scoring');
      await runScore(improved);
    } catch (err) {
      setError(err.message);
      setPhase('done');
    }
  }, [resume, runScore]);

  // ─── Generate LinkedIn About ─────────────────────────────────
  const genLinkedIn = useCallback(async () => {
    if (!resume) return;
    setLoadingInsight('linkedin');
    setLinkedinAbout('');
    try {
      const text = await askGroq(
        'You are a LinkedIn profile optimization expert. Write compelling About sections that rank well in LinkedIn search and attract recruiters.',
        `Write a LinkedIn About section for ${name} based on this resume.\n\n${resume}\n\nRequirements:\n- 300-400 words, 3-4 short paragraphs\n- HOOK first sentence (bold claim or intriguing statement)\n- First person, warm and authentic tone\n- Include top 3 skills and biggest 2 achievements with numbers\n- Industry keywords woven naturally: ${INDUSTRIES.find(i=>i.id===industry)?.kw}\n- End with clear CTA (open to what opportunities)\n- No cringe phrases like "passionate professional" or "dynamic individual"\n\nWrite it now.`,
        700, 0.7
      );
      setLinkedinAbout(text);
    } catch (err) { setLinkedinAbout('❌ ' + err.message); }
    setLoadingInsight('');
  }, [resume, name, industry]);

  // ─── Generate Cover Letter ───────────────────────────────────
  const genCoverLetter = useCallback(async () => {
    if (!resume) return;
    setLoadingInsight('cover');
    setCoverLetter('');
    try {
      const text = await askGroq(
        'You are a master cover letter writer. Write cover letters that get callbacks.',
        `Write a compelling cover letter for ${name} applying for ${title}.\n\nCandidate resume:\n${resume}\n\n${jobDesc ? `Job Description:\n${jobDesc}\n\n` : ''}Requirements:\n- 4 paragraphs, ~350 words\n- Paragraph 1: Hook + why THIS company/role specifically\n- Paragraph 2: Most relevant experience with 2 quantified achievements\n- Paragraph 3: What you bring that others don't (unique value prop)\n- Paragraph 4: CTA and next steps\n- Professional but human tone\n- Mirror keywords from job description\n- Never start with "I am writing to..."\n\nWrite the complete cover letter.`,
        700, 0.65
      );
      setCoverLetter(text);
    } catch (err) { setCoverLetter('❌ ' + err.message); }
    setLoadingInsight('');
  }, [resume, name, title, jobDesc]);

  // ─── Predict Interview Questions ─────────────────────────────
  const genInterviewQs = useCallback(async () => {
    if (!resume) return;
    setLoadingInsight('interview');
    setInterviewQs([]);
    try {
      const raw = await askGroq(
        'You are a senior recruiter and interview expert. Return ONLY valid JSON array. No markdown.',
        `Based on this resume for ${title} at ${INDUSTRIES.find(i=>i.id===industry)?.label}, predict the 8 most likely interview questions.\n\nResume:\n${resume}\n\nReturn JSON array:\n[{"q":"<question>","why":"<1-line reason>","framework":"<STAR/other>","sample_opener":"<first sentence of ideal answer>"}]\n\nNo markdown, just the JSON array.`,
        900, 0.4
      );
      const parsed = parseJSON(raw);
      if (Array.isArray(parsed)) setInterviewQs(parsed);
    } catch (err) { console.warn(err); }
    setLoadingInsight('');
  }, [resume, title, industry]);

  // ─── ATS Simulation ─────────────────────────────────────────
  const runAtsScan = useCallback(async () => {
    if (!resume) return;
    setLoadingInsight('ats');
    setAtsScan(null);
    try {
      const raw = await askGroq(
        'You are an ATS (Applicant Tracking System) simulator. Return ONLY valid JSON.',
        `Simulate parsing this resume through an ATS for the role "${title}".\n\nResume:\n${resume}\n${jobDesc ? `\nJob Description:\n${jobDesc}` : ''}\n\nReturn JSON:\n{"pass_rate": <0-100>, "parsed_correctly": <true|false>, "detected_sections": ["..."], "missing_sections": ["..."], "keyword_matches": ["..."], "keyword_misses": ["..."], "format_issues": ["..."], "ats_verdict": "<PASS|BORDERLINE|FAIL>", "tips": ["...", "...", "..."]}`,
        600, 0.1
      );
      const parsed = parseJSON(raw);
      if (parsed) setAtsScan(parsed);
    } catch (err) { console.warn(err); }
    setLoadingInsight('');
  }, [resume, title, jobDesc]);

  // ─── Copy / Save helpers ────────────────────────────────────
  const copyResume = () => {
    navigator.clipboard.writeText(resume);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const saveSettings = async () => {
    try {
      await persistSettings({ ...userSettings, coverLetter: resume });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) { alert('❌ ' + err.message); }
  };

  const downloadTxt = () => {
    const blob = new Blob([resume], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `${name.replace(/\s+/g,'_')}_resume.txt`; a.click();
    URL.revokeObjectURL(url);
  };

  const downloadMd = () => {
    const md = resume.replace(/^([A-Z][A-Z ]{3,})$/gm, '## $1').replace(/^•/gm, '-');
    const blob = new Blob([md], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `${name.replace(/\s+/g,'_')}_resume.md`; a.click();
    URL.revokeObjectURL(url);
  };

  // ─── Wizard steps ────────────────────────────────────────────
  const STEP_LABELS = ['Personal', 'Target', 'Experience', 'JD & Style', 'Generate'];
  const canGenerate = name.trim() && title.trim() && skills.trim() && !!GROQ_KEY;

  const scoreCol = (s) => s >= 85 ? '#22c55e' : s >= 70 ? '#06b6d4' : s >= 55 ? '#f59e0b' : '#ef4444';

  // ════════════════════════════════════════════════════════════
  return (
    <div className="page-content animate-fade" style={{ maxWidth: '100%' }}>

      {/* ── TOP HEADER ── */}
      <div style={{
        background: 'linear-gradient(135deg, rgba(59,130,246,0.1) 0%, rgba(139,92,246,0.08) 50%, rgba(6,182,212,0.06) 100%)',
        border: '1px solid rgba(59,130,246,0.2)', borderRadius: 16, padding: '20px 28px', marginBottom: 24,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
          <div style={{ fontSize: 40 }}>🏆</div>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
              <h2 style={{ margin: 0, fontSize: 20, fontWeight: 900 }}>AI Resume Creator Pro</h2>
              <span style={{ fontSize: 10, background: 'linear-gradient(135deg,#3b82f6,#7c3aed)', color: '#fff', padding: '3px 10px', borderRadius: 20, fontWeight: 700, letterSpacing: '0.05em' }}>ADVANCED</span>
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
              World-class AI • 20-factor scoring • ATS simulation • LinkedIn generator • Interview coach • Real-time streaming
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {['🤖 ATS-Optimized','🎯 Keyword Match','📊 20 Factors','⚡ Streaming','💼 LinkedIn','🎙️ Interview','🔍 ATS Scan'].map(b => (
              <div key={b} style={{ padding: '4px 10px', borderRadius: 20, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', fontSize: 10, color: 'var(--text-muted)', fontWeight: 600 }}>{b}</div>
            ))}
          </div>
        </div>
        {!GROQ_KEY && (
          <div style={{ marginTop: 12, padding: '8px 14px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 8, fontSize: 12, color: '#f87171' }}>
            ⚠️ Add <code>REACT_APP_GROQ_KEY=your_key</code> to .env.local and restart the app to enable AI generation.
          </div>
        )}
      </div>

      {error && (
        <div style={{ padding: '10px 16px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 8, fontSize: 12, color: '#f87171', marginBottom: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span>⚠️ {error}</span>
          <button onClick={() => setError('')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#f87171' }}>✕</button>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '380px 1fr', gap: 20, alignItems: 'start' }}>

        {/* ════ LEFT: WIZARD ════ */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

          {/* Step indicator */}
          <Steps current={step} total={STEP_LABELS.length} labels={STEP_LABELS} />

          {/* ─ STEP 0: Personal Info ─ */}
          {step === 0 && (
            <div className="card" style={{ animation: 'fadeIn 0.25s ease' }}>
              <div className="card-header"><div className="card-title">👤 Personal Information</div></div>
              <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {[
                  { label: 'Full Name *', val: name, set: setName, ph: 'Arjun Sharma', type: 'text' },
                  { label: 'Email', val: email, set: setEmail, ph: 'arjun@email.com', type: 'email' },
                  { label: 'Phone', val: phone, set: setPhone, ph: '+91 9876543210', type: 'tel' },
                  { label: 'Location', val: location, set: setLocation, ph: 'Chennai, India', type: 'text' },
                  { label: 'LinkedIn URL', val: linkedin, set: setLinkedin, ph: 'linkedin.com/in/arjun', type: 'url' },
                  { label: 'Portfolio / GitHub', val: portfolio, set: setPortfolio, ph: 'github.com/arjun', type: 'url' },
                ].map(f => (
                  <div key={f.label}>
                    <label className="form-label">{f.label}</label>
                    <input className="form-input" type={f.type} placeholder={f.ph} value={f.val} onChange={e => f.set(e.target.value)} />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ─ STEP 1: Target Role ─ */}
          {step === 1 && (
            <div className="card" style={{ animation: 'fadeIn 0.25s ease' }}>
              <div className="card-header"><div className="card-title">🎯 Target Role & Configuration</div></div>
              <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div>
                  <label className="form-label">Target Job Title *</label>
                  <input className="form-input" placeholder="Senior React Developer" value={title} onChange={e => setTitle(e.target.value)} />
                </div>
                <div>
                  <label className="form-label">Industry</label>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                    {INDUSTRIES.map(ind => (
                      <button key={ind.id} onClick={() => setIndustry(ind.id)} style={{ padding: '5px 11px', borderRadius: 20, cursor: 'pointer', fontSize: 11, fontWeight: 600, border: `1px solid ${industry===ind.id?'#3b82f6':'var(--border)'}`, background: industry===ind.id?'rgba(59,130,246,0.12)':'transparent', color: industry===ind.id?'#60a5fa':'var(--text-muted)', transition: 'all 0.2s' }}>
                        {ind.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="form-label">Career Level</label>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                    {LEVELS.map(l => (
                      <button key={l.id} onClick={() => setLevel(l.id)} style={{ padding: '5px 11px', borderRadius: 20, cursor: 'pointer', fontSize: 11, fontWeight: 600, border: `1px solid ${level===l.id?'#06b6d4':'var(--border)'}`, background: level===l.id?'rgba(6,182,212,0.1)':'transparent', color: level===l.id?'#22d3ee':'var(--text-muted)', transition: 'all 0.2s' }}>
                        {l.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="form-label">Resume Style</label>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                    {STYLES.map(s => (
                      <button key={s.id} onClick={() => setStyle(s.id)} style={{ padding: '9px 10px', borderRadius: 8, cursor: 'pointer', textAlign: 'left', border: `1px solid ${style===s.id?'#8b5cf6':'var(--border)'}`, background: style===s.id?'rgba(139,92,246,0.1)':'transparent', transition: 'all 0.2s' }}>
                        <div style={{ fontSize: 12, fontWeight: 700, color: style===s.id?'#a78bfa':'var(--text-primary)' }}>{s.label}</div>
                        <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>{s.desc}</div>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ─ STEP 2: Experience ─ */}
          {step === 2 && (
            <div className="card" style={{ animation: 'fadeIn 0.25s ease' }}>
              <div className="card-header"><div className="card-title">💼 Your Background</div></div>
              <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
                <div>
                  <label className="form-label">Core Skills * <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>(comma-separated)</span></label>
                  <input className="form-input" placeholder="React, TypeScript, Node.js, AWS, Docker, GraphQL" value={skills} onChange={e => setSkills(e.target.value)} />
                  <div style={{ fontSize: 10, color: 'var(--amber)', marginTop: 3 }}>💡 Include hard + soft skills. More specific = better keyword score.</div>
                </div>
                <div>
                  <label className="form-label">Work Experience <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>(numbers = higher score)</span></label>
                  <textarea className="form-textarea" style={{ minHeight: 120 }}
                    placeholder={`TechCorp (2021-2024) — Senior Frontend Engineer\n• Built React dashboard for 80K+ users\n• Reduced load time 42% via code splitting\n• Led 5-person team across 3 products\n\nStartupXYZ (2019-2021) — UI Developer\n• Shipped 12 features, 99.9% uptime`}
                    value={experience} onChange={e => setExperience(e.target.value)} />
                </div>
                <div>
                  <label className="form-label">Professional Summary <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>(optional — AI will write one if empty)</span></label>
                  <textarea className="form-textarea" rows={3} style={{ minHeight: 70 }}
                    placeholder="Optionally describe yourself in your own words..."
                    value={summary} onChange={e => setSummary(e.target.value)} />
                </div>
                <div className="grid-2" style={{ gap: 10 }}>
                  <div>
                    <label className="form-label">Education</label>
                    <textarea className="form-textarea" rows={2} style={{ minHeight: 54 }}
                      placeholder="B.Tech CS, Anna University, 2019" value={education} onChange={e => setEducation(e.target.value)} />
                  </div>
                  <div>
                    <label className="form-label">Awards / Certs / Projects</label>
                    <textarea className="form-textarea" rows={2} style={{ minHeight: 54 }}
                      placeholder="AWS Certified 2023&#10;Hackathon Winner&#10;Open source: 300+ stars" value={awards} onChange={e => setAwards(e.target.value)} />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ─ STEP 3: JD & Style ─ */}
          {step === 3 && (
            <div className="card" style={{ animation: 'fadeIn 0.25s ease' }}>
              <div className="card-header">
                <div className="card-title">🎯 Job Description</div>
                <span style={{ fontSize: 10, background: 'rgba(59,130,246,0.15)', color: '#60a5fa', padding: '3px 10px', borderRadius: 20, fontWeight: 700 }}>↑ Keyword Score +30%</span>
              </div>
              <div className="card-body">
                <textarea className="form-textarea" style={{ minHeight: 200, resize: 'vertical' }}
                  placeholder="Paste the complete job description here.&#10;&#10;The AI will:&#10;• Mirror exact JD keywords for ATS matching&#10;• Align your experience to their specific requirements&#10;• Tailor the summary to this specific role&#10;• Maximize your keyword alignment score&#10;&#10;This is the single most impactful thing you can do to improve your score."
                  value={jobDesc} onChange={e => setJobDesc(e.target.value)} />
                <div style={{ fontSize: 11, color: '#60a5fa', marginTop: 8 }}>
                  ✓ Without JD: ~65-70% keyword score &nbsp;&nbsp; ✓ With JD: ~80-90% keyword score
                </div>
              </div>
            </div>
          )}

          {/* ─ STEP 4: Generate ─ */}
          {step === 4 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {/* Summary card */}
              <div className="card" style={{ background: 'linear-gradient(135deg,rgba(59,130,246,0.06),rgba(139,92,246,0.06))', border: '1px solid rgba(59,130,246,0.2)' }}>
                <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {[
                    { icon: '👤', label: name || '—', sub: title || 'No role set' },
                    { icon: '💻', label: INDUSTRIES.find(i=>i.id===industry)?.label || '', sub: LEVELS.find(l=>l.id===level)?.label || '' },
                    { icon: '🎨', label: STYLES.find(s=>s.id===style)?.label || '', sub: skills ? skills.split(',').slice(0,3).join(', ')+'...' : 'No skills' },
                    { icon: '🎯', label: jobDesc ? '✅ JD provided' : '⚠️ No JD (lower keyword score)', sub: jobDesc ? `${jobDesc.split(' ').length} words` : 'Add JD for best results' },
                  ].map(r => (
                    <div key={r.label} style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                      <span style={{ fontSize: 16, flexShrink: 0 }}>{r.icon}</span>
                      <div>
                        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>{r.label}</div>
                        <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>{r.sub}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Phase stepper */}
              <div style={{ display: 'flex', borderRadius: 8, overflow: 'hidden', border: '1px solid var(--border)' }}>
                {[
                  { key: 'writing', icon: '✍️', label: 'Writing' },
                  { key: 'scoring', icon: '📊', label: 'Scoring' },
                  { key: 'done',    icon: '✅', label: 'Done' },
                ].map((p, i) => {
                  const active = phase === p.key;
                  const done   = phase === 'done' || (p.key==='writing'&&(phase==='scoring'||phase==='done')) || (p.key==='scoring'&&phase==='done');
                  return (
                    <div key={p.key} style={{ flex: 1, padding: '8px 4px', textAlign: 'center', fontSize: 11, fontWeight: 700, background: active?'rgba(59,130,246,0.18)':done?'rgba(34,197,94,0.08)':'var(--bg-secondary)', color: active?'#60a5fa':done?'#4ade80':'var(--text-muted)', borderRight: i<2?'1px solid var(--border)':'none', transition: 'all 0.3s' }}>
                      {p.icon} {p.label}
                    </div>
                  );
                })}
              </div>

              {/* Generate button */}
              <button
                className="btn btn-primary btn-lg w-full"
                onClick={generate}
                disabled={isLoading || !canGenerate}
                style={{ background: isLoading?undefined:'linear-gradient(135deg,#3b82f6,#7c3aed)', fontSize: 15, fontWeight: 900, letterSpacing: '-0.3px', height: 52 }}
              >
                {phase==='writing' ? <><div className="spinner" style={{width:16,height:16,borderWidth:2}}/> Phase 1: Writing Resume…</>
                :phase==='scoring' ? <><div className="spinner" style={{width:16,height:16,borderWidth:2}}/> Phase 2: Scoring 20 Factors…</>
                :<>✨ Generate AI Resume + Score</>}
              </button>

              {/* Score history */}
              {scoreHistory.length > 0 && (
                <div className="card">
                  <div className="card-header">
                    <div className="card-title">📈 Score History</div>
                    <Sparkline history={scoreHistory} />
                  </div>
                  <div className="card-body" style={{ display: 'flex', gap: 8 }}>
                    {scoreHistory.map((h, i) => (
                      <div key={i} style={{ flex: 1, textAlign: 'center', padding: '8px 6px', borderRadius: 8, background: `${scoreCol(h.score)}10`, border: `1px solid ${scoreCol(h.score)}25` }}>
                        <div style={{ fontSize: 20, fontWeight: 900, color: scoreCol(h.score) }}>{h.score}</div>
                        <div style={{ fontSize: 9, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>{h.label}</div>
                        <div style={{ fontSize: 9, color: 'var(--text-muted)' }}>{h.time}</div>
                        {i > 0 && <div style={{ fontSize: 10, fontWeight: 800, color: h.score>scoreHistory[i-1].score?'#4ade80':'#f87171' }}>{h.score>scoreHistory[i-1].score?'↑':'↓'}{Math.abs(h.score-scoreHistory[i-1].score)}</div>}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ─ Navigation buttons ─ */}
          <div style={{ display: 'flex', gap: 10 }}>
            {step > 0 && (
              <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setStep(s => s-1)} disabled={isLoading}>
                <ChevronLeft size={14} /> Back
              </button>
            )}
            {step < 4 && (
              <button className="btn btn-primary" style={{ flex: 2 }} onClick={() => setStep(s => s+1)}>
                Next <ChevronRight size={14} />
              </button>
            )}
            {step === 4 && phase === 'done' && (
              <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => { setPhase('idle'); setResume(''); setScores(null); }}>
                <RefreshCw size={13} /> Reset
              </button>
            )}
          </div>

          {/* Quick-jump to any step */}
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
            {STEP_LABELS.map((l, i) => (
              <button key={i} onClick={() => setStep(i)} style={{ flex: 1, padding: '4px 2px', fontSize: 9, fontFamily: 'var(--font-mono)', textTransform: 'uppercase', border: `1px solid ${step===i?'rgba(59,130,246,0.4)':'var(--border)'}`, background: step===i?'rgba(59,130,246,0.08)':'transparent', borderRadius: 4, cursor: 'pointer', color: step===i?'#60a5fa':'var(--text-muted)', fontWeight: 600 }}>{l}</button>
            ))}
          </div>
        </div>

        {/* ════ RIGHT: OUTPUT PANEL ════ */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

          {/* Output tab bar */}
          {(resume || isLoading) && (
            <div style={{ display: 'flex', gap: 3, background: 'var(--bg-secondary)', borderRadius: 10, padding: 4, border: '1px solid var(--border)' }}>
              {[
                { id: 'resume',   icon: '📄', label: 'Resume',   show: true },
                { id: 'score',    icon: '📊', label: 'Score',    show: !!scores },
                { id: 'insights', icon: '💡', label: 'Insights', show: !!scores },
              ].filter(t => t.show).map(tab => (
                <button key={tab.id} onClick={() => setOutputTab(tab.id)} style={{ flex: 1, padding: '8px 0', borderRadius: 7, border: outputTab===tab.id?'1px solid rgba(59,130,246,0.4)':'1px solid transparent', background: outputTab===tab.id?'var(--bg-card)':'transparent', color: outputTab===tab.id?'var(--text-primary)':'var(--text-muted)', fontSize: 12, fontWeight: 700, cursor: 'pointer', transition: 'all 0.2s', boxShadow: outputTab===tab.id?'0 2px 8px rgba(0,0,0,0.3)':'none' }}>
                  {tab.icon} {tab.label}
                </button>
              ))}
            </div>
          )}

          {/* ═══ TAB: RESUME ═══ */}
          {outputTab === 'resume' && (
            <div className="card">
              <div className="card-header">
                <div className="card-title">📄 {compareMode ? 'Resume — Comparison Mode' : 'Generated Resume'}</div>
                <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                  {resume && (
                    <>
                      <button className="btn btn-secondary btn-sm" onClick={() => setImproveOpen(v => !v)} disabled={isLoading} style={{ fontSize: 10 }}>⚡ Improve</button>
                      {compareMode && <button className="btn btn-secondary btn-sm" style={{ fontSize: 10 }} onClick={() => setCompareMode(false)}>🔍 Split</button>}
                      <button className="btn btn-secondary btn-sm" onClick={copyResume} style={{ fontSize: 10 }}>{copied?'✅ Copied':'📋 Copy'}</button>
                      <button className="btn btn-secondary btn-sm" onClick={downloadTxt} style={{ fontSize: 10 }}>📥 .TXT</button>
                      <button className="btn btn-secondary btn-sm" onClick={downloadMd} style={{ fontSize: 10 }}>.MD</button>
                      <button className="btn btn-primary btn-sm" onClick={saveSettings} style={{ fontSize: 10 }}>{saved?'✅ Saved!':'💾 Save'}</button>
                    </>
                  )}
                </div>
              </div>
              <div className="card-body" style={{ padding: 0 }}>

                {/* Improve panel */}
                {improveOpen && (
                  <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)', background: 'rgba(59,130,246,0.04)' }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: '#60a5fa', marginBottom: 8 }}>⚡ Smart Improve — AI rewrites + re-scores automatically</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
                      {QUICK_FIXES.map(f => (
                        <button key={f.label} className="btn btn-secondary btn-sm" style={{ fontSize: 10 }} onClick={() => setImproveTip(f.prompt)} disabled={isLoading}>
                          {f.emoji} {f.label}
                        </button>
                      ))}
                    </div>
                    <textarea className="form-textarea" rows={2} style={{ minHeight: 58, marginBottom: 8 }}
                      value={improveTip} onChange={e => setImproveTip(e.target.value)}
                      placeholder="Or describe a custom improvement... e.g. 'Make the summary more senior-level'"
                    />
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button className="btn btn-secondary btn-sm" onClick={() => { setImproveOpen(false); setImproveTip(''); }}>Cancel</button>
                      <button className="btn btn-primary" style={{ flex: 1, fontSize: 12 }} onClick={() => improve(improveTip)} disabled={phase==='writing'||!improveTip.trim()}>
                        {phase==='writing'?<><div className="spinner" style={{width:12,height:12,borderWidth:2}}/> Improving…</>:<>✨ Apply Improvement</>}
                      </button>
                    </div>
                  </div>
                )}

                {/* Streaming preview */}
                {streamText && (
                  <div style={{ padding: '14px 18px', fontFamily: 'var(--font-mono)', fontSize: 11.5, lineHeight: 1.9, color: 'var(--text-secondary)', whiteSpace: 'pre-wrap', maxHeight: 260, overflow: 'hidden' }}>
                    {streamText}
                  </div>
                )}

                {/* Empty state */}
                {!resume && !streamText && !isLoading && (
                  <div className="empty-state" style={{ padding: '56px 24px' }}>
                    <div style={{ fontSize: 52, marginBottom: 16 }}>📋</div>
                    <h3>Your AI resume will appear here</h3>
                    <p style={{ maxWidth: 280, margin: '0 auto' }}>Complete the wizard steps on the left, then click Generate on Step 5.</p>
                  </div>
                )}

                {/* Loading skeleton */}
                {isLoading && !resume && !streamText && (
                  <div style={{ padding: '24px 18px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                      <div className="spinner" style={{ width: 18, height: 18, borderWidth: 2 }} />
                      <span style={{ fontSize: 13, color: phase==='scoring'?'#fbbf24':'#60a5fa', fontWeight: 600 }}>
                        {phase==='writing'?'🤖 AI crafting your world-class resume…':'📊 Running 20-factor analysis…'}
                      </span>
                    </div>
                    {[96,82,74,90,68,78,58,86,72,64,88,70].map((w,i) => (
                      <div key={i} style={{ height: 11, borderRadius: 6, width: `${w}%`, backgroundImage: 'linear-gradient(90deg,var(--bg-surface) 0%,rgba(59,130,246,0.14) 50%,var(--bg-surface) 100%)', backgroundSize: '200% 100%', animation: `shimmer 1.4s ${i*0.09}s infinite` }}/>
                    ))}
                  </div>
                )}

                {/* Compare split view */}
                {compareMode && beforeResume && resume && (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr' }}>
                    <div>
                      <div style={{ padding: '8px 14px', fontSize: 11, fontWeight: 700, color: '#f87171', borderBottom: '1px solid var(--border)', borderRight: '1px solid var(--border)', background: 'rgba(239,68,68,0.05)' }}>⬅ BEFORE</div>
                      <textarea className="form-textarea" readOnly value={beforeResume} style={{ minHeight: 560, fontFamily: 'var(--font-mono)', fontSize: 11, lineHeight: 1.8, resize: 'none', border: 'none', borderRadius: 0, borderRight: '1px solid var(--border)', background: 'transparent', padding: '14px' }}/>
                    </div>
                    <div>
                      <div style={{ padding: '8px 14px', fontSize: 11, fontWeight: 700, color: '#4ade80', borderBottom: '1px solid var(--border)', background: 'rgba(34,197,94,0.05)' }}>➡ AFTER (IMPROVED)</div>
                      <textarea className="form-textarea" value={resume} onChange={e => setResume(e.target.value)} style={{ minHeight: 560, fontFamily: 'var(--font-mono)', fontSize: 11, lineHeight: 1.8, resize: 'none', border: 'none', borderRadius: 0, background: 'transparent', padding: '14px' }}/>
                    </div>
                  </div>
                )}

                {/* Normal view */}
                {!compareMode && resume && (
                  <textarea className="form-textarea" value={resume} onChange={e => setResume(e.target.value)}
                    style={{ minHeight: 580, fontFamily: 'var(--font-mono)', fontSize: 12, lineHeight: 1.85, resize: 'vertical', border: 'none', borderRadius: 0, background: 'rgba(0,0,0,0.12)', padding: '18px' }}
                  />
                )}
              </div>
            </div>
          )}

          {/* ═══ TAB: SCORE ═══ */}
          {outputTab === 'score' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {phase==='scoring' && (
                <div className="card"><div className="card-body" style={{ display:'flex',alignItems:'center',gap:12,color:'#60a5fa',fontSize:13 }}><div className="spinner" style={{width:16,height:16,borderWidth:2}}/> Running 20-factor analysis…</div></div>
              )}
              {scores && (
                <>
                  {/* Score header */}
                  <div className="card" style={{ border:`1px solid ${scoreCol(scores.overall_score)}25`, background:`${scoreCol(scores.overall_score)}06` }}>
                    <div className="card-body">
                      <div style={{ display:'flex', gap:20, alignItems:'flex-start', flexWrap:'wrap', marginBottom:18 }}>
                        <ScoreRing score={scores.overall_score} size={96} />
                        <RadarChart scores={scores} size={160} />
                        <div style={{ flex:1, minWidth:180 }}>
                          <div style={{ fontSize:13, color:'var(--text-secondary)', lineHeight:1.6, marginBottom:10, fontStyle:'italic' }}>"{scores.verdict}"</div>
                          <div style={{ display:'flex', gap:7, flexWrap:'wrap' }}>
                            {[
                              { t: scores.application_ready?'✅ App Ready':'⚠️ Needs Work', c: scores.application_ready?'#22c55e':'#f59e0b' },
                              { t: `🎯 Hire: ${scores.hire_probability||'N/A'}`, c:'#3b82f6' },
                              { t: `⚡ Verbs: ${scores.action_verb_quality||'N/A'}`, c:'#8b5cf6' },
                              { t: `📊 Quant: ${scores.quantification_rate??0}%`, c:'#f59e0b' },
                            ].map(b=><span key={b.t} style={{fontSize:10,padding:'3px 9px',borderRadius:20,background:`${b.c}15`,color:b.c,border:`1px solid ${b.c}25`,fontWeight:700}}>{b.t}</span>)}
                          </div>
                        </div>
                      </div>
                      <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                        {SCORE_DIMS.map(d => <ScoreBar key={d.key} val={scores[d.key]} color={d.color} label={`${d.label} (${d.pct})`} icon={d.icon}/>)}
                      </div>
                    </div>
                  </div>

                  {/* 15 sub-factors */}
                  {scores.sub && (
                    <div className="card">
                      <div className="card-header"><div className="card-title">🔬 15 Sub-Factor Breakdown</div></div>
                      <div className="card-body" style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
                        {Object.entries(scores.sub).map(([k,v]) => {
                          const lbl = k.replace(/_/g,' ').replace(/\b\w/g,c=>c.toUpperCase());
                          const col = scoreCol(v);
                          return (
                            <div key={k} style={{ display:'flex',alignItems:'center',gap:8 }}>
                              <div style={{ width:30,height:30,borderRadius:7,background:`${col}12`,border:`1px solid ${col}25`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:11,fontWeight:900,color:col,flexShrink:0 }}>{v}</div>
                              <div style={{ flex:1 }}>
                                <div style={{ fontSize:10,color:'var(--text-secondary)',marginBottom:2 }}>{lbl}</div>
                                <div style={{ height:3,background:'rgba(255,255,255,0.06)',borderRadius:2,overflow:'hidden' }}>
                                  <div style={{ height:'100%',width:`${v}%`,background:col,borderRadius:2,transition:'width 1s' }}/>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Best + Worst bullets */}
                  <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14 }}>
                    {scores.best_bullet && (
                      <div style={{ padding:'12px 14px', background:'rgba(34,197,94,0.05)', border:'1px solid rgba(34,197,94,0.2)', borderRadius:10 }}>
                        <div style={{ fontSize:11,fontWeight:700,color:'#4ade80',marginBottom:6 }}>✅ Best Bullet</div>
                        <div style={{ fontSize:11,color:'var(--text-secondary)',lineHeight:1.6,borderLeft:'2px solid #22c55e',paddingLeft:8 }}>{scores.best_bullet}</div>
                      </div>
                    )}
                    {scores.worst_bullet && (
                      <div style={{ padding:'12px 14px', background:'rgba(239,68,68,0.05)', border:'1px solid rgba(239,68,68,0.2)', borderRadius:10 }}>
                        <div style={{ fontSize:11,fontWeight:700,color:'#f87171',marginBottom:6 }}>⚠️ Weakest Bullet</div>
                        <div style={{ fontSize:11,color:'var(--text-secondary)',lineHeight:1.6,borderLeft:'2px solid #ef4444',paddingLeft:8,marginBottom:8 }}>{scores.worst_bullet}</div>
                        <button className="btn btn-secondary btn-sm w-full" style={{ fontSize:10 }} onClick={() => { setImproveTip(`Rewrite this weak bullet with strong action verb and specific metrics: "${scores.worst_bullet}"`); setImproveOpen(true); setOutputTab('resume'); }} disabled={isLoading}>
                          ⚡ Fix this bullet
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Top improvements */}
                  {Array.isArray(scores.improvements) && (
                    <div className="card">
                      <div className="card-header"><div className="card-title">🔧 Top Improvements</div></div>
                      <div className="card-body" style={{ display:'flex',flexDirection:'column',gap:8 }}>
                        {scores.improvements.map((tip,i) => (
                          <div key={i} style={{ display:'flex',gap:10,alignItems:'center',padding:'10px 12px',background:'var(--bg-secondary)',borderRadius:8,border:'1px solid var(--border)' }}>
                            <div style={{ width:22,height:22,borderRadius:'50%',background:'rgba(245,158,11,0.15)',border:'1px solid rgba(245,158,11,0.3)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:11,color:'#f59e0b',fontWeight:700,flexShrink:0 }}>{i+1}</div>
                            <div style={{ flex:1,fontSize:12,color:'var(--text-secondary)' }}>{tip}</div>
                            <button className="btn btn-primary btn-sm" style={{ fontSize:10,flexShrink:0 }} onClick={() => { setImproveTip(tip); setImproveOpen(true); setOutputTab('resume'); }} disabled={isLoading}>⚡ Fix</button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Competitive edge + recruiter take */}
                  <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14 }}>
                    {scores.competitive_edge && (
                      <div style={{ padding:'12px 14px',background:'rgba(59,130,246,0.05)',border:'1px solid rgba(59,130,246,0.2)',borderRadius:10 }}>
                        <div style={{ fontSize:11,fontWeight:700,color:'#60a5fa',marginBottom:6 }}>🏆 Competitive Edge</div>
                        <div style={{ fontSize:12,color:'var(--text-secondary)',lineHeight:1.6 }}>{scores.competitive_edge}</div>
                      </div>
                    )}
                    {scores.recruiter_take && (
                      <div style={{ padding:'12px 14px',background:'rgba(139,92,246,0.05)',border:'1px solid rgba(139,92,246,0.2)',borderRadius:10 }}>
                        <div style={{ fontSize:11,fontWeight:700,color:'#a78bfa',marginBottom:6 }}>👀 Recruiter's 6-Second Take</div>
                        <div style={{ fontSize:12,color:'var(--text-secondary)',lineHeight:1.6,fontStyle:'italic' }}>"{scores.recruiter_take}"</div>
                      </div>
                    )}
                  </div>

                  {/* Missing keywords */}
                  {scores.missing_keywords && (
                    <div style={{ padding:'10px 16px',background:'rgba(59,130,246,0.05)',border:'1px solid rgba(59,130,246,0.2)',borderRadius:10,fontSize:12,color:'var(--text-secondary)' }}>
                      <strong style={{ color:'#60a5fa' }}>🔑 Add these keywords to boost score: </strong>{scores.missing_keywords}
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* ═══ TAB: INSIGHTS ═══ */}
          {outputTab === 'insights' && (
            <div style={{ display:'flex', flexDirection:'column', gap:14 }}>

              {/* Insight selector */}
              <div style={{ display:'flex', gap:6, background:'var(--bg-secondary)', borderRadius:10, padding:4, border:'1px solid var(--border)' }}>
                {[
                  { id:'linkedin', icon:'💼', label:'LinkedIn About' },
                  { id:'cover',    icon:'✉️', label:'Cover Letter' },
                  { id:'interview',icon:'🎙️', label:'Interview Qs' },
                  { id:'ats',      icon:'🤖', label:'ATS Scan' },
                ].map(t => (
                  <button key={t.id} onClick={() => setInsightTab(t.id)} style={{ flex:1,padding:'7px 0',borderRadius:7,border:insightTab===t.id?'1px solid rgba(59,130,246,0.4)':'1px solid transparent',background:insightTab===t.id?'var(--bg-card)':'transparent',color:insightTab===t.id?'var(--text-primary)':'var(--text-muted)',fontSize:11,fontWeight:700,cursor:'pointer',transition:'all 0.2s' }}>
                    {t.icon} {t.label}
                  </button>
                ))}
              </div>

              {/* ── LinkedIn About ── */}
              {insightTab === 'linkedin' && (
                <div className="card">
                  <div className="card-header">
                    <div className="card-title">💼 LinkedIn About Section</div>
                    <div style={{ display:'flex',gap:6 }}>
                      {linkedinAbout && <button className="btn btn-secondary btn-sm" style={{ fontSize:10 }} onClick={() => { navigator.clipboard.writeText(linkedinAbout); setCopied(true); setTimeout(()=>setCopied(false),2000); }}>{copied?'✅ Copied':'📋 Copy'}</button>}
                      <button className="btn btn-primary btn-sm" onClick={genLinkedIn} disabled={!resume||!!loadingInsight} style={{ fontSize:10 }}>
                        {loadingInsight==='linkedin'?<><div className="spinner" style={{width:11,height:11,borderWidth:2}}/> Generating…</>:<>✨ Generate</>}
                      </button>
                    </div>
                  </div>
                  <div className="card-body">
                    {!linkedinAbout && loadingInsight !== 'linkedin' && (
                      <div style={{ textAlign:'center',padding:'32px 0',color:'var(--text-muted)' }}>
                        <div style={{ fontSize:32,marginBottom:10 }}>💼</div>
                        <div style={{ fontSize:13 }}>Generate a compelling LinkedIn About section based on your resume</div>
                      </div>
                    )}
                    {loadingInsight === 'linkedin' && (
                      <div style={{ display:'flex',alignItems:'center',gap:10,color:'#22d3ee',fontSize:13 }}><div className="spinner" style={{width:14,height:14,borderWidth:2}}/> Writing your LinkedIn About…</div>
                    )}
                    {linkedinAbout && <textarea className="form-textarea" style={{ minHeight:260,lineHeight:1.8,fontSize:13,resize:'vertical' }} value={linkedinAbout} onChange={e=>setLinkedinAbout(e.target.value)}/>}
                  </div>
                </div>
              )}

              {/* ── Cover Letter ── */}
              {insightTab === 'cover' && (
                <div className="card">
                  <div className="card-header">
                    <div className="card-title">✉️ Tailored Cover Letter</div>
                    <div style={{ display:'flex',gap:6 }}>
                      {coverLetter && <button className="btn btn-secondary btn-sm" style={{ fontSize:10 }} onClick={() => { navigator.clipboard.writeText(coverLetter); }}>📋 Copy</button>}
                      <button className="btn btn-primary btn-sm" onClick={genCoverLetter} disabled={!resume||!!loadingInsight} style={{ fontSize:10 }}>
                        {loadingInsight==='cover'?<><div className="spinner" style={{width:11,height:11,borderWidth:2}}/> Generating…</>:<>✨ Generate</>}
                      </button>
                    </div>
                  </div>
                  <div className="card-body">
                    {!coverLetter && loadingInsight !== 'cover' && (
                      <div style={{ textAlign:'center',padding:'32px 0',color:'var(--text-muted)' }}>
                        <div style={{ fontSize:32,marginBottom:10 }}>✉️</div>
                        <div style={{ fontSize:13 }}>Generate a cover letter tailored to your resume and job description</div>
                        {jobDesc && <div style={{ fontSize:11,color:'#4ade80',marginTop:6 }}>✓ JD provided — will be highly targeted</div>}
                      </div>
                    )}
                    {loadingInsight === 'cover' && (
                      <div style={{ display:'flex',alignItems:'center',gap:10,color:'#a78bfa',fontSize:13 }}><div className="spinner" style={{width:14,height:14,borderWidth:2}}/> Writing your cover letter…</div>
                    )}
                    {coverLetter && <textarea className="form-textarea" style={{ minHeight:320,lineHeight:1.8,fontSize:13,resize:'vertical' }} value={coverLetter} onChange={e=>setCoverLetter(e.target.value)}/>}
                  </div>
                </div>
              )}

              {/* ── Interview Questions ── */}
              {insightTab === 'interview' && (
                <div className="card">
                  <div className="card-header">
                    <div className="card-title">🎙️ Predicted Interview Questions</div>
                    <button className="btn btn-primary btn-sm" onClick={genInterviewQs} disabled={!resume||!!loadingInsight} style={{ fontSize:10 }}>
                      {loadingInsight==='interview'?<><div className="spinner" style={{width:11,height:11,borderWidth:2}}/> Analyzing…</>:<>🎯 Predict</>}
                    </button>
                  </div>
                  <div className="card-body">
                    {!interviewQs.length && loadingInsight !== 'interview' && (
                      <div style={{ textAlign:'center',padding:'32px 0',color:'var(--text-muted)' }}>
                        <div style={{ fontSize:32,marginBottom:10 }}>🎙️</div>
                        <div style={{ fontSize:13 }}>Predict the 8 most likely questions a recruiter will ask based on your resume</div>
                      </div>
                    )}
                    {loadingInsight === 'interview' && (
                      <div style={{ display:'flex',alignItems:'center',gap:10,color:'#f87171',fontSize:13 }}><div className="spinner" style={{width:14,height:14,borderWidth:2}}/> Predicting questions…</div>
                    )}
                    {interviewQs.length > 0 && (
                      <div style={{ display:'flex',flexDirection:'column',gap:12 }}>
                        {interviewQs.map((q,i) => (
                          <div key={i} style={{ padding:'12px 14px',background:'var(--bg-secondary)',borderRadius:10,border:'1px solid var(--border)' }}>
                            <div style={{ display:'flex',gap:10,marginBottom:8 }}>
                              <div style={{ width:24,height:24,borderRadius:'50%',background:'rgba(239,68,68,0.15)',border:'1px solid rgba(239,68,68,0.3)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:11,color:'#f87171',fontWeight:700,flexShrink:0 }}>{i+1}</div>
                              <div style={{ fontWeight:700,fontSize:13,color:'var(--text-primary)',lineHeight:1.5 }}>{q.q}</div>
                            </div>
                            <div style={{ marginLeft:34,display:'flex',flexDirection:'column',gap:5 }}>
                              <div style={{ fontSize:11,color:'#f59e0b' }}><strong>Why:</strong> <span style={{ color:'var(--text-muted)',fontWeight:400 }}>{q.why}</span></div>
                              <div style={{ fontSize:11,color:'#4ade80' }}><strong>Framework:</strong> <span style={{ color:'var(--text-secondary)',fontWeight:400 }}>{q.framework}</span></div>
                              {q.sample_opener && <div style={{ fontSize:11,color:'#a78bfa' }}><strong>Open with:</strong> <span style={{ color:'var(--text-secondary)',fontWeight:400,fontStyle:'italic' }}>"{q.sample_opener}"</span></div>}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* ── ATS Simulation Scan ── */}
              {insightTab === 'ats' && (
                <div className="card">
                  <div className="card-header">
                    <div className="card-title">🤖 ATS Simulation Scan</div>
                    <button className="btn btn-primary btn-sm" onClick={runAtsScan} disabled={!resume||!!loadingInsight} style={{ fontSize:10 }}>
                      {loadingInsight==='ats'?<><div className="spinner" style={{width:11,height:11,borderWidth:2}}/> Scanning…</>:<>🔍 Run Scan</>}
                    </button>
                  </div>
                  <div className="card-body">
                    {!atsScan && loadingInsight !== 'ats' && (
                      <div style={{ textAlign:'center',padding:'32px 0',color:'var(--text-muted)' }}>
                        <div style={{ fontSize:32,marginBottom:10 }}>🤖</div>
                        <div style={{ fontSize:13 }}>Simulate how an Applicant Tracking System parses your resume</div>
                        <div style={{ fontSize:11,marginTop:6,color:'var(--text-muted)' }}>Checks: sections detected, keywords matched, format issues, parse rate</div>
                      </div>
                    )}
                    {loadingInsight === 'ats' && (
                      <div style={{ display:'flex',alignItems:'center',gap:10,color:'#22c55e',fontSize:13 }}><div className="spinner" style={{width:14,height:14,borderWidth:2}}/> Simulating ATS parsing…</div>
                    )}
                    {atsScan && (
                      <div style={{ display:'flex',flexDirection:'column',gap:14 }}>
                        {/* Verdict + pass rate */}
                        <div style={{ display:'flex',gap:14,alignItems:'center',flexWrap:'wrap' }}>
                          <div style={{ padding:'12px 20px',borderRadius:10,background:atsScan.ats_verdict==='PASS'?'rgba(34,197,94,0.1)':atsScan.ats_verdict==='BORDERLINE'?'rgba(245,158,11,0.1)':'rgba(239,68,68,0.1)',border:`1px solid ${atsScan.ats_verdict==='PASS'?'rgba(34,197,94,0.3)':atsScan.ats_verdict==='BORDERLINE'?'rgba(245,158,11,0.3)':'rgba(239,68,68,0.3)'}` }}>
                            <div style={{ fontSize:22,fontWeight:900,color:atsScan.ats_verdict==='PASS'?'#4ade80':atsScan.ats_verdict==='BORDERLINE'?'#fbbf24':'#f87171' }}>{atsScan.ats_verdict}</div>
                            <div style={{ fontSize:11,color:'var(--text-muted)' }}>ATS Verdict</div>
                          </div>
                          <div style={{ padding:'12px 20px',borderRadius:10,background:'rgba(59,130,246,0.08)',border:'1px solid rgba(59,130,246,0.2)' }}>
                            <div style={{ fontSize:22,fontWeight:900,color:'#60a5fa' }}>{atsScan.pass_rate}%</div>
                            <div style={{ fontSize:11,color:'var(--text-muted)' }}>Parse Rate</div>
                          </div>
                        </div>
                        {/* Sections */}
                        <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr',gap:12 }}>
                          <div>
                            <div style={{ fontSize:11,fontWeight:700,color:'#4ade80',marginBottom:6 }}>✅ Sections Detected</div>
                            {(atsScan.detected_sections||[]).map(s=><div key={s} style={{ fontSize:11,color:'var(--text-secondary)',padding:'2px 0' }}>• {s}</div>)}
                          </div>
                          <div>
                            <div style={{ fontSize:11,fontWeight:700,color:'#f87171',marginBottom:6 }}>❌ Missing Sections</div>
                            {(atsScan.missing_sections||[]).length===0?<div style={{ fontSize:11,color:'#4ade80' }}>None! All sections present</div>:(atsScan.missing_sections||[]).map(s=><div key={s} style={{ fontSize:11,color:'var(--text-secondary)',padding:'2px 0' }}>• {s}</div>)}
                          </div>
                        </div>
                        {/* Keywords */}
                        <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr',gap:12 }}>
                          <div>
                            <div style={{ fontSize:11,fontWeight:700,color:'#4ade80',marginBottom:6 }}>✅ Keywords Matched</div>
                            <div style={{ display:'flex',flexWrap:'wrap',gap:4 }}>{(atsScan.keyword_matches||[]).map(k=><span key={k} style={{ fontSize:10,padding:'2px 8px',borderRadius:20,background:'rgba(34,197,94,0.1)',color:'#4ade80',border:'1px solid rgba(34,197,94,0.2)' }}>{k}</span>)}</div>
                          </div>
                          <div>
                            <div style={{ fontSize:11,fontWeight:700,color:'#f87171',marginBottom:6 }}>❌ Keywords Missing</div>
                            <div style={{ display:'flex',flexWrap:'wrap',gap:4 }}>{(atsScan.keyword_misses||[]).map(k=><span key={k} style={{ fontSize:10,padding:'2px 8px',borderRadius:20,background:'rgba(239,68,68,0.1)',color:'#f87171',border:'1px solid rgba(239,68,68,0.2)' }}>{k}</span>)}</div>
                          </div>
                        </div>
                        {/* Format issues */}
                        {(atsScan.format_issues||[]).length > 0 && (
                          <div style={{ padding:'10px 14px',background:'rgba(245,158,11,0.07)',border:'1px solid rgba(245,158,11,0.2)',borderRadius:8 }}>
                            <div style={{ fontSize:11,fontWeight:700,color:'#fbbf24',marginBottom:6 }}>⚠️ Format Issues</div>
                            {atsScan.format_issues.map(f=><div key={f} style={{ fontSize:11,color:'var(--text-secondary)',padding:'2px 0' }}>• {f}</div>)}
                          </div>
                        )}
                        {/* Tips */}
                        {(atsScan.tips||[]).length > 0 && (
                          <div>
                            <div style={{ fontSize:11,fontWeight:700,color:'#60a5fa',marginBottom:6 }}>💡 ATS Tips</div>
                            {atsScan.tips.map((t,i)=><div key={i} style={{ fontSize:12,color:'var(--text-secondary)',padding:'4px 0',borderBottom:'1px solid var(--border)',display:'flex',gap:8 }}><span style={{ color:'#60a5fa' }}>{i+1}.</span>{t}</div>)}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Empty output placeholder */}
          {!resume && !isLoading && (
            <div className="card" style={{ display: outputTab==='resume'?'block':'none' }}>
              <div className="empty-state" style={{ padding:'56px 24px' }}>
                <div style={{ fontSize:52,marginBottom:16 }}>🤖</div>
                <h3>AI Resume Creator Pro</h3>
                <p style={{ maxWidth:300,margin:'0 auto 20px' }}>Complete the 5-step wizard on the left. The more details you provide, the better your resume and score will be.</p>
                <div style={{ display:'flex',gap:10,justifyContent:'center',flexWrap:'wrap' }}>
                  {['Step 1: Fill personal info','Step 2: Set target role','Step 3: Add experience','Step 4: Paste job description','Step 5: Generate!'].map((s,i)=>(
                    <div key={i} style={{ padding:'6px 14px',borderRadius:20,background:'rgba(59,130,246,0.08)',border:'1px solid rgba(59,130,246,0.2)',fontSize:11,color:'#60a5fa',cursor:'pointer' }} onClick={()=>setStep(i)}>{s}</div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ResumeAI;
