import { create } from 'zustand';
import { Editor } from '@tiptap/react';
import { SmartReview, SmartReviewState } from '@/types/SmartReview';

export type Suggestion = {
  id: string;
  type: 'spelling' | 'grammar' | 'style';
  ruleKey: string;
  original: string;
  replacements: string[];
  explanation: string;
  range: { from: number; to: number };
  status: 'new' | 'applied' | 'dismissed';
};

interface Document {
  id: string;
  title: string;
  content: string;
  lastModified?: Date;
  createdAt?: Date;
}

interface EditorState {
  editor: Editor | null;
  suggestions: Suggestion[];
  wordCount: number;
  performanceMetrics: {
    totalChecks: number;
    lastResponseTime: number;
  };
  currentDoc: Document | null;
  documents: Document[];
  smartReview: SmartReviewState;
  setEditor: (editor: Editor | null) => void;
  addSuggestion: (suggestion: Suggestion) => void;
  updateSuggestionStatus: (id: string, status: 'applied' | 'dismissed') => void;
  setCurrentDoc: (doc: Document | null) => void;
  setDocuments: (docs: Document[]) => void;
  addDocument: (doc: Document) => void;
  updateDocument: (doc: Document) => void;
  removeDocument: (docId: string) => void;
  createNewDocument: () => Document;
  setWordCount: (count: number) => void;
  updatePerformanceMetrics: (responseTime: number) => void;
  clearSuggestions: () => void;
  updateSuggestionRanges: (appliedFrom: number, lengthDiff: number, appliedSuggestionId: string) => void;
  runSmartReview: (content: string) => Promise<void>;
  closeSmartReview: () => void;
  setSmartReviewLoading: (loading: boolean) => void;
  setSmartReviewError: (error: string | undefined) => void;
}

export const useEditorStore = create<EditorState>((set, get) => ({
  editor: null,
  suggestions: [],
  wordCount: 0,
  performanceMetrics: {
    totalChecks: 0,
    lastResponseTime: 0,
  },
  currentDoc: null,
  documents: [],
  smartReview: {
    data: null,
    isOpen: false,
    loading: false,
    error: undefined,
  },
  setEditor: (editor) => set({ editor }),
  addSuggestion: (sug) => {
    // TEMP LOG – remove after working
    console.log('🟢 ADD', sug.ruleKey, sug.range, sug.status);
    set((state) => ({
      suggestions: [
        ...state.suggestions,
        { ...sug, status: sug.status || 'new' },
      ],
    }));
  },
  updateSuggestionStatus: (id, status: 'applied' | 'dismissed') =>
    set((state) => ({
      suggestions: state.suggestions.map((s) =>
        s.id === id ? { ...s, status } : s
      ),
    })),
  setCurrentDoc: (doc) => {
    console.log('📝 Updating document in store:', {
      id: doc?.id,
      title: doc?.title,
      contentLength: doc?.content?.length,
      timestamp: new Date().toISOString()
    });
    set({ currentDoc: doc });
  },
  setDocuments: (docs) => set({ documents: docs }),
  addDocument: (doc) => 
    set((state) => ({
      documents: [doc, ...state.documents],
      currentDoc: doc // Automatically set as current doc
    })),
  updateDocument: (doc) =>
    set((state) => ({
      documents: state.documents.map((d) =>
        d.id === doc.id ? { ...d, ...doc } : d
      ),
      currentDoc: state.currentDoc?.id === doc.id ? doc : state.currentDoc
    })),
  removeDocument: (docId) =>
    set((state) => ({
      documents: state.documents.filter((d) => d.id !== docId),
      currentDoc: state.currentDoc?.id === docId ? null : state.currentDoc,
    })),
  createNewDocument: () => {
    const creationDate = new Date();
    const newDoc: Document = {
      id: crypto.randomUUID(),
      title: 'Untitled Document',
      content: '',
      lastModified: creationDate,
      createdAt: creationDate,
    };
    
    console.log('📝 Creating new document in store:', newDoc.id);
    
    set((state) => ({
      documents: [newDoc, ...(state.documents || [])],
      currentDoc: newDoc,
    }));
    
    return newDoc;
  },
  setWordCount: (count) => set({ wordCount: count }),
  updatePerformanceMetrics: (responseTime) =>
    set((state) => ({
      performanceMetrics: {
        totalChecks: state.performanceMetrics.totalChecks + 1,
        lastResponseTime: responseTime,
      },
    })),
  clearSuggestions: () => set({ suggestions: [] }),
  updateSuggestionRanges: (appliedFrom: number, lengthDiff: number, appliedSuggestionId: string) =>
    set((state) => ({
      suggestions: state.suggestions.map((suggestion) => {
        // Skip the applied suggestion and already processed suggestions
        if (suggestion.id === appliedSuggestionId || suggestion.status !== 'new') {
          return suggestion;
        }
        
        // Only update suggestions that come after the applied position
        if (suggestion.range.from > appliedFrom) {
          console.log('📐 Updating suggestion range:', {
            id: suggestion.id,
            original: suggestion.original,
            oldRange: { from: suggestion.range.from, to: suggestion.range.to },
            lengthDiff
          });
          
          return {
            ...suggestion,
            range: {
              from: suggestion.range.from + lengthDiff,
              to: suggestion.range.to + lengthDiff
            }
          };
        }
        
        return suggestion;
      })
    })),
  runSmartReview: async (content: string) => {
    set((state) => ({
      smartReview: {
        ...state.smartReview,
        loading: true,
        error: undefined,
        isOpen: true,
      },
    }));

    try {
      const response = await fetch('/api/smart-review', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ content }),
      });

      if (!response.ok) {
        throw new Error(`Smart Review API error: ${response.status}`);
      }

      const smartReviewData: SmartReview = await response.json();

      set((state) => ({
        smartReview: {
          ...state.smartReview,
          data: smartReviewData,
          loading: false,
        },
      }));
    } catch (error) {
      console.error('Smart Review error:', error);
      set((state) => ({
        smartReview: {
          ...state.smartReview,
          loading: false,
          error: error instanceof Error ? error.message : 'Failed to generate smart review',
        },
      }));
    }
  },
  closeSmartReview: () =>
    set((state) => ({
      smartReview: {
        ...state.smartReview,
        isOpen: false,
      },
    })),
  setSmartReviewLoading: (loading) =>
    set((state) => ({
      smartReview: {
        ...state.smartReview,
        loading,
      },
    })),
  setSmartReviewError: (error) =>
    set((state) => ({
      smartReview: {
        ...state.smartReview,
        error,
      },
    })),
})); 