import { create } from 'zustand';
import { Editor } from '@tiptap/react';
import { SmartReview, SmartReviewState } from '@/types/SmartReview';

export type Suggestion = {
  id: string;
  type: 'spelling' | 'grammar' | 'style' | 'smart';
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
  // Separated suggestion types
  grammarSuggestions: Suggestion[];
  smartReviewSuggestions: Suggestion[];
  // Legacy suggestions property for backward compatibility
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
  // Grammar suggestion methods
  addGrammarSuggestion: (suggestion: Suggestion) => void;
  updateGrammarSuggestionStatus: (id: string, status: 'applied' | 'dismissed') => void;
  clearGrammarSuggestions: () => void;
  updateGrammarSuggestions: (suggestions: Suggestion[]) => void;
  updateGrammarSuggestionRanges: (appliedFrom: number, lengthDiff: number, appliedSuggestionId: string) => void;
  // Smart review suggestion methods
  addSmartReviewSuggestion: (suggestion: Suggestion) => void;
  updateSmartReviewSuggestionStatus: (id: string, status: 'applied' | 'dismissed') => void;
  clearSmartReviewSuggestions: () => void;
  updateSmartReviewSuggestionRanges: (appliedFrom: number, lengthDiff: number, appliedSuggestionId: string) => void;
  // Legacy methods for backward compatibility
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
  updateSmartReviewIssueStatus: (issueId: string, status: 'applied' | 'dismissed') => void;
  updateSuggestions: (suggestions: Suggestion[]) => void;
  // Combined getters
  getAllSuggestions: () => Suggestion[];
  getActiveSuggestions: () => Suggestion[];
}

export const useEditorStore = create<EditorState>((set, get) => ({
  editor: null,
  grammarSuggestions: [],
  smartReviewSuggestions: [],
  suggestions: [], // Legacy property
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
  
  // Grammar suggestion methods
  addGrammarSuggestion: (sug) => {
    console.log('🟢 ADD GRAMMAR', sug.ruleKey, sug.range, sug.status);
    set((state) => ({
      grammarSuggestions: [
        ...state.grammarSuggestions,
        { ...sug, status: sug.status || 'new' },
      ],
    }));
  },
  updateGrammarSuggestionStatus: (id, status: 'applied' | 'dismissed') =>
    set((state) => ({
      grammarSuggestions: state.grammarSuggestions.map((s) =>
        s.id === id ? { ...s, status } : s
      ),
    })),
  clearGrammarSuggestions: () => {
    console.log('🧹 Clearing grammar suggestions');
    set({ grammarSuggestions: [] });
  },
  updateGrammarSuggestions: (suggestions) => {
    console.log('📝 Updating grammar suggestions:', suggestions.length);
    set(() => ({ grammarSuggestions: suggestions }));
  },
  updateGrammarSuggestionRanges: (appliedFrom: number, lengthDiff: number, appliedSuggestionId: string) =>
    set((state) => ({
      grammarSuggestions: state.grammarSuggestions.map((suggestion) => {
        if (suggestion.id === appliedSuggestionId || suggestion.status !== 'new') {
          return suggestion;
        }
        if (suggestion.range.from > appliedFrom) {
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

  // Smart review suggestion methods
  addSmartReviewSuggestion: (sug) => {
    console.log('🟢 ADD SMART REVIEW', sug.ruleKey, sug.range, sug.status);
    set((state) => ({
      smartReviewSuggestions: [
        ...state.smartReviewSuggestions,
        { ...sug, status: sug.status || 'new' },
      ],
    }));
  },
  updateSmartReviewSuggestionStatus: (id, status: 'applied' | 'dismissed') =>
    set((state) => ({
      smartReviewSuggestions: state.smartReviewSuggestions.map((s) =>
        s.id === id ? { ...s, status } : s
      ),
    })),
  clearSmartReviewSuggestions: () => {
    console.log('🧹 Clearing smart review suggestions');
    set({ smartReviewSuggestions: [] });
  },
  updateSmartReviewSuggestionRanges: (appliedFrom: number, lengthDiff: number, appliedSuggestionId: string) =>
    set((state) => ({
      smartReviewSuggestions: state.smartReviewSuggestions.map((suggestion) => {
        if (suggestion.id === appliedSuggestionId || suggestion.status !== 'new') {
          return suggestion;
        }
        if (suggestion.range.from > appliedFrom) {
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

  // Legacy methods for backward compatibility
  addSuggestion: (sug) => {
    if (sug.type === 'smart') {
      get().addSmartReviewSuggestion(sug);
    } else {
      get().addGrammarSuggestion(sug);
    }
    // Also update legacy suggestions array
    set((state) => ({
      suggestions: [
        ...state.suggestions,
        { ...sug, status: sug.status || 'new' },
      ],
    }));
  },
  updateSuggestionStatus: (id, status: 'applied' | 'dismissed') => {
    const state = get();
    const grammarSug = state.grammarSuggestions.find(s => s.id === id);
    const smartSug = state.smartReviewSuggestions.find(s => s.id === id);
    
    if (grammarSug) {
      get().updateGrammarSuggestionStatus(id, status);
    }
    if (smartSug) {
      get().updateSmartReviewSuggestionStatus(id, status);
    }
    
    // Also update legacy suggestions array
    set((state) => ({
      suggestions: state.suggestions.map((s) =>
        s.id === id ? { ...s, status } : s
      ),
    }));
  },

  // Combined getters
  getAllSuggestions: () => {
    const state = get();
    return [...state.grammarSuggestions, ...state.smartReviewSuggestions];
  },
  getActiveSuggestions: () => {
    const state = get();
    const activeGrammar = state.grammarSuggestions.filter(s => s.status === 'new');
    const activeSmart = state.smartReviewSuggestions.filter(s => s.status === 'new');
    return [...activeGrammar, ...activeSmart];
  },

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
      currentDoc: doc
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
  clearSuggestions: () => {
    set({ 
      suggestions: [],
      grammarSuggestions: [],
      smartReviewSuggestions: []
    });
  },
  updateSuggestionRanges: (appliedFrom: number, lengthDiff: number, appliedSuggestionId: string) => {
    get().updateGrammarSuggestionRanges(appliedFrom, lengthDiff, appliedSuggestionId);
    get().updateSmartReviewSuggestionRanges(appliedFrom, lengthDiff, appliedSuggestionId);
    
    // Also update legacy suggestions array
    set((state) => ({
      suggestions: state.suggestions.map((suggestion) => {
        if (suggestion.id === appliedSuggestionId || suggestion.status !== 'new') {
          return suggestion;
        }
        if (suggestion.range.from > appliedFrom) {
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
    }));
  },
  runSmartReview: async (content: string) => {
    console.log('🔄 Starting Smart Review...');
    
    set((state) => ({
      smartReview: {
        ...state.smartReview,
        loading: true,
        error: undefined,
        isOpen: true,
        data: null,
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

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || `Smart Review API error: ${response.status}`);
      }

      if (!data || !data.metrics || !data.issues || !data.suggestions) {
        console.error('Invalid Smart Review response:', data);
        throw new Error('Invalid response from Smart Review API');
      }

      console.log('✅ Smart Review data received:', {
        metrics: Object.keys(data.metrics),
        issueCount: data.issues.length,
        suggestionCount: data.suggestions.length
      });

      set((state) => ({
        smartReview: {
          ...state.smartReview,
          data: data,
          loading: false,
          error: undefined,
          isOpen: true,
        },
      }));
    } catch (error) {
      console.error('❌ Smart Review error:', error);
      set((state) => ({
        smartReview: {
          ...state.smartReview,
          data: null,
          loading: false,
          error: error instanceof Error ? error.message : 'Failed to generate smart review',
          isOpen: true,
        },
      }));
      throw error;
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
  updateSmartReviewIssueStatus: (issueId: string, status: 'applied' | 'dismissed') =>
    set((state) => ({
      smartReview: {
        ...state.smartReview,
        data: state.smartReview.data ? {
          ...state.smartReview.data,
          issues: state.smartReview.data.issues.map(issue =>
            issue.id === issueId ? { ...issue, status } : issue
          )
        } : null
      }
    })),
  updateSuggestions: (suggestions) => {
    // Split suggestions by type
    const grammarSugs = suggestions.filter(s => s.type !== 'smart');
    const smartSugs = suggestions.filter(s => s.type === 'smart');
    
    console.log('📝 Updating suggestions (split):', {
      grammar: grammarSugs.length,
      smart: smartSugs.length,
      total: suggestions.length
    });
    
    set(() => ({
      suggestions, // Legacy
      grammarSuggestions: grammarSugs,
      smartReviewSuggestions: smartSugs
    }));
  },
})); 