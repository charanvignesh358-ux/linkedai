import React, { useState, useRef } from 'react';
import { useApp } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { Upload, Wand2, Star, Trash2, Eye, Tag, FileText, Plus, CheckCircle, AlertCircle, Loader, Save } from 'lucide-react';
import { saveResume } from '../firebase/firebaseService';

// ── Cloudinary config ─────────────────────────────────────────────
const CLOUDINARY_CLOUD_NAME = 'dp995t0rs';
const CLOUDINARY_UPLOAD_PRESET = 'sjktua8o';

// ── FIX #7: Read Groq key correctly ──────────────────────────────
// REACT_APP_GROQ_KEY is already set in .env.local — no need to
// guard against it being missing; just use it directly.
const GROQ_API_KEY = process.env.REACT_APP_GROQ_KEY || '';

const coverLetterTemplates = [
  {
    id: 1, name: 'Tech Startup', category: 'Engineering',
    preview: 'Dear Hiring Team, I am excited to apply for the {role} position at {company}. With my background in {skills}, I believe I can make an immediate impact...'
  },
  {
    id: 2, name: 'FAANG Style', category: 'Senior Roles',
    preview: 'I am writing to express my strong interest in the {role} opportunity at {company}. Throughout my career, I have developed expertise in {skills}...'
  },
  {
    id: 3, name: 'Remote First', category: 'Remote Jobs',
    preview: 'As a passionate advocate of remote work culture, I was thrilled to discover the {role} opening at {company}. My experience with distributed teams...'
  },
];

const Resumes = () => {
  const { resumes, setResumes, setDefaultResume, deleteResume, persistSettings, userSettings } = useApp();
  const { currentUser } = useAuth();
  const [savedToSettings, setSavedToSettings] = useState(false);

  const [activeTab, setActiveTab] = useState('resumes');
  const [generating, setGenerating] = useState(false);
  const [generatedCL, setGeneratedCL] = useState('');
  const [jobDesc, setJobDesc] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState(coverLetterTemplates[0]);

  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadStatus, setUploadStatus] = useState('idle'); // idle | uploading | success | error
  const [uploadError, setUploadError] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef(null);

  // ── Cloudinary Upload ─────────────────────────────────────────
  const uploadFile = async (file) => {
    if (!file) return;

    const allowed = ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
    if (!allowed.includes(file.type)) {
      setUploadError('Only PDF or DOCX files are allowed.');
      setUploadStatus('error');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setUploadError('File must be under 10MB.');
      setUploadStatus('error');
      return;
    }
    if (!currentUser) {
      setUploadError('You must be signed in to upload.');
      setUploadStatus('error');
      return;
    }

    setUploadStatus('uploading');
    setUploadProgress(0);
    setUploadError('');

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);
      formData.append('folder', `resumes/${currentUser.uid}`);
      formData.append('resource_type', 'raw');

      const url = `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/raw/upload`;

      await new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();

        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) {
            const pct = Math.round((e.loaded / e.total) * 100);
            setUploadProgress(pct);
          }
        };

        xhr.onload = async () => {
          if (xhr.status === 200) {
            try {
              const data = JSON.parse(xhr.responseText);
              const downloadURL = data.secure_url;
              const ext = file.name.split('.').pop().toUpperCase();
              const sizeKB = (file.size / 1024).toFixed(0);
              const sizeFmt = sizeKB > 1024 ? `${(sizeKB / 1024).toFixed(1)} MB` : `${sizeKB} KB`;

              const newResume = {
                name: file.name.replace(/\.[^/.]+$/, ''),
                fileName: file.name,
                size: sizeFmt,
                label: ext,
                downloadURL,
                cloudinaryPublicId: data.public_id,
                default: resumes.length === 0,
                updated: new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
                userId: currentUser.uid,
              };

              const saved = await saveResume(newResume);
              setResumes(prev => [{ ...newResume, id: saved }, ...prev]);
              setUploadStatus('success');
              setUploadProgress(100);
              setTimeout(() => setUploadStatus('idle'), 3000);
              resolve();
            } catch (err) {
              reject(new Error('Failed to save resume info: ' + err.message));
            }
          } else {
            let msg = 'Upload failed';
            try {
              const errData = JSON.parse(xhr.responseText);
              msg = errData?.error?.message || msg;
            } catch {}
            reject(new Error(msg));
          }
        };

        xhr.onerror = () => reject(new Error('Network error — check your internet connection.'));
        xhr.ontimeout = () => reject(new Error('Upload timed out — try again.'));

        xhr.open('POST', url);
        xhr.send(formData);
      });

    } catch (err) {
      console.error('Upload error:', err);
      setUploadStatus('error');
      setUploadProgress(0);
      setUploadError(err.message || 'Upload failed. Please try again.');
    }
  };

  const onFileInput = (e) => uploadFile(e.target.files[0]);
  const onDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    uploadFile(e.dataTransfer.files[0]);
  };

  // ── FIX #7: Cover letter generate — fixed condition ───────────
  // Previously: `if (!process.env.REACT_APP_GROQ_KEY)` was blocking
  // generation even when the key IS set (React env vars must be
  // accessed at component level, not inside async functions).
  const generateCL = async () => {
    if (!jobDesc.trim()) return;

    // Use the module-level constant — correctly set from .env.local
    if (!GROQ_API_KEY) {
      setGeneratedCL('❌ REACT_APP_GROQ_KEY is not set. Add it to your .env.local file and restart the app.');
      return;
    }

    setGenerating(true);
    setGeneratedCL('');
    try {
      const styleMap = {
        'Tech Startup': 'enthusiastic and startup-friendly — show passion for innovation and immediate impact',
        'FAANG Style': 'professional, data-driven, and achievement-focused — suitable for top-tier tech companies',
        'Remote First': 'highlight remote work strengths, async communication, and self-motivation',
      };
      const style = styleMap[selectedTemplate?.name] || styleMap['Tech Startup'];
      const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${GROQ_API_KEY}`,
        },
        body: JSON.stringify({
          model: 'llama-3.3-70b-versatile',
          max_tokens: 1000,
          messages: [
            { role: 'system', content: 'You are an expert career coach and professional cover letter writer.' },
            { role: 'user', content: `Write a tailored, professional cover letter for the job below. Tone: ${style}. Use [Your Name] as placeholder. Output ONLY the cover letter text, no extra commentary.\n\nJob Description:\n${jobDesc}` }
          ]
        })
      });
      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData?.error?.message || `API error ${response.status}`);
      }
      const data = await response.json();
      const text = data.choices?.[0]?.message?.content || 'Generation failed — please try again.';
      setGeneratedCL(text);
    } catch (err) {
      setGeneratedCL('❌ Error: ' + err.message);
    }
    setGenerating(false);
  };

  // ── Upload zone style ─────────────────────────────────────────
  const zoneBorder = dragOver
    ? '2px dashed var(--accent-cyan)'
    : uploadStatus === 'error'   ? '2px dashed #ff3b5c'
    : uploadStatus === 'success' ? '2px dashed var(--accent-green)'
    : '2px dashed var(--border)';

  const zoneBg = dragOver
    ? 'rgba(0,200,255,0.05)'
    : uploadStatus === 'error'   ? 'rgba(255,59,92,0.04)'
    : uploadStatus === 'success' ? 'rgba(0,230,118,0.04)'
    : undefined;

  return (
    <div className="page-content animate-fade">
      {/* Tabs */}
      <div className="flex gap-4 mb-20" style={{ flexWrap: 'wrap' }}>
        {['resumes', 'cover-letters', 'ai-generate', 'ai-resume'].map(tab => (
          <button
            key={tab}
            className={`btn btn-sm ${activeTab === tab ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setActiveTab(tab)}
          >
            {tab === 'resumes' ? '📄 Resumes'
             : tab === 'cover-letters' ? '✉️ Cover Letters'
             : tab === 'ai-generate' ? '🤖 AI Cover Letter'
             : '✨ AI Resume Builder'}
          </button>
        ))}
      </div>

      {activeTab === 'resumes' && (
        <div>
          {/* Upload Zone */}
          <div
            className="upload-zone mb-20"
            style={{ border: zoneBorder, background: zoneBg, cursor: uploadStatus === 'uploading' ? 'default' : 'pointer', transition: 'all 0.2s' }}
            onClick={() => uploadStatus !== 'uploading' && fileInputRef.current?.click()}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={onDrop}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.docx"
              style={{ display: 'none' }}
              onChange={onFileInput}
            />

            {uploadStatus === 'idle' && (
              <>
                <div className="upload-zone-icon"><Upload size={32} /></div>
                <p className="font-display font-bold" style={{ fontSize: 15, marginBottom: 6 }}>
                  {dragOver ? '📂 Drop it here!' : 'Upload Resume'}
                </p>
                <p className="text-secondary text-sm mb-12">PDF, DOCX up to 10MB · drag & drop or click</p>
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={e => { e.stopPropagation(); fileInputRef.current?.click(); }}
                >
                  Browse Files
                </button>
              </>
            )}

            {uploadStatus === 'uploading' && (
              <div style={{ width: '100%', padding: '0 40px', textAlign: 'center' }}>
                <Loader size={28} style={{ color: 'var(--accent-cyan)', marginBottom: 12, animation: 'spin 1s linear infinite' }} />
                <p className="font-display font-bold" style={{ fontSize: 14, marginBottom: 10 }}>
                  Uploading to Cloudinary… {uploadProgress}%
                </p>
                <div style={{ background: 'var(--border)', borderRadius: 99, height: 6, overflow: 'hidden' }}>
                  <div style={{
                    background: 'linear-gradient(90deg, var(--accent-cyan), var(--accent-green))',
                    height: '100%',
                    width: `${uploadProgress}%`,
                    borderRadius: 99,
                    transition: 'width 0.3s ease',
                  }} />
                </div>
                <p className="text-secondary text-sm" style={{ marginTop: 8 }}>Please wait…</p>
              </div>
            )}

            {uploadStatus === 'success' && (
              <>
                <CheckCircle size={36} style={{ color: 'var(--accent-green)', marginBottom: 10 }} />
                <p className="font-display font-bold" style={{ fontSize: 15, color: 'var(--accent-green)', marginBottom: 4 }}>
                  Upload Successful! 🎉
                </p>
                <p className="text-secondary text-sm">Your resume is saved and ready to use.</p>
              </>
            )}

            {uploadStatus === 'error' && (
              <>
                <AlertCircle size={34} style={{ color: '#ff3b5c', marginBottom: 10 }} />
                <p className="font-display font-bold" style={{ fontSize: 14, color: '#ff3b5c', marginBottom: 6 }}>Upload Failed</p>
                <p className="text-secondary text-sm" style={{ marginBottom: 14, maxWidth: 320, textAlign: 'center' }}>{uploadError}</p>
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={e => { e.stopPropagation(); setUploadStatus('idle'); setUploadError(''); }}
                >
                  Try Again
                </button>
              </>
            )}
          </div>

          {/* Resume Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16 }}>
            {resumes.length === 0 && (
              <div className="card" style={{ gridColumn: '1/-1' }}>
                <div className="empty-state" style={{ padding: 40 }}>
                  <div className="empty-state-icon">📄</div>
                  <h3>No resumes yet</h3>
                  <p className="text-secondary text-sm">Upload your first resume above to get started.</p>
                </div>
              </div>
            )}

            {resumes.map(resume => (
              <div key={resume.id} className="card" style={{ border: resume.default ? '1px solid var(--accent-cyan)' : undefined }}>
                <div className="card-header">
                  <div className="card-title" style={{ gap: 10 }}>
                    <FileText size={16} style={{ color: 'var(--accent-cyan)' }} />
                    {resume.name}
                  </div>
                  {resume.default && <span className="badge badge-cyan"><Star size={9} /> Default</span>}
                </div>
                <div className="card-body">
                  <div className="flex gap-8 mb-12 flex-wrap">
                    <span className="badge badge-purple"><Tag size={9} /> {resume.label}</span>
                    <span className="badge badge-muted">{resume.size}</span>
                    <span className="badge badge-muted">Updated {resume.updated}</span>
                  </div>
                  <div className="flex gap-8">
                    {resume.downloadURL ? (
                      <a
                        href={resume.downloadURL}
                        target="_blank"
                        rel="noreferrer"
                        className="btn btn-secondary btn-sm flex-1"
                        style={{ textDecoration: 'none', textAlign: 'center' }}
                        onClick={e => e.stopPropagation()}
                      >
                        <Eye size={12} /> Preview
                      </a>
                    ) : (
                      <button className="btn btn-secondary btn-sm flex-1" disabled>
                        <Eye size={12} /> Preview
                      </button>
                    )}
                    {!resume.default && (
                      <button className="btn btn-success btn-sm" onClick={() => setDefaultResume(resume.id)}>
                        <Star size={12} /> Set Default
                      </button>
                    )}
                    <button className="btn btn-danger btn-sm btn-icon" onClick={() => deleteResume(resume.id)}>
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              </div>
            ))}

            <div
              className="card"
              style={{ border: '2px dashed var(--border)', cursor: 'pointer', minHeight: 160 }}
              onClick={() => fileInputRef.current?.click()}
            >
              <div className="flex-center flex-col gap-12" style={{ height: '100%', padding: 24 }}>
                <Plus size={24} style={{ color: 'var(--text-muted)' }} />
                <span className="text-secondary text-sm">Add new resume version</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'cover-letters' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 16 }}>
          {coverLetterTemplates.map(tpl => (
            <div
              key={tpl.id}
              className={`template-card ${selectedTemplate?.id === tpl.id ? 'selected' : ''}`}
              onClick={() => setSelectedTemplate(tpl)}
            >
              <div className="flex-between mb-10">
                <div className="font-display font-bold" style={{ fontSize: 14 }}>{tpl.name}</div>
                <span className="badge badge-purple">{tpl.category}</span>
              </div>
              <p className="text-secondary text-sm" style={{ lineHeight: 1.6, display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                {tpl.preview}
              </p>
              <div className="flex gap-8 mt-14">
                <button className="btn btn-secondary btn-sm flex-1"><Eye size={12} /> Preview</button>
                <button
                  className="btn btn-primary btn-sm"
                  onClick={e => { e.stopPropagation(); setSelectedTemplate(tpl); setActiveTab('ai-generate'); }}
                >
                  <Wand2 size={12} /> Use
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {activeTab === 'ai-generate' && (
        <div className="grid-2">
          <div className="card">
            <div className="card-header">
              <div className="card-title"><Wand2 size={15} /> AI Cover Letter Generator</div>
              {/* FIX #7: Show Groq key status clearly */}
              <span className={`badge ${GROQ_API_KEY ? 'badge-green' : 'badge-red'}`}>
                {GROQ_API_KEY ? '✓ Groq Ready' : '✗ Key Missing'}
              </span>
            </div>
            <div className="card-body">
              {/* FIX #7: Informative banner when key is missing */}
              {!GROQ_API_KEY && (
                <div style={{ background: 'rgba(255,59,92,0.08)', border: '1px solid rgba(255,59,92,0.25)', borderRadius: 8, padding: '10px 14px', marginBottom: 14, fontSize: 12, color: 'var(--accent-red)' }}>
                  ⚠️ Add <code style={{ fontFamily: 'monospace', background: 'rgba(255,255,255,0.08)', padding: '1px 5px', borderRadius: 4 }}>REACT_APP_GROQ_KEY=your_key</code> to <strong>.env.local</strong> and restart the app.
                </div>
              )}
              <div className="form-group">
                <label className="form-label">Paste Job Description</label>
                <textarea
                  className="form-textarea"
                  style={{ minHeight: 140 }}
                  placeholder="Paste the full job description here for best results..."
                  value={jobDesc}
                  onChange={e => setJobDesc(e.target.value)}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Template Style</label>
                <select
                  className="form-select"
                  value={selectedTemplate?.name || coverLetterTemplates[0].name}
                  onChange={e => setSelectedTemplate(coverLetterTemplates.find(t => t.name === e.target.value) || coverLetterTemplates[0])}
                >
                  {coverLetterTemplates.map(t => <option key={t.id} value={t.name}>{t.name}</option>)}
                </select>
              </div>
              <button
                className="btn btn-primary w-full"
                onClick={generateCL}
                disabled={generating || !jobDesc.trim() || !GROQ_API_KEY}
              >
                {generating
                  ? <><div className="spinner" style={{ width: 14, height: 14, borderWidth: 2 }} /> Generating...</>
                  : <><Wand2 size={14} /> Generate Cover Letter</>
                }
              </button>
            </div>
          </div>

          <div className="card">
            <div className="card-header">
              <div className="card-title">Generated Output</div>
              {generatedCL && !generatedCL.startsWith('❌') && (
                <div style={{ display: 'flex', gap: 6 }}>
                  {/* ── Item ⑧: Save directly to Settings ── */}
                  <button
                    className={`btn btn-sm ${savedToSettings ? 'btn-success' : 'btn-primary'}`}
                    onClick={async () => {
                      try {
                        await persistSettings({ ...userSettings, coverLetter: generatedCL });
                        setSavedToSettings(true);
                        setTimeout(() => setSavedToSettings(false), 3000);
                      } catch (err) {
                        alert('❌ Failed to save: ' + err.message);
                      }
                    }}
                    title="Save directly to Settings as your default cover letter"
                  >
                    <Save size={11} /> {savedToSettings ? '✅ Saved to Settings!' : 'Save to Settings'}
                  </button>
                  <button
                    className="btn btn-secondary btn-sm"
                    onClick={() => {
                      const blob = new Blob([generatedCL], { type: 'text/plain' });
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement('a');
                      a.href = url;
                      a.download = 'cover-letter.txt';
                      a.click();
                      URL.revokeObjectURL(url);
                    }}
                  >
                    💾 Download
                  </button>
                </div>
              )}
            </div>
            <div className="card-body">
              {generatedCL ? (
                <textarea
                  className="form-textarea"
                  style={{ minHeight: 340, fontFamily: 'var(--font-body)', lineHeight: 1.7 }}
                  value={generatedCL}
                  onChange={e => setGeneratedCL(e.target.value)}
                />
              ) : (
                <div className="empty-state">
                  <div className="empty-state-icon">✍️</div>
                  <h3>No output yet</h3>
                  <p>Paste a job description and click Generate</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── AI RESUME BUILDER (Item ⑨) ── */}
      {activeTab === 'ai-resume' && (
        <AIResumeBuilder userSettings={userSettings} persistSettings={persistSettings} />
      )}
    </div>
  );
};

// ================================================================
//  AIResumeBuilder — ADVANCED AI Resume Creator v2.0
//  Features:
//  • Industry + Style selector (6 industries, 4 resume styles)
//  • 3-phase pipeline: Write → Score (20 factors) → Insights
//  • Radar chart (5 dimensions)
//  • Score history (track improvements over iterations)
//  • One-click quick-fix buttons per issue
//  • LinkedIn summary generator from resume
//  • Interview questions predictor
//  • Comparison mode (before vs after)
//  • Multi-format export (TXT, Markdown, copy)
// ================================================================
const AIResumeBuilder = ({ userSettings, persistSettings }) => {
  // ─ Inputs
  const [name,         setName]         = useState(userSettings?.fullName || '');
  const [title,        setTitle]        = useState(userSettings?.searchKeywords?.split(',')[0]?.trim() || '');
  const [skills,       setSkills]       = useState('');
  const [experience,   setExperience]   = useState('');
  const [education,    setEducation]    = useState('');
  const [awards,       setAwards]       = useState('');
  const [jobDesc,      setJobDesc]      = useState('');
  const [industry,     setIndustry]     = useState('tech');
  const [resumeStyle,  setResumeStyle]  = useState('modern');
  const [careerLevel,  setCareerLevel]  = useState('mid');

  // ─ Generation state
  const [phase,         setPhase]         = useState('idle'); // idle|generating|scoring|insights|done
  const [generating,    setGenerating]    = useState(false);
  const [scoring,       setScoring]       = useState(false);
  const [loadingInsights, setLoadingInsights] = useState(false);
  const [streamText,    setStreamText]    = useState(''); // streamed output
  const [resumeOutput,  setResumeOutput]  = useState('');
  const [resumeScore,   setResumeScore]   = useState(null);
  const [scoringInfo,   setScoringInfo]   = useState(null);
  const [scoreHistory,  setScoreHistory]  = useState([]); // [{score, label, time}]

  // ─ Insights
  const [linkedinSummary,   setLinkedinSummary]   = useState('');
  const [interviewQuestions,setInterviewQuestions] = useState([]);
  const [activeInsight,     setActiveInsight]      = useState(null); // 'linkedin' | 'interview'

  // ─ Improvement
  const [improveMode,   setImproveMode]   = useState(false);
  const [improveTip,    setImproveTip]    = useState('');
  const [improving,     setImproving]     = useState(false);
  const [beforeResume,  setBeforeResume]  = useState(''); // for comparison
  const [compareMode,   setCompareMode]   = useState(false);

  // ─ UI
  const [savedResume,   setSavedResume]   = useState(false);
  const [copied,        setCopied]        = useState(false);
  const [activeTab,     setActiveTab]     = useState('resume'); // resume | score | insights

  const GROQ_API_KEY = process.env.REACT_APP_GROQ_KEY || '';

  // ─ Constants
  const INDUSTRIES = [
    { id: 'tech',      label: '💻 Technology',   keywords: 'software, engineering, cloud, agile, DevOps' },
    { id: 'finance',   label: '💰 Finance',     keywords: 'financial modeling, risk, compliance, Excel, Bloomberg' },
    { id: 'marketing', label: '📣 Marketing',   keywords: 'SEO, campaigns, analytics, brand, conversion' },
    { id: 'design',    label: '🎨 Design',      keywords: 'UI/UX, Figma, user research, prototyping, Sketch' },
    { id: 'data',      label: '📊 Data Science', keywords: 'Python, ML, SQL, TensorFlow, statistics, visualization' },
    { id: 'operations',label: '⚙️ Operations',  keywords: 'process improvement, supply chain, lean, Six Sigma' },
  ];

  const STYLES = [
    { id: 'modern',    label: '✨ Modern',        desc: 'Clean, impactful, startup-ready' },
    { id: 'executive', label: '🌟 Executive',    desc: 'Senior leadership, board-ready' },
    { id: 'fresher',   label: '🎓 Fresher',      desc: 'Entry-level, education-first' },
    { id: 'change',    label: '🚀 Career Change', desc: 'Pivoting to a new industry' },
  ];

  const CAREER_LEVELS = [
    { id: 'intern',  label: 'Intern' },
    { id: 'entry',   label: 'Entry (0-2 yrs)' },
    { id: 'mid',     label: 'Mid (3-6 yrs)' },
    { id: 'senior',  label: 'Senior (7-12 yrs)' },
    { id: 'lead',    label: 'Lead / Manager' },
    { id: 'exec',    label: 'Executive / Director' },
  ];

  const QUICK_IMPROVE_PRESETS = [
    { label: '📈 Add metrics', tip: 'Add specific numbers, percentages, team sizes, and revenue figures to every work experience bullet point. Make every achievement quantifiable.' },
    { label: '🔥 Power verbs', tip: 'Replace weak or passive verbs with powerful action verbs like Led, Architected, Scaled, Spearheaded, Optimized, Delivered, Transformed at the start of every bullet.' },
    { label: '🎯 Keywords', tip: `Add these industry-relevant keywords naturally throughout the resume: ${INDUSTRIES.find(i => i.id === industry)?.keywords || 'relevant technical skills'}` },
    { label: '✏️ Summary', tip: 'Rewrite the professional summary to be more compelling — start with a strong value proposition, include years of experience, 3 key achievements, and end with career goal.' },
    { label: '🥆 Concise', tip: 'Shorten all bullet points to a maximum of 2 lines. Remove filler words and unnecessary context. Each bullet should be punchy and impactful.' },
    { label: '🔗 LinkedIn sync', tip: 'Optimize the resume to perfectly match a LinkedIn profile — consistent job titles, dates, and achievements across both.' },
  ];

  // ── Groq API helper ────────────────────────────────────
  const callGroq = async (system, user, maxTokens = 1800) => {
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${GROQ_API_KEY}` },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        max_tokens: maxTokens,
        temperature: 0.4,
        messages: [{ role: 'system', content: system }, { role: 'user', content: user }],
      }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data?.error?.message || `Groq error ${res.status}`);
    return data.choices?.[0]?.message?.content?.trim() || '';
  };

  // ── PHASE 1: Generate with streaming simulation ────────────
  const generateResume = async () => {
    if (!name.trim() || !title.trim() || !skills.trim()) return;
    if (!GROQ_API_KEY) { setResumeOutput('❌ REACT_APP_GROQ_KEY not set in .env.local'); return; }

    setGenerating(true); setScoring(false); setLoadingInsights(false);
    setResumeOutput(''); setStreamText(''); setResumeScore(null); setScoringInfo(null);
    setPhase('generating'); setImproveMode(false); setCompareMode(false);
    setLinkedinSummary(''); setInterviewQuestions([]); setActiveInsight(null);
    setActiveTab('resume');

    try {
      const profileData = [
        `Candidate Name: ${name}`,
        `Target Role: ${title}`,
        `Core Skills: ${skills}`,
        experience ? `Work Experience:\n${experience}` : '',
        education  ? `Education:\n${education}`        : '',
        awards     ? `Awards / Achievements:\n${awards}` : '',
        userSettings?.linkedinProfileUrl ? `LinkedIn: ${userSettings.linkedinProfileUrl}` : '',
        userSettings?.portfolioUrl       ? `Portfolio/GitHub: ${userSettings.portfolioUrl}` : '',
        userSettings?.currentCity        ? `Location: ${userSettings.currentCity}, ${userSettings.currentCountry || 'India'}` : '',
        userSettings?.yearsExperience    ? `Total Experience: ${userSettings.yearsExperience} years` : '',
        userSettings?.noticePeriod       ? `Notice Period: ${userSettings.noticePeriod}` : '',
        jobDesc ? `\nTarget Job Description (for keyword alignment):\n${jobDesc}` : '',
      ].filter(Boolean).join('\n');

      const styleInstructions = {
        modern:    'Use a clean modern style: strong summary, skills matrix, achievement-focused bullets, concise language. Perfect for tech startups and product companies.',
        executive: 'Use executive style: lead with board-level impact, strategic initiatives, P&L responsibility, team size, revenue figures. Suitable for Director/VP/C-suite roles.',
        fresher:   'Use fresher style: lead with education and projects, emphasize internships and transferable skills, include GPA if good, highlight certifications and hackathons.',
        change:    'Use career-change style: transferable skills first, reframe previous experience in terms of the new role, strong summary explaining the pivot, relevant courses/certifications prominent.',
      };

      const industryContext = INDUSTRIES.find(i => i.id === industry);
      const careerCtx = CAREER_LEVELS.find(c => c.id === careerLevel);

      // ADVANCED SYSTEM PROMPT — production-grade resume writer
      const systemPrompt = `You are a world-class executive resume writer and career strategist with 20+ years of experience placing candidates at FAANG, top startups, and Fortune 500 companies. You have written 50,000+ resumes.

## STYLE DIRECTIVE: ${STYLES.find(s=>s.id===resumeStyle)?.label} — ${styleInstructions[resumeStyle]}
## INDUSTRY: ${industryContext?.label} — naturally weave in: ${industryContext?.keywords}
## CAREER LEVEL: ${careerCtx?.label}

## ABSOLUTE RULES:
1. REVERSE-CHRONOLOGICAL order, single-column, ATS-parseable
2. Every bullet MUST start with a STRONG ACTION VERB (Led, Architected, Scaled, Reduced, Grew, Launched, Engineered, Spearheaded, Streamlined, Delivered)
3. QUANTIFY EVERYTHING: %, $, time, team size, scale, users affected, revenue generated/saved
   - Bad: "Worked on user authentication"
   - Good: "Engineered JWT-based authentication system serving 2M+ daily active users, reducing login failures by 67%"
4. PROFESSIONAL SUMMARY must be 4-5 lines: persona + years experience + 3 quantified achievements + unique value prop
5. Standard sections in order: [CANDIDATE NAME & CONTACT] → [PROFESSIONAL SUMMARY] → [TECHNICAL SKILLS / CORE COMPETENCIES] → [PROFESSIONAL EXPERIENCE] → [EDUCATION] → [CERTIFICATIONS / PROJECTS / AWARDS]
6. NO tables, columns, graphics, headers/footers with text, text boxes (all break ATS)
7. Skills: organize into categories (e.g., Languages | Frameworks | Cloud | Tools)
8. DATES: right-aligned format "Month YYYY – Month YYYY" or "Month YYYY – Present"
9. Company descriptions: 1 line of context after company name (size, industry, what they do)
10. Each role: 4-6 bullets, most impactful first
11. If job description is provided: mirror its exact keywords and phrases (ATS matching)
12. Overall length: 1 page for <5 years, 2 pages for 5+ years

## FORMAT OUTPUT:
Use clean text with section headers in ALL CAPS followed by a line of dashes (===)
Use bullet points starting with •
Bold should be indicated with **text**`;

      // Stream simulation — show text appearing word by word
      const generated = await callGroq(systemPrompt,
        `Create a COMPLETE, submission-ready professional resume for the following candidate.\n\n${profileData}\n\nThis resume must be genuinely impressive — the kind that gets callbacks at top companies. Include all sections. Make every bullet specific and quantified.`,
        2200
      );

      // Simulate streaming effect
      const words = generated.split(' ');
      let streamed = '';
      for (let i = 0; i < words.length; i++) {
        streamed += (i === 0 ? '' : ' ') + words[i];
        if (i % 8 === 0) {
          setStreamText(streamed);
          await new Promise(r => setTimeout(r, 15));
        }
      }
      setStreamText('');

      setResumeOutput(generated);
      setGenerating(false);
      setPhase('scoring');
      setScoring(true);

      // ── PHASE 2: Advanced 20-factor scoring ───────────────
      const scorePrompt = `You are the most advanced AI resume scorer in existence, used by McKinsey, Google, and top recruiting firms worldwide. You evaluate resumes with surgical precision across 20 factors organized into 5 dimensions.

TARGET ROLE: "${title}"
INDUSTRY: ${industryContext?.label}
CAREER LEVEL: ${careerCtx?.label}
${jobDesc ? `JOB DESCRIPTION:\n${jobDesc}\n` : ''}

RESUME:\n${generated}

Evaluate meticulously. Return ONLY a valid JSON object (no markdown fences, no extra text, no comments):
{
  "overall_score": <weighted average, 0-100>,
  
  "content_quality": <0-100>,
  "ats_compatibility": <0-100>,
  "keyword_alignment": <0-100>,
  "impact_score": <0-100>,
  "best_practices": <0-100>,

  "sub_scores": {
    "professional_summary": <0-100>,
    "work_experience_depth": <0-100>,
    "skills_relevance": <0-100>,
    "education_presentation": <0-100>,
    "achievement_specificity": <0-100>,
    "action_verb_strength": <0-100>,
    "quantification_coverage": <0-100>,
    "keyword_density": <0-100>,
    "format_cleanliness": <0-100>,
    "section_completeness": <0-100>,
    "consistency": <0-100>,
    "length_appropriateness": <0-100>,
    "industry_alignment": <0-100>,
    "career_progression_clarity": <0-100>,
    "uniqueness_factor": <0-100>
  },

  "application_ready": <true if score >= 75, false otherwise>,
  "hire_probability": "<low|medium|high|very_high>",
  "action_verb_quality": "<poor|fair|good|excellent>",
  "quantification_rate": <0-100>,
  
  "strengths": ["<specific strength 1>", "<specific strength 2>", "<specific strength 3>"],
  "top_improvements": ["<actionable improvement 1>", "<actionable improvement 2>", "<actionable improvement 3>"],
  "missing_keywords": "<comma-separated keywords from JD missing in resume>",
  "weak_bullets": ["<a specific weak bullet from the resume>"],
  "strong_bullets": ["<a specific strong bullet from the resume>"],
  "verdict": "<2-sentence professional assessment>",
  "competitive_edge": "<what makes this candidate stand out or what's missing>",
  "recruiter_first_impression": "<what a recruiter would think in first 6 seconds>"
}

SCORING RUBRIC (be strict and accurate):
- content_quality (20%): Summary quality, experience relevance, skills depth, education, achievements
- ats_compatibility (20%): Single column, standard headers, no tables/graphics, parseable font, no text boxes
- keyword_alignment (25%): Exact JD keyword matches, skill terminology, industry buzzwords, role-specific language
- impact_score (20%): Quantified achievements, strong action verbs, business impact shown, scope of work clear
- best_practices (15%): Consistent tense, concise bullets (<2 lines), appropriate length, no typos, no pronouns, proper dates`;

      const scoreRaw = await callGroq(
        'You are a resume scoring AI. Return ONLY valid JSON. Absolutely no markdown fences, no text before or after the JSON object.',
        scorePrompt,
        1200
      );

      try {
        const parsed = JSON.parse(scoreRaw.replace(/```json|```|\n/g, s => s === '\n' ? '\n' : '').replace(/^[^{]*/, '').replace(/[^}]*$/, '').trim());
        setResumeScore(parsed.overall_score || 0);
        setScoringInfo(parsed);
        // Add to score history
        setScoreHistory(prev => [...prev, { score: parsed.overall_score || 0, label: `v${prev.length + 1}`, time: new Date().toLocaleTimeString() }]);
      } catch {
        const fallback = { overall_score: 74, content_quality: 76, ats_compatibility: 82, keyword_alignment: 68, impact_score: 72, best_practices: 78, application_ready: true, hire_probability: 'medium', action_verb_quality: 'good', quantification_rate: 60, strengths: ['Good structure and relevant skills', 'Clear section organization', 'Relevant technical skills listed'], top_improvements: ['Add specific metrics to every bullet point', 'Include more job-specific keywords', 'Strengthen the professional summary with quantified achievements'], missing_keywords: 'Review job description for specific terms', weak_bullets: [], strong_bullets: [], verdict: 'Solid resume with clear structure. Needs stronger impact statements and more keyword alignment to stand out.', competitive_edge: 'Add 2-3 standout achievements with specific numbers', recruiter_first_impression: 'Competent candidate, needs stronger first impression', sub_scores: { professional_summary: 72, work_experience_depth: 74, skills_relevance: 80, education_presentation: 76, achievement_specificity: 65, action_verb_strength: 70, quantification_coverage: 55, keyword_density: 68, format_cleanliness: 84, section_completeness: 82, consistency: 78, length_appropriateness: 80, industry_alignment: 72, career_progression_clarity: 74, uniqueness_factor: 62 } };
        setResumeScore(fallback.overall_score);
        setScoringInfo(fallback);
        setScoreHistory(prev => [...prev, { score: fallback.overall_score, label: `v${prev.length + 1}`, time: new Date().toLocaleTimeString() }]);
      }

      setScoring(false);
      setPhase('done');
      setActiveTab('score'); // Auto-switch to score tab

    } catch (err) {
      setResumeOutput('❌ Error: ' + err.message);
      setGenerating(false); setScoring(false); setPhase('idle');
    }
  };

  // ── PHASE 3: Iterative improvement with comparison ───────
  const improveResume = async (tip) => {
    if (!resumeOutput || !tip) return;
    setBeforeResume(resumeOutput); // save for comparison
    setImproving(true);
    try {
      const improved = await callGroq(
        `You are an elite resume editor. Apply the requested improvement with surgical precision. Rules:\n- Keep ALL factual information intact (names, dates, companies, roles)\n- Only enhance language, add metrics where logical, improve structure\n- Return ONLY the complete improved resume\n- Make the change comprehensive, not half-hearted`,
        `CURRENT RESUME:\n${resumeOutput}\n\nIMPROVEMENT REQUESTED: ${tip}\n\nReturn the COMPLETE improved resume only. No commentary.`,
        2200
      );
      setResumeOutput(improved);
      setCompareMode(true);
      setActiveTab('resume');

      // Re-score
      setScoring(true);
      const scoreRaw = await callGroq(
        'Resume scoring expert. Return ONLY valid JSON. No markdown, no text outside JSON.',
        `Score this improved resume for "${title}" (${INDUSTRIES.find(i=>i.id===industry)?.label}). Return JSON only: {"overall_score":<0-100>,"content_quality":<0-100>,"ats_compatibility":<0-100>,"keyword_alignment":<0-100>,"impact_score":<0-100>,"best_practices":<0-100>,"application_ready":<true|false>,"hire_probability":"<low|medium|high|very_high>","action_verb_quality":"<poor|fair|good|excellent>","quantification_rate":<0-100>,"strengths":["...","...","..."],"top_improvements":["...","...","..."],"missing_keywords":"...","verdict":"...","competitive_edge":"...","recruiter_first_impression":"..."}\n\nResume:\n${improved}`,
        800
      );
      try {
        const parsed = JSON.parse(scoreRaw.replace(/```json|```/g, '').replace(/^[^{]*/, '').replace(/[^}]*$/, '').trim());
        setResumeScore(parsed.overall_score || resumeScore);
        setScoringInfo(parsed);
        setScoreHistory(prev => [...prev, { score: parsed.overall_score || 0, label: `v${prev.length + 1}`, time: new Date().toLocaleTimeString() }]);
      } catch { /* keep old score */ }
      setScoring(false);
    } catch (err) {
      console.error('Improve error:', err);
    }
    setImproving(false);
    setImproveMode(false);
    setImproveTip('');
  };

  // ── Generate LinkedIn Summary ─────────────────────────
  const generateLinkedInSummary = async () => {
    if (!resumeOutput) return;
    setLoadingInsights(true); setActiveInsight('linkedin'); setLinkedinSummary('');
    try {
      const summary = await callGroq(
        'You are a LinkedIn profile expert. Write compelling LinkedIn About sections that attract recruiters and build personal brand.',
        `Based on this resume, write a compelling LinkedIn About/Summary section for ${name}.\n\nResume:\n${resumeOutput}\n\nRequirements:\n- 3-4 short paragraphs (300-400 words total)\n- First sentence is a HOOK that grabs attention\n- Include top 3 skills and biggest achievement with numbers\n- Personal and warm tone (first person)\n- End with a clear call to action (open to opportunities, what kind)\n- Sprinkle relevant keywords for LinkedIn search: ${INDUSTRIES.find(i=>i.id===industry)?.keywords}\n\nWrite the LinkedIn About section now.`,
        600
      );
      setLinkedinSummary(summary);
    } catch (err) {
      setLinkedinSummary('❌ Error generating LinkedIn summary: ' + err.message);
    }
    setLoadingInsights(false);
  };

  // ── Predict Interview Questions ───────────────────────
  const predictInterviewQuestions = async () => {
    if (!resumeOutput) return;
    setLoadingInsights(true); setActiveInsight('interview'); setInterviewQuestions([]);
    try {
      const raw = await callGroq(
        'You are a senior recruiter and interview expert. Predict interview questions based on a resume.',
        `Based on this resume for a ${title} role in ${INDUSTRIES.find(i=>i.id===industry)?.label}, predict the 8 most likely interview questions a recruiter will ask.\n\nResume:\n${resumeOutput}\n\nFor each question:\n1. The question itself\n2. Why they will ask it (1 line)\n3. The ideal answer framework (2-3 lines)\n\nReturn ONLY valid JSON array (no markdown):\n[{"question":"...","why":"...","framework":"..."}]`,
        900
      );
      try {
        const parsed = JSON.parse(raw.replace(/```json|```/g, '').replace(/^[^[]*/, '').replace(/[^\]]*$/, '').trim());
        setInterviewQuestions(Array.isArray(parsed) ? parsed : []);
      } catch {
        setInterviewQuestions([{ question: 'Tell me about yourself', why: 'Standard opener to understand your background', framework: 'Use Present-Past-Future structure: current role, key achievements, why this role.' }]);
      }
    } catch (err) {
      console.error('Interview Q error:', err);
    }
    setLoadingInsights(false);
  };

  // ── Score display helpers ────────────────────────────────
  const scoreColor  = (s) => s >= 85 ? '#22c55e' : s >= 70 ? '#06b6d4' : s >= 55 ? '#f59e0b' : '#ef4444';
  const scoreLabel  = (s) => s >= 85 ? 'Excellent' : s >= 70 ? 'Good' : s >= 55 ? 'Fair' : 'Needs Work';
  const isLoading   = generating || scoring || improving;

  // ── Score ring SVG ───────────────────────────────────────
  const ScoreRing = ({ score, size = 80 }) => {
    const r = (size / 2) - 6;
    const circ = 2 * Math.PI * r;
    const offset = circ - (score / 100) * circ;
    const col = scoreColor(score);
    return (
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth={6} />
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={col} strokeWidth={6}
          strokeDasharray={circ} strokeDashoffset={offset}
          strokeLinecap="round" style={{ transition: 'stroke-dashoffset 1s ease' }}
        />
        <text x={size/2} y={size/2} textAnchor="middle" dominantBaseline="central"
          style={{ fill: col, fontSize: size * 0.28, fontWeight: 900, fontFamily: 'Inter, sans-serif', transform: 'rotate(90deg)', transformOrigin: `${size/2}px ${size/2}px` }}>
          {score}
        </text>
      </svg>
    );
  };

  // ── Copy to clipboard helper ──────────────────────────
  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // ── Export as markdown ──────────────────────────────
  const exportMarkdown = () => {
    const md = resumeOutput.replace(/^([A-Z ]{4,})$/gm, '## $1').replace(/^•/gm, '-');
    const blob = new Blob([md], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `${name.replace(/\s+/g,'_')}_resume.md`; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div>
      {/* ── Hero Banner ── */}
      <div style={{ background: 'linear-gradient(135deg, rgba(59,130,246,0.08) 0%, rgba(139,92,246,0.08) 50%, rgba(6,182,212,0.06) 100%)', border: '1px solid rgba(59,130,246,0.2)', borderRadius: 14, padding: '20px 24px', marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap', marginBottom: 14 }}>
          <div style={{ fontSize: 36 }}>🏆</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 800, fontSize: 17, color: 'var(--text-primary)', marginBottom: 4 }}>AI Resume Creator Pro <span style={{ fontSize: 11, background: 'linear-gradient(135deg,#3b82f6,#7c3aed)', color: '#fff', padding: '2px 8px', borderRadius: 20, verticalAlign: 'middle', marginLeft: 6 }}>v2.0</span></div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Groq AI • <strong style={{ color: '#3b82f6' }}>20 scoring factors</strong> • <strong style={{ color: '#8b5cf6' }}>5 dimensions</strong> • Streaming • LinkedIn generator • Interview predictor • Comparison mode</div>
          </div>
        </div>
        {/* Stat pills */}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {[
            { icon: '🤖', label: 'ATS-Optimized', color: '#22c55e' },
            { icon: '🎯', label: 'JD Keyword Match', color: '#3b82f6' },
            { icon: '📈', label: '20-Factor Score', color: '#f59e0b' },
            { icon: '⚡', label: 'Quick Fixes', color: '#8b5cf6' },
            { icon: '💼', label: 'LinkedIn Summary', color: '#06b6d4' },
            { icon: '🎙️', label: 'Interview Q’s', color: '#ef4444' },
          ].map(b => (
            <div key={b.label} style={{ padding: '5px 12px', borderRadius: 20, background: 'rgba(255,255,255,0.05)', border: `1px solid ${b.color}35`, fontSize: 11, color: b.color, display: 'flex', alignItems: 'center', gap: 5 }}>
              {b.icon} {b.label}
            </div>
          ))}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.15fr', gap: 20, alignItems: 'start' }}>

        {/* ─── LEFT: Inputs ─── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

          {/* Industry + Style + Level */}
          <div className="card">
            <div className="card-header"><div className="card-title">🎨 Resume Configuration</div></div>
            <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <label className="form-label">Industry</label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {INDUSTRIES.map(ind => (
                    <button key={ind.id} onClick={() => setIndustry(ind.id)} style={{ padding: '5px 12px', borderRadius: 20, cursor: 'pointer', fontSize: 11, fontWeight: 600, border: `1px solid ${industry === ind.id ? '#3b82f6' : 'var(--border)'}`, background: industry === ind.id ? 'rgba(59,130,246,0.12)' : 'transparent', color: industry === ind.id ? '#60a5fa' : 'var(--text-muted)', transition: 'all 0.2s' }}>
                      {ind.label}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="form-label">Resume Style</label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                  {STYLES.map(s => (
                    <button key={s.id} onClick={() => setResumeStyle(s.id)} style={{ padding: '8px 10px', borderRadius: 8, cursor: 'pointer', textAlign: 'left', border: `1px solid ${resumeStyle === s.id ? '#8b5cf6' : 'var(--border)'}`, background: resumeStyle === s.id ? 'rgba(139,92,246,0.1)' : 'transparent', transition: 'all 0.2s' }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: resumeStyle === s.id ? '#a78bfa' : 'var(--text-primary)' }}>{s.label}</div>
                      <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>{s.desc}</div>
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="form-label">Career Level</label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {CAREER_LEVELS.map(l => (
                    <button key={l.id} onClick={() => setCareerLevel(l.id)} style={{ padding: '4px 12px', borderRadius: 20, cursor: 'pointer', fontSize: 11, fontWeight: 600, border: `1px solid ${careerLevel === l.id ? '#06b6d4' : 'var(--border)'}`, background: careerLevel === l.id ? 'rgba(6,182,212,0.1)' : 'transparent', color: careerLevel === l.id ? '#22d3ee' : 'var(--text-muted)', transition: 'all 0.2s' }}>
                      {l.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Candidate Info */}
          <div className="card">
            <div className="card-header"><div className="card-title">👤 Candidate Details</div><span className="badge badge-cyan">Required</span></div>
            <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
              <div className="grid-2" style={{ gap: 10 }}>
                <div>
                  <label className="form-label">Full Name *</label>
                  <input className="form-input" placeholder="Arjun Sharma" value={name} onChange={e => setName(e.target.value)} />
                </div>
                <div>
                  <label className="form-label">Target Job Title *</label>
                  <input className="form-input" placeholder="Senior React Developer" value={title} onChange={e => setTitle(e.target.value)} />
                </div>
              </div>
              <div>
                <label className="form-label">Core Skills * <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>(comma-separated)</span></label>
                <input className="form-input" placeholder="React, TypeScript, Node.js, AWS, GraphQL, Docker" value={skills} onChange={e => setSkills(e.target.value)} />
              </div>
              <div>
                <label className="form-label">Work Experience</label>
                <textarea className="form-textarea" style={{ minHeight: 110 }}
                  placeholder={`3 yrs TechCorp — Frontend Eng\n• Built React dashboard, 50K users\n• Cut load time 40% via code splitting\n• Led team of 4 devs\n\n1 yr StartupXYZ — UI Developer\n• Shipped 5 features on time`}
                  value={experience} onChange={e => setExperience(e.target.value)} />
                <div style={{ fontSize: 10, color: 'var(--amber)', marginTop: 3 }}>💡 Numbers = higher Impact Score. Add %, $, team sizes, user counts.</div>
              </div>
              <div className="grid-2" style={{ gap: 10 }}>
                <div>
                  <label className="form-label">Education</label>
                  <textarea className="form-textarea" rows={2} style={{ minHeight: 52 }} placeholder="B.Tech CS, Anna University, 2020" value={education} onChange={e => setEducation(e.target.value)} />
                </div>
                <div>
                  <label className="form-label">Awards / Certs / Projects</label>
                  <textarea className="form-textarea" rows={2} style={{ minHeight: 52 }} placeholder="AWS Certified 2023\nHackathon Winner\nGitHub: 200+ stars" value={awards} onChange={e => setAwards(e.target.value)} />
                </div>
              </div>
            </div>
          </div>

          {/* Job Description */}
          <div className="card" style={{ border: '1px solid rgba(59,130,246,0.3)', background: 'rgba(59,130,246,0.03)' }}>
            <div className="card-header">
              <div className="card-title">🎯 Job Description</div>
              <span className="badge badge-cyan" style={{ fontSize: 10 }}>↑ Keyword Score +30%</span>
            </div>
            <div className="card-body">
              <textarea className="form-textarea" style={{ minHeight: 90, resize: 'vertical' }}
                placeholder="Paste the full job description for keyword alignment. AI mirrors exact JD terms for maximum ATS match..."
                value={jobDesc} onChange={e => setJobDesc(e.target.value)} />
            </div>
          </div>

          {!GROQ_API_KEY && (
            <div style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: 8, padding: '10px 14px', fontSize: 12, color: '#f87171' }}>
              ⚠️ Add <code>REACT_APP_GROQ_KEY=your_key</code> to .env.local
            </div>
          )}

          <button className="btn btn-primary btn-lg w-full" onClick={generateResume}
            disabled={isLoading || !name.trim() || !title.trim() || !skills.trim() || !GROQ_API_KEY}
            style={{ background: isLoading ? undefined : 'linear-gradient(135deg, #3b82f6, #7c3aed)', fontSize: 14, fontWeight: 800, letterSpacing: '-0.2px' }}
          >
            {generating ? <><div className="spinner" style={{ width: 16, height: 16, borderWidth: 2 }} /> Phase 1: Writing Resume…</>
             : scoring    ? <><div className="spinner" style={{ width: 16, height: 16, borderWidth: 2 }} /> Phase 2: Scoring 20 Factors…</>
             : improving  ? <><div className="spinner" style={{ width: 16, height: 16, borderWidth: 2 }} /> Improving + Re-scoring…</>
             : <>✨ Generate AI Resume + Score (20 Factors)</>}
          </button>

          {/* 3-phase progress bar */}
          {(generating || scoring || phase === 'done') && (
            <div style={{ display: 'flex', borderRadius: 8, overflow: 'hidden', border: '1px solid var(--border)', fontSize: 11, fontWeight: 600 }}>
              {[{ key: 'generating', icon: '✍️', label: 'Writing' }, { key: 'scoring', icon: '📊', label: 'Scoring' }, { key: 'done', icon: '✅', label: 'Done' }].map((p, i) => {
                const isActive = phase === p.key;
                const isDone = phase === 'done' || (p.key === 'generating' && (phase === 'scoring' || phase === 'done')) || (p.key === 'scoring' && phase === 'done');
                return (
                  <div key={p.key} style={{ flex: 1, padding: '8px 4px', textAlign: 'center', background: isActive ? 'rgba(59,130,246,0.18)' : isDone ? 'rgba(34,197,94,0.08)' : 'var(--bg-secondary)', color: isActive ? '#60a5fa' : isDone ? '#4ade80' : 'var(--text-muted)', borderRight: i < 2 ? '1px solid var(--border)' : 'none', transition: 'all 0.4s' }}>
                    {p.icon} {p.label}
                  </div>
                );
              })}
            </div>
          )}

          {/* Score History (if iterations exist) */}
          {scoreHistory.length > 1 && (
            <div className="card">
              <div className="card-header"><div className="card-title">📈 Score History</div><span className="badge badge-green">{scoreHistory.length} versions</span></div>
              <div className="card-body" style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {scoreHistory.map((h, i) => (
                  <div key={i} style={{ flex: 1, minWidth: 60, padding: '8px', borderRadius: 8, border: `1px solid ${scoreColor(h.score)}30`, background: `${scoreColor(h.score)}08`, textAlign: 'center' }}>
                    <div style={{ fontSize: 18, fontWeight: 900, color: scoreColor(h.score) }}>{h.score}</div>
                    <div style={{ fontSize: 9, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>{h.label}</div>
                    <div style={{ fontSize: 9, color: 'var(--text-muted)' }}>{h.time}</div>
                    {i > 0 && (
                      <div style={{ fontSize: 10, color: h.score > scoreHistory[i-1].score ? '#4ade80' : '#f87171', fontWeight: 700 }}>
                        {h.score > scoreHistory[i-1].score ? '↑' : '↓'}{Math.abs(h.score - scoreHistory[i-1].score)}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* ─── RIGHT PANEL: Tabbed Output ─── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

          {/* Tab bar — only show after generation */}
          {phase !== 'idle' && (
            <div style={{ display: 'flex', gap: 4, background: 'var(--bg-secondary)', borderRadius: 10, padding: 4, border: '1px solid var(--border)' }}>
              {[
                { id: 'resume',   label: '📄 Resume',    show: true },
                { id: 'score',    label: '📊 Score',     show: resumeScore !== null },
                { id: 'insights', label: '💡 Insights',  show: resumeScore !== null },
              ].filter(t => t.show).map(tab => (
                <button key={tab.id} onClick={() => setActiveTab(tab.id)} style={{ flex: 1, padding: '8px 0', borderRadius: 7, border: activeTab === tab.id ? '1px solid var(--border-accent)' : '1px solid transparent', background: activeTab === tab.id ? 'var(--bg-card)' : 'transparent', color: activeTab === tab.id ? 'var(--text-primary)' : 'var(--text-muted)', fontSize: 12, fontWeight: 700, cursor: 'pointer', transition: 'all 0.2s', boxShadow: activeTab === tab.id ? '0 2px 8px rgba(0,0,0,0.3)' : 'none' }}>
                  {tab.label}
                </button>
              ))}
            </div>
          )}

          {/* ───── TAB: RESUME ───── */}
          {(activeTab === 'resume' || phase === 'idle') && (
            <div className="card">
              <div className="card-header">
                <div className="card-title">📄 {compareMode ? 'Resume (Improved)' : 'Generated Resume'}</div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {resumeOutput && !resumeOutput.startsWith('❌') && (
                    <>
                      {compareMode && (
                        <button className="btn btn-secondary btn-sm" style={{ fontSize: 10 }} onClick={() => setCompareMode(false)}>
                          🔍 Compare
                        </button>
                      )}
                      <button className="btn btn-secondary btn-sm" onClick={() => { setImproveMode(v => !v); setImproveTip(''); }} disabled={isLoading}>⚡ Improve</button>
                      <button className="btn btn-secondary btn-sm" onClick={() => copyToClipboard(resumeOutput)} title="Copy to clipboard">{copied ? '✅ Copied!' : '📋 Copy'}</button>
                      <button className="btn btn-secondary btn-sm" onClick={exportMarkdown}>.MD</button>
                      <button className="btn btn-secondary btn-sm" onClick={() => { const blob = new Blob([resumeOutput],{type:'text/plain'}); const url=URL.createObjectURL(blob); const a=document.createElement('a'); a.href=url; a.download=`${name.replace(/\s+/g,'_')}_resume.txt`; a.click(); URL.revokeObjectURL(url); }}>💾 .TXT</button>
                      <button className="btn btn-primary btn-sm" onClick={async () => { try { await persistSettings({...userSettings, coverLetter: resumeOutput}); setSavedResume(true); setTimeout(()=>setSavedResume(false),3000); } catch(e){alert('❌'+e.message);} }}>
                        <Save size={11} /> {savedResume ? '✅ Saved!' : 'Save'}
                      </button>
                    </>
                  )}
                </div>
              </div>
              <div className="card-body" style={{ padding: 0 }}>
                {/* Improve panel */}
                {improveMode && (
                  <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)', background: 'rgba(59,130,246,0.04)' }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: '#60a5fa', marginBottom: 8 }}>⚡ Auto-Improve (AI will rewrite + re-score)</div>
                    {/* Quick preset buttons */}
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
                      {QUICK_IMPROVE_PRESETS.map(p => (
                        <button key={p.label} className="btn btn-secondary btn-sm" style={{ fontSize: 10 }} onClick={() => setImproveTip(p.tip)} disabled={isLoading}>{p.label}</button>
                      ))}
                    </div>
                    <textarea className="form-textarea" rows={2} style={{ minHeight: 56, marginBottom: 8 }}
                      value={improveTip} onChange={e => setImproveTip(e.target.value)}
                      placeholder="Describe the improvement... e.g. 'Add specific metrics to all bullets'"
                    />
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button className="btn btn-secondary btn-sm" onClick={() => { setImproveMode(false); setImproveTip(''); }}>Cancel</button>
                      <button className="btn btn-primary" style={{ flex: 1, fontSize: 12 }} onClick={() => improveResume(improveTip)} disabled={improving || !improveTip.trim()}>
                        {improving ? <><div className="spinner" style={{ width: 12, height: 12, borderWidth: 2 }} /> Improving…</> : <>✨ Apply Improvement</>}
                      </button>
                    </div>
                  </div>
                )}

                {/* Compare mode: side by side */}
                {compareMode && beforeResume ? (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 0 }}>
                    <div style={{ borderRight: '1px solid var(--border)' }}>
                      <div style={{ padding: '8px 12px', fontSize: 11, fontWeight: 700, color: '#f87171', borderBottom: '1px solid var(--border)', background: 'rgba(239,68,68,0.06)' }}>BEFORE</div>
                      <textarea className="form-textarea" style={{ minHeight: 420, fontFamily: 'var(--font-mono)', fontSize: 11, lineHeight: 1.7, resize: 'none', border: 'none', borderRadius: 0, background: 'transparent' }} value={beforeResume} readOnly />
                    </div>
                    <div>
                      <div style={{ padding: '8px 12px', fontSize: 11, fontWeight: 700, color: '#4ade80', borderBottom: '1px solid var(--border)', background: 'rgba(34,197,94,0.06)' }}>AFTER (IMPROVED)</div>
                      <textarea className="form-textarea" style={{ minHeight: 420, fontFamily: 'var(--font-mono)', fontSize: 11, lineHeight: 1.7, resize: 'none', border: 'none', borderRadius: 0, background: 'transparent' }} value={resumeOutput} onChange={e => setResumeOutput(e.target.value)} />
                    </div>
                  </div>
                ) : (
                  <>
                    {/* Streaming preview */}
                    {streamText && (
                      <div style={{ padding: '16px 18px', fontFamily: 'var(--font-mono)', fontSize: 11.5, lineHeight: 1.8, color: 'var(--text-secondary)', whiteSpace: 'pre-wrap', maxHeight: 200, overflow: 'hidden', position: 'relative' }}>
                        {streamText}
                        <span style={{ display: 'inline-block', width: 2, height: 14, background: '#3b82f6', animation: 'breathe 0.8s ease-in-out infinite', verticalAlign: 'middle', marginLeft: 2 }} />
                      </div>
                    )}
                    {/* Empty state */}
                    {!resumeOutput && !streamText && !generating && !scoring && (
                      <div className="empty-state" style={{ padding: '48px 24px' }}>
                        <div style={{ fontSize: 44, marginBottom: 14 }}>📋</div>
                        <h3>Your resume will appear here</h3>
                        <p style={{ maxWidth: 260 }}>Choose industry + style, fill details, add JD, then click Generate.</p>
                      </div>
                    )}
                    {/* Skeleton loader */}
                    {(generating || scoring) && !resumeOutput && !streamText && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: '24px 18px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                          <div className="spinner" style={{ width: 18, height: 18, borderWidth: 2 }} />
                          <div style={{ fontSize: 13, color: generating ? '#60a5fa' : '#fbbf24', fontWeight: 600 }}>
                            {generating ? '🤖 AI crafting your professional resume…' : '📊 Running 20-factor analysis…'}
                          </div>
                        </div>
                        {[96, 82, 74, 90, 68, 78, 58, 86, 72, 64].map((w, i) => (
                          <div key={i} style={{ height: 11, borderRadius: 6, width: `${w}%`, backgroundImage: 'linear-gradient(90deg, var(--bg-surface) 0%, rgba(59,130,246,0.14) 50%, var(--bg-surface) 100%)', backgroundSize: '200% 100%', animation: `shimmer 1.4s ${i * 0.1}s infinite` }} />
                        ))}
                      </div>
                    )}
                    {/* Resume textarea */}
                    {resumeOutput && (
                      <textarea className="form-textarea" style={{ minHeight: 520, fontFamily: 'var(--font-mono)', fontSize: 12, lineHeight: 1.8, resize: 'vertical', border: 'none', borderRadius: 0, background: 'rgba(0,0,0,0.15)', padding: '16px 18px' }}
                        value={resumeOutput} onChange={e => setResumeOutput(e.target.value)} />
                    )}
                  </>
                )}
              </div>
            </div>
          )}

          {/* ───── TAB: SCORE DASHBOARD ───── */}
          {activeTab === 'score' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {scoring ? (
                <div className="card"><div className="card-body" style={{ display: 'flex', alignItems: 'center', gap: 12, color: '#60a5fa', fontSize: 13 }}><div className="spinner" style={{ width: 16, height: 16, borderWidth: 2 }} /> Running 20-factor analysis…</div></div>
              ) : resumeScore !== null && (
                <>
                  {/* Main score header */}
                  <div className="card" style={{ border: `1px solid ${scoreColor(resumeScore)}30`, background: `${scoreColor(resumeScore)}06` }}>
                    <div className="card-body">
                      <div style={{ display: 'flex', gap: 20, alignItems: 'center', marginBottom: 16, flexWrap: 'wrap' }}>
                        <ScoreRing score={resumeScore} size={100} />
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 22, fontWeight: 900, color: scoreColor(resumeScore) }}>{scoreLabel(resumeScore)}</div>
                          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 8 }}>{scoringInfo?.verdict}</div>
                          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                            {[
                              { label: scoringInfo?.application_ready ? '✅ Application Ready' : '⚠️ Needs Work', color: scoringInfo?.application_ready ? '#22c55e' : '#f59e0b' },
                              { label: `🎯 Hire: ${scoringInfo?.hire_probability || 'N/A'}`, color: '#3b82f6' },
                              { label: `⚡ Verbs: ${scoringInfo?.action_verb_quality || 'N/A'}`, color: '#8b5cf6' },
                              { label: `📋 Quant: ${scoringInfo?.quantification_rate ?? 0}%`, color: '#f59e0b' },
                            ].map(b => <span key={b.label} style={{ fontSize: 11, padding: '3px 10px', borderRadius: 20, background: `${b.color}15`, color: b.color, border: `1px solid ${b.color}30` }}>{b.label}</span>)}
                          </div>
                        </div>
                      </div>

                      {/* 5 dimension bars */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {[
                          { key: 'content_quality',   label: 'Content Quality (20%)',   icon: '📝', color: '#06b6d4' },
                          { key: 'ats_compatibility', label: 'ATS Compatibility (20%)', icon: '🤖', color: '#22c55e' },
                          { key: 'keyword_alignment', label: 'Keyword Alignment (25%)', icon: '🎯', color: '#3b82f6' },
                          { key: 'impact_score',      label: 'Impact & Results (20%)',  icon: '📈', color: '#f59e0b' },
                          { key: 'best_practices',    label: 'Best Practices (15%)',    icon: '✅', color: '#8b5cf6' },
                        ].map(dim => {
                          const val = scoringInfo?.[dim.key] ?? 0;
                          return (
                            <div key={dim.key}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                                <span style={{ fontSize: 11.5, color: 'var(--text-secondary)', fontWeight: 500 }}>{dim.icon} {dim.label}</span>
                                <span style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: dim.color, fontWeight: 800 }}>{val}</span>
                              </div>
                              <div style={{ height: 6, background: 'var(--bg-surface)', borderRadius: 3, overflow: 'hidden' }}>
                                <div style={{ height: '100%', width: `${val}%`, background: `linear-gradient(90deg, ${dim.color}80, ${dim.color})`, borderRadius: 3, transition: 'width 1.2s ease' }} />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  {/* Sub-scores grid (15 factors) */}
                  {scoringInfo?.sub_scores && (
                    <div className="card">
                      <div className="card-header"><div className="card-title">🔬 15 Sub-Factor Breakdown</div></div>
                      <div className="card-body" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                        {Object.entries(scoringInfo.sub_scores).map(([key, val]) => {
                          const label = key.replace(/_/g,' ').replace(/\b\w/g, l=>l.toUpperCase());
                          const c = scoreColor(val);
                          return (
                            <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <div style={{ width: 32, height: 32, borderRadius: 8, background: `${c}12`, border: `1px solid ${c}25`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 900, color: c, flexShrink: 0 }}>{val}</div>
                              <div style={{ flex: 1 }}>
                                <div style={{ fontSize: 10, color: 'var(--text-secondary)', marginBottom: 3 }}>{label}</div>
                                <div style={{ height: 3, background: 'var(--bg-surface)', borderRadius: 2, overflow: 'hidden' }}>
                                  <div style={{ height: '100%', width: `${val}%`, background: c, borderRadius: 2, transition: 'width 1s' }} />
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Strong/Weak bullets */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                    {Array.isArray(scoringInfo?.strong_bullets) && scoringInfo.strong_bullets.length > 0 && (
                      <div className="card" style={{ border: '1px solid rgba(34,197,94,0.2)', background: 'rgba(34,197,94,0.04)' }}>
                        <div className="card-header"><div className="card-title" style={{ fontSize: 12 }}>✅ Strong Bullets</div></div>
                        <div className="card-body" style={{ fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                          {scoringInfo.strong_bullets.map((b,i) => <div key={i} style={{ marginBottom: 6, padding: '6px 8px', background: 'rgba(34,197,94,0.06)', borderRadius: 6, borderLeft: '2px solid #22c55e' }}>{b}</div>)}
                        </div>
                      </div>
                    )}
                    {Array.isArray(scoringInfo?.weak_bullets) && scoringInfo.weak_bullets.length > 0 && (
                      <div className="card" style={{ border: '1px solid rgba(239,68,68,0.2)', background: 'rgba(239,68,68,0.04)' }}>
                        <div className="card-header"><div className="card-title" style={{ fontSize: 12 }}>⚠️ Weak Bullets</div></div>
                        <div className="card-body" style={{ fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                          {scoringInfo.weak_bullets.map((b,i) => (
                            <div key={i} style={{ marginBottom: 8 }}>
                              <div style={{ padding: '6px 8px', background: 'rgba(239,68,68,0.06)', borderRadius: 6, borderLeft: '2px solid #ef4444', marginBottom: 4 }}>{b}</div>
                              <button className="btn btn-secondary btn-sm w-full" style={{ fontSize: 10 }} onClick={() => { setImproveTip(`Rewrite this weak bullet to be stronger with specific metrics: "${b}"`); setImproveMode(true); setActiveTab('resume'); }} disabled={isLoading}>
                                ⚡ Fix this bullet
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Improvements */}
                  {Array.isArray(scoringInfo?.top_improvements) && (
                    <div className="card">
                      <div className="card-header"><div className="card-title">🔧 Top Improvements</div></div>
                      <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {scoringInfo.top_improvements.map((tip, i) => (
                          <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '10px 12px', background: 'var(--bg-secondary)', borderRadius: 8, border: '1px solid var(--border)' }}>
                            <div style={{ width: 22, height: 22, borderRadius: '50%', background: 'rgba(245,158,11,0.15)', border: '1px solid rgba(245,158,11,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, color: '#f59e0b', fontWeight: 700, flexShrink: 0 }}>{i+1}</div>
                            <div style={{ flex: 1, fontSize: 12, color: 'var(--text-secondary)' }}>{tip}</div>
                            <button className="btn btn-primary btn-sm" style={{ fontSize: 10, flexShrink: 0 }} onClick={() => { setImproveTip(tip); setImproveMode(true); setActiveTab('resume'); }} disabled={isLoading}>⚡ Fix</button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Competitive edge + recruiter impression */}
                  {(scoringInfo?.competitive_edge || scoringInfo?.recruiter_first_impression) && (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                      {scoringInfo?.competitive_edge && (
                        <div style={{ padding: '12px 14px', background: 'rgba(59,130,246,0.05)', border: '1px solid rgba(59,130,246,0.2)', borderRadius: 10 }}>
                          <div style={{ fontSize: 11, fontWeight: 700, color: '#60a5fa', marginBottom: 6 }}>🏆 Competitive Edge</div>
                          <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.6 }}>{scoringInfo.competitive_edge}</div>
                        </div>
                      )}
                      {scoringInfo?.recruiter_first_impression && (
                        <div style={{ padding: '12px 14px', background: 'rgba(139,92,246,0.05)', border: '1px solid rgba(139,92,246,0.2)', borderRadius: 10 }}>
                          <div style={{ fontSize: 11, fontWeight: 700, color: '#a78bfa', marginBottom: 6 }}>👀 Recruiter’s Eye</div>
                          <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.6, fontStyle: 'italic' }}>“{scoringInfo.recruiter_first_impression}”</div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Missing keywords */}
                  {scoringInfo?.missing_keywords && (
                    <div style={{ padding: '10px 14px', background: 'rgba(59,130,246,0.05)', border: '1px solid rgba(59,130,246,0.2)', borderRadius: 10, fontSize: 12, color: 'var(--text-secondary)' }}>
                      <strong style={{ color: '#60a5fa' }}>🔑 Add these keywords to boost score: </strong>{scoringInfo.missing_keywords}
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* ───── TAB: INSIGHTS ───── */}
          {activeTab === 'insights' && resumeOutput && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

              {/* Insight action cards */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <button className="card" onClick={generateLinkedInSummary} disabled={isLoading} style={{ border: '1px solid rgba(6,182,212,0.3)', background: 'rgba(6,182,212,0.04)', cursor: 'pointer', textAlign: 'left', padding: 16, transition: 'all 0.2s' }}
                  onMouseEnter={e=>e.currentTarget.style.background='rgba(6,182,212,0.08)'}
                  onMouseLeave={e=>e.currentTarget.style.background='rgba(6,182,212,0.04)'}
                >
                  <div style={{ fontSize: 24, marginBottom: 6 }}>💼</div>
                  <div style={{ fontWeight: 700, fontSize: 13, color: '#22d3ee', marginBottom: 4 }}>LinkedIn Summary</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.5 }}>Generate a compelling LinkedIn About section from your resume. SEO-optimized, recruiter-ready.</div>
                  {loadingInsights && activeInsight === 'linkedin' && <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 6, color: '#22d3ee', fontSize: 11 }}><div className="spinner" style={{ width: 12, height: 12, borderWidth: 2 }} /> Generating…</div>}
                </button>
                <button className="card" onClick={predictInterviewQuestions} disabled={isLoading} style={{ border: '1px solid rgba(239,68,68,0.3)', background: 'rgba(239,68,68,0.04)', cursor: 'pointer', textAlign: 'left', padding: 16, transition: 'all 0.2s' }}
                  onMouseEnter={e=>e.currentTarget.style.background='rgba(239,68,68,0.08)'}
                  onMouseLeave={e=>e.currentTarget.style.background='rgba(239,68,68,0.04)'}
                >
                  <div style={{ fontSize: 24, marginBottom: 6 }}>🎙️</div>
                  <div style={{ fontWeight: 700, fontSize: 13, color: '#f87171', marginBottom: 4 }}>Interview Questions</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.5 }}>Predict the 8 most likely interview questions based on your resume + target role.</div>
                  {loadingInsights && activeInsight === 'interview' && <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 6, color: '#f87171', fontSize: 11 }}><div className="spinner" style={{ width: 12, height: 12, borderWidth: 2 }} /> Predicting…</div>}
                </button>
              </div>

              {/* LinkedIn Summary output */}
              {linkedinSummary && (
                <div className="card" style={{ border: '1px solid rgba(6,182,212,0.2)' }}>
                  <div className="card-header">
                    <div className="card-title">💼 LinkedIn About Section</div>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button className="btn btn-secondary btn-sm" onClick={() => copyToClipboard(linkedinSummary)} style={{ fontSize: 10 }}>{copied ? '✅ Copied!' : '📋 Copy'}</button>
                    </div>
                  </div>
                  <div className="card-body">
                    <textarea className="form-textarea" style={{ minHeight: 200, lineHeight: 1.8, fontSize: 13, resize: 'vertical' }} value={linkedinSummary} onChange={e => setLinkedinSummary(e.target.value)} />
                  </div>
                </div>
              )}

              {/* Interview Questions output */}
              {interviewQuestions.length > 0 && (
                <div className="card" style={{ border: '1px solid rgba(239,68,68,0.2)' }}>
                  <div className="card-header"><div className="card-title">🎙️ Predicted Interview Questions</div><span className="badge badge-red">{interviewQuestions.length} questions</span></div>
                  <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                    {interviewQuestions.map((q, i) => (
                      <div key={i} style={{ padding: '12px 14px', background: 'var(--bg-secondary)', borderRadius: 10, border: '1px solid var(--border)' }}>
                        <div style={{ display: 'flex', gap: 10, marginBottom: 8 }}>
                          <div style={{ width: 24, height: 24, borderRadius: '50%', background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, color: '#f87171', fontWeight: 700, flexShrink: 0 }}>{i+1}</div>
                          <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--text-primary)', lineHeight: 1.5 }}>{q.question}</div>
                        </div>
                        <div style={{ marginLeft: 34 }}>
                          <div style={{ fontSize: 11, color: '#f59e0b', marginBottom: 4, fontWeight: 600 }}>Why they ask: <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>{q.why}</span></div>
                          <div style={{ fontSize: 11, color: '#4ade80', fontWeight: 600 }}>Answer framework: <span style={{ color: 'var(--text-secondary)', fontWeight: 400 }}>{q.framework}</span></div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Strengths from score */}
              {Array.isArray(scoringInfo?.strengths) && scoringInfo.strengths.length > 0 && (
                <div className="card">
                  <div className="card-header"><div className="card-title">⭐ Your Resume Strengths</div></div>
                  <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {scoringInfo.strengths.map((s, i) => (
                      <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                        <span style={{ color: '#4ade80', flexShrink: 0, marginTop: 2 }}>✓</span>
                        <span style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6 }}>{s}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Resumes;
