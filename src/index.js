import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';

const root = ReactDOM.createRoot(document.getElementById('root'));
// NOTE: StrictMode disabled intentionally — it double-invokes effects in dev
// which aborts the SSE pipeline connection immediately after login.
// Re-enable only for debugging React warnings, never during bot runs.
root.render(<App />);
