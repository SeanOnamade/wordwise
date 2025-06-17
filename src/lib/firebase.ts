'use client';

import { initializeApp, getApps } from 'firebase/app';
import { getAuth, sendSignInLinkToEmail, isSignInWithEmailLink, signInWithEmailLink } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getPerformance, trace } from 'firebase/performance';

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
let perf: any = null;

if (typeof window !== 'undefined') {
  app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
  auth = getAuth(app);
  db = getFirestore(app);
  perf = getPerformance(app);
}

// Enhanced performance monitoring helper
export const createPerformanceTrace = (traceName: string) => {
  if (perf && typeof window !== 'undefined') {
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
    const trace = createPerformanceTrace('grammar_check_performance');
    if (trace) {
      trace.putAttribute('word_count', wordCount.toString());
      trace.putAttribute('suggestion_count', suggestionCount.toString());
      trace.putAttribute('duration_ms', (endTime - startTime).toString());
      trace.start();
      setTimeout(() => trace.stop(), 0); // Stop immediately to record the duration
    }
  },

  // Document save performance
  documentSave: (startTime: number, endTime: number, docSize: number) => {
    const trace = createPerformanceTrace('document_save_performance');
    if (trace) {
      trace.putAttribute('document_size_chars', docSize.toString());
      trace.putAttribute('duration_ms', (endTime - startTime).toString());
      trace.start();
      setTimeout(() => trace.stop(), 0);
    }
  },

  // Export performance
  documentExport: (startTime: number, endTime: number, format: string, docSize: number) => {
    const trace = createPerformanceTrace('document_export_performance');
    if (trace) {
      trace.putAttribute('export_format', format);
      trace.putAttribute('document_size_chars', docSize.toString());
      trace.putAttribute('duration_ms', (endTime - startTime).toString());
      trace.start();
      setTimeout(() => trace.stop(), 0);
    }
  },

  // Editor performance
  editorPerformance: (action: string, duration: number, contextData?: Record<string, string>) => {
    const trace = createPerformanceTrace(`editor_${action}`);
    if (trace) {
      trace.putAttribute('action', action);
      trace.putAttribute('duration_ms', duration.toString());
      
      // Add any additional context data
      if (contextData) {
        Object.entries(contextData).forEach(([key, value]) => {
          trace.putAttribute(key, value);
        });
      }
      
      trace.start();
      setTimeout(() => trace.stop(), 0);
    }
  },

  // Authentication performance
  authPerformance: (action: string, startTime: number, endTime: number, success: boolean) => {
    const trace = createPerformanceTrace(`auth_${action}`);
    if (trace) {
      trace.putAttribute('auth_action', action);
      trace.putAttribute('success', success.toString());
      trace.putAttribute('duration_ms', (endTime - startTime).toString());
      trace.start();
      setTimeout(() => trace.stop(), 0);
    }
  }
};

// Error tracking integration with Sentry
export const trackError = (error: Error, context?: Record<string, any>) => {
  console.error('Error tracked:', error, context);
  
  // If Sentry is available, use it for error tracking
  if (typeof window !== 'undefined' && (window as any).Sentry) {
    (window as any).Sentry.captureException(error, {
      extra: context,
      tags: {
        component: 'firebase',
        environment: process.env.NODE_ENV
      }
    });
  }
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