import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import {
  auth,
  db,
  googleProvider,
  signInWithPopup,
  signInAnonymously,
  signOut,
  onAuthStateChanged,
  User,
} from '../lib/firebase';
import { doc, setDoc } from 'firebase/firestore';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  signInWithGoogle: () => Promise<User | null>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  signInWithGoogle: async () => null,
  logout: async () => {},
});

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (!currentUser) {
        try {
          await signInAnonymously(auth);
          return;
        } catch (anonErr) {
          console.warn('Anonymous sign-in notice:', anonErr);
        }
      }

      setUser(currentUser);
      setLoading(false);

      if (currentUser) {
        // Sync user profile to Firestore
        try {
          await setDoc(
            doc(db, 'users', currentUser.uid),
            {
              id: currentUser.uid,
              name: currentUser.displayName || 'Family Member',
              email: currentUser.email || '',
              avatar:
                currentUser.photoURL ||
                'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=256&h=256&q=80',
              createdAt: new Date().toISOString(),
              lastLoginAt: new Date().toISOString(),
            },
            { merge: true }
          );
        } catch (err) {
          console.warn('Could not sync user profile to Firestore:', err);
        }
      }
    });

    return () => unsubscribe();
  }, []);

  const signInWithGoogle = async (): Promise<User | null> => {
    try {
      const result = await signInWithPopup(auth, googleProvider);
      return result.user;
    } catch (err: any) {
      console.error('Google sign-in error:', err);
      if (err.code === 'auth/popup-closed-by-user') {
        console.log('User closed popup');
      } else {
        alert(`Google Sign-In notice: ${err.message || 'Popup blocked or canceled.'}`);
      }
      return null;
    }
  };

  const logout = async () => {
    try {
      await signOut(auth);
      setUser(null);
    } catch (err) {
      console.error('Logout error:', err);
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, signInWithGoogle, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
