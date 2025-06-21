'use client';

import { useEditor, EditorContent, BubbleMenu } from '@tiptap/react';
import { Extension } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import { Color } from '@tiptap/extension-color';
import { Highlight } from '@tiptap/extension-highlight';
import { Underline } from '@tiptap/extension-underline';
import { useEffect, useRef, useCallback, useMemo, useState } from 'react';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';
import { Suggestion, useEditorStore } from '@/store/editorStore';
import { checkText } from '@/lib/grammar';
import debounce from 'lodash/debounce';

// Plugin key for suggestion highlights
const suggestionHighlightKey = new PluginKey('suggestionHighlight');

// Performance-optimized highlight colors
const getHighlightColor = (type: string): string => {
  const colors = {
    grammar: 'rgba(239, 68, 68, 0.2)', // red-500 with 20% opacity
    style: 'rgba(245, 158, 11, 0.2)',  // amber-500 with 20% opacity
    spelling: 'rgba(59, 130, 246, 0.2)' // blue-500 with 20% opacity
  };
  return colors[type as keyof typeof colors] || colors.grammar;
};

const getHighlightBorder = (type: string): string => {
  const colors = {
    grammar: '#ef4444', // red-500
    style: '#f59e0b',   // amber-500
    spelling: '#3b82f6' // blue-500
  };
  return colors[type as keyof typeof colors] || colors.grammar;
};

// Memoized decoration creation with performance optimizations
const createDecorations = (doc: any, suggestions: Suggestion[]): DecorationSet => {
  if (!doc || !suggestions?.length) {
    return DecorationSet.empty;
  }
  
  const decorations: Decoration[] = [];
  const pendingSuggestions = suggestions.filter(s => s.status === 'new');
  
  // Batch decoration creation for better performance
  pendingSuggestions.forEach(suggestion => {
    const { range, type, id } = suggestion;
    const { from, to } = range;
    
    // Validate range bounds
    if (from >= 0 && to <= doc.content.size && from < to) {
      decorations.push(
        Decoration.inline(from, to, {
          class: `hl-${type} suggestion-highlight cursor-pointer`,
          'data-suggestion-id': id,
          'data-suggestion-type': type,
          style: `
            background-color: ${getHighlightColor(type)};
            border-bottom: 2px dotted ${getHighlightBorder(type)};
            border-radius: 2px;
            padding: 1px 2px;
            transition: all 0.2s ease;
          `.replace(/\s+/g, ' ').trim()
        })
      );
    }
  });
  
  return DecorationSet.create(doc, decorations);
};

// Create optimized suggestion highlight plugin
const createSuggestionHighlightPlugin = () => {
  let currentSuggestions: Suggestion[] = [];
  
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
  suggestions: Suggestion[];
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
  const lastSuggestionsRef = useRef<Suggestion[]>([]);
  const lastCheckRef = useRef<string>('');
  const { addSuggestion, clearSuggestions, updateSuggestionStatus } = useEditorStore();

  // Tooltip state
  const [tooltip, setTooltip] = useState<{
    show: boolean;
    suggestion: Suggestion | null;
    position: { x: number; y: number };
    element: HTMLElement | null;
  }>({
    show: false,
    suggestion: null,
    position: { x: 0, y: 0 },
    element: null
  });

  // Debounced grammar check
  const debouncedGrammarCheck = useRef(
    debounce(async (rawText: string) => {
      console.log('🔄 debounce fires', { rawText });
      
      if (rawText.length < 3 || rawText === lastCheckRef.current) return;
      lastCheckRef.current = rawText;
      
      console.log('👀 GRAMMAR EFFECT fired', { length: rawText.length });
      try {
        console.log('🛫 Calling LT for', rawText.slice(0, 50));
        // Clear existing suggestions
        clearSuggestions();
        
        // Get new suggestions from LanguageTool
        const suggestions = await checkText(rawText);
        
        // Add each suggestion
        suggestions.forEach(suggestion => {
          addSuggestion(suggestion);
        });
      } catch (error) {
        console.error('Grammar check failed:', error);
      }
    }, 800)
  ).current;

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
      
      // ‼️ probe
      console.log('🎯 onUpdate', { htmlSnippet: html.slice(0,30), textLen: text.length });
      
      onUpdate?.(html);
      onTextChange?.(text);
      
      // Run grammar check on the plain text
      if (text.trim().length >= 3) {
        debouncedGrammarCheck(text);
      }
    }, 100); // 100ms debounce for content updates
  }, [onUpdate, onTextChange, debouncedGrammarCheck]);
  
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

  // Show tooltip on hover
  const showTooltip = useCallback((element: HTMLElement, suggestion: Suggestion) => {
    const rect = element.getBoundingClientRect();
    const position = {
      x: rect.left + rect.width / 2,
      y: rect.top - 10
    };
    
    setTooltip({
      show: true,
      suggestion,
      position,
      element
    });
  }, []);

  // Hide tooltip
  const hideTooltip = useCallback(() => {
    setTooltip({ show: false, suggestion: null, position: { x: 0, y: 0 }, element: null });
  }, []);

  // Add event listeners for suggestion interactions
  useEffect(() => {
    if (!editor) return;

    const editorElement = editor.view.dom;

    // Handle hover on suggestion highlights
    const handleHighlightHover = (event: Event) => {
      const target = event.target as HTMLElement;
      const highlight = target.closest('[data-suggestion-id]') as HTMLElement;
      
      if (highlight && highlight.dataset.suggestionId) {
        const suggestionId = highlight.dataset.suggestionId;
        const suggestion = suggestions.find(s => s.id === suggestionId);
        
        if (suggestion) {
          showTooltip(highlight, suggestion);
        }
      }
    };

    // Handle mouse leave
    const handleHighlightLeave = (event: Event) => {
      const target = event.target as HTMLElement;
      const highlight = target.closest('[data-suggestion-id]') as HTMLElement;
      
      if (highlight) {
        // Small delay to allow moving to tooltip
        setTimeout(() => {
          const tooltipHovered = document.querySelector('.suggestion-tooltip:hover');
          if (!tooltipHovered) {
            hideTooltip();
          }
        }, 100);
      }
    };

    editorElement.addEventListener('mouseenter', handleHighlightHover, true);
    editorElement.addEventListener('mouseleave', handleHighlightLeave, true);

    return () => {
      editorElement.removeEventListener('mouseenter', handleHighlightHover, true);
      editorElement.removeEventListener('mouseleave', handleHighlightLeave, true);
    };
  }, [editor, suggestions, showTooltip, hideTooltip]);

  // Optimized suggestions update with deep comparison
  useEffect(() => {
    if (!editor) return;
    
    // Update decorations when suggestions change
    const { view } = editor;
    const tr = view.state.tr;
    tr.setMeta('suggestions', suggestions);
    tr.setMeta('forceUpdate', true);
    view.dispatch(tr);
    
    // Update lastSuggestionsRef
    lastSuggestionsRef.current = suggestions;
  }, [editor, suggestions]);
  
  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (updateTimeoutRef.current) {
        clearTimeout(updateTimeoutRef.current);
      }
    };
  }, []);

  // Handle suggestion application
  const handleApplySuggestion = useCallback((suggestionId: string, replacement: string) => {
    if (!editor) return;
    
    const suggestion = suggestions.find(s => s.id === suggestionId);
    if (!suggestion) return;

    // Replace text in editor
    const currentHTML = editor.getHTML();
    const escapedOriginal = suggestion.original.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`\\b${escapedOriginal}\\b`, 'i');
    
    if (regex.test(currentHTML)) {
      const newHTML = currentHTML.replace(regex, replacement);
      editor.commands.setContent(newHTML);
    }

    // Update suggestion status
    updateSuggestionStatus(suggestionId, 'applied');
    
    // Hide tooltip
    setTooltip({ show: false, suggestion: null, position: { x: 0, y: 0 }, element: null });
  }, [editor, suggestions, updateSuggestionStatus]);

  // Handle suggestion dismissal
  const handleDismissSuggestion = useCallback((suggestionId: string) => {
    updateSuggestionStatus(suggestionId, 'dismissed');
    setTooltip({ show: false, suggestion: null, position: { x: 0, y: 0 }, element: null });
  }, [updateSuggestionStatus]);

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
      <style jsx>{`
        .suggestion-highlight:hover {
          background-color: rgba(59, 130, 246, 0.3) !important;
          transform: scale(1.02);
        }
        .hl-grammar:hover {
          background-color: rgba(239, 68, 68, 0.3) !important;
        }
        .hl-style:hover {
          background-color: rgba(245, 158, 11, 0.3) !important;
        }
        .hl-spelling:hover {
          background-color: rgba(59, 130, 246, 0.3) !important;
        }
      `}</style>

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

      {/* Suggestion Tooltip */}
      {tooltip.show && tooltip.suggestion && (
        <div
          className="suggestion-tooltip fixed z-50 bg-white rounded-lg shadow-xl border border-gray-200 p-3 max-w-sm"
          style={{
            left: `${tooltip.position.x}px`,
            top: `${tooltip.position.y}px`,
            transform: 'translateX(-50%) translateY(-100%)',
          }}
          onMouseEnter={() => {/* Keep tooltip open on hover */}}
          onMouseLeave={hideTooltip}
        >
          {/* Suggestion Type Badge */}
          <div className="flex items-center justify-between mb-2">
            <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
              tooltip.suggestion.type === 'grammar' ? 'bg-red-100 text-red-800' :
              tooltip.suggestion.type === 'style' ? 'bg-blue-100 text-blue-800' :
              'bg-purple-100 text-purple-800'
            }`}>
              {tooltip.suggestion.type}
            </span>
          </div>

          {/* Original → Replacement */}
          <div className="mb-3">
            <div className="flex items-center space-x-2 text-sm">
              <span className="text-red-600 line-through">{tooltip.suggestion.original}</span>
              <span className="text-gray-400">→</span>
              <span className="text-green-600 font-medium">{tooltip.suggestion.replacements[0]}</span>
            </div>
          </div>

          {/* Explanation */}
          <p className="text-sm text-gray-600 mb-3">
            {tooltip.suggestion.explanation}
          </p>

          {/* Action Buttons */}
          <div className="flex space-x-2">
            <button
              onClick={() => handleApplySuggestion(tooltip.suggestion!.id, tooltip.suggestion!.replacements[0])}
              className="flex-1 px-3 py-1 bg-green-600 text-white rounded text-sm font-medium hover:bg-green-700 transition-colors"
            >
              Apply
            </button>
            <button
              onClick={() => handleDismissSuggestion(tooltip.suggestion!.id)}
              className="flex-1 px-3 py-1 bg-gray-600 text-white rounded text-sm font-medium hover:bg-gray-700 transition-colors"
            >
              Dismiss
            </button>
          </div>

          {/* Tooltip Arrow */}
          <div className="absolute top-full left-1/2 transform -translate-x-1/2">
            <div className="w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-white"></div>
            <div className="w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-200 -mt-px"></div>
          </div>
        </div>
      )}
    </div>
  );
} 