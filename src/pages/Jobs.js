import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { Search, MapPin, DollarSign, Clock, Zap, Bookmark, Send } from 'lucide-react';

const JobCard = ({ job, onApply }) => {
  const score = job.score || 0;
  const scoreColor = score >= 90 ? 'var(--accent-green)' : score >= 75 ? 'var(--accent-cyan)' : 'var(--accent-amber)';
  const companyInitials = (job.company || '??').slice(0, 2).toUpperCase();
  const tags = Array.isArray(job.tags) ? job.tags : [];

  return (
    <div className="job-card animate-fade">
      <div className="job-card-header">
        <div className="flex items-start gap-12">
          <div className="company-logo">{companyInitials}</div>
          <div>
            <div className="job-title">{job.title}</div>
            <div className="job-company">{job.company}</div>
          </div>
        </div>
        <div className="flex-col items-center gap-4" style={{ display: 'flex', alignItems: 'flex-end' }}>
          <div className="match-score">
            <div className="score-bar">
              <div className="score-fill" style={{ width: `${score}%`, background: scoreColor }} />
            </div>
            <span style={{ color: scoreColor, fontSize: 12, fontFamily: 'var(--font-mono)' }}>{score}%</span>
          </div>
          <span className="text-xs text-muted">AI match</span>
        </div>
      </div>

      <div className="job-meta">
        {job.location && <span className="badge badge-muted"><MapPin size={10} /> {job.location}</span>}
        {job.salary   && <span className="badge badge-muted"><DollarSign size={10} /> {job.salary}</span>}
        {job.posted   && <span className="badge badge-muted"><Clock size={10} /> {job.posted}</span>}
        {job.type     && <span className={`badge ${job.type === 'Contract' ? 'badge-amber' : 'badge-cyan'}`}>{job.type}</span>}
        {job.level    && <span className="badge badge-purple">{job.level}</span>}
        {job.easyApply && <span className="badge badge-green">Easy Apply</span>}
      </div>

      {tags.length > 0 && (
        <div className="flex flex-wrap gap-6 mt-8">
          {tags.map(tag => (
            <span key={tag} className="chip" style={{ padding: '3px 10px', fontSize: 11 }}>{tag}</span>
          ))}
        </div>
      )}

      <div className="job-actions">
        {job.status === 'applied' ? (
          <button className="btn btn-success btn-sm" disabled style={{ cursor: 'default' }}>
            ✅ Applied
          </button>
        ) : (
          <button className="btn btn-primary btn-sm" onClick={() => onApply(job.id)}>
            <Send size={12} /> Auto Apply
          </button>
        )}
        <button
          className="btn btn-secondary btn-sm"
          onClick={() => {
            const key = `saved_job_${job.id}`;
            const already = localStorage.getItem(key);
            if (already) { localStorage.removeItem(key); alert('Job unsaved.'); }
            else { localStorage.setItem(key, JSON.stringify(job)); alert('Job saved!'); }
          }}
        >
          <Bookmark size={12} /> {localStorage.getItem(`saved_job_${job.id}`) ? 'Unsave' : 'Save'}
        </button>
        {job.link && (
          <a href={job.link} target="_blank" rel="noreferrer" className="btn btn-ghost btn-sm" style={{ textDecoration: 'none' }}>View on LinkedIn</a>
        )}
      </div>
    </div>
  );
};

const Jobs = () => {
  const { jobs, applyToJob, userSettings } = useApp();
  const [search, setSearch] = useState('');
  const [location, setLocation] = useState('');
  const [level, setLevel] = useState('All');
  const [type, setType] = useState('All');
  const [sortBy, setSortBy] = useState('match');
  const [applying, setApplying] = useState(false);

  const levels = ['All', 'Entry', 'Mid', 'Senior'];
  const types = ['All', 'Full-time', 'Contract', 'Part-time'];

  const filtered = jobs
    .filter(j => {
      const matchSearch = !search ||
        (j.title || '').toLowerCase().includes(search.toLowerCase()) ||
        (j.company || '').toLowerCase().includes(search.toLowerCase()) ||
        (Array.isArray(j.tags) && j.tags.some(t => t.toLowerCase().includes(search.toLowerCase())));
      const matchLevel = level === 'All' || j.level === level;
      const matchType = type === 'All' || j.type === type;
      const matchLoc = !location || (j.location || '').toLowerCase().includes(location.toLowerCase());
      return matchSearch && matchLevel && matchType && matchLoc;
    })
    .sort((a, b) => sortBy === 'match' ? b.score - a.score : 0);

  return (
    <div className="page-content animate-fade">
      {/* Search Bar */}
      <div className="card mb-20">
        <div className="card-body">
          <div className="grid-2 mb-12">
            <div className="search-bar">
              <Search size={15} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
              <input
                placeholder="Search job titles, companies, skills..."
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
            <div className="search-bar">
              <MapPin size={15} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
              <input
                placeholder="Location (Remote, NYC, etc.)"
                value={location}
                onChange={e => setLocation(e.target.value)}
              />
            </div>
          </div>

          <div className="flex items-center gap-12 flex-wrap">
            <div className="flex items-center gap-8">
              <span className="text-xs text-muted font-mono">LEVEL:</span>
              <div className="filter-chips">
                {levels.map(l => (
                  <span key={l} className={`chip ${level === l ? 'active' : ''}`} onClick={() => setLevel(l)}>{l}</span>
                ))}
              </div>
            </div>
            <div className="flex items-center gap-8">
              <span className="text-xs text-muted font-mono">TYPE:</span>
              <div className="filter-chips">
                {types.map(t => (
                  <span key={t} className={`chip ${type === t ? 'active' : ''}`} onClick={() => setType(t)}>{t}</span>
                ))}
              </div>
            </div>
            <div className="ml-auto flex items-center gap-8">
              <span className="text-xs text-muted font-mono">SORT:</span>
              <select className="form-select" style={{ width: 140, padding: '6px 12px' }} value={sortBy} onChange={e => setSortBy(e.target.value)}>
                <option value="match">Match Score</option>
                <option value="recent">Most Recent</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Results Header */}
      <div className="flex-between mb-16">
        <div className="flex items-center gap-10">
          <span className="font-display font-bold" style={{ fontSize: 16 }}>{filtered.length} Jobs Found</span>
          <span className="badge badge-cyan">{jobs.filter(j => j.status === 'applied').length} Applied</span>
          {location && <span className="badge badge-purple">📍 {location}</span>}
        </div>
        <button
          className="btn btn-primary btn-sm"
          disabled={applying}
          onClick={async () => {
            const highMatch = filtered.filter(j => j.score >= 85 && j.status !== 'applied');
            if (!highMatch.length) return;
            setApplying(true);
            for (const job of highMatch) { await applyToJob(job.id); await new Promise(r => setTimeout(r, 400)); }
            setApplying(false);
          }}
        >
          <Zap size={13} /> {applying ? 'Applying...' : `Auto-Apply All (${filtered.filter(j => j.score >= 85 && j.status !== 'applied').length} high-match)`}
        </button>
      </div>

      {/* Job Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(380px, 1fr))', gap: 16 }}>
        {filtered.map(job => (
          <JobCard key={job.id} job={job} onApply={applyToJob} />
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="empty-state">
          <div className="empty-state-icon">🔍</div>
          <h3>No jobs found</h3>
          <p>Try adjusting your search or filters</p>
        </div>
      )}
    </div>
  );
};

export default Jobs;
