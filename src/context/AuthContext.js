// ================================================================
//  AuthContext.js — Authentication + User Profile + Admin Access
// ================================================================
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  updateProfile,
  sendPasswordResetEmail,
  GoogleAuthProvider,
  signInWithPopup,
} from 'firebase/auth';
import {
  doc, setDoc, getDoc, serverTimestamp,
} from 'firebase/firestore';
import { auth, db } from '../firebase/config';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [currentUser, setCurrentUser] = useState(null);
  const [userProfile, setUserProfile] = useState(null); // Firestore profile
  const [isAdmin, setIsAdmin] = useState(false);
  const [authLoading, setAuthLoading] = useState(true);
  const [authError, setAuthError] = useState('');

  // ── Load Firestore profile ────────────────────────────────────
  // NOTE: createUserProfile is defined below but referenced here via closure.
  // We use a ref to avoid stale closure issues with useCallback.
  const createUserProfileRef = React.useRef(null);

  const loadUserProfile = useCallback(async (user) => {
    try {
      const ref = doc(db, 'users', user.uid);
      const snap = await getDoc(ref);
      if (snap.exists()) {
        const data = snap.data();
        // Verify role against adminConfig — prevents any user faking admin
        const role = await verifyRole(user.uid, data.role || 'member');
        setUserProfile({ ...data, role });
        setIsAdmin(role === 'admin');
        // Update last login
        await setDoc(ref, { lastLogin: serverTimestamp() }, { merge: true });
      } else {
        // First login — create profile (via ref to avoid stale closure)
        if (createUserProfileRef.current) await createUserProfileRef.current(user, {});
      }
    } catch (err) {
      console.warn('Could not load user profile:', err.message);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Watch auth state ──────────────────────────────────────────
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);
      if (user) {
        await loadUserProfile(user);
      } else {
        setUserProfile(null);
        setIsAdmin(false);
      }
      setAuthLoading(false);
    });
    return unsub;
  }, [loadUserProfile]);

  // ── Create Firestore user doc ──────────────────────────────
  const createUserProfile = async (user, extra = {}) => {
    const ref = doc(db, 'users', user.uid);
    const snap = await getDoc(ref);

    // Check if this is the very first user → make them admin
    const isFirstUser = !(await checkAnyUserExists());

    const profile = {
      uid: user.uid,
      email: user.email,
      displayName: user.displayName || extra.displayName || '',
      photoURL: user.photoURL || '',
      role: isFirstUser ? 'admin' : 'member',
      createdAt: serverTimestamp(),
      lastLogin: serverTimestamp(),
      plan: 'free',
      botStatus: 'idle',
      ...extra,
    };

    if (!snap.exists()) {
      // Brand new user — save profile
      await setDoc(ref, profile);
      if (profile.role === 'admin') {
        await lockAdminSlot(user.uid, user.email);
      }
      setUserProfile(profile);
      setIsAdmin(profile.role === 'admin');
      return profile;
    } else {
      // Existing user — verify role against adminConfig, never overwrite
      const existingData = snap.data();
      const role = await verifyRole(user.uid, existingData.role || 'member');
      await setDoc(ref, { lastLogin: serverTimestamp() }, { merge: true });
      setUserProfile({ ...existingData, role });
      setIsAdmin(role === 'admin');
      return existingData;
    }
  };

  // Keep the ref pointing to the latest createUserProfile (avoids stale closure in loadUserProfile)
  createUserProfileRef.current = createUserProfile;

  // ── Check if admin already exists ─────────────────────────────
  const checkAnyUserExists = async () => {
    try {
      const adminDoc = await getDoc(doc(db, 'meta', 'adminConfig'));
      return adminDoc.exists() && adminDoc.data().adminAssigned === true;
    } catch {
      return false;
    }
  };

  // ── Verify role against adminConfig (anti-tampering) ─────────
  const verifyRole = async (uid, storedRole) => {
    try {
      const adminDoc = await getDoc(doc(db, 'meta', 'adminConfig'));
      if (adminDoc.exists()) {
        const adminUid = adminDoc.data().adminUid;
        // Only the locked admin UID can be admin
        if (storedRole === 'admin' && uid !== adminUid) {
          // Fix corrupted role back to member
          const userRef = doc(db, 'users', uid);
          await setDoc(userRef, { role: 'member' }, { merge: true });
          return 'member';
        }
        return uid === adminUid ? 'admin' : storedRole;
      }
      // No adminConfig exists yet — allow first admin
      return storedRole;
    } catch (err) {
      console.warn('verifyRole error (defaulting to stored role):', err.message);
      return storedRole;
    }
  };

  // ── Lock in the one admin forever ────────────────────────────
  const lockAdminSlot = async (uid, email) => {
    await setDoc(doc(db, 'meta', 'adminConfig'), {
      adminAssigned: true,
      adminUid: uid,
      adminEmail: email,
      assignedAt: serverTimestamp(),
    });
  };

  // ── Sign Up ───────────────────────────────────────────────────
  const signUp = async (email, password, displayName) => {
    setAuthError('');
    try {
      const cred = await createUserWithEmailAndPassword(auth, email, password);
      await updateProfile(cred.user, { displayName });
      await createUserProfile(cred.user, { displayName });

      // Note: admin slot is handled inside createUserProfile
      return { success: true };
    } catch (err) {
      const msg = getFriendlyError(err.code);
      setAuthError(msg);
      return { success: false, error: msg };
    }
  };

  // ── Sign In with Email ────────────────────────────────────────
  const signIn = async (email, password) => {
    setAuthError('');
    try {
      await signInWithEmailAndPassword(auth, email, password);
      return { success: true };
    } catch (err) {
      const msg = getFriendlyError(err.code);
      setAuthError(msg);
      return { success: false, error: msg };
    }
  };

  // ── Sign In with Google ───────────────────────────────────────
  const signInWithGoogle = async () => {
    setAuthError('');
    try {
      const provider = new GoogleAuthProvider();
      const cred = await signInWithPopup(auth, provider);
      await createUserProfile(cred.user, {});
      return { success: true };
    } catch (err) {
      const msg = getFriendlyError(err.code);
      setAuthError(msg);
      return { success: false, error: msg };
    }
  };

  // ── Sign Out ─────────────────────────────────────────────────
  const logOut = async () => {
    await signOut(auth);
    setUserProfile(null);
    setIsAdmin(false);
  };

  // ── Reset Password ────────────────────────────────────────────
  const resetPassword = async (email) => {
    try {
      await sendPasswordResetEmail(auth, email);
      return { success: true };
    } catch (err) {
      return { success: false, error: getFriendlyError(err.code) };
    }
  };

  // ── Friendly error messages ───────────────────────────────────
  const getFriendlyError = (code) => {
    const map = {
      'auth/email-already-in-use': 'This email is already registered.',
      'auth/invalid-email': 'Please enter a valid email address.',
      'auth/weak-password': 'Password must be at least 6 characters.',
      'auth/user-not-found': 'No account found with this email.',
      'auth/wrong-password': 'Incorrect password. Please try again.',
      'auth/too-many-requests': 'Too many attempts. Please try again later.',
      'auth/popup-closed-by-user': 'Google sign-in was cancelled.',
      'auth/network-request-failed': 'Network error. Check your connection.',
    };
    return map[code] || 'Something went wrong. Please try again.';
  };

  return (
    <AuthContext.Provider value={{
      currentUser,
      userProfile,
      isAdmin,
      authLoading,
      authError,
      setAuthError,
      signUp,
      signIn,
      signInWithGoogle,
      logOut,
      resetPassword,
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};
