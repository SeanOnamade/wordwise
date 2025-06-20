import { create } from 'zustand';
import { Editor } from '@tiptap/react';

interface Suggestion {
  id: string;
  range: { from: number; to: number };
  type: 'grammar' | 'style' | 'spelling';
  original: string;
  replacement: string;
  ruleKey: string;
  explanation: string;
  status: 'pending' | 'accepted' | 'rejected';
}

interface EditorState {
  editor: Editor | null;
  suggestions: Suggestion[];
  wordCount: number;
  performanceMetrics: {
    totalChecks: number;
    lastResponseTime: number;
  };
  currentDoc: {
    id: string;
    title: string;
    content: string;
  } | null;
  setEditor: (editor: Editor | null) => void;
  addSuggestion: (suggestion: Omit<Suggestion, 'id' | 'status'>) => void;
  updateSuggestionStatus: (id: string, status: 'accepted' | 'rejected') => void;
  setCurrentDoc: (doc: { id: string; title: string; content: string } | null) => void;
  setWordCount: (count: number) => void;
  updatePerformanceMetrics: (responseTime: number) => void;
  clearSuggestions: () => void;
}

export const useEditorStore = create<EditorState>((set) => ({
  editor: null,
  suggestions: [],
  wordCount: 0,
  performanceMetrics: {
    totalChecks: 0,
    lastResponseTime: 0,
  },
  currentDoc: null,
  setEditor: (editor) => set({ editor }),
  addSuggestion: (suggestion) =>
    set((state) => ({
      suggestions: [
        ...state.suggestions,
        { ...suggestion, id: crypto.randomUUID(), status: 'pending' },
      ],
    })),
  updateSuggestionStatus: (id, status) =>
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
  setWordCount: (count) => set({ wordCount: count }),
  updatePerformanceMetrics: (responseTime) =>
    set((state) => ({
      performanceMetrics: {
        totalChecks: state.performanceMetrics.totalChecks + 1,
        lastResponseTime: responseTime,
      },
    })),
  clearSuggestions: () => set({ suggestions: [] }),
})); 