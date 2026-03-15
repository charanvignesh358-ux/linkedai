import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { collection, getDocs, doc, updateDoc, deleteDoc, orderBy, query } from 'firebase/firestore';
import { db } from '../firebase/config';
import { Shield, Users, Activity, Trash2, Crown, UserCheck, UserX, RefreshCw, Lock, TrendingUp } from 'lucide-react';

const RoleBadge = ({ role }) => {
  const cfg = {
    admin:  { color: 'var(--accent-amber)',  bg: 'rgba(255,184,0,0.1)',  icon: '👑', label: 'Admin'  },
    member: { color: 'var(--accent-cyan)',   bg: 'rgba(0,200,255,0.1)', icon: '👤', label: 'Member' },
    banned: { color: 'var(--accent-red)',    bg: 'rgba(255,59,92,0.1)', icon: '🚫', label: 'Banned' },
  };
  const c = cfg[role] || cfg.member;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      padding: '3px 10px', borderRadius: 20,
      background: c.bg, color: c.color,
      fontSize: 11, fontFamily: 'var(--font-mono)', fontWeight: 700,
      border: `1px solid ${c.color}30`,
    }}>
      {c.icon} {c.label}
    </span>
  );
};

const AdminPanel = () => {
  const { isAdmin, currentUser, userProfile } = useAuth();
  const [users,    setUsers]    = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [updating, setUpdating] = useState('');
  const [tab,      setTab]      = useState('users'); // users | logs | stats

  useEffect(() => {
    if (isAdmin) loadUsers();
  }, [isAdmin]);

  const loadUsers = async () => {
    setLoading(true);
    try {
      const snap = await getDocs(query(collection(db, 'users'), orderBy('createdAt', 'desc')));
      setUsers(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (err) {
      console.error(err);
    }
    setLoading(false);
  };

  const updateRole = async (uid, role) => {
    if (uid === currentUser.uid && role !== 'admin') {
      alert("You can't demote yourself!");
      return;
    }
    setUpdating(uid);
    try {
      await updateDoc(doc(db, 'users', uid), { role });
      setUsers(prev => prev.map(u => u.id === uid ? { ...u, role } : u));
    } catch (err) {
      console.error('Failed to update role:', err);
      alert('Failed to update role: ' + err.message);
    }
    setUpdating('');
  };

  const deleteUser = async (uid) => {
    if (uid === currentUser.uid) { alert("Can't delete yourself!"); return; }
    if (!window.confirm('Delete this user from Firestore? (Firebase Auth account will remain)')) return;
    try {
      await deleteDoc(doc(db, 'users', uid));
      setUsers(prev => prev.filter(u => u.id !== uid));
    } catch (err) {
      console.error('Failed to delete user:', err);
      alert('Failed to delete user: ' + err.message);
    }
  };

  // Guard
  if (!isAdmin) {
    return (
      <div className="page-content" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 400 }}>
        <div className="empty-state">
          <div className="empty-state-icon"><Lock size={40} style={{ opacity: 0.3 }} /></div>
          <h3>Access Denied</h3>
          <p>You need admin privileges to view this page.</p>
        </div>
      </div>
    );
  }

  const adminCount  = users.filter(u => u.role === 'admin').length;
  const memberCount = users.filter(u => u.role === 'member').length;
  const bannedCount = users.filter(u => u.role === 'banned').length;

  return (
    <div className="page-content animate-fade">

      {/* Header */}
      <div className="manager-header" style={{ marginBottom: 24 }}>
        <div className="manager-title">
          <div className="manager-brain-icon" style={{ fontSize: 22 }}>👑</div>
          <div>
            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 22, margin: 0 }}>
              Admin Panel
            </h2>
            <div className="font-mono text-xs text-muted" style={{ marginTop: 4 }}>
              Full platform control · Signed in as {userProfile?.displayName || currentUser?.email}
            </div>
          </div>
        </div>
        <button className="btn btn-secondary btn-sm" onClick={loadUsers}>
          <RefreshCw size={13} /> Refresh
        </button>
      </div>

      {/* Stats row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>
        {[
          { label: 'Total Users',  value: users.length,  icon: <Users size={18} />,     color: 'rgba(0,200,255,0.12)',  iconColor: 'var(--accent-cyan)'   },
          { label: 'Admins',       value: adminCount,    icon: <Crown size={18} />,     color: 'rgba(255,184,0,0.12)',  iconColor: 'var(--accent-amber)'  },
          { label: 'Members',      value: memberCount,   icon: <UserCheck size={18} />, color: 'rgba(0,230,118,0.12)',  iconColor: 'var(--accent-green)'  },
          { label: 'Banned',       value: bannedCount,   icon: <UserX size={18} />,     color: 'rgba(255,59,92,0.12)',  iconColor: 'var(--accent-red)'    },
        ].map((s, i) => (
          <div key={i} className="stat-card" style={{ padding: '16px 20px' }}>
            <div className="stat-icon" style={{ background: s.color, color: s.iconColor, width: 36, height: 36 }}>{s.icon}</div>
            <div className="stat-value" style={{ fontSize: '1.8rem', marginTop: 10 }}>{s.value}</div>
            <div className="stat-label">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Tab bar */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        {[
          { key: 'users', icon: <Users size={13} />,    label: 'Users'     },
          { key: 'stats', icon: <TrendingUp size={13} />,label: 'Platform'  },
        ].map(t => (
          <button
            key={t.key}
            className={`btn btn-sm ${tab === t.key ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setTab(t.key)}
          >
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {/* Users Table */}
      {tab === 'users' && (
        <div className="card">
          <div className="card-header">
            <div className="card-title"><Users size={14} /> All Users</div>
            <span className="badge badge-cyan">{users.length} total</span>
          </div>
          <div className="card-body" style={{ padding: 0 }}>
            {loading ? (
              <div style={{ padding: 40, textAlign: 'center' }}>
                <div className="spinner" style={{ margin: '0 auto' }} />
              </div>
            ) : (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>User</th>
                    <th>Email</th>
                    <th>Role</th>
                    <th>Joined</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map(u => (
                    <tr key={u.id} style={{ opacity: updating === u.id ? 0.5 : 1, transition: 'opacity 0.2s' }}>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <div style={{
                            width: 32, height: 32, borderRadius: '50%',
                            background: 'var(--gradient-primary)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: 12, fontWeight: 800, fontFamily: 'var(--font-display)', color: '#fff',
                            flexShrink: 0,
                          }}>
                            {(u.displayName || u.email || '?')[0].toUpperCase()}
                          </div>
                          <div>
                            <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--text-primary)' }}>
                              {u.displayName || '—'}
                              {u.id === currentUser.uid && (
                                <span style={{ marginLeft: 6, fontSize: 10, color: 'var(--accent-cyan)', fontFamily: 'var(--font-mono)' }}>(you)</span>
                              )}
                            </div>
                            <div style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                              uid: {u.id.slice(0, 10)}...
                            </div>
                          </div>
                        </div>
                      </td>
                      <td style={{ fontSize: 12 }}>{u.email}</td>
                      <td><RoleBadge role={u.role} /></td>
                      <td className="font-mono text-xs text-muted">
                        {u.createdAt?.toDate
                          ? u.createdAt.toDate().toLocaleDateString()
                          : '—'}
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: 6 }}>
                          {u.role !== 'admin' && (
                            <button
                              className="btn btn-ghost btn-sm"
                              style={{ fontSize: 11, color: 'var(--accent-amber)' }}
                              onClick={() => updateRole(u.id, 'admin')}
                              disabled={updating === u.id}
                            >
                              <Crown size={11} /> Make Admin
                            </button>
                          )}
                          {u.role === 'admin' && u.id !== currentUser.uid && (
                            <button
                              className="btn btn-ghost btn-sm"
                              style={{ fontSize: 11 }}
                              onClick={() => updateRole(u.id, 'member')}
                              disabled={updating === u.id}
                            >
                              <UserCheck size={11} /> Demote
                            </button>
                          )}
                          {u.role !== 'banned' && u.id !== currentUser.uid && (
                            <button
                              className="btn btn-ghost btn-sm"
                              style={{ fontSize: 11, color: 'var(--accent-red)' }}
                              onClick={() => updateRole(u.id, 'banned')}
                              disabled={updating === u.id}
                            >
                              <UserX size={11} /> Ban
                            </button>
                          )}
                          {u.role === 'banned' && (
                            <button
                              className="btn btn-ghost btn-sm"
                              style={{ fontSize: 11, color: 'var(--accent-green)' }}
                              onClick={() => updateRole(u.id, 'member')}
                              disabled={updating === u.id}
                            >
                              <UserCheck size={11} /> Unban
                            </button>
                          )}
                          {u.id !== currentUser.uid && (
                            <button
                              className="btn btn-ghost btn-sm btn-icon"
                              style={{ color: 'var(--accent-red)' }}
                              onClick={() => deleteUser(u.id)}
                            >
                              <Trash2 size={13} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* Platform Stats tab */}
      {tab === 'stats' && (
        <div className="card">
          <div className="card-header">
            <div className="card-title"><Activity size={14} /> Platform Overview</div>
          </div>
          <div className="card-body">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16 }}>
              {[
                { label: 'Project ID',        value: 'linkedin-6fea9',     color: 'var(--accent-cyan)' },
                { label: 'Firestore Region',  value: 'us-central1',        color: 'var(--accent-green)' },
                { label: 'Auth Provider',     value: 'Email + Google',     color: 'var(--accent-purple)' },
                { label: 'Security Rules',    value: 'Role-Based (RBAC)',  color: 'var(--accent-amber)' },
                { label: 'Firebase Plan',     value: 'Spark (Free Tier)',  color: 'var(--accent-cyan)' },
                { label: 'Admin Role',        value: userProfile?.displayName || currentUser?.email, color: 'var(--accent-amber)' },
              ].map((item, i) => (
                <div key={i} style={{
                  padding: '14px 16px',
                  background: 'var(--bg-secondary)',
                  borderRadius: 10,
                  border: '1px solid var(--border)',
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                }}>
                  <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{item.label}</span>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: item.color, fontWeight: 700 }}>{item.value}</span>
                </div>
              ))}
            </div>

            <div style={{
              marginTop: 20, padding: '14px 16px',
              background: 'rgba(0,230,118,0.05)',
              border: '1px solid rgba(0,230,118,0.2)',
              borderRadius: 10,
              display: 'flex', alignItems: 'center', gap: 10,
            }}>
              <Shield size={16} style={{ color: 'var(--accent-green)', flexShrink: 0 }} />
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--accent-green)', marginBottom: 2 }}>
                  RBAC Security Rules Active
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                  Users can only access their own data. Admins have full read access. No public access allowed.
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminPanel;
