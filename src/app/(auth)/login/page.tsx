'use client';

import { useState, useEffect } from 'react';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [authReady, setAuthReady] = useState(false);
  const [isSignInMode, setIsSignInMode] = useState(true);
  const router = useRouter();

  // Check if auth is ready
  useEffect(() => {
    if (typeof window !== 'undefined') {
      // Give a moment for Firebase to initialize
      const timer = setTimeout(() => {
        setAuthReady(true);
      }, 100);
      return () => clearTimeout(timer);
    }
  }, []);

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email || !password) {
      setError('Please enter both email and password.');
      return;
    }
    
    if (!auth) {
      setError('Firebase authentication is not configured. Please check your environment variables.');
      return;
    }

    setIsLoading(true);
    setError('');
    setMessage('');

    try {
      await signInWithEmailAndPassword(auth, email, password);
      setMessage('Signed in successfully! Redirecting...');
      setTimeout(() => router.push('/editor'), 500);
    } catch (error: any) {
      console.log('Sign in error:', error.code, error.message);
      setError(getAuthErrorMessage(error));
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email || !password) {
      setError('Please enter both email and password.');
      return;
    }
    
    if (!auth) {
      setError('Firebase authentication is not configured. Please check your environment variables.');
      return;
    }

    setIsLoading(true);
    setError('');
    setMessage('');

    try {
      await createUserWithEmailAndPassword(auth, email, password);
      setMessage('Account created successfully! Redirecting...');
      setTimeout(() => router.push('/editor'), 500);
    } catch (error: any) {
      console.log('Account creation error:', error.code, error.message);
      setError(getAuthErrorMessage(error));
    } finally {
      setIsLoading(false);
    }
  };

  // Helper function to get user-friendly error messages
  const getAuthErrorMessage = (error: any): string => {
    switch (error.code) {
      case 'auth/wrong-password':
        return 'Incorrect password. Please try again.';
      case 'auth/invalid-email':
        return 'Invalid email address format.';
      case 'auth/user-disabled':
        return 'This account has been disabled. Please contact support.';
      case 'auth/too-many-requests':
        return 'Too many failed attempts. Please try again later.';
      case 'auth/weak-password':
        return 'Password should be at least 6 characters long.';
      case 'auth/email-already-in-use':
        return 'An account with this email already exists.';
      case 'auth/operation-not-allowed':
        return 'Email/password accounts are not enabled. Please contact support.';
      case 'auth/network-request-failed':
        return 'Network error. Please check your internet connection.';
      case 'auth/internal-error':
        return 'Internal error occurred. Please try again.';
      default:
        return `Authentication failed: ${error.message || 'Unknown error'}`;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center py-12 px-4">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <h2 className="text-3xl font-bold text-gray-900">Welcome to WordWise</h2>
          <p className="mt-2 text-gray-600">AI-powered writing assistant</p>
        </div>

        {/* Mode Toggle */}
        <div className="flex bg-gray-100 rounded-lg p-1">
          <button
            type="button"
            onClick={() => {
              setIsSignInMode(true);
              setError('');
              setMessage('');
            }}
            className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
              isSignInMode
                ? 'bg-white text-blue-600 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Sign In
          </button>
          <button
            type="button"
            onClick={() => {
              setIsSignInMode(false);
              setError('');
              setMessage('');
            }}
            className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
              !isSignInMode
                ? 'bg-white text-blue-600 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Create Account
          </button>
        </div>
        
        <form className="mt-8 space-y-6" onSubmit={isSignInMode ? handleSignIn : handleCreateAccount}>
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
              Email Address
            </label>
            <input
              id="email"
              type="email"
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Enter your email address"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={isLoading}
            />
          </div>
          
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
              Password
            </label>
            <input
              id="password"
              type="password"
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder={isSignInMode ? "Enter your password" : "Choose a password (min 6 characters)"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={isLoading}
              minLength={6}
            />
          </div>

          {error && (
            <div 
              className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg" 
              role="alert"
              aria-live="assertive"
            >
              <div className="flex items-start">
                <svg 
                  className="w-5 h-5 mr-3 mt-0.5 flex-shrink-0 text-red-600" 
                  fill="currentColor" 
                  viewBox="0 0 20 20"
                  aria-hidden="true"
                >
                  <path 
                    fillRule="evenodd" 
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" 
                    clipRule="evenodd" 
                  />
                </svg>
                <div>
                  <h4 className="font-medium text-red-800">Authentication Error</h4>
                  <p className="text-sm text-red-700 mt-1">{error}</p>
                </div>
              </div>
            </div>
          )}

          {message && (
            <div 
              className="bg-green-50 border border-green-200 text-green-800 px-4 py-3 rounded-lg"
              role="status" 
              aria-live="polite"
            >
              <div className="flex items-center">
                <svg 
                  className="w-5 h-5 mr-3 flex-shrink-0 text-green-600" 
                  fill="currentColor" 
                  viewBox="0 0 20 20"
                  aria-hidden="true"
                >
                  <path 
                    fillRule="evenodd" 
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" 
                    clipRule="evenodd" 
                  />
                </svg>
                <span className="font-medium">{message}</span>
              </div>
            </div>
          )}

          <button
            type="submit"
            disabled={isLoading || !email || !password || !authReady}
            className="w-full py-2 px-4 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {!authReady ? 'Initializing...' : isLoading ? 'Signing in...' : 'Sign In / Create Account'}
          </button>
          
          {/* Debug info */}
          <div className="text-xs text-gray-400 text-center">
            Email: {email ? '✓' : '✗'} | Password: {password ? '✓' : '✗'} | Auth: {authReady ? '✓' : '✗'}
          </div>
          
          <div className="text-center">
            <p className="text-xs text-gray-500">
              New to WordWise? Don't worry! We'll automatically create your account
              <br />
              if you don't have one yet. Just enter your email and choose a password.
            </p>
          </div>
        </form>
      </div>
    </div>
  );
} 