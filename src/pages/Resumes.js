import React, { useState, useRef } from 'react';
import { useApp } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { Upload, Wand2, Star, Trash2, Eye, Tag, FileText, Plus, CheckCircle, AlertCircle, Loader } from 'lucide-react';
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
  const { resumes, setResumes, setDefaultResume, deleteResume } = useApp();
  const { currentUser } = useAuth();

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
      <div className="flex gap-4 mb-20">
        {['resumes', 'cover-letters', 'ai-generate'].map(tab => (
          <button
            key={tab}
            className={`btn btn-sm ${activeTab === tab ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setActiveTab(tab)}
          >
            {tab === 'resumes' ? '📄 Resumes' : tab === 'cover-letters' ? '✉️ Cover Letters' : '🤖 AI Generate'}
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
                <button
                  className="btn btn-success btn-sm"
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
                  💾 Save
                </button>
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
    </div>
  );
};

export default Resumes;
