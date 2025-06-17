'use client';

import { useEffect, useState } from 'react';
import { User } from 'firebase/auth';
import { signOut } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { useRouter } from 'next/navigation';
import EditorShell from './EditorShell';
import { useEditorStore } from '@/store/editorStore';

export const dynamic = 'force-dynamic';

export default function EditorPage() {
  const router = useRouter();
  const { setCurrentDoc, clearSuggestions } = useEditorStore();
  const [isClient, setIsClient] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  // Ensure we're on the client side before accessing auth
  useEffect(() => {
    setIsClient(true);
    
    if (typeof window !== 'undefined' && auth) {
      // Initialize auth state manually on client side
      const unsubscribe = auth.onAuthStateChanged((user: User | null) => {
        setUser(user);
        setLoading(false);
      }, (error: Error) => {
        setError(error);
        setLoading(false);
      });

      return () => unsubscribe();
    } else {
      setLoading(false);
    }
  }, []);

  // Redirect to login if not authenticated
  useEffect(() => {
    if (isClient && !loading && !user) {
      router.push('/login');
    }
  }, [isClient, user, loading, router]);

  const handleSignOut = async () => {
    if (!auth) return;
    
    try {
      await signOut(auth);
      // Clear editor state on logout
      setCurrentDoc(null);
      clearSuggestions();
      router.push('/login');
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  if (!isClient || loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-600">Authentication error: {error.message}</p>
          <button
            onClick={() => router.push('/login')}
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            Go to Login
          </button>
        </div>
      </div>
    );
  }

  if (!user) {
    return null; // Will redirect to login
  }

  return (
    <EditorShell user={user} onSignOut={handleSignOut} />
  );
} 