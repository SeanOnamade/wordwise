import { create } from 'zustand';
import { Editor } from '@tiptap/react';

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
})); 