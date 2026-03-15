// ================================================================
//  firebaseService.js — All Firestore operations for LinkedAI
//  Collections:
//    /jobs          — scraped job listings
//    /applications  — submitted applications
//    /resumes       — resume metadata
//    /connections   — LinkedIn connection log
//    /stats         — aggregated dashboard stats
//    /activityFeed  — bot activity log
//    /settings      — user preferences (single doc)
// ================================================================

import {
  collection, doc, getDoc, getDocs, setDoc, addDoc,
  updateDoc, deleteDoc, onSnapshot, query, orderBy,
  limit, where, serverTimestamp, writeBatch, increment,
} from 'firebase/firestore';
import { db, auth } from './config';

// ─── HELPERS ────────────────────────────────────────────────────

/** Remove undefined values — Firestore rejects them */
const strip = (obj) => JSON.parse(JSON.stringify(obj));

/** Get current user's UID — throws if not logged in */
const uid = () => {
  const user = auth.currentUser;
  if (!user) throw new Error('Not authenticated');
  return user.uid;
};

// ─── JOBS ────────────────────────────────────────────────────────

export const saveJob = async (job) => {
  const userId = uid();
  const ref = job.id
    ? doc(db, 'jobs', String(job.id))
    : doc(collection(db, 'jobs'));
  await setDoc(ref, strip({ ...job, userId, updatedAt: serverTimestamp() }), { merge: true });
  return ref.id;
};

export const getJobs = async () => {
  const userId = uid();
  const snap = await getDocs(
    query(collection(db, 'jobs'), where('userId', '==', userId), orderBy('score', 'desc'))
  );
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
};

export const listenJobs = (callback) => {
  const userId = uid();
  // Try with ordering first; fall back to unordered if index missing
  const q = query(
    collection(db, 'jobs'),
    where('userId', '==', userId),
    orderBy('score', 'desc'),
    limit(100)
  );
  let fallbackUnsub = null;
  const unsub = onSnapshot(q,
    snap => callback(snap.docs.map(d => ({ id: d.id, ...d.data() }))),
    (err) => {
      console.warn('listenJobs index missing, using fallback:', err.message);
      // Fallback: no ordering (works without composite index)
      const fallback = query(collection(db, 'jobs'), where('userId', '==', userId), limit(100));
      fallbackUnsub = onSnapshot(fallback, snap => callback(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
    }
  );
  // Return a combined unsubscribe that cleans up both listeners
  return () => { unsub(); fallbackUnsub?.(); };
};

export const markJobApplied = async (jobId) => {
  await updateDoc(doc(db, 'jobs', String(jobId)), {
    status: 'applied',
    appliedAt: serverTimestamp(),
  });
};

// ─── APPLICATIONS ────────────────────────────────────────────────

export const addApplication = async (app) => {
  const userId = uid();
  const ref = await addDoc(collection(db, 'applications'), strip({
    ...app,
    userId,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  }));
  return ref.id;
};

export const getApplications = async () => {
  const userId = uid();
  const snap = await getDocs(
    query(
      collection(db, 'applications'),
      where('userId', '==', userId),
      orderBy('createdAt', 'desc')
    )
  );
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
};

export const listenApplications = (callback) => {
  const userId = uid();
  const q = query(
    collection(db, 'applications'),
    where('userId', '==', userId),
    orderBy('createdAt', 'desc'),
    limit(200)
  );
  let fallbackUnsub = null;
  const unsub = onSnapshot(q,
    snap => callback(snap.docs.map(d => ({ id: d.id, ...d.data() }))),
    (err) => {
      console.warn('listenApplications index missing, using fallback:', err.message);
      const fallback = query(collection(db, 'applications'), where('userId', '==', userId), limit(200));
      fallbackUnsub = onSnapshot(fallback, snap => callback(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
    }
  );
  return () => { unsub(); fallbackUnsub?.(); };
};

export const updateApplicationStatus = async (appId, status) => {
  await updateDoc(doc(db, 'applications', String(appId)), {
    status,
    updatedAt: serverTimestamp(),
  });
};

// ─── RESUMES ─────────────────────────────────────────────────────

export const saveResume = async (resume) => {
  const userId = uid();
  const ref = resume.id
    ? doc(db, 'resumes', String(resume.id))
    : doc(collection(db, 'resumes'));
  await setDoc(ref, strip({ ...resume, userId, updatedAt: serverTimestamp() }), { merge: true });
  return ref.id;
};

export const getResumes = async () => {
  const userId = uid();
  const snap = await getDocs(
    query(collection(db, 'resumes'), where('userId', '==', userId))
  );
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
};

export const setDefaultResume = async (resumeId) => {
  const userId = uid();
  const snap = await getDocs(
    query(collection(db, 'resumes'), where('userId', '==', userId))
  );
  const batch = writeBatch(db);
  snap.docs.forEach(d => {
    batch.update(d.ref, { default: d.id === resumeId });
  });
  await batch.commit();
};

export const deleteResume = async (resumeId) => {
  await deleteDoc(doc(db, 'resumes', String(resumeId)));
};

// ─── CONNECTIONS ─────────────────────────────────────────────────

export const addConnection = async (connection) => {
  const userId = uid();
  const ref = await addDoc(collection(db, 'connections'), strip({
    ...connection,
    userId,
    createdAt: serverTimestamp(),
  }));
  return ref.id;
};

export const getConnections = async () => {
  const userId = uid();
  const snap = await getDocs(
    query(
      collection(db, 'connections'),
      where('userId', '==', userId),
      orderBy('createdAt', 'desc')
    )
  );
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
};

export const listenConnections = (callback) => {
  const userId = uid();
  const q = query(
    collection(db, 'connections'),
    where('userId', '==', userId),
    orderBy('createdAt', 'desc'),
    limit(200)
  );
  let fallbackUnsub = null;
  const unsub = onSnapshot(q,
    snap => callback(snap.docs.map(d => ({ id: d.id, ...d.data() }))),
    (err) => {
      console.warn('listenConnections index missing, using fallback:', err.message);
      const fallback = query(collection(db, 'connections'), where('userId', '==', userId), limit(200));
      fallbackUnsub = onSnapshot(fallback, snap => callback(snap.docs.map(d => ({ id: d.id, ...d.data() }))));      
    }
  );
  return () => { unsub(); fallbackUnsub?.(); };
};

export const updateConnectionStatus = async (connectionId, status) => {
  await updateDoc(doc(db, 'connections', String(connectionId)), {
    status,
    updatedAt: serverTimestamp(),
  });
};

// ─── STATS ───────────────────────────────────────────────────────
// Stats are stored per-user: /stats/{uid}

export const initStats = async (defaults) => {
  const userId = uid();
  const ref = doc(db, 'stats', userId);
  const snap = await getDoc(ref);
  if (!snap.exists()) {
    await setDoc(ref, strip({ ...defaults, updatedAt: serverTimestamp() }));
  }
};

export const getStats = async () => {
  const userId = uid();
  const snap = await getDoc(doc(db, 'stats', userId));
  return snap.exists() ? snap.data() : null;
};

export const incrementStat = async (field, amount = 1) => {
  const userId = uid();
  const ref = doc(db, 'stats', userId);
  await updateDoc(ref, {
    [field]: increment(amount),
    updatedAt: serverTimestamp(),
  });
};

/** Atomically add delta values to multiple stat fields at once */
export const batchIncrementStats = async (deltas = {}) => {
  const userId = uid();
  const ref = doc(db, 'stats', userId);
  const updates = { updatedAt: serverTimestamp() };
  Object.entries(deltas).forEach(([k, v]) => {
    if (v && v > 0) updates[k] = increment(v);
  });
  await updateDoc(ref, updates);
};

/** Overwrite specific stat fields with absolute values */
export const setStatsAbsolute = async (fields = {}) => {
  const userId = uid();
  const ref = doc(db, 'stats', userId);
  await updateDoc(ref, { ...fields, updatedAt: serverTimestamp() });
};

export const listenStats = (callback) => {
  const userId = uid();
  return onSnapshot(doc(db, 'stats', userId), snap => {
    if (snap.exists()) callback(snap.data());
  });
};

// ─── ACTIVITY FEED ───────────────────────────────────────────────

export const logActivity = async (event) => {
  const userId = uid();
  await addDoc(collection(db, 'activityFeed'), strip({
    ...event,
    userId,
    createdAt: serverTimestamp(),
  }));
};

export const getActivityFeed = async () => {
  const userId = uid();
  const snap = await getDocs(
    query(
      collection(db, 'activityFeed'),
      where('userId', '==', userId),
      orderBy('createdAt', 'desc'),
      limit(50)
    )
  );
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
};

export const listenActivityFeed = (callback) => {
  const userId = uid();
  const q = query(
    collection(db, 'activityFeed'),
    where('userId', '==', userId),
    orderBy('createdAt', 'desc'),
    limit(50)
  );
  return onSnapshot(q, snap =>
    callback(snap.docs.map(d => ({ id: d.id, ...d.data() })))
  );
};

// ─── SETTINGS ────────────────────────────────────────────────────
// Settings stored per-user: /settings/{uid}

export const saveSettings = async (settings) => {
  const userId = uid();
  await setDoc(
    doc(db, 'settings', userId),
    strip({ ...settings, updatedAt: serverTimestamp() }),
    { merge: true }
  );
};

export const getUserSettings = async () => {
  const userId = uid();
  const snap = await getDoc(doc(db, 'settings', userId));
  return snap.exists() ? snap.data() : null;
};
