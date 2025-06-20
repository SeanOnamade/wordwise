import { useEffect, useRef } from 'react';
import { doc, setDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';

interface UseAutosaveProps {
  docId: string;
  content: string;
  enabled?: boolean;
}

export function useAutosave({ docId, content, enabled = true }: UseAutosaveProps) {
  const timeoutRef = useRef<NodeJS.Timeout>();
  const lastSavedRef = useRef<string>(content);

  useEffect(() => {
    if (!enabled || !docId || content === lastSavedRef.current) {
      return;
    }

    // Clear existing timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    // Set new timeout for 2s debounce
    timeoutRef.current = setTimeout(async () => {
      try {
        console.log('📝 Starting autosave...', { docId, contentLength: content.length });
        
        const docRef = doc(db, 'documents', docId);
        await setDoc(docRef, {
          content,
          lastModified: new Date().toISOString()
        }, { merge: true });
        
        console.log('✅ Document autosaved successfully:', docId);
        lastSavedRef.current = content;
      } catch (error) {
        console.error('❌ Autosave failed:', {
          error,
          docId,
          contentLength: content.length
        });
      }
    }, 2000);

    // Cleanup timeout on unmount or content change
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [docId, content, enabled]);

  return {
    lastSaved: lastSavedRef.current
  };
} 