import { useState, useEffect, useCallback, useRef } from 'react';
import {
  signInAnonymously as firebaseSignInAnonymously,
  signInWithPopup,
  GoogleAuthProvider,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  updateProfile as firebaseUpdateProfile,
  User as FirebaseUser,
} from 'firebase/auth';
import { doc, setDoc, getDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../firebase/config';
import { useAppStore } from '../store/useAppStore';

interface UseAuthReturn {
  user: FirebaseUser | null;
  isLoading: boolean;
  signInAnonymously: () => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
  updateProfile: (updates: { displayName?: string; photoURL?: string }) => Promise<void>;
  error: string | null;
}

const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

const createUserProfile = async (user: FirebaseUser): Promise<void> => {
  const userRef = doc(db, 'users', user.uid);
  const userSnap = await getDoc(userRef);

  if (!userSnap.exists()) {
    await setDoc(userRef, {
      uid: user.uid,
      displayName: user.displayName || (user.isAnonymous ? `User ${user.uid.slice(0, 6)}` : null),
      email: user.email,
      photoURL: user.photoURL,
      isAnonymous: user.isAnonymous,
      isOnline: true,
      createdAt: serverTimestamp(),
      lastSeen: serverTimestamp(),
    });
  } else {
    await setDoc(
      userRef,
      {
        lastSeen: serverTimestamp(),
        isOnline: true,
      },
      { merge: true }
    );
  }
};

const getAuthErrorMessage = (error: unknown): string => {
  if (error instanceof Error) {
    const code = (error as { code?: string }).code;
    switch (code) {
      case 'auth/user-not-found':
        return 'No account found with this email';
      case 'auth/wrong-password':
        return 'Incorrect password';
      case 'auth/email-already-in-use':
        return 'Email already in use';
      case 'auth/invalid-email':
        return 'Invalid email address';
      case 'auth/operation-not-allowed':
        return 'This sign-in method is not enabled';
      case 'auth/popup-closed-by-user':
        return 'Sign-in popup was closed';
      case 'auth/popup-blocked':
        return 'Sign-in popup was blocked by the browser';
      case 'auth/network-request-failed':
        return 'Network error. Please check your connection';
      case 'auth/too-many-requests':
        return 'Too many attempts. Please try again later';
      case 'auth/user-disabled':
        return 'This account has been disabled';
      default:
        return error.message || 'An authentication error occurred';
    }
  }
  return 'An unexpected error occurred';
};

export function useAuth(): UseAuthReturn {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const user = useAppStore((s) => s.user.currentUser);
  const setUser = useAppStore((s) => s.setUser);

  const unsubRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(
      auth,
        async (firebaseUser) => {
        setUser(firebaseUser as any);

        if (firebaseUser) {
          try {
            await createUserProfile(firebaseUser);
          } catch (err) {
            console.error('Failed to create/update user profile:', err);
          }
        }

        setIsLoading(false);
      },
      (err) => {
        console.error('Auth state change error:', err);
        setError('Authentication state error');
        setIsLoading(false);
      }
    );

    unsubRef.current = unsubscribe;

    return () => {
      if (unsubRef.current) {
        unsubRef.current();
      }
    };
  }, [setUser]);

  const signInAnonymously = useCallback(async (): Promise<void> => {
    setIsLoading(true);
    setError(null);

    try {
      const credential = await firebaseSignInAnonymously(auth);
      await createUserProfile(credential.user);
    } catch (err) {
      const message = getAuthErrorMessage(err);
      setError(message);
      throw new Error(message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const signInWithGoogle = useCallback(async (): Promise<void> => {
    setIsLoading(true);
    setError(null);

    try {
      const credential = await signInWithPopup(auth, googleProvider);
      await createUserProfile(credential.user);
    } catch (err) {
      const message = getAuthErrorMessage(err);
      setError(message);
      throw new Error(message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const signOut = useCallback(async (): Promise<void> => {
    setIsLoading(true);
    setError(null);

    try {
      const currentUser = auth.currentUser;
      if (currentUser) {
        const userRef = doc(db, 'users', currentUser.uid);
        await setDoc(
          userRef,
          {
            lastSeen: serverTimestamp(),
            isOnline: false,
          },
          { merge: true }
        );
      }

      await firebaseSignOut(auth);
      setUser(null);
    } catch (err) {
      const message = getAuthErrorMessage(err);
      setError(message);
      throw new Error(message);
    } finally {
      setIsLoading(false);
    }
  }, [setUser]);

  const updateProfile = useCallback(
    async (updates: { displayName?: string; photoURL?: string }): Promise<void> => {
      const currentUser = auth.currentUser;
      if (!currentUser) {
        throw new Error('No authenticated user');
      }

      setError(null);

      try {
        await firebaseUpdateProfile(currentUser, updates);
        await setDoc(
          doc(db, 'users', currentUser.uid),
          {
            ...updates,
            updatedAt: serverTimestamp(),
          },
          { merge: true }
        );
      } catch (err) {
        const message = getAuthErrorMessage(err);
        setError(message);
        throw new Error(message);
      }
    },
    []
  );

  return {
    user: user as any,
    isLoading,
    signInAnonymously,
    signInWithGoogle,
    signOut,
    updateProfile,
    error,
  };
}

export default useAuth;
