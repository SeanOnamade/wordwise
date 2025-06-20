import { useEffect, useRef, useState } from 'react';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';

interface UseAutosaveProps {
  docId: string;
  content: string;
  title: string;
  enabled?: boolean;
}

interface SavedState {
  content: string;
  title: string;
}

export function useAutosave({ docId, content, title, enabled = true }: UseAutosaveProps) {
  const timeoutRef = useRef<NodeJS.Timeout>();
  const lastSavedRef = useRef<SavedState>({ content, title });
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Early return if conditions aren't met
    if (!enabled) {
      console.log('📝 Autosave disabled');
      return;
    }
    if (!docId) {
      console.log('📝 No document ID provided');
      return;
    }
    if (!auth?.currentUser) {
      console.log('📝 No authenticated user');
      return;
    }

    // Check if either content or title has changed
    const contentChanged = content !== lastSavedRef.current.content;
    const titleChanged = title !== lastSavedRef.current.title;
    
    if (!contentChanged && !titleChanged) {
      console.log('📝 No changes detected, skipping save');
      return;
    }

    // Early return if Firestore isn't initialized
    if (!db) {
      console.error('🔥 Firestore write FAILED: Firestore not initialized');
      setError('Firestore not initialized');
      return;
    }

    console.log('📝 Starting autosave cycle...', {
      docId,
      contentLength: content.length,
      title,
      changes: {
        content: contentChanged,
        title: titleChanged
      }
    });

    // Clear existing timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    // Set new timeout for 2s debounce
    const saveTimeout = setTimeout(async () => {
      try {
        setIsSaving(true);
        setError(null);

        // Double-check Firestore is still initialized
        if (!db) {
          throw new Error('Firestore not initialized');
        }
        
        const docRef = doc(db, 'documents', docId);
        const data = {
          ownerUid: auth.currentUser?.uid,
          title,
          content,
          updatedAt: serverTimestamp() // Changed from lastModified to match our schema
        };

        console.log('📝 Attempting Firestore write...', {
          docId,
          userId: auth.currentUser?.uid,
          contentLength: content.length,
          title
        });

        await setDoc(docRef, data, { merge: true });

        console.log('✅ Firestore write SUCCESS', { 
          docId, 
          length: content.length,
          title,
          timestamp: new Date().toISOString()
        });
        
        lastSavedRef.current = { content, title };
        setLastSaved(new Date());
      } catch (err) {
        const error = err as Error;
        console.error('🔥 Firestore write FAILED', {
          error: {
            name: error.name,
            message: error.message,
            stack: error.stack
          },
          docId,
          contentLength: content.length,
          title,
          timestamp: new Date().toISOString()
        });
        setError(error.message);
      } finally {
        setIsSaving(false);
      }
    }, 2000);

    // Store the timeout ref for cleanup
    timeoutRef.current = saveTimeout;

    // Cleanup timeout on unmount or content change
    return () => {
      clearTimeout(saveTimeout);
    };
  }, [docId, content, title, enabled]);

  return {
    lastSaved,
    isSaving,
    error
  };
} 