import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Mail, Lock, User, Eye, EyeOff, Zap, Shield, ArrowRight, Chrome } from 'lucide-react';

const AuthPage = () => {
  const { signIn, signUp, signInWithGoogle, resetPassword, authError, setAuthError } = useAuth();
  const [mode,        setMode]        = useState('login'); // login | signup | reset
  const [showPass,    setShowPass]    = useState(false);
  const [loading,     setLoading]     = useState(false);
  const [resetSent,   setResetSent]   = useState(false);
  const [form,        setForm]        = useState({ name: '', email: '', password: '' });

  const update = (k, v) => { setAuthError(''); setForm(p => ({ ...p, [k]: v })); };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      let result;
      if      (mode === 'login')  result = await signIn(form.email, form.password);
      else if (mode === 'signup') result = await signUp(form.email, form.password, form.name);
      else {
        result = await resetPassword(form.email);
        if (result?.success) setResetSent(true);
      }
    } catch (err) {
      console.error('Auth error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogle = async () => {
    setLoading(true);
    try {
      await signInWithGoogle();
    } catch (err) {
      console.error('Google sign-in error:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: 'var(--bg-primary)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 20,
    }}>

      {/* Card */}
      <div style={{
        width: '100%', maxWidth: 420,
        background: 'var(--bg-card)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-lg)',
        overflow: 'hidden',
        position: 'relative',
      }}>

        {/* Logo header */}
        <div style={{ padding: '24px 24px 16px', textAlign: 'center' }}>
          <div style={{
            fontFamily: 'var(--font-display)',
            fontSize: 22, fontWeight: 800,
            color: 'var(--text-primary)',
            marginBottom: 4,
          }}>
            LinkedAI
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', letterSpacing: '0.12em' }}>
            AUTOMATION PLATFORM
          </div>
        </div>

        {/* Mode tabs */}
        {mode !== 'reset' && (
          <div style={{ display: 'flex', margin: '0 32px 24px', background: 'var(--bg-secondary)', borderRadius: 12, padding: 4, border: '1px solid var(--border)' }}>
            {['login', 'signup'].map(m => (
              <button
                key={m}
                onClick={() => { setMode(m); setAuthError(''); }}
                style={{
                  flex: 1, padding: '8px 0',
                  background: mode === m ? 'var(--bg-card)' : 'transparent',
                  border: mode === m ? '1px solid var(--border-accent)' : '1px solid transparent',
                  borderRadius: 9,
                  color: mode === m ? 'var(--text-primary)' : 'var(--text-muted)',
                  fontFamily: 'var(--font-display)',
                  fontWeight: 700, fontSize: 13,
                  cursor: 'pointer',
                  transition: 'all 0.25s cubic-bezier(0.16,1,0.3,1)',
                  boxShadow: mode === m ? '0 2px 12px rgba(0,0,0,0.3)' : 'none',
                }}
              >
                {m === 'login' ? '🔑 Sign In' : '✨ Sign Up'}
              </button>
            ))}
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} style={{ padding: '0 32px 32px' }}>

          {mode === 'reset' && (
            <div style={{ textAlign: 'center', marginBottom: 24 }}>
              <div style={{ fontSize: 28, marginBottom: 8 }}>🔐</div>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: 17, fontWeight: 700, marginBottom: 6 }}>Reset Password</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Enter your email and we'll send a reset link</div>
            </div>
          )}

          {resetSent && (
            <div style={{
              background: 'rgba(0,230,118,0.08)', border: '1px solid rgba(0,230,118,0.2)',
              borderRadius: 10, padding: '12px 16px', marginBottom: 20,
              fontSize: 13, color: 'var(--accent-green)', textAlign: 'center',
            }}>
              ✅ Reset link sent! Check your email.
            </div>
          )}

          {authError && (
            <div style={{
              background: 'rgba(255,59,92,0.08)', border: '1px solid rgba(255,59,92,0.2)',
              borderRadius: 10, padding: '10px 14px', marginBottom: 16,
              fontSize: 12, color: 'var(--accent-red)',
              display: 'flex', alignItems: 'center', gap: 8,
              animation: 'slideInDown 0.3s cubic-bezier(0.16,1,0.3,1)',
            }}>
              ⚠️ {authError}
            </div>
          )}

          {/* Name field (signup only) */}
          {mode === 'signup' && (
            <div style={{ marginBottom: 14 }}>
              <label style={{ display: 'block', fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                Full Name
              </label>
              <div style={{ position: 'relative' }}>
                <User size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                <input
                  type="text" required
                  placeholder="Your full name"
                  value={form.name}
                  onChange={e => update('name', e.target.value)}
                  style={{
                    width: '100%', paddingLeft: 36, paddingRight: 14,
                    padding: '11px 14px 11px 36px',
                    background: 'var(--bg-secondary)',
                    border: '1px solid var(--border)',
                    borderRadius: 10, color: 'var(--text-primary)',
                    fontSize: 13.5, fontFamily: 'var(--font-body)',
                    outline: 'none', transition: 'border-color 0.2s',
                    boxSizing: 'border-box',
                  }}
                  onFocus={e => e.target.style.borderColor = 'var(--accent-cyan)'}
                  onBlur={e => e.target.style.borderColor = 'var(--border)'}
                />
              </div>
            </div>
          )}

          {/* Email */}
          <div style={{ marginBottom: 14 }}>
            <label style={{ display: 'block', fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              Email Address
            </label>
            <div style={{ position: 'relative' }}>
              <Mail size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input
                type="email" required
                placeholder="you@email.com"
                value={form.email}
                onChange={e => update('email', e.target.value)}
                style={{
                  width: '100%', padding: '11px 14px 11px 36px',
                  background: 'var(--bg-secondary)',
                  border: '1px solid var(--border)',
                  borderRadius: 10, color: 'var(--text-primary)',
                  fontSize: 13.5, fontFamily: 'var(--font-body)',
                  outline: 'none', transition: 'border-color 0.2s',
                  boxSizing: 'border-box',
                }}
                onFocus={e => e.target.style.borderColor = 'var(--accent-cyan)'}
                onBlur={e => e.target.style.borderColor = 'var(--border)'}
              />
            </div>
          </div>

          {/* Password */}
          {mode !== 'reset' && (
            <div style={{ marginBottom: 20 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <label style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                  Password
                </label>
                {mode === 'login' && (
                  <button type="button" onClick={() => setMode('reset')}
                    style={{ fontSize: 11, color: 'var(--accent-cyan)', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'var(--font-mono)' }}>
                    Forgot?
                  </button>
                )}
              </div>
              <div style={{ position: 'relative' }}>
                <Lock size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                <input
                  type={showPass ? 'text' : 'password'} required
                  placeholder={mode === 'signup' ? 'At least 6 characters' : '••••••••••'}
                  value={form.password}
                  onChange={e => update('password', e.target.value)}
                  style={{
                    width: '100%', padding: '11px 40px 11px 36px',
                    background: 'var(--bg-secondary)',
                    border: '1px solid var(--border)',
                    borderRadius: 10, color: 'var(--text-primary)',
                    fontSize: 13.5, fontFamily: 'var(--font-body)',
                    outline: 'none', transition: 'border-color 0.2s',
                    boxSizing: 'border-box',
                  }}
                  onFocus={e => e.target.style.borderColor = 'var(--accent-cyan)'}
                  onBlur={e => e.target.style.borderColor = 'var(--border)'}
                />
                <button type="button" onClick={() => setShowPass(!showPass)} style={{
                  position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
                  background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)',
                }}>
                  {showPass ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
            </div>
          )}

          {/* Submit button */}
          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%', padding: '12px',
              background: loading ? 'rgba(0,200,255,0.3)' : 'linear-gradient(135deg, #00c8ff, #0066ff, #7b3fff)',
              border: 'none', borderRadius: 10,
              color: '#fff', fontFamily: 'var(--font-display)',
              fontWeight: 700, fontSize: 14, cursor: loading ? 'not-allowed' : 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              transition: 'all 0.25s', marginBottom: 12,
              boxShadow: '0 4px 20px rgba(0,200,255,0.25)',
              position: 'relative', overflow: 'hidden',
            }}
          >
            {loading ? (
              <><div className="spinner" style={{ width: 16, height: 16, borderWidth: 2 }} /> Processing...</>
            ) : mode === 'login' ? (
              <><Zap size={15} /> Sign In to LinkedAI</>
            ) : mode === 'signup' ? (
              <><ArrowRight size={15} /> Create Account</>
            ) : (
              <><Mail size={15} /> Send Reset Link</>
            )}
            {!loading && (
              <div style={{
                position: 'absolute', inset: 0,
                background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.08), transparent)',
                animation: 'progressSlide 2s linear infinite',
              }} />
            )}
          </button>

          {/* Google sign in */}
          {mode !== 'reset' && (
            <button
              type="button"
              onClick={handleGoogle}
              disabled={loading}
              style={{
                width: '100%', padding: '11px',
                background: 'transparent',
                border: '1px solid var(--border)',
                borderRadius: 10,
                color: 'var(--text-secondary)',
                fontFamily: 'var(--font-body)',
                fontWeight: 600, fontSize: 13,
                cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                transition: 'all 0.25s',
              }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--border-accent)'; e.currentTarget.style.color = 'var(--text-primary)'; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-secondary)'; }}
            >
              <svg width="16" height="16" viewBox="0 0 48 48">
                <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
                <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
                <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
                <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.18 1.48-4.97 2.31-8.16 2.31-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
              </svg>
              Continue with Google
            </button>
          )}

          {/* Back to login from reset */}
          {mode === 'reset' && (
            <button type="button" onClick={() => { setMode('login'); setResetSent(false); }}
              style={{ width: '100%', marginTop: 8, background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: 12, cursor: 'pointer', fontFamily: 'var(--font-mono)' }}>
              ← Back to Sign In
            </button>
          )}
        </form>

        {/* Security badge */}
        <div style={{
          borderTop: '1px solid var(--border)',
          padding: '12px 32px',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
          background: 'rgba(0,230,118,0.02)',
        }}>
          <Shield size={11} style={{ color: 'var(--accent-green)' }} />
          <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', letterSpacing: '0.08em' }}>
            SECURED WITH FIREBASE AUTH + LEVEL 5 ENCRYPTION
          </span>
        </div>
      </div>
    </div>
  );
};

export default AuthPage;
