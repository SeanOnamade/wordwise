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
  setEditor: (editor: Editor | null) => void;
  addSuggestion: (suggestion: Omit<Suggestion, 'id' | 'status'>) => void;
  updateSuggestionStatus: (id: string, status: 'accepted' | 'rejected') => void;
  setCurrentDoc: (doc: Document | null) => void;
  setDocuments: (docs: Document[]) => void;
  addDocument: (doc: Document) => void;
  updateDocument: (doc: Document) => void;
  removeDocument: (docId: string) => void;
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
  documents: [],
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
      currentDoc: state.currentDoc?.id === docId ? null : state.currentDoc
    })),
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