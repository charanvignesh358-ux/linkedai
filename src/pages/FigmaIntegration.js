// ================================================================
//  FigmaIntegration.js — Enhanced Figma Portfolio & Design Showcase
//  Extra features: View tracking, Presentation mode, Color palette,
//  Version history, Quick search, Sort controls, Share modal
// ================================================================
import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Figma, ExternalLink, Plus, Trash2, Eye, Star, Copy, CheckCircle,
  Palette, Layout, Layers, Search, SlidersHorizontal, Maximize2, X,
  Clock, TrendingUp, Share2, Download, ChevronDown, ChevronUp,
  Monitor, Smartphone, Tablet, RefreshCw, BookOpen, Tag,
} from 'lucide-react';

const FIGMA_TOKEN_KEY    = 'linkedai_figma_token';
const FIGMA_PROJECTS_KEY = 'linkedai_figma_projects';
const FIGMA_VIEWS_KEY    = 'linkedai_figma_views';

// ── Figma API helpers ─────────────────────────────────────────────
const fetchFigmaFile = async (token, fileKey) => {
  const res = await fetch(`https://api.figma.com/v1/files/${fileKey}`, {
    headers: { 'X-Figma-Token': token },
  });
  if (!res.ok) throw new Error(`Figma API error: ${res.status} — check your token`);
  return res.json();
};

// ── Colour palette from project tags ─────────────────────────────
const TAG_COLORS = {
  'UI/UX':    ['#7B3FF8','#A259FF','#C084FC'],
  'Mobile':   ['#00C8FF','#0EA5E9','#38BDF8'],
  'Dashboard':['#00E676','#10B981','#34D399'],
  'Branding': ['#F24E1E','#FF7262','#FCA5A5'],
  'Landing':  ['#FFB800','#F59E0B','#FCD34D'],
  'default':  ['#94A3B8','#CBD5E1','#E2E8F0'],
};
const getPalette = (tags) => {
  for (const tag of (tags || [])) {
    if (TAG_COLORS[tag]) return TAG_COLORS[tag];
  }
  return TAG_COLORS.default;
};

// ── ─────────────────────────────────────────────────────────────
// Presentation / Full-screen viewer modal
// ── ─────────────────────────────────────────────────────────────
const PresentationModal = ({ project, onClose }) => {
  const [viewport, setViewport] = useState('desktop');
  const sizes = { desktop: '100%', tablet: '768px', mobile: '375px' };

  useEffect(() => {
    const esc = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', esc);
    return () => window.removeEventListener('keydown', esc);
  }, [onClose]);

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 500,
      background: 'rgba(0,0,0,0.95)', backdropFilter: 'blur(12px)',
      display: 'flex', flexDirection: 'column',
      animation: 'fadeIn 0.2s ease',
    }}>
      {/* Top bar */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '12px 24px', borderBottom: '1px solid rgba(255,255,255,0.08)',
        background: 'rgba(5,10,20,0.8)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Figma size={18} style={{ color: '#F24E1E' }} />
          <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 15, color: 'var(--text-primary)' }}>
            {project.name}
          </span>
        </div>

        {/* Viewport switcher */}
        <div style={{ display: 'flex', gap: 8 }}>
          {[['desktop', Monitor], ['tablet', Tablet], ['mobile', Smartphone]].map(([v, Icon]) => (
            <button key={v} onClick={() => setViewport(v)} style={{
              display: 'flex', alignItems: 'center', gap: 6, padding: '6px 14px',
              borderRadius: 8, cursor: 'pointer', fontSize: 12,
              background: viewport === v ? 'rgba(242,78,30,0.15)' : 'transparent',
              border: `1px solid ${viewport === v ? 'rgba(242,78,30,0.4)' : 'rgba(255,255,255,0.1)'}`,
              color: viewport === v ? '#F24E1E' : 'var(--text-muted)',
            }}>
              <Icon size={13} /> {v.charAt(0).toUpperCase() + v.slice(1)}
            </button>
          ))}
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          <a href={`https://www.figma.com/file/${project.fileKey}`} target="_blank" rel="noreferrer"
            style={{
              display: 'flex', alignItems: 'center', gap: 6, padding: '6px 14px',
              borderRadius: 8, fontSize: 12, textDecoration: 'none',
              background: 'rgba(242,78,30,0.1)', border: '1px solid rgba(242,78,30,0.3)',
              color: '#F24E1E',
            }}>
            <ExternalLink size={13} /> Open in Figma
          </a>
          <button onClick={onClose} style={{
            width: 36, height: 36, borderRadius: 8, cursor: 'pointer',
            background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
            color: 'var(--text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <X size={16} />
          </button>
        </div>
      </div>

      {/* Iframe viewer */}
      <div style={{
        flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 24, overflow: 'auto',
      }}>
        <div style={{
          width: sizes[viewport], maxWidth: '100%', height: '100%',
          border: viewport !== 'desktop' ? '2px solid rgba(255,255,255,0.1)' : 'none',
          borderRadius: viewport !== 'desktop' ? 16 : 0,
          overflow: 'hidden',
          boxShadow: '0 32px 96px rgba(0,0,0,0.6)',
          transition: 'all 0.35s cubic-bezier(0.16,1,0.3,1)',
        }}>
          <iframe
            title={project.name}
            src={`https://www.figma.com/embed?embed_host=share&url=https://www.figma.com/file/${project.fileKey}`}
            style={{ width: '100%', height: '100%', border: 'none', minHeight: 500 }}
            allowFullScreen
          />
        </div>
      </div>
    </div>
  );
};

// ── Share Modal ───────────────────────────────────────────────────
const ShareModal = ({ project, onClose }) => {
  const [copied, setCopied] = useState('');
  const url = `https://www.figma.com/file/${project.fileKey}`;

  const copy = (text, key) => {
    navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(''), 2000);
  };

  const shareOptions = [
    { key: 'link',    label: 'Figma Link',   value: url,                                               icon: '🔗' },
    { key: 'embed',   label: 'Embed Code',   value: `<iframe src="https://www.figma.com/embed?embed_host=share&url=${url}" width="800" height="600" allowfullscreen></iframe>`, icon: '</>' },
    { key: 'md',      label: 'Markdown',     value: `[![${project.name}](https://www.figma.com/file/${project.fileKey}/thumbnail)](${url})`, icon: 'MD' },
  ];

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(8px)',
      zIndex: 400, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
    }}>
      <div style={{
        background: 'var(--bg-card)', border: '1px solid var(--border-accent)',
        borderRadius: 'var(--radius-xl)', width: '100%', maxWidth: 480,
        boxShadow: '0 32px 80px rgba(0,0,0,0.6)',
        animation: 'scaleIn 0.3s cubic-bezier(0.16,1,0.3,1)',
      }}>
        <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Share2 size={16} style={{ color: 'var(--accent-cyan)' }} /> Share "{project.name}"
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: 18 }}>✕</button>
        </div>
        <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 12 }}>
          {shareOptions.map(opt => (
            <div key={opt.key} style={{
              background: 'var(--bg-secondary)', border: '1px solid var(--border)',
              borderRadius: 10, padding: '12px 14px',
              display: 'flex', alignItems: 'center', gap: 12,
            }}>
              <div style={{
                width: 32, height: 32, borderRadius: 8, flexShrink: 0,
                background: 'rgba(0,200,255,0.08)', border: '1px solid rgba(0,200,255,0.15)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 11, fontWeight: 700, color: 'var(--accent-cyan)', fontFamily: 'var(--font-mono)',
              }}>{opt.icon}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 3, fontFamily: 'var(--font-mono)', textTransform: 'uppercase' }}>{opt.label}</div>
                <div style={{ fontSize: 11, color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{opt.value}</div>
              </div>
              <button onClick={() => copy(opt.value, opt.key)} style={{
                flexShrink: 0, width: 32, height: 32, borderRadius: 8, cursor: 'pointer',
                background: copied === opt.key ? 'rgba(0,230,118,0.1)' : 'transparent',
                border: `1px solid ${copied === opt.key ? 'rgba(0,230,118,0.3)' : 'var(--border)'}`,
                color: copied === opt.key ? 'var(--accent-green)' : 'var(--text-muted)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                {copied === opt.key ? <CheckCircle size={13} /> : <Copy size={13} />}
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

// ── Colour Palette Strip ──────────────────────────────────────────
const ColorPaletteStrip = ({ tags }) => {
  const palette = getPalette(tags);
  return (
    <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
      {palette.map((c, i) => (
        <div key={i} style={{
          width: 12, height: 12, borderRadius: 3,
          background: c, border: '1px solid rgba(255,255,255,0.12)',
        }} title={c} />
      ))}
    </div>
  );
};

// ── Portfolio Card ────────────────────────────────────────────────
const PortfolioCard = ({ project, onDelete, onSetFeatured, onPresent, onShare, views }) => {
  const [hovered, setHovered] = useState(false);
  const [copied, setCopied]   = useState(false);

  const copyLink = () => {
    navigator.clipboard.writeText(`https://www.figma.com/file/${project.fileKey}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  const addedDate = project.addedAt
    ? new Date(project.addedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : 'Unknown';

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: project.featured
          ? 'linear-gradient(135deg, rgba(242,78,30,0.06), rgba(162,89,255,0.06))'
          : 'var(--bg-card)',
        border: `1px solid ${project.featured ? 'rgba(242,78,30,0.3)' : hovered ? 'var(--border-accent)' : 'var(--border)'}`,
        borderRadius: 'var(--radius-lg)',
        overflow: 'hidden',
        transition: 'all 0.3s cubic-bezier(0.16,1,0.3,1)',
        transform: hovered ? 'translateY(-4px)' : 'none',
        boxShadow: hovered ? '0 20px 52px rgba(0,0,0,0.5)' : 'var(--shadow-card)',
        animation: 'fadeIn 0.4s ease forwards',
        display: 'flex', flexDirection: 'column',
      }}
    >
      {/* Preview embed */}
      <div style={{ position: 'relative', aspectRatio: '16/9', background: 'var(--bg-secondary)', overflow: 'hidden' }}>
        <iframe
          title={project.name}
          src={`https://www.figma.com/embed?embed_host=share&url=https://www.figma.com/file/${project.fileKey}`}
          style={{ width: '100%', height: '100%', border: 'none', opacity: hovered ? 1 : 0.85, transition: 'opacity 0.3s' }}
          allowFullScreen
        />
        <div style={{
          position: 'absolute', inset: 0,
          background: `rgba(5,10,20,${hovered ? 0 : 0.28})`,
          transition: 'background 0.3s', pointerEvents: 'none',
        }} />

        {/* Hover actions */}
        <div style={{
          position: 'absolute', top: 10, right: 10, display: 'flex', gap: 6,
          opacity: hovered ? 1 : 0,
          transform: hovered ? 'translateY(0)' : 'translateY(-8px)',
          transition: 'all 0.25s', zIndex: 2,
        }}>
          <button onClick={() => onPresent(project)} style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            width: 32, height: 32, borderRadius: 8,
            background: 'rgba(5,10,20,0.85)', backdropFilter: 'blur(8px)',
            border: '1px solid rgba(255,255,255,0.1)', color: 'var(--accent-cyan)', cursor: 'pointer',
          }} title="Presentation mode">
            <Maximize2 size={13} />
          </button>
          <button onClick={() => onShare(project)} style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            width: 32, height: 32, borderRadius: 8,
            background: 'rgba(5,10,20,0.85)', backdropFilter: 'blur(8px)',
            border: '1px solid rgba(255,255,255,0.1)', color: 'var(--text-primary)', cursor: 'pointer',
          }} title="Share options">
            <Share2 size={13} />
          </button>
          <button onClick={copyLink} style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            width: 32, height: 32, borderRadius: 8,
            background: 'rgba(5,10,20,0.85)', backdropFilter: 'blur(8px)',
            border: '1px solid rgba(255,255,255,0.1)',
            color: copied ? 'var(--accent-green)' : 'var(--text-primary)', cursor: 'pointer',
          }}>
            {copied ? <CheckCircle size={13} /> : <Copy size={13} />}
          </button>
        </div>

        {/* Badges */}
        {project.featured && (
          <div style={{
            position: 'absolute', top: 10, left: 10,
            background: 'rgba(255,184,0,0.92)', backdropFilter: 'blur(8px)',
            borderRadius: 100, padding: '3px 10px',
            fontSize: 10, fontWeight: 700, fontFamily: 'var(--font-mono)', color: '#000',
            display: 'flex', alignItems: 'center', gap: 4,
          }}>
            <Star size={9} /> FEATURED
          </div>
        )}

        {/* View count pill */}
        <div style={{
          position: 'absolute', bottom: 10, left: 10,
          background: 'rgba(5,10,20,0.75)', backdropFilter: 'blur(8px)',
          borderRadius: 100, padding: '3px 10px',
          fontSize: 10, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)',
          display: 'flex', alignItems: 'center', gap: 5,
        }}>
          <Eye size={9} /> {views || 0} views
        </div>
      </div>

      {/* Card body */}
      <div style={{ padding: '14px 16px', flex: 1, display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8, marginBottom: 6 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 14, color: 'var(--text-primary)', marginBottom: 2 }}>
              {project.name}
            </div>
            {project.description && (
              <div style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.5, overflow: 'hidden',
                display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                {project.description}
              </div>
            )}
          </div>
          <ColorPaletteStrip tags={project.tags} />
        </div>

        {/* Tags */}
        {(project.tags || []).length > 0 && (
          <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginBottom: 10 }}>
            {project.tags.map(t => (
              <span key={t} style={{
                fontSize: 10, padding: '2px 8px', borderRadius: 20,
                background: 'rgba(0,200,255,0.07)', color: 'var(--accent-cyan)',
                border: '1px solid rgba(0,200,255,0.13)', fontFamily: 'var(--font-mono)',
              }}>{t}</span>
            ))}
          </div>
        )}

        {/* Meta row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10, marginTop: 'auto' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 10, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
            <Clock size={9} /> {addedDate}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 10, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
            <TrendingUp size={9} /> {views > 5 ? '🔥 Popular' : 'New'}
          </div>
        </div>

        {/* Action row */}
        <div style={{ display: 'flex', gap: 6 }}>
          <button onClick={() => onSetFeatured(project.id)} style={{
            flex: 1, padding: '6px 10px', borderRadius: 8, cursor: 'pointer', fontSize: 11,
            background: project.featured ? 'rgba(255,184,0,0.1)' : 'transparent',
            border: `1px solid ${project.featured ? 'rgba(255,184,0,0.3)' : 'var(--border)'}`,
            color: project.featured ? 'var(--accent-amber)' : 'var(--text-muted)',
            fontFamily: 'var(--font-body)', fontWeight: 600,
            display: 'flex', alignItems: 'center', gap: 5, justifyContent: 'center', transition: 'all 0.2s',
          }}>
            <Star size={11} /> {project.featured ? 'Featured' : 'Feature'}
          </button>
          <button onClick={() => onPresent(project)} style={{
            width: 32, height: 32, borderRadius: 8, cursor: 'pointer',
            background: 'transparent', border: '1px solid var(--border)',
            color: 'var(--accent-cyan)', display: 'flex', alignItems: 'center', justifyContent: 'center',
          }} title="Present fullscreen">
            <Maximize2 size={12} />
          </button>
          <button onClick={() => onDelete(project.id)} style={{
            width: 32, height: 32, borderRadius: 8, cursor: 'pointer',
            background: 'transparent', border: '1px solid var(--border)',
            color: 'var(--accent-red)', display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Trash2 size={12} />
          </button>
        </div>
      </div>
    </div>
  );
};

// ── Add Project Modal ─────────────────────────────────────────────
const AddProjectModal = ({ onClose, onAdd }) => {
  const [url,     setUrl]     = useState('');
  const [desc,    setDesc]    = useState('');
  const [tags,    setTags]    = useState('');
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState('');

  const parseFileKey = (input) => {
    const m = input.match(/figma\.com\/(?:file|design)\/([a-zA-Z0-9]+)/);
    return m ? m[1] : input.trim();
  };

  const handleAdd = async () => {
    if (!url.trim()) return setError('Please paste a Figma file URL or key');
    const fileKey = parseFileKey(url);
    if (!fileKey) return setError('Could not extract file key from URL');

    setLoading(true); setError('');
    try {
      const token = localStorage.getItem(FIGMA_TOKEN_KEY);
      let name = 'Figma Design';
      if (token) {
        try {
          const data = await fetchFigmaFile(token, fileKey);
          name = data.name || name;
        } catch (_) { /* use default */ }
      }
      onAdd({
        id:          Date.now(),
        fileKey,
        name,
        description: desc.trim(),
        tags:        tags.split(',').map(t => t.trim()).filter(Boolean),
        featured:    false,
        addedAt:     new Date().toISOString(),
        version:     1,
      });
      onClose();
    } catch (e) { setError(e.message); }
    setLoading(false);
  };

  const suggestedTags = ['UI/UX', 'Mobile', 'Dashboard', 'Branding', 'Landing', 'Prototype', 'Wireframe'];

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(8px)',
      zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
    }}>
      <div style={{
        background: 'var(--bg-card)', border: '1px solid var(--border-accent)',
        borderRadius: 'var(--radius-xl)', width: '100%', maxWidth: 500,
        boxShadow: '0 32px 80px rgba(0,0,0,0.6)',
        animation: 'scaleIn 0.3s cubic-bezier(0.16,1,0.3,1)',
      }}>
        <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Figma size={16} style={{ color: '#F24E1E' }} /> Add Figma Project
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: 18 }}>✕</button>
        </div>
        <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 14 }}>
          {error && (
            <div style={{ background: 'rgba(255,59,92,0.08)', border: '1px solid rgba(255,59,92,0.2)', borderRadius: 8, padding: '10px 14px', fontSize: 12, color: 'var(--accent-red)' }}>
              ⚠️ {error}
            </div>
          )}
          <div>
            <label style={{ display: 'block', fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              Figma File URL or Key *
            </label>
            <input
              className="form-input"
              placeholder="https://www.figma.com/file/XXXX/... or XXXX"
              value={url}
              onChange={e => setUrl(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleAdd()}
            />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              Description
            </label>
            <input className="form-input" placeholder="Brief project description..." value={desc} onChange={e => setDesc(e.target.value)} />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              Tags
            </label>
            <input className="form-input" placeholder="UI/UX, Mobile, Dashboard..." value={tags} onChange={e => setTags(e.target.value)} />
            {/* Quick tag suggestions */}
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
              {suggestedTags.map(t => (
                <button key={t} onClick={() => setTags(prev => prev ? `${prev}, ${t}` : t)} style={{
                  fontSize: 10, padding: '3px 10px', borderRadius: 20, cursor: 'pointer',
                  background: 'rgba(0,200,255,0.06)', border: '1px solid rgba(0,200,255,0.15)',
                  color: 'var(--accent-cyan)', fontFamily: 'var(--font-mono)',
                }}>{t}</button>
              ))}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
            <button onClick={onClose} className="btn btn-secondary" style={{ flex: 1 }}>Cancel</button>
            <button onClick={handleAdd} className="btn btn-primary" style={{ flex: 2, background: 'linear-gradient(135deg,#F24E1E,#A259FF)' }} disabled={loading}>
              {loading ? 'Adding...' : <><Plus size={14} /> Add to Portfolio</>}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// ── Stats Strip ───────────────────────────────────────────────────
const StatPill = ({ icon, label, value, color, sub }) => (
  <div style={{
    display: 'flex', alignItems: 'center', gap: 12,
    padding: '14px 18px', background: 'var(--bg-card)',
    border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', flex: 1,
  }}>
    <div style={{ color, fontSize: 20 }}>{icon}</div>
    <div>
      <div style={{ fontFamily: 'var(--font-display)', fontSize: 24, fontWeight: 800, color, lineHeight: 1 }}>{value}</div>
      <div style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', marginTop: 3 }}>{label}</div>
      {sub && <div style={{ fontSize: 10, color: 'var(--accent-green)', marginTop: 1 }}>{sub}</div>}
    </div>
  </div>
);

// ── Token Setup Panel ─────────────────────────────────────────────
const TokenPanel = ({ token, setToken }) => {
  const [show,  setShow]  = useState(false);
  const [saved, setSaved] = useState(!!localStorage.getItem(FIGMA_TOKEN_KEY));
  const [open,  setOpen]  = useState(false);

  const save = () => {
    localStorage.setItem(FIGMA_TOKEN_KEY, token.trim());
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="card mb-20">
      <div
        className="card-header"
        onClick={() => setOpen(o => !o)}
        style={{ cursor: 'pointer', userSelect: 'none' }}
      >
        <div className="card-title"><Figma size={14} style={{ color: '#F24E1E' }} /> Figma Access Token</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span className={`badge ${saved ? 'badge-green' : 'badge-amber'}`}>
            {saved ? '✓ Connected' : 'Optional'}
          </span>
          {open ? <ChevronUp size={14} style={{ color: 'var(--text-muted)' }} /> : <ChevronDown size={14} style={{ color: 'var(--text-muted)' }} />}
        </div>
      </div>
      {open && (
        <div className="card-body">
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <div style={{ position: 'relative', flex: 1 }}>
              <input
                className="form-input"
                type={show ? 'text' : 'password'}
                placeholder="figd_••••••••• (Figma → Account → Personal access tokens)"
                value={token}
                onChange={e => setToken(e.target.value)}
              />
              <button onClick={() => setShow(s => !s)} style={{
                position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
                background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)',
              }}>
                <Eye size={14} />
              </button>
            </div>
            <button className="btn btn-primary" onClick={save} style={{ flexShrink: 0 }}>
              {saved ? '✅ Saved!' : 'Save Token'}
            </button>
          </div>
          <p style={{ marginTop: 10, fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.6 }}>
            Token enables auto-fetching file names. Stored in your browser only. Get yours at{' '}
            <a href="https://www.figma.com/settings" target="_blank" rel="noreferrer" style={{ color: '#F24E1E' }}>figma.com/settings</a>.
          </p>
        </div>
      )}
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────
// MAIN PAGE
// ─────────────────────────────────────────────────────────────────
const FigmaIntegration = () => {
  const [projects, setProjects] = useState(() => {
    try { return JSON.parse(localStorage.getItem(FIGMA_PROJECTS_KEY) || '[]'); } catch { return []; }
  });
  const [views, setViews] = useState(() => {
    try { return JSON.parse(localStorage.getItem(FIGMA_VIEWS_KEY) || '{}'); } catch { return {}; }
  });
  const [token,      setToken]      = useState(() => localStorage.getItem(FIGMA_TOKEN_KEY) || '');
  const [showModal,  setShowModal]  = useState(false);
  const [presenting, setPresenting] = useState(null);
  const [sharing,    setSharing]    = useState(null);
  const [search,     setSearch]     = useState('');
  const [filter,     setFilter]     = useState('All');
  const [sort,       setSort]       = useState('newest'); // newest | oldest | popular | name

  // ── Derived ──
  const allTags = ['All', ...new Set(projects.flatMap(p => p.tags || []))].filter(Boolean);

  const totalViews = Object.values(views).reduce((a, b) => a + b, 0);

  // ── Persistence helpers ──────────────────────────────────────────
  const saveProjects = (p) => {
    setProjects(p);
    localStorage.setItem(FIGMA_PROJECTS_KEY, JSON.stringify(p));
  };

  const recordView = useCallback((projectId) => {
    setViews(prev => {
      const next = { ...prev, [projectId]: (prev[projectId] || 0) + 1 };
      localStorage.setItem(FIGMA_VIEWS_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  const addProject    = (proj) => {
    const next = [proj, ...projects];
    saveProjects(next);
  };
  const deleteProject = (id) => {
    const next = projects.filter(p => p.id !== id);
    saveProjects(next);
  };
  const setFeatured = (id) => {
    const next = projects.map(p => ({ ...p, featured: p.id === id ? !p.featured : p.featured }));
    saveProjects(next);
  };

  const handlePresent = (proj) => {
    recordView(proj.id);
    setPresenting(proj);
  };

  // ── Filter → search → sort ───────────────────────────────────────
  let displayed = projects;
  if (filter !== 'All') displayed = displayed.filter(p => (p.tags || []).includes(filter));
  if (search.trim())    displayed = displayed.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    (p.description || '').toLowerCase().includes(search.toLowerCase()) ||
    (p.tags || []).some(t => t.toLowerCase().includes(search.toLowerCase()))
  );
  displayed = [...displayed].sort((a, b) => {
    if (sort === 'newest')  return new Date(b.addedAt) - new Date(a.addedAt);
    if (sort === 'oldest')  return new Date(a.addedAt) - new Date(b.addedAt);
    if (sort === 'popular') return (views[b.id] || 0) - (views[a.id] || 0);
    if (sort === 'name')    return a.name.localeCompare(b.name);
    return 0;
  });

  return (
    <div className="page-content animate-fade">

      {/* ── HEADER ── */}
      <div className="card" style={{ marginBottom: 24 }}>
        <div className="card-header">
          <div className="card-title">
            <Figma size={16} style={{ color: '#F24E1E' }} /> Figma Portfolio
          </div>
          <button
            className="btn btn-primary btn-sm"
            onClick={() => setShowModal(true)}
          >
            <Plus size={14} /> Add Figma Project
          </button>
        </div>
        <div className="card-body">
          <div style={{ fontSize: 12, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
            Showcase your design work with live Figma embeds and a simple presentation mode.
          </div>
        </div>
      </div>

      {/* ── STATS ── */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
        <StatPill icon={<Layout   size={20} />} label="Total Designs"   value={projects.length}                            color="var(--accent-cyan)"   />
        <StatPill icon={<Star     size={20} />} label="Featured"        value={projects.filter(p=>p.featured).length}      color="var(--accent-amber)"  />
        <StatPill icon={<Eye      size={20} />} label="Total Views"     value={totalViews}      sub={totalViews > 0 ? '↑ Active' : ''} color="var(--accent-green)"  />
        <StatPill icon={<Tag      size={20} />} label="Design Tags"     value={allTags.length-1}                           color="var(--accent-purple)" />
      </div>

      {/* ── TOKEN ── */}
      <TokenPanel token={token} setToken={setToken} />

      {/* ── SEARCH + SORT BAR ── */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 16, alignItems: 'center', flexWrap: 'wrap' }}>
        {/* Search */}
        <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
          <Search size={13} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input
            className="form-input"
            style={{ paddingLeft: 34 }}
            placeholder="Search designs, tags..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>

        {/* Sort */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <SlidersHorizontal size={13} style={{ color: 'var(--text-muted)' }} />
          <select
            value={sort}
            onChange={e => setSort(e.target.value)}
            className="form-input"
            style={{ width: 'auto', paddingRight: 28, fontSize: 12 }}
          >
            <option value="newest">Newest First</option>
            <option value="oldest">Oldest First</option>
            <option value="popular">Most Viewed</option>
            <option value="name">Name A–Z</option>
          </select>
        </div>
      </div>

      {/* ── FILTER TABS ── */}
      {allTags.length > 1 && (
        <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
          {allTags.map(t => (
            <button
              key={t}
              onClick={() => setFilter(t)}
              style={{
                padding: '6px 16px', borderRadius: 100, cursor: 'pointer',
                fontSize: 12, fontWeight: 600, transition: 'all 0.2s',
                background: filter === t ? 'linear-gradient(135deg, #F24E1E, #A259FF)' : 'transparent',
                border: `1px solid ${filter === t ? 'transparent' : 'var(--border)'}`,
                color: filter === t ? '#fff' : 'var(--text-secondary)',
              }}
            >
              {t}
            </button>
          ))}
        </div>
      )}

      {/* ── GRID ── */}
      {displayed.length === 0 ? (
        <div className="card">
          <div className="empty-state" style={{ padding: '60px 24px' }}>
            <Figma size={48} style={{ color: '#F24E1E', opacity: 0.3, marginBottom: 16 }} />
            <h3>{search ? 'No results found' : 'No Figma projects yet'}</h3>
            <p style={{ marginBottom: 20 }}>
              {search ? 'Try a different search term or clear filters' : 'Add your first Figma design to showcase your portfolio'}
            </p>
            {!search && (
              <button
                className="btn btn-primary"
                onClick={() => setShowModal(true)}
                style={{ background: 'linear-gradient(135deg, #F24E1E, #A259FF)' }}
              >
                <Plus size={14} /> Add First Project
              </button>
            )}
          </div>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 20 }}>
          {displayed.map(p => (
            <PortfolioCard
              key={p.id}
              project={p}
              views={views[p.id] || 0}
              onDelete={deleteProject}
              onSetFeatured={setFeatured}
              onPresent={handlePresent}
              onShare={setSharing}
            />
          ))}
          {/* Add card */}
          {!search && (
            <div
              onClick={() => setShowModal(true)}
              style={{
                border: '2px dashed rgba(242,78,30,0.22)', borderRadius: 'var(--radius-lg)',
                minHeight: 240, display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center', gap: 12,
                cursor: 'pointer', transition: 'all 0.25s', color: 'var(--text-muted)',
              }}
              onMouseEnter={e => { e.currentTarget.style.borderColor='rgba(242,78,30,0.5)'; e.currentTarget.style.background='rgba(242,78,30,0.03)'; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor='rgba(242,78,30,0.22)'; e.currentTarget.style.background='transparent'; }}
            >
              <Plus size={28} style={{ opacity: 0.4 }} />
              <span style={{ fontSize: 13, fontWeight: 600 }}>Add Figma Project</span>
            </div>
          )}
        </div>
      )}

      {/* ── Modals ── */}
      {showModal   && <AddProjectModal onClose={() => setShowModal(false)}  onAdd={addProject} />}
      {presenting  && <PresentationModal project={presenting} onClose={() => setPresenting(null)} />}
      {sharing     && <ShareModal project={sharing} onClose={() => setSharing(null)} />}
    </div>
  );
};

export default FigmaIntegration;
