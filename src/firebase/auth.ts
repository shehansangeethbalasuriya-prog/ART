import {
  signInAnonymously as firebaseSignInAnonymously,
  signInWithPopup,
  GoogleAuthProvider,
  signOut as firebaseSignOut,
  onAuthStateChanged as firebaseOnAuthStateChanged,
  updateProfile as firebaseUpdateProfile,
  User,
  Unsubscribe,
} from 'firebase/auth';
import { doc, setDoc, serverTimestamp, getDoc } from 'firebase/firestore';
import { auth, db } from './config';
import { UserProfile } from '../types';

const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({
  prompt: 'select_account',
});

export const signInAnonymously = async (): Promise<User> => {
  try {
    const credential = await firebaseSignInAnonymously(auth);
    await createUserProfile(credential.user);
    return credential.user;
  } catch (error) {
    console.error('Anonymous sign-in failed:', error);
    throw new Error(getAuthErrorMessage(error));
  }
};

export const signInWithGoogle = async (): Promise<User> => {
  try {
    const credential = await signInWithPopup(auth, googleProvider);
    await createUserProfile(credential.user);
    return credential.user;
  } catch (error) {
    console.error('Google sign-in failed:', error);
    throw new Error(getAuthErrorMessage(error));
  }
};

export const signOut = async (): Promise<void> => {
  try {
    const user = auth.currentUser;
    if (user) {
      await setDoc(
        doc(db, 'users', user.uid),
        {
          lastSeen: serverTimestamp(),
          isOnline: false,
        },
        { merge: true }
      );
    }
    await firebaseSignOut(auth);
  } catch (error) {
    console.error('Sign-out failed:', error);
    throw new Error(getAuthErrorMessage(error));
  }
};

export const onAuthStateChanged = (
  callback: (user: User | null) => void
): Unsubscribe => {
  return firebaseOnAuthStateChanged(auth, callback);
};

export const getCurrentUser = (): User | null => {
  return auth.currentUser;
};

export const updateProfile = async (
  updates: Partial<Pick<UserProfile, 'displayName' | 'photoURL'>>
): Promise<void> => {
  const user = auth.currentUser;
  if (!user) {
    throw new Error('No authenticated user');
  }

  try {
    await firebaseUpdateProfile(user, updates);
    await setDoc(
      doc(db, 'users', user.uid),
      {
        ...updates,
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );
  } catch (error) {
    console.error('Profile update failed:', error);
    throw new Error(getAuthErrorMessage(error));
  }
};

const createUserProfile = async (user: User): Promise<void> => {
  const userRef = doc(db, 'users', user.uid);
  const userSnap = await getDoc(userRef);

  if (!userSnap.exists()) {
    const profile: Omit<UserProfile, 'id'> = {
      uid: user.uid,
      displayName: user.displayName ?? 'Anonymous',
      email: user.email,
      photoURL: user.photoURL,
      color: '#' + Math.floor(Math.random() * 16777215).toString(16).padStart(6, '0'),
      createdAt: Date.now(),
      lastSeen: Date.now(),
    };

    await setDoc(userRef, profile);
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
      default:
        return error.message || 'An authentication error occurred';
    }
  }
  return 'An unexpected error occurred';
};
