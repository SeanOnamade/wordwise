'use client';

import { initializeApp, getApps, FirebaseApp } from 'firebase/app';
import { getAuth, sendSignInLinkToEmail, isSignInWithEmailLink, signInWithEmailLink, Auth } from 'firebase/auth';
import { getFirestore, setLogLevel, Firestore } from 'firebase/firestore';

// Helper function to clean environment variables
export const cleanEnv = (key: string) => process.env[key]?.trim() ?? '';

// Only import Performance in production
const isProduction = cleanEnv('NEXT_PUBLIC_ENV') === 'prod';
let getPerformance: typeof import('firebase/performance')['getPerformance'] | undefined;
let trace: typeof import('firebase/performance')['trace'] | undefined;
let perf: any = null; // We'll type this as any since Firebase Performance types are complex

if (typeof window !== 'undefined' && isProduction) {
  import('firebase/performance').then((performanceModule) => {
    getPerformance = performanceModule.getPerformance;
    trace = performanceModule.trace;
  });
}

const firebaseConfig = {
  apiKey: cleanEnv('NEXT_PUBLIC_FIREBASE_API_KEY'),
  authDomain: cleanEnv('NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN'),
  projectId: cleanEnv('NEXT_PUBLIC_FIREBASE_PROJECT_ID'),
  storageBucket: cleanEnv('NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET'),
  messagingSenderId: cleanEnv('NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID'),
  appId: cleanEnv('NEXT_PUBLIC_FIREBASE_APP_ID'),
};

// Initialize Firebase only once on client side
let app: FirebaseApp | null = null;
let auth: Auth | null = null;
let db: Firestore | null = null;

if (typeof window !== 'undefined' && getApps().length === 0) {
  try {
    app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    db = getFirestore(app);
    
    // Only initialize Performance in production
    if (isProduction && getPerformance) {
      perf = getPerformance(app);
    } else {
      console.log('🚫 Firebase Performance SDK disabled in development');
    }
    
    // Enable Firestore debug logging in development
    if (!isProduction) {
      setLogLevel('debug');
    }
  } catch (error) {
    console.error('Failed to initialize Firebase:', error);
  }
} else if (typeof window !== 'undefined') {
  // Get existing app instance
  app = getApps()[0];
  auth = getAuth(app);
  db = getFirestore(app);
  if (isProduction && getPerformance) {
    perf = getPerformance(app);
  }
}

// Enhanced performance monitoring helper
export const createPerformanceTrace = (traceName: string) => {
  if (perf && trace && typeof window !== 'undefined' && isProduction) {
    try {
      const traceInstance = trace(perf, traceName);
      
      // Add custom attributes for better tracking
      traceInstance.putAttribute('environment', process.env.NODE_ENV || 'development');
      traceInstance.putAttribute('timestamp', Date.now().toString());
      
      return traceInstance;
    } catch (error) {
      console.warn('Failed to create performance trace:', error);
      return null;
    }
  }
  return null;
};

// Performance monitoring for specific operations
export const performanceMonitor = {
  // Grammar check performance
  grammarCheck: (startTime: number, endTime: number, wordCount: number, suggestionCount: number) => {
    const traceInstance = createPerformanceTrace('grammar_check_performance');
    if (traceInstance) {
      traceInstance.putAttribute('word_count', wordCount.toString());
      traceInstance.putAttribute('suggestion_count', suggestionCount.toString());
      traceInstance.putAttribute('duration_ms', (endTime - startTime).toString());
      traceInstance.start();
      setTimeout(() => traceInstance.stop(), 0); // Stop immediately to record the duration
    }
  },

  // Document save performance
  documentSave: (startTime: number, endTime: number, docSize: number) => {
    const traceInstance = createPerformanceTrace('document_save_performance');
    if (traceInstance) {
      traceInstance.putAttribute('document_size_chars', docSize.toString());
      traceInstance.putAttribute('duration_ms', (endTime - startTime).toString());
      traceInstance.start();
      setTimeout(() => traceInstance.stop(), 0);
    }
  },

  // Export performance
  documentExport: (startTime: number, endTime: number, format: string, docSize: number) => {
    const traceInstance = createPerformanceTrace('document_export_performance');
    if (traceInstance) {
      traceInstance.putAttribute('export_format', format);
      traceInstance.putAttribute('document_size_chars', docSize.toString());
      traceInstance.putAttribute('duration_ms', (endTime - startTime).toString());
      traceInstance.start();
      setTimeout(() => traceInstance.stop(), 0);
    }
  },

  // Editor performance
  editorPerformance: (action: string, duration: number, contextData?: Record<string, string>) => {
    const traceInstance = createPerformanceTrace(`editor_${action}`);
    if (traceInstance) {
      traceInstance.putAttribute('action', action);
      traceInstance.putAttribute('duration_ms', duration.toString());
      
      // Add any additional context data
      if (contextData) {
        Object.entries(contextData).forEach(([key, value]) => {
          traceInstance.putAttribute(key, value);
        });
      }
      
      traceInstance.start();
      setTimeout(() => traceInstance.stop(), 0);
    }
  },

  // Authentication performance
  authPerformance: (action: string, startTime: number, endTime: number, success: boolean) => {
    const traceInstance = createPerformanceTrace(`auth_${action}`);
    if (traceInstance) {
      traceInstance.putAttribute('auth_action', action);
      traceInstance.putAttribute('success', success.toString());
      traceInstance.putAttribute('duration_ms', (endTime - startTime).toString());
      traceInstance.start();
      setTimeout(() => traceInstance.stop(), 0);
    }
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
  if (!auth) {
    throw new Error('Firebase auth not initialized');
  }

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
  if (!auth) {
    throw new Error('Firebase auth not initialized');
  }

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

export { app, auth, db, perf }; 