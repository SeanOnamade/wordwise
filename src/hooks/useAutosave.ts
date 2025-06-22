import { useEffect, useRef, useState, useCallback } from 'react';
import { auth } from '@/lib/firebase';

interface UseAutosaveProps {
  docId: string;
  content: string;
  title: string;
  createdAt: Date | null;
  enabled?: boolean;
}

interface SavedState {
  content: string;
  title: string;
}

export function useAutosave({ docId, content, title, createdAt, enabled = true }: UseAutosaveProps) {
  const timeoutRef = useRef<NodeJS.Timeout>();
  const lastSavedRef = useRef<SavedState>({ content, title });
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const forceSave = useCallback(async (overrideData?: { content: string; title: string }) => {
    if (!enabled || !docId || !auth?.currentUser) {
      console.log('📝 Force save skipped - conditions not met');
      return;
    }

    const contentToSave = overrideData?.content ?? content;
    const titleToSave = overrideData?.title ?? title;

    try {
      setIsSaving(true);
      setError(null);

      console.log('📝 Force saving document...', {
        docId,
        userId: auth.currentUser?.uid,
        contentLength: contentToSave.length,
        title: titleToSave,
      });

      const response = await fetch('/api/saveDoc', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: auth.currentUser?.uid,
          docId,
          title: titleToSave,
          content: contentToSave,
          createdAt: createdAt && !lastSaved ? createdAt : undefined,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to save document');
      }

      console.log('✅ Document force-saved successfully', {
        docId,
        length: contentToSave.length,
        title: titleToSave,
        timestamp: new Date().toISOString(),
      });

      lastSavedRef.current = { content: contentToSave, title: titleToSave };
      setLastSaved(new Date());
    } catch (err) {
      const error = err as Error;
      console.error('🔥 Force save FAILED', {
        error: {
          name: error.name,
          message: error.message,
          stack: error.stack,
        },
        docId,
        contentLength: contentToSave.length,
        title: titleToSave,
        timestamp: new Date().toISOString(),
      });
      setError(error.message);
    } finally {
      setIsSaving(false);
    }
  }, [docId, content, title, createdAt, enabled, lastSaved]);

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

        console.log('📝 Attempting to save document...', {
          docId,
          userId: auth.currentUser?.uid,
          contentLength: content.length,
          title,
        });

        const response = await fetch('/api/saveDoc', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            userId: auth.currentUser?.uid,
            docId,
            title,
            content,
            createdAt: createdAt && !lastSaved ? createdAt : undefined,
          }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Failed to save document');
        }

        console.log('✅ Document saved successfully', { 
          docId, 
          length: content.length,
          title,
          timestamp: new Date().toISOString()
        });
        
        lastSavedRef.current = { content, title };
        setLastSaved(new Date());
      } catch (err) {
        const error = err as Error;
        console.error('🔥 Document save FAILED', {
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
  }, [docId, content, title, createdAt, enabled]);

  return {
    lastSaved,
    isSaving,
    error,
    forceSave
  };
} 