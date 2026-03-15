import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { Plus, Calendar, Building, FileText, X } from 'lucide-react';

const COLUMNS = [
  { id: 'applied', label: 'Applied', color: 'var(--accent-cyan)', dot: '#00c8ff' },
  { id: 'interview', label: 'Interview', color: 'var(--accent-amber)', dot: '#ffb800' },
  { id: 'offer', label: 'Offer', color: 'var(--accent-green)', dot: '#00e676' },
  { id: 'rejected', label: 'Rejected', color: 'var(--accent-red)', dot: '#ff3b5c' },
];

const KanbanCard = ({ app, onMove }) => {
  const score = app.score || 0;
  const scoreColor = score >= 90 ? 'var(--accent-green)' : score >= 75 ? 'var(--accent-cyan)' : 'var(--accent-amber)';
  const nextStatuses = COLUMNS.filter(c => c.id !== app.status).map(c => c.id);

  return (
    <div className="kanban-card">
      <div className="kanban-card-title">{app.title}</div>
      <div className="kanban-card-company flex items-center gap-6">
        <Building size={11} /> {app.company}
      </div>
      <div className="kanban-card-meta">
        <span className="badge badge-muted" style={{ fontSize: 10 }}>
          <Calendar size={9} /> {app.date}
        </span>
        <span className="badge badge-muted" style={{ fontSize: 10 }}>
          <FileText size={9} /> {app.resume}
        </span>
        <span className="font-mono text-xs ml-auto" style={{ color: scoreColor }}>{score}%</span>
      </div>
      <div className="flex gap-4 mt-10 flex-wrap">
        {nextStatuses.slice(0, 2).map(st => (
          <button key={st} className="btn btn-ghost btn-sm" style={{ fontSize: 10, padding: '3px 8px' }} onClick={() => onMove(app.id, st)}>
            → {st}
          </button>
        ))}
      </div>
    </div>
  );
};

const Applications = () => {
  const { applications, setApplications, updateApplicationStatus } = useApp();
  const [view, setView] = useState('kanban');
  const [showAdd, setShowAdd] = useState(false);
  const [newApp, setNewApp] = useState({ title: '', company: '', status: 'applied', date: new Date().toISOString().split('T')[0], resume: '', score: '' });

  const handleAddApp = () => {
    if (!newApp.title || !newApp.company) return;
    const app = { ...newApp, id: `manual_${Date.now()}`, score: Number(newApp.score) || 0, resume: newApp.resume || 'N/A' };
    setApplications(prev => [app, ...prev]);
    setShowAdd(false);
    setNewApp({ title: '', company: '', status: 'applied', date: new Date().toISOString().split('T')[0], resume: '', score: '' });
  };

  const statusColor = { applied: 'cyan', interview: 'amber', offer: 'green', rejected: 'red' };

  return (
    <div className="page-content animate-fade">
      <div className="flex-between mb-20">
        <div className="flex items-center gap-10">
          {['kanban', 'table'].map(v => (
            <button key={v} className={`btn btn-sm ${view === v ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setView(v)}>
              {v === 'kanban' ? '⊞ Kanban' : '≡ Table'}
            </button>
          ))}
        </div>
        <button className="btn btn-primary btn-sm" onClick={() => setShowAdd(true)}>
          <Plus size={13} /> Add Application
        </button>
      </div>

      {/* Add Application Modal */}
      {showAdd && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 500, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-accent)', borderRadius: 16, padding: 28, width: 420, maxWidth: '90vw' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: 16, fontWeight: 700 }}>Add Application</div>
              <button onClick={() => setShowAdd(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}><X size={18} /></button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {[['Job Title', 'title', 'text'], ['Company', 'company', 'text'], ['Resume / CV', 'resume', 'text'], ['Match Score (%)', 'score', 'number'], ['Date Applied', 'date', 'date']].map(([label, key, type]) => (
                <div key={key}>
                  <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 4, fontFamily: 'var(--font-mono)' }}>{label}</label>
                  <input className="form-input" type={type} value={newApp[key]} onChange={e => setNewApp(p => ({ ...p, [key]: e.target.value }))} />
                </div>
              ))}
              <div>
                <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 4, fontFamily: 'var(--font-mono)' }}>Status</label>
                <select className="form-select" value={newApp.status} onChange={e => setNewApp(p => ({ ...p, status: e.target.value }))}>
                  {COLUMNS.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
                </select>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
              <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setShowAdd(false)}>Cancel</button>
              <button className="btn btn-primary" style={{ flex: 1 }} onClick={handleAddApp} disabled={!newApp.title || !newApp.company}>Add</button>
            </div>
          </div>
        </div>
      )}

      {view === 'kanban' ? (
        <div className="kanban-board">
          {COLUMNS.map(col => {
            const colApps = applications.filter(a => a.status === col.id);
            return (
              <div key={col.id} className="kanban-column">
                <div className="kanban-col-header">
                  <div className="kanban-col-title">
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: col.dot }} />
                    <span style={{ color: col.color }}>{col.label}</span>
                  </div>
                  <span className="kanban-col-count">{colApps.length}</span>
                </div>
                {colApps.map(app => (
                  <KanbanCard key={app.id} app={app} onMove={updateApplicationStatus} />
                ))}
                {colApps.length === 0 && (
                  <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--text-muted)', fontSize: 12 }}>
                    No applications
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="card">
          <div className="card-body" style={{ padding: 0 }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Company</th>
                  <th>Role</th>
                  <th>Status</th>
                  <th>Date Applied</th>
                  <th>Resume</th>
                  <th>Match</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {applications.map(app => (
                  <tr key={app.id}>
                    <td><strong style={{ color: 'var(--text-primary)' }}>{app.company}</strong></td>
                    <td>{app.title}</td>
                    <td><span className={`badge badge-${statusColor[app.status] || 'muted'}`}>{app.status}</span></td>
                    <td className="font-mono text-xs">{app.date}</td>
                    <td className="text-xs text-secondary">{app.resume}</td>
                    <td className="font-mono text-cyan">{app.score ? `${app.score}%` : '—'}</td>
                    <td>
                      <div className="flex gap-4">
                        {COLUMNS.filter(c => c.id !== app.status).slice(0, 2).map(c => (
                          <button key={c.id} className="btn btn-ghost btn-sm" style={{ fontSize: 10 }}
                            onClick={() => updateApplicationStatus(app.id, c.id)}>
                            {c.label}
                          </button>
                        ))}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default Applications;
