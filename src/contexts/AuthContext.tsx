import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User } from 'firebase/auth';
import { AuthService, AuthUser } from '@/lib/auth-service';
import { auth } from '@/lib/firebase';

interface AuthContextType {
  currentUser: User | null;
  userData: AuthUser | null;
  isAdmin: boolean;
  isAdminResolved: boolean;
  isLoading: boolean;
  signOut: () => Promise<void>;
  refreshUserData: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [userData, setUserData] = useState<AuthUser | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isAdminResolved, setIsAdminResolved] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const refreshUserData = async () => {
    if (currentUser) {
      try {
        const userData = await AuthService.getUserData(currentUser.uid);
        setUserData(userData);
        
        if (userData) {
          const adminStatus = await AuthService.isAdmin(currentUser.uid);
          setIsAdmin(adminStatus);
        }
      } catch (error) {
        console.error('Error refreshing user data:', error);
      }
    }
  };

  const signOut = async () => {
    try {
      AuthService.clearPendingAuthRedirect();
      await AuthService.signOut();
      setCurrentUser(null);
      setUserData(null);
      setIsAdmin(false);
      setIsAdminResolved(false);
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  useEffect(() => {
    let isActive = true;

    const loadUserProfile = async (user: User) => {
      setIsAdminResolved(false);
      try {
        let profile = await AuthService.getUserData(user.uid);

        if (!isActive || auth.currentUser?.uid !== user.uid) {
          return;
        }

        if (!profile) {
          profile = {
            uid: user.uid,
            email: user.email || '',
            displayName: user.displayName || 'User',
            role: 'user',
            createdAt: new Date(),
            score: 0,
            badge: '👤 New Citizen',
            totalReports: 0,
            acceptedReports: 0,
            rejectedReports: 0,
            isRecommended: false,
          } as AuthUser;

          try {
            await AuthService.createUserDocument(user.uid, profile);
          } catch (firestoreError) {
            console.warn('Firestore temporarily unavailable, using local data:', firestoreError);
          }
        }

        if (!isActive || auth.currentUser?.uid !== user.uid) {
          return;
        }

        setUserData(profile);

        try {
          const adminStatus = await AuthService.isAdmin(user.uid);

          if (!isActive || auth.currentUser?.uid !== user.uid) {
            return;
          }

          setIsAdmin(adminStatus);
          setIsAdminResolved(true);

          if (profile.role !== (adminStatus ? 'admin' : 'user')) {
            setUserData({ ...profile, role: adminStatus ? 'admin' : 'user' });
          }
        } catch (adminCheckError) {
          console.warn('Admin check failed, defaulting to user role:', adminCheckError);
          if (isActive && auth.currentUser?.uid === user.uid) {
            setIsAdmin(false);
            setIsAdminResolved(true);
          }
        }
      } catch (error) {
        console.error('Error in AuthContext:', error);

        if (!isActive || auth.currentUser?.uid !== user.uid) {
          return;
        }

        const fallbackUserData = {
          uid: user.uid,
          email: user.email || '',
          displayName: user.displayName || 'User',
          role: 'user' as const,
          createdAt: new Date(),
          score: 0,
          badge: '👤 New Citizen',
          totalReports: 0,
          acceptedReports: 0,
          rejectedReports: 0,
          isRecommended: false,
        };

        setUserData(fallbackUserData);

        try {
          const adminStatus = await AuthService.isAdmin(user.uid);
          if (!isActive || auth.currentUser?.uid !== user.uid) {
            return;
          }
          setIsAdmin(adminStatus);
          setIsAdminResolved(true);
          if (adminStatus) {
            setUserData({ ...fallbackUserData, role: 'admin' });
          }
        } catch (adminCheckError) {
          console.error('Error checking admin status:', adminCheckError);
          if (isActive && auth.currentUser?.uid === user.uid) {
            setIsAdmin(false);
            setIsAdminResolved(true);
          }
        }
      }
    };

    const unsubscribe = AuthService.onAuthStateChanged(async (user) => {
      if (!isActive) {
        return;
      }

      setCurrentUser(user);

      if (user) {
        await loadUserProfile(user);
      } else {
        setUserData(null);
        setIsAdmin(false);
        setIsAdminResolved(true);
      }

      if (isActive) {
        setIsLoading(false);
      }
    });

    void AuthService.completeGoogleRedirectSignIn().catch((error) => {
      // Redirect flow can fail in some storage-partitioned environments.
      // Popup is the primary flow; this is best-effort only.
      console.warn('Google redirect sign-in failed (ignored):', error);
      AuthService.clearPendingAuthRedirect();
    });

    return () => {
      isActive = false;
      unsubscribe();
    };
  }, []);

  const value: AuthContextType = {
    currentUser,
    userData,
    isAdmin,
    isAdminResolved,
    isLoading,
    signOut,
    refreshUserData,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
