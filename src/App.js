import React, { useState } from 'react';
import { AppProvider, useApp } from './context/AppContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import Sidebar from './components/Sidebar';
import Topbar from './components/Topbar';
import FirebaseStatus from './components/FirebaseStatus';
import AuthPage from './pages/AuthPage';
import Dashboard from './pages/Dashboard';
import Jobs from './pages/Jobs';
import Applications from './pages/Applications';
import Resumes from './pages/Resumes';
import Networking from './pages/Networking';
import Settings from './pages/Settings';
import ManagerAgent from './pages/ManagerAgent';
import FigmaIntegration from './pages/FigmaIntegration';
import ContentStudio from './pages/ContentStudio';
import InterviewCoach from './pages/InterviewCoach';
import AdminPanel from './pages/AdminPanel';
import ChatBot from './pages/ChatBot';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

const PageRouter = () => {
  const { activePage } = useApp();
  switch (activePage) {
    case 'dashboard':    return <Dashboard />;
    case 'jobs':         return <Jobs />;
    case 'applications': return <Applications />;
    case 'resumes':      return <Resumes />;
    case 'networking':   return <Networking />;
    case 'settings':     return <Settings />;
    case 'manager':      return <ManagerAgent />;
    case 'admin':        return <AdminPanel />;
    case 'figma':        return <FigmaIntegration />;
    case 'content':      return <ContentStudio />;
    case 'interview':    return <InterviewCoach />;
    case 'chatbot':      return <ChatBot />;
    default:             return <Dashboard />;
  }
};

// Error Boundary to catch crashes in any page without killing the whole app
class ErrorBoundary extends React.Component {
  constructor(props) { super(props); this.state = { hasError: false, error: null, errorInfo: null }; }
  static getDerivedStateFromError(error) { return { hasError: true, error }; }
  componentDidCatch(error, info) { console.error('Page crashed:', error, info); this.setState({ errorInfo: info }); }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: 40, color: 'var(--accent-red)' }}>
          <h3>Something went wrong on this page.</h3>
          <pre style={{ fontSize: 11, opacity: 0.7, whiteSpace: 'pre-wrap' }}>{this.state.error?.message}{this.state.errorInfo?.componentStack ? '\n\nComponent Stack:' + this.state.errorInfo.componentStack : ''}</pre>
          <button className="btn btn-primary" style={{ marginTop: 16 }} onClick={() => this.setState({ hasError: false, error: null, errorInfo: null })}>↺ Try Again</button>
        </div>
      );
    }
    return this.props.children;
  }
}

const AppContent = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="app-layout">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="main-content">
        <Topbar onMenuToggle={() => setSidebarOpen(v => !v)} />
        <ErrorBoundary>
          <PageRouter />
        </ErrorBoundary>
      </div>
      <FirebaseStatus />
      <ToastContainer position="bottom-right" autoClose={4000} theme="dark" style={{ fontSize: 13 }} />
    </div>
  );
};

// ── Auth gate: shows login page until signed in ─────────────────
const AuthGate = () => {
  const { currentUser, authLoading } = useAuth();

  if (authLoading) {
    return (
      <div style={{
        minHeight: '100vh', background: 'var(--bg-primary)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 16,
      }}>
        <div style={{
          width: 52, height: 52,
          background: 'linear-gradient(135deg, rgba(59,130,246,0.15), rgba(139,92,246,0.15))',
          border: '1px solid rgba(59,130,246,0.3)', borderRadius: 16,
          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26,
          animation: 'breathe 1.5s ease-in-out infinite',
        }}>
          🧠
        </div>
        <div className="spinner" />
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-muted)', letterSpacing: '0.1em' }}>
          INITIALIZING...
        </div>
      </div>
    );
  }

  if (!currentUser) return <AuthPage />;

  return (
    <AppProvider>
      <AppContent />
    </AppProvider>
  );
};

const App = () => (
  <AuthProvider>
    <AuthGate />
  </AuthProvider>
);

export default App;
