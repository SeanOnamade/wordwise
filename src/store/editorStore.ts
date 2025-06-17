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
  currentDoc: {
    id: string;
    title: string;
    content: string;
  } | null;
  setEditor: (editor: Editor | null) => void;
  addSuggestion: (suggestion: Omit<Suggestion, 'id' | 'status'>) => void;
  updateSuggestionStatus: (id: string, status: 'accepted' | 'rejected') => void;
  setCurrentDoc: (doc: { id: string; title: string; content: string } | null) => void;
  clearSuggestions: () => void;
}

export const useEditorStore = create<EditorState>((set) => ({
  editor: null,
  suggestions: [],
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
  setCurrentDoc: (doc) => set({ currentDoc: doc }),
  clearSuggestions: () => set({ suggestions: [] }),
})); 