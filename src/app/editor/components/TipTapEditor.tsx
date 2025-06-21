'use client';

import { useEditor, EditorContent, BubbleMenu } from '@tiptap/react';
import { Extension } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import { Color } from '@tiptap/extension-color';
import { Highlight } from '@tiptap/extension-highlight';
import { Underline } from '@tiptap/extension-underline';
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
        const suggestionsChanged = tr.getMeta('suggestionsChanged');
        
        if (newSuggestions !== undefined) {
          currentSuggestions = newSuggestions;
        }
        
        // Only recreate decorations if suggestions changed or forced update
        if (newSuggestions !== undefined || forceUpdate || suggestionsChanged) {
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
  onEditorCreate?: (editor: any) => void;
}

export default function TipTapEditor({
  content = '',
  suggestions = [],
  onUpdate,
  onTextChange,
  onEditorCreate
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
    Underline,
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

  // Update editor content when content prop changes
  useEffect(() => {
    if (editor && content !== editor.getHTML()) {
      console.log('📝 Updating editor content:', {
        newContent: content?.substring(0, 50) + '...',
        oldContent: editor.getHTML()?.substring(0, 50) + '...'
      });
      editor.commands.setContent(content);
    }
  }, [editor, content]);

  // Notify parent when editor is created
  useEffect(() => {
    if (editor && onEditorCreate) {
      onEditorCreate(editor);
    }
  }, [editor, onEditorCreate]);

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
      <div className="bg-slate-50 rounded-2xl overflow-hidden animate-pulse">
        <div className="p-6 space-y-3">
          <div className="h-4 bg-slate-200 rounded w-3/4"></div>
          <div className="h-4 bg-slate-200 rounded w-1/2"></div>
          <div className="h-4 bg-slate-200 rounded w-5/6"></div>
          <div className="h-32 bg-slate-200 rounded w-full"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-slate-50 text-slate-900 rounded-2xl editor-light-canvas relative overflow-hidden">
      {/* Fixed Toolbar inside editor card */}
      <div className="flex gap-2 px-4 py-2 bg-slate-100 dark:bg-slate-200 text-slate-800 shadow-inner rounded-t-xl">
        {/* Undo */}
        <button
          onClick={() => editor.chain().focus().undo().run()}
          disabled={!editor.can().undo()}
          className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-200 disabled:opacity-50 disabled:cursor-not-allowed rounded transition-colors"
          title="Undo"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
          </svg>
        </button>

        {/* Redo */}
        <button
          onClick={() => editor.chain().focus().redo().run()}
          disabled={!editor.can().redo()}
          className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-200 disabled:opacity-50 disabled:cursor-not-allowed rounded transition-colors"
          title="Redo"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 10h-10a8 8 0 00-8 8v2M21 10l-6 6m6-6l-6-6" />
          </svg>
        </button>

        {/* Bold */}
        <button
          onClick={() => editor.chain().focus().toggleBold().run()}
          className={`p-1.5 rounded transition-colors ${
            editor.isActive('bold') 
              ? 'bg-indigo-500 text-white' 
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200'
          }`}
          title="Bold"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M8 4h6a4 4 0 014 4 4 4 0 01-4 4H8V4zM8 12h7a4 4 0 014 4 4 4 0 01-4 4H8v-8z" />
          </svg>
        </button>

        {/* Italic */}
        <button
          onClick={() => editor.chain().focus().toggleItalic().run()}
          className={`p-1.5 rounded transition-colors ${
            editor.isActive('italic') 
              ? 'bg-indigo-500 text-white' 
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200'
          }`}
          title="Italic"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M10 4l4 16M6 20h8M8 4h8" />
          </svg>
        </button>

        {/* Underline */}
        <button
          onClick={() => editor.chain().focus().toggleUnderline().run()}
          className={`p-1.5 rounded transition-colors ${
            editor.isActive('underline') 
              ? 'bg-indigo-500 text-white' 
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200'
          }`}
          title="Underline"
        >
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
            <path d="M4 16h12v1H4v-1zM6 3v6a4 4 0 008 0V3h-1v6a3 3 0 01-6 0V3H6z" />
          </svg>
        </button>

        {/* H1 */}
        <button
          onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
          className={`p-1.5 rounded transition-colors text-sm font-semibold ${
            editor.isActive('heading', { level: 1 }) 
              ? 'bg-indigo-500 text-white' 
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200'
          }`}
          title="Heading 1"
        >
          H1
        </button>

        {/* H2 */}
        <button
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          className={`p-1.5 rounded transition-colors text-sm font-semibold ${
            editor.isActive('heading', { level: 2 }) 
              ? 'bg-indigo-500 text-white' 
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200'
          }`}
          title="Heading 2"
        >
          H2
        </button>

        {/* Bullet List */}
        <button
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          className={`p-1.5 rounded transition-colors ${
            editor.isActive('bulletList') 
              ? 'bg-indigo-500 text-white' 
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200'
          }`}
          title="Bullet List"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>

        {/* Numbered List */}
        <button
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          className={`p-1.5 rounded transition-colors ${
            editor.isActive('orderedList') 
              ? 'bg-indigo-500 text-white' 
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200'
          }`}
          title="Numbered List"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>

      {/* Floating Bubble Menu */}
      <BubbleMenu 
        editor={editor} 
        tippyOptions={{ duration: 100, placement: 'top' }}
        className="flex gap-1 bg-slate-800/90 text-slate-100 p-2 rounded-xl shadow-lg backdrop-blur-sm border border-slate-700/50"
      >
        {/* Bold */}
        <button
          onClick={() => editor.chain().focus().toggleBold().run()}
          className={`px-3 py-1 text-sm font-semibold rounded-lg transition-colors hover:bg-slate-700/50 ${
            editor.isActive('bold') 
              ? 'bg-indigo-500 text-white' 
              : 'text-slate-200 hover:text-white'
          }`}
          title="Bold"
        >
          B
        </button>

        {/* Italic */}
        <button
          onClick={() => editor.chain().focus().toggleItalic().run()}
          className={`px-3 py-1 text-sm italic rounded-lg transition-colors hover:bg-slate-700/50 ${
            editor.isActive('italic') 
              ? 'bg-indigo-500 text-white' 
              : 'text-slate-200 hover:text-white'
          }`}
          title="Italic"
        >
          I
        </button>

        {/* Underline */}
        <button
          onClick={() => editor.chain().focus().toggleUnderline().run()}
          className={`px-3 py-1 text-sm underline rounded-lg transition-colors hover:bg-slate-700/50 ${
            editor.isActive('underline') 
              ? 'bg-indigo-500 text-white' 
              : 'text-slate-200 hover:text-white'
          }`}
          title="Underline"
        >
          U
        </button>

        {/* H1 */}
        <button
          onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
          className={`px-3 py-1 text-sm font-semibold rounded-lg transition-colors hover:bg-slate-700/50 ${
            editor.isActive('heading', { level: 1 }) 
              ? 'bg-indigo-500 text-white' 
              : 'text-slate-200 hover:text-white'
          }`}
          title="Heading 1"
        >
          H1
        </button>

        {/* H2 */}
        <button
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          className={`px-3 py-1 text-sm font-semibold rounded-lg transition-colors hover:bg-slate-700/50 ${
            editor.isActive('heading', { level: 2 }) 
              ? 'bg-indigo-500 text-white' 
              : 'text-slate-200 hover:text-white'
          }`}
          title="Heading 2"
        >
          H2
        </button>

        {/* Bullet List */}
        <button
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          className={`px-3 py-1 text-sm rounded-lg transition-colors hover:bg-slate-700/50 ${
            editor.isActive('bulletList') 
              ? 'bg-indigo-500 text-white' 
              : 'text-slate-200 hover:text-white'
          }`}
          title="Bullet List"
        >
          •
        </button>

        {/* Numbered List */}
        <button
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          className={`px-3 py-1 text-sm rounded-lg transition-colors hover:bg-slate-700/50 ${
            editor.isActive('orderedList') 
              ? 'bg-indigo-500 text-white' 
              : 'text-slate-200 hover:text-white'
          }`}
          title="Numbered List"
        >
          1.
        </button>
      </BubbleMenu>

      <div className="editor-container">
        <EditorContent 
          editor={editor} 
          className="prose prose-lg max-w-none focus:outline-none min-h-[400px] p-6 bg-slate-50 text-slate-900"
        />
      </div>
    </div>
  );
} 