'use client';

import { initializeApp, getApps } from 'firebase/app';
import { getAuth, sendSignInLinkToEmail, isSignInWithEmailLink, signInWithEmailLink } from 'firebase/auth';
import { getFirestore, setLogLevel } from 'firebase/firestore';

// Disable Firebase Performance for now to avoid errors
const isProduction = process.env.NEXT_PUBLIC_ENV === 'prod';

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

// Initialize Firebase only on client side
let app: any = null;
let auth: any = null;
let db: any = null;

if (typeof window !== 'undefined') {
  try {
    app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
    auth = getAuth(app);
    db = getFirestore(app);
    
    console.log('✅ Firebase client initialized successfully');
    
    // Enable Firestore debug logging in development
    if (!isProduction) {
      setLogLevel('debug');
    }
  } catch (error) {
    console.error('Error initializing Firebase:', error);
  }
}

// Simplified performance monitoring (no Firebase Performance SDK)
export const createPerformanceTrace = (traceName: string) => {
  // Return a simple mock trace object for now
  return {
    putAttribute: () => {},
    start: () => {},
    stop: () => {}
  };
};

// Performance monitoring for specific operations
export const performanceMonitor = {
  // Grammar check performance
  grammarCheck: (startTime: number, endTime: number, wordCount: number, suggestionCount: number) => {
    console.log('📊 Grammar check performance:', {
      duration: endTime - startTime,
      wordCount,
      suggestionCount
    });
  },

  // Document save performance
  documentSave: (startTime: number, endTime: number, docSize: number) => {
    console.log('📊 Document save performance:', {
      duration: endTime - startTime,
      docSize
    });
  },

  // Export performance
  documentExport: (startTime: number, endTime: number, format: string, docSize: number) => {
    console.log('📊 Document export performance:', {
      duration: endTime - startTime,
      format,
      docSize
    });
  },

  // Editor performance
  editorPerformance: (action: string, duration: number, contextData?: Record<string, string>) => {
    console.log('📊 Editor performance:', {
      action,
      duration,
      ...contextData
    });
  },

  // Authentication performance
  authPerformance: (action: string, startTime: number, endTime: number, success: boolean) => {
    console.log('📊 Auth performance:', {
      action,
      duration: endTime - startTime,
      success
    });
  }
};

// Track errors for monitoring
export const trackError = (error: Error, context?: Record<string, any>) => {
  console.error('Application error:', {
    error: {
      name: error.name,
      message: error.message,
      stack: error.stack
    },
    context,
    timestamp: new Date().toISOString()
  });
};

export const sendSignInLink = async (email: string) => {
  const actionCodeSettings = {
    url: `${window.location.origin}/editor`,
    handleCodeInApp: true,
  };

  try {
    await sendSignInLinkToEmail(auth, email, actionCodeSettings);
    window.localStorage.setItem('emailForSignIn', email);
    return { success: true };
  } catch (error) {
    console.error('Error sending sign in link:', error);
    trackError(error as Error, { action: 'send_signin_link', email });
    return { success: false, error };
  }
};

export const confirmSignIn = async (email: string) => {
  if (isSignInWithEmailLink(auth, window.location.href)) {
    try {
      await signInWithEmailLink(auth, email, window.location.href);
      window.localStorage.removeItem('emailForSignIn');
      return { success: true };
    } catch (error) {
      console.error('Error signing in with email link:', error);
      trackError(error as Error, { action: 'confirm_signin', email });
      return { success: false, error };
    }
  }
  return { success: false, error: 'Invalid sign-in link' };
};

export { app, auth, db }; 