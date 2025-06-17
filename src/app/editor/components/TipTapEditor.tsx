'use client';

import { useEditor, EditorContent } from '@tiptap/react';
import { Extension } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import { Color } from '@tiptap/extension-color';
import { Highlight } from '@tiptap/extension-highlight';
import { useEffect, useRef, useCallback, useMemo } from 'react';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';

// Plugin key for suggestion highlights
const suggestionHighlightKey = new PluginKey('suggestionHighlight');

// Memoized decoration creation with performance optimizations
const createDecorations = (doc: any, suggestions: any[]): DecorationSet => {
  if (!doc || !suggestions?.length) {
    return DecorationSet.empty;
  }
  
  const decorations: Decoration[] = [];
  const pendingSuggestions = suggestions.filter(s => s.status === 'pending');
  
  // Batch decoration creation for better performance
  pendingSuggestions.forEach(suggestion => {
    const { range, type, id } = suggestion;
    const { from, to } = range;
    
    // Validate range bounds
    if (from >= 0 && to <= doc.content.size && from < to) {
      decorations.push(
        Decoration.inline(from, to, {
          class: `hl-${type} suggestion-highlight`,
          'data-suggestion-id': id,
          'data-suggestion-type': type,
          style: `background-color: ${getHighlightColor(type)};`
        })
      );
    }
  });
  
  return DecorationSet.create(doc, decorations);
};

// Performance-optimized highlight colors
const getHighlightColor = (type: string): string => {
  const colors = {
    grammar: 'rgba(239, 68, 68, 0.15)', // red-500 with 15% opacity
    style: 'rgba(245, 158, 11, 0.15)',  // amber-500 with 15% opacity
    spelling: 'rgba(59, 130, 246, 0.15)' // blue-500 with 15% opacity
  };
  return colors[type as keyof typeof colors] || colors.grammar;
};

// Create optimized suggestion highlight plugin
const createSuggestionHighlightPlugin = () => {
  let currentSuggestions: any[] = [];
  
  return new Plugin({
    key: suggestionHighlightKey,
    state: {
      init() {
        return DecorationSet.empty;
      },
      apply(tr, oldDecorations) {
        // Check if we need to update decorations
        const newSuggestions = tr.getMeta('suggestions');
        const forceUpdate = tr.getMeta('forceUpdate');
        
        if (newSuggestions !== undefined) {
          currentSuggestions = newSuggestions;
        }
        
        // Only recreate decorations if suggestions changed or forced update
        if (newSuggestions !== undefined || forceUpdate) {
          return createDecorations(tr.doc, currentSuggestions);
        }
        
        // Map existing decorations for document changes only
        if (tr.docChanged) {
          return oldDecorations.map(tr.mapping, tr.doc);
        }
        
        return oldDecorations;
      }
    },
    props: {
      decorations(state) {
        return this.getState(state);
      }
    }
  });
};

// Create extension that adds the plugin - memoized for performance
const SuggestionHighlightExtension = Extension.create({
  name: 'suggestionHighlight',
  addProseMirrorPlugins() {
    return [createSuggestionHighlightPlugin()];
  }
});

interface TipTapEditorProps {
  content?: string;
  suggestions: any[];
  onUpdate?: (content: string) => void;
  onTextChange?: (text: string) => void;
}

export default function TipTapEditor({
  content = '',
  suggestions = [],
  onUpdate,
  onTextChange
}: TipTapEditorProps) {
  
  const updateTimeoutRef = useRef<NodeJS.Timeout>();
  const lastSuggestionsRef = useRef<any[]>([]);
  
  // Memoized extensions array to prevent unnecessary re-creation
  const extensions = useMemo(() => [
    StarterKit.configure({
      // Optimize for performance
      history: {
        depth: 100, // Limit undo history for better performance
        newGroupDelay: 500,
      },
    }),
    Color,
    Highlight.configure({ 
      multicolor: true,
      HTMLAttributes: {
        class: 'custom-highlight',
      },
    }),
    SuggestionHighlightExtension,
  ], []); // Empty dependency array - these never change
  
  // Performance-optimized update handler
  const handleUpdate = useCallback(({ editor }: { editor: any }) => {
    // Debounce content updates to prevent excessive re-renders
    if (updateTimeoutRef.current) {
      clearTimeout(updateTimeoutRef.current);
    }
    
    updateTimeoutRef.current = setTimeout(() => {
      const html = editor.getHTML();
      const text = editor.getText();
      
      onUpdate?.(html);
      onTextChange?.(text);
    }, 100); // 100ms debounce for content updates
  }, [onUpdate, onTextChange]);
  
  // Create editor with performance optimizations
  const editor = useEditor({
    extensions,
    content,
    onUpdate: handleUpdate,
    editorProps: {
      attributes: {
        class: 'prose prose-lg max-w-none focus:outline-none min-h-[400px] p-4 editor-content',
        'data-placeholder': 'Start writing...',
        spellcheck: 'false', // Disable browser spellcheck for better performance
      },
      // Performance optimization: limit DOM updates
      transformPastedHTML: (html) => {
        // Basic HTML sanitization for performance
        return html.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
      },
    },
    // Optimize editor creation
    immediatelyRender: false,
    shouldRerenderOnTransaction: false, // Prevent unnecessary re-renders
  });

  // Optimized suggestions update with deep comparison
  useEffect(() => {
    if (!editor) return;
    
    // Deep comparison to avoid unnecessary updates
    const suggestionsChanged = JSON.stringify(suggestions) !== JSON.stringify(lastSuggestionsRef.current);
    
    if (suggestionsChanged) {
      lastSuggestionsRef.current = suggestions;
      
      // Update decorations efficiently
      const { view } = editor;
      const tr = view.state.tr;
      tr.setMeta('suggestions', suggestions);
      tr.setMeta('forceUpdate', true);
      view.dispatch(tr);
    }
  }, [editor, suggestions]);
  
  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (updateTimeoutRef.current) {
        clearTimeout(updateTimeoutRef.current);
      }
    };
  }, []);

  if (!editor) {
    return (
      <div className="bg-white rounded-lg shadow-lg overflow-hidden animate-pulse">
        <div className="border-b p-3 bg-gray-100"></div>
        <div className="p-4 space-y-3">
          <div className="h-4 bg-gray-200 rounded w-3/4"></div>
          <div className="h-4 bg-gray-200 rounded w-1/2"></div>
          <div className="h-4 bg-gray-200 rounded w-5/6"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-lg overflow-hidden">
      <div className="border-b p-3 bg-gray-50">
        <div className="flex items-center space-x-2">
          <button
            onClick={() => editor.chain().focus().undo().run()}
            disabled={!editor.can().undo()}
            className="p-2 rounded hover:bg-gray-100 disabled:opacity-50 transition-colors"
            title="Undo (Ctrl+Z)"
          >
            ↶
          </button>
          <button
            onClick={() => editor.chain().focus().redo().run()}
            disabled={!editor.can().redo()}
            className="p-2 rounded hover:bg-gray-100 disabled:opacity-50 transition-colors"
            title="Redo (Ctrl+Y)"
          >
            ↷
          </button>
          <div className="w-px h-6 bg-gray-300"></div>
          <button
            onClick={() => editor.chain().focus().toggleBold().run()}
            className={`p-2 rounded transition-colors ${
              editor.isActive('bold') ? 'bg-blue-100 text-blue-700' : 'hover:bg-gray-100'
            }`}
            title="Bold (Ctrl+B)"
          >
            <strong>B</strong>
          </button>
          <button
            onClick={() => editor.chain().focus().toggleItalic().run()}
            className={`p-2 rounded transition-colors ${
              editor.isActive('italic') ? 'bg-blue-100 text-blue-700' : 'hover:bg-gray-100'
            }`}
            title="Italic (Ctrl+I)"
          >
            <em>I</em>
          </button>
          <button
            onClick={() => editor.chain().focus().toggleStrike().run()}
            className={`p-2 rounded transition-colors ${
              editor.isActive('strike') ? 'bg-blue-100 text-blue-700' : 'hover:bg-gray-100'
            }`}
            title="Strikethrough"
          >
            <span style={{ textDecoration: 'line-through' }}>S</span>
          </button>
        </div>
      </div>
      <div className="editor-container">
        <EditorContent editor={editor} />
      </div>
    </div>
  );
} 