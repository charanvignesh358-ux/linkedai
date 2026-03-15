// ================================================================
//  src/context/AppContext.js  — v4.2  (All Bugs Fixed)
//
//  Fixes vs v4.1:
//   ✅ FIX #1: forceRefreshStats removed from bootstrap useEffect
//      dependency array — was causing infinite re-render loop.
//      Uses stable ref pattern instead.
//   ✅ FIX #2: getConnections/getResumes now always called AFTER
//      auth is confirmed inside bootstrap — no more "Not
//      authenticated" throw on first mount.
//   ✅ FIX #3: listenStats debounced (300ms) so rapid SSE events
//      during pipeline don't cause dozens of re-renders/second.
//   ✅ FIX #4: setStats correctly exported in context value.
//   ✅ FIX #5: forceRefreshStats has empty deps [] so it has a
//      stable identity — Dashboard useEffect no longer loops.
// ================================================================

import React, {
  createContext, useContext, useState,
  useCallback, useEffect, useRef,
} from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '../firebase/config';
import {
  listenJobs, listenApplications, listenStats, listenConnections,
  getResumes, getConnections, getStats,
  getUserSettings, saveSettings, initStats,
  addApplication, updateApplicationStatus as fbUpdateAppStatus,
  markJobApplied, setDefaultResume,
  deleteResume as fbDeleteResume,
  incrementStat, logActivity,
} from '../firebase/firebaseService';

const AppContext = createContext(null);

// ─── Default stats ──────────────────────────────────────────────
const DEFAULT_STATS = {
  jobsFound: 0, applied: 0, interviews: 0,
  connections: 0, responseRate: 0, matchScore: 0,
};

// ─── Demo jobs ──────────────────────────────────────────────────
const DEFAULT_JOBS = [
  { id: 'demo_1',  title: 'Senior Frontend Engineer',   company: 'Razorpay',   location: 'Bangalore / Remote', salary: '₹18-28 LPA', posted: '2d ago', type: 'Full-time', level: 'Senior', easyApply: true,  score: 94, tags: ['React', 'TypeScript', 'GraphQL'],        link: 'https://www.linkedin.com/jobs/' },
  { id: 'demo_2',  title: 'Full Stack Developer',       company: 'Zepto',      location: 'Mumbai / Remote',    salary: '₹15-22 LPA', posted: '1d ago', type: 'Full-time', level: 'Mid',    easyApply: true,  score: 91, tags: ['Node.js', 'React', 'PostgreSQL'],       link: 'https://www.linkedin.com/jobs/' },
  { id: 'demo_3',  title: 'React Native Developer',     company: 'PhonePe',    location: 'Bangalore',          salary: '₹20-30 LPA', posted: '3d ago', type: 'Full-time', level: 'Mid',    easyApply: true,  score: 89, tags: ['React Native', 'Redux', 'iOS/Android'], link: 'https://www.linkedin.com/jobs/' },
  { id: 'demo_4',  title: 'Backend Engineer (Node.js)', company: 'CRED',       location: 'Bangalore / Remote', salary: '₹22-35 LPA', posted: '1d ago', type: 'Full-time', level: 'Senior', easyApply: true,  score: 87, tags: ['Node.js', 'AWS', 'Microservices'],      link: 'https://www.linkedin.com/jobs/' },
  { id: 'demo_5',  title: 'Software Engineer II',       company: 'Swiggy',     location: 'Bangalore',          salary: '₹18-25 LPA', posted: '5d ago', type: 'Full-time', level: 'Mid',    easyApply: true,  score: 85, tags: ['Python', 'Django', 'Redis'],             link: 'https://www.linkedin.com/jobs/' },
  { id: 'demo_6',  title: 'Frontend Developer',         company: 'Meesho',     location: 'Bangalore / Hybrid', salary: '₹12-18 LPA', posted: '2d ago', type: 'Full-time', level: 'Mid',    easyApply: true,  score: 83, tags: ['React', 'CSS', 'Performance'],           link: 'https://www.linkedin.com/jobs/' },
  { id: 'demo_7',  title: 'DevOps Engineer',            company: 'Freshworks', location: 'Chennai / Remote',   salary: '₹16-24 LPA', posted: '4d ago', type: 'Full-time', level: 'Mid',    easyApply: true,  score: 80, tags: ['AWS', 'Kubernetes', 'Terraform'],        link: 'https://www.linkedin.com/jobs/' },
  { id: 'demo_8',  title: 'Data Engineer',              company: 'Flipkart',   location: 'Bangalore',          salary: '₹20-32 LPA', posted: '2d ago', type: 'Full-time', level: 'Senior', easyApply: true,  score: 78, tags: ['Spark', 'Kafka', 'Python'],              link: 'https://www.linkedin.com/jobs/' },
  { id: 'demo_9',  title: 'Product Engineer',           company: 'Groww',      location: 'Bangalore / Remote', salary: '₹14-22 LPA', posted: '1d ago', type: 'Full-time', level: 'Entry',  easyApply: true,  score: 76, tags: ['Java', 'Spring Boot', 'MySQL'],          link: 'https://www.linkedin.com/jobs/' },
  { id: 'demo_10', title: 'iOS Developer',              company: 'Paytm',      location: 'Noida / Remote',     salary: '₹15-25 LPA', posted: '3d ago', type: 'Full-time', level: 'Mid',    easyApply: true,  score: 75, tags: ['Swift', 'UIKit', 'Xcode'],               link: 'https://www.linkedin.com/jobs/' },
  { id: 'demo_11', title: 'Machine Learning Engineer',  company: 'Juspay',     location: 'Bangalore',          salary: '₹25-40 LPA', posted: '6d ago', type: 'Full-time', level: 'Senior', easyApply: true,  score: 73, tags: ['Python', 'TensorFlow', 'MLOps'],         link: 'https://www.linkedin.com/jobs/' },
  { id: 'demo_12', title: 'Android Developer',          company: 'Ola',        location: 'Bangalore',          salary: '₹16-26 LPA', posted: '2d ago', type: 'Full-time', level: 'Mid',    easyApply: false, score: 71, tags: ['Kotlin', 'Jetpack', 'MVVM'],             link: 'https://www.linkedin.com/jobs/' },
  { id: 'demo_13', title: 'Cloud Architect',            company: 'Infosys',    location: 'Remote',             salary: '₹30-50 LPA', posted: '1d ago', type: 'Contract',  level: 'Senior', easyApply: true,  score: 70, tags: ['AWS', 'Azure', 'GCP'],                   link: 'https://www.linkedin.com/jobs/' },
  { id: 'demo_14', title: 'QA Automation Engineer',     company: 'Postman',    location: 'Bangalore / Remote', salary: '₹12-18 LPA', posted: '7d ago', type: 'Full-time', level: 'Mid',    easyApply: true,  score: 68, tags: ['Selenium', 'Cypress', 'Jest'],           link: 'https://www.linkedin.com/jobs/' },
  { id: 'demo_15', title: 'Technical Lead',             company: 'Nykaa',      location: 'Mumbai',             salary: '₹28-42 LPA', posted: '3d ago', type: 'Full-time', level: 'Senior', easyApply: true,  score: 66, tags: ['React', 'Node.js', 'Leadership'],        link: 'https://www.linkedin.com/jobs/' },
];

export const AppProvider = ({ children }) => {
  const [firebaseReady, setFirebaseReady] = useState(false);
  const [firebaseError, setFirebaseError] = useState(null);

  const [activePage, setActivePage]       = useState('dashboard');
  const [botStatus, setBotStatus]         = useState('idle');
  const [notifications, setNotifications] = useState([]);

  const [stats, setStats]               = useState(DEFAULT_STATS);
  const [jobs, setJobs]                 = useState(DEFAULT_JOBS);
  const [applications, setApplications] = useState([]);
  const [resumes, setResumes]           = useState([]);
  const [connections, setConnections]   = useState([]);
  const [userSettings, setUserSettings] = useState({});

  // Refs for listener cleanup & auth gate
  const firebaseReadyRef = useRef(false);
  const unsubRefs        = useRef({ jobs: null, apps: null, stats: null, conns: null });

  // ── FIX #5: forceRefreshStats — STABLE identity (empty deps) ──
  // We use a mutable ref to always hold the latest setStats so we
  // don't need setStats in the callback's closure deps.
  const setStatsRef = useRef(null);
  setStatsRef.current = setStats; // update ref on every render

  // FIX #5: empty deps [] = stable function identity across renders
  const forceRefreshStats = useCallback(async () => {
    try {
      const fresh = await getStats();
      if (fresh) {
        setStatsRef.current({
          jobsFound:    fresh.jobsFound    ?? 0,
          applied:      fresh.applied      ?? 0,
          interviews:   fresh.interviews   ?? 0,
          connections:  fresh.connections  ?? 0,
          responseRate: fresh.responseRate ?? 0,
          matchScore:   fresh.matchScore   ?? 0,
        });
      }
    } catch (e) {
      console.warn('[AppContext] forceRefreshStats error:', e.message);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // A ref so bootstrap can call it without a dep
  const forceRefreshRef = useRef(forceRefreshStats);
  useEffect(() => { forceRefreshRef.current = forceRefreshStats; }, [forceRefreshStats]);

  // ── optimisticStatUpdate ─────────────────────────────────────
  const optimisticStatUpdate = useCallback((delta = {}) => {
    setStats(prev => ({
      jobsFound:    (prev.jobsFound    || 0) + (delta.jobsFound    || 0),
      applied:      (prev.applied      || 0) + (delta.applied      || 0),
      interviews:   (prev.interviews   || 0) + (delta.interviews   || 0),
      connections:  (prev.connections  || 0) + (delta.connections  || 0),
      responseRate: prev.responseRate  || 0,
      matchScore:   prev.matchScore    || 0,
    }));
  }, []);

  // ── pushOptimisticApplication ────────────────────────────────
  const pushOptimisticApplication = useCallback((app) => {
    setApplications(prev => {
      if (prev.some(a => a.id === app.id)) return prev;
      return [{ ...app, _optimistic: true }, ...prev];
    });
  }, []);

  // ── pushOptimisticConnection ─────────────────────────────────
  const pushOptimisticConnection = useCallback((conn) => {
    setConnections(prev => {
      if (prev.some(c => c.id === conn.id)) return prev;
      return [{ ...conn, _optimistic: true }, ...prev];
    });
  }, []);

  // ── Firebase bootstrap ────────────────────────────────────────
  // FIX #1: empty deps [] — only wires up the auth listener once.
  // FIX #2: all Firestore reads happen AFTER auth user is confirmed.
  useEffect(() => {
    const cleanupListeners = () => {
      unsubRefs.current.jobs?.();
      unsubRefs.current.apps?.();
      unsubRefs.current.stats?.();
      unsubRefs.current.conns?.();
      unsubRefs.current = { jobs: null, apps: null, stats: null, conns: null };
    };

    const bootstrap = async () => {
      cleanupListeners();

      try {
        await initStats(DEFAULT_STATS);

        // FIX #2: getConnections/getResumes/getUserSettings called
        // safely here, inside the auth-confirmed branch.
        const [remoteResumes, remoteConns, remoteSettings] = await Promise.all([
          getResumes(),
          getConnections(),
          getUserSettings(),
        ]);

        if (remoteResumes.length > 0) setResumes(remoteResumes);
        if (remoteConns.length > 0)   setConnections(remoteConns);
        if (remoteSettings) {
          setUserSettings(remoteSettings);
          if (remoteSettings.botStatus) setBotStatus(remoteSettings.botStatus);
        }

        // Jobs listener
        unsubRefs.current.jobs = listenJobs(data => {
          setJobs(prev => {
            const fbIds    = new Set(data.map(j => String(j.id)));
            const demoOnly = DEFAULT_JOBS.filter(j => !fbIds.has(String(j.id)));
            return data.length > 0 ? [...data, ...demoOnly] : prev;
          });
        });

        // Applications listener — replace optimistic records with real ones
        unsubRefs.current.apps = listenApplications(data => {
          if (data.length > 0) setApplications(data);
        });

        // Connections listener
        unsubRefs.current.conns = listenConnections(data => {
          if (data.length > 0) setConnections(data);
        });

        // FIX #3: Stats listener debounced at 300ms
        // Prevents dozens of re-renders/second during SSE streaming
        let statsDebounceTimer = null;
        unsubRefs.current.stats = listenStats(data => {
          if (!data) return;
          if (statsDebounceTimer) clearTimeout(statsDebounceTimer);
          statsDebounceTimer = setTimeout(() => {
            setStatsRef.current({
              jobsFound:    data.jobsFound    ?? 0,
              applied:      data.applied      ?? 0,
              interviews:   data.interviews   ?? 0,
              connections:  data.connections  ?? 0,
              responseRate: data.responseRate ?? 0,
              matchScore:   data.matchScore   ?? 0,
            });
          }, 300);
        });

        firebaseReadyRef.current = true;
        setFirebaseReady(true);
        setFirebaseError(null);

        // Pull stats once immediately (via ref — avoids dep cycle)
        await forceRefreshRef.current();

      } catch (err) {
        console.warn('[AppContext] Firebase bootstrap error:', err.message);
        setFirebaseError(err.message);
        setFirebaseReady(false);
        firebaseReadyRef.current = false;
      }
    };

    const unsubAuth = onAuthStateChanged(auth, user => {
      if (user) {
        bootstrap();
      } else {
        cleanupListeners();
        firebaseReadyRef.current = false;
        setFirebaseReady(false);
        setFirebaseError('Please sign in to connect to Firebase.');
        // Reset all state on logout
        setStats(DEFAULT_STATS);
        setApplications([]);
        setConnections([]);
        setResumes([]);
        setUserSettings({});
      }
    });

    return () => {
      unsubAuth();
      cleanupListeners();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Notifications ────────────────────────────────────────────
  const addNotification = useCallback((notif) => {
    setNotifications(prev => [
      { id: Date.now(), read: false, time: 'just now', ...notif },
      ...prev,
    ]);
  }, []);

  const markAllRead = useCallback(() => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  }, []);

  // ── Application actions ──────────────────────────────────────
  const updateApplicationStatus = useCallback(async (id, status) => {
    setApplications(prev => prev.map(a => a.id === id ? { ...a, status } : a));
    if (firebaseReadyRef.current) {
      try { await fbUpdateAppStatus(String(id), status); } catch (e) { console.warn(e); }
    }
  }, []);

  const applyToJob = useCallback(async (jobId) => {
    const job = jobs.find(j => j.id === jobId);
    if (!job) return;

    const newApp = {
      id:        `app_${Date.now()}`,
      title:     job.title,
      company:   job.company,
      status:    'applied',
      date:      new Date().toISOString().split('T')[0],
      resume:    'resume-v3.pdf',
      score:     job.score,
      createdAt: new Date().toISOString(),
    };

    // Optimistic UI updates
    setJobs(prev => prev.map(j => j.id === jobId ? { ...j, status: 'applied' } : j));
    setApplications(prev => [newApp, ...prev]);
    setStats(prev => ({
      ...prev,
      applied:   (prev.applied   || 0) + 1,
      jobsFound: Math.max(prev.jobsFound || 0, jobs.length),
    }));
    addNotification({ type: 'success', message: `Applied to ${job.title} @ ${job.company}`, time: 'just now' });

    if (firebaseReadyRef.current) {
      try {
        await Promise.all([
          addApplication(newApp),
          markJobApplied(String(jobId)),
          incrementStat('applied'),
          logActivity({
            type: 'application',
            message: `Auto-applied to ${job.title} @ ${job.company}`,
            icon: '📝',
            color: 'rgba(0,230,118,0.12)',
          }),
        ]);
        setTimeout(() => forceRefreshRef.current(), 1500);
      } catch (e) { console.warn('Firebase sync error:', e); }
    }
  }, [jobs, addNotification]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Resume actions ───────────────────────────────────────────
  const handleSetResumes = useCallback((updaterOrArray) => {
    setResumes(updaterOrArray);
  }, []);

  const handleSetDefaultResume = useCallback(async (id) => {
    setResumes(prev => prev.map(r => ({ ...r, default: r.id === id })));
    if (firebaseReadyRef.current) {
      try { await setDefaultResume(String(id)); } catch (e) { console.warn(e); }
    }
  }, []);

  const handleDeleteResume = useCallback(async (id) => {
    setResumes(prev => prev.filter(r => r.id !== id));
    if (firebaseReadyRef.current) {
      try { await fbDeleteResume(String(id)); } catch (e) { console.warn(e); }
    }
  }, []);

  // ── Settings ─────────────────────────────────────────────────
  const persistSettings = useCallback(async (settings) => {
    setUserSettings(settings);
    if (firebaseReadyRef.current) {
      try { await saveSettings(settings); } catch (e) { console.warn(e); }
    }
  }, []);

  const unreadCount = notifications.filter(n => !n.read).length;

  return (
    <AppContext.Provider value={{
      firebaseReady,
      firebaseError,

      activePage, setActivePage,
      botStatus, setBotStatus,
      notifications, unreadCount, addNotification, markAllRead,

      // FIX #4: setStats correctly exported
      stats, setStats,
      forceRefreshStats,
      optimisticStatUpdate,

      jobs, setJobs, applyToJob,
      applications, setApplications,
      updateApplicationStatus,
      pushOptimisticApplication,

      resumes, setResumes: handleSetResumes,
      setDefaultResume: handleSetDefaultResume,
      deleteResume: handleDeleteResume,

      connections, setConnections,
      pushOptimisticConnection,

      userSettings,
      persistSettings,
    }}>
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
};
