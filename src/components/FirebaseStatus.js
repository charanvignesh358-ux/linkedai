import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { Database, X, ExternalLink } from 'lucide-react';

const FirebaseStatus = () => {
  const { firebaseReady, firebaseError } = useApp();
  const [dismissed, setDismissed] = useState(false);

  // Don't show if connected or dismissed
  if (firebaseReady || dismissed) return null;

  return (
    <div style={{
      position: 'fixed',
      bottom: 80, right: 20,
      zIndex: 999,
      background: firebaseError
        ? 'rgba(255,184,0,0.08)'
        : 'rgba(0,200,255,0.08)',
      border: `1px solid ${firebaseError ? 'rgba(255,184,0,0.3)' : 'rgba(0,200,255,0.3)'}`,
      borderRadius: 14,
      padding: '12px 16px',
      maxWidth: 320,
      backdropFilter: 'blur(12px)',
      animation: 'slideInRight 0.4s cubic-bezier(0.16,1,0.3,1)',
      boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
        <Database size={16} style={{ color: firebaseError ? 'var(--accent-amber)' : 'var(--accent-cyan)', flexShrink: 0, marginTop: 2 }} />
        <div style={{ flex: 1 }}>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: 13, fontWeight: 700, marginBottom: 4 }}>
            {firebaseError ? '⚠️ Firebase Not Connected' : '🔄 Connecting to Firebase...'}
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.6 }}>
            {firebaseError
              ? `Error: ${firebaseError}`
              : 'Setting up real-time sync...'}
          </div>
          {firebaseError && (
            <a
              href="https://console.firebase.google.com"
              target="_blank"
              rel="noreferrer"
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 4,
                marginTop: 8, fontSize: 11, color: 'var(--accent-amber)',
                textDecoration: 'none', fontFamily: 'var(--font-mono)',
              }}
            >
              Open Firebase Console <ExternalLink size={10} />
            </a>
          )}
        </div>
        <button
          onClick={() => setDismissed(true)}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 2, flexShrink: 0 }}
        >
          <X size={14} />
        </button>
      </div>
    </div>
  );
};

export default FirebaseStatus;
