'use client';

import { useEditor, EditorContent, BubbleMenu } from '@tiptap/react';
import { Extension } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import { Color } from '@tiptap/extension-color';
import { Highlight } from '@tiptap/extension-highlight';
import { Underline } from '@tiptap/extension-underline';
import TextAlign from '@tiptap/extension-text-align';
import { useEffect, useRef, useCallback, useMemo, useState } from 'react';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';
import { Suggestion, useEditorStore } from '@/store/editorStore';
import { checkText } from '@/lib/grammar';
import debounce from 'lodash/debounce';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';

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
    let { from, to } = range;
    
    // Ensure range is within document bounds
    from = Math.max(0, from);
    to = Math.min(doc.content.size, to);
    
    // Validate range bounds and ensure it's not empty
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
            padding: 0px 1px;
            margin: 0px;
            box-decoration-break: clone;
            -webkit-box-decoration-break: clone;
            display: inline;
            line-height: inherit;
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
      if (rawText.length < 3 || rawText === lastCheckRef.current) return;
      lastCheckRef.current = rawText;
      
      try {
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

  // Create keyboard shortcut extension
  const KeyboardShortcutExtension = Extension.create({
    name: 'customKeyboardShortcuts',
    addKeyboardShortcuts() {
      return {
        'Mod-Shift-x': () => this.editor.commands.toggleStrike(),
        'Mod-Shift-h': () => this.editor.commands.toggleHighlight(),
        'Mod-Alt-1': () => this.editor.commands.toggleHeading({ level: 1 }),
        'Mod-Alt-2': () => this.editor.commands.toggleHeading({ level: 2 }),
        'Mod-Alt-3': () => this.editor.commands.toggleHeading({ level: 3 }),
        'Mod-Shift-8': () => this.editor.commands.toggleBulletList(),
        'Mod-Shift-7': () => this.editor.commands.toggleOrderedList(),
        'Mod-Shift-l': () => this.editor.commands.setTextAlign('left'),
        'Mod-Shift-e': () => this.editor.commands.setTextAlign('center'),
        'Mod-Shift-r': () => this.editor.commands.setTextAlign('right'),
        'Mod-Shift-j': () => this.editor.commands.setTextAlign('justify'),
      }
    }
  });

  // Memoized extensions array to prevent unnecessary re-creation
  const extensions = useMemo(() => [
    StarterKit.configure({
      // Optimize for performance
      history: {
        depth: 100, // Limit undo history for better performance
        newGroupDelay: 500,
      }
    }),
    Color,
    Highlight.configure({ 
      multicolor: true,
      HTMLAttributes: {
        class: 'custom-highlight',
      }
    }),
    Underline,
    TextAlign.configure({
      types: ['heading', 'paragraph'],
      alignments: ['left', 'center', 'right', 'justify'],
      defaultAlignment: 'left',
    }),
    KeyboardShortcutExtension,
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

    // Get current text content
    const currentText = editor.getText();
    const { from, to } = suggestion.range;

    // Use TipTap's transaction system for precise replacement
    const { view } = editor;
    const { state } = view;
    
    // Create a transaction to replace the text
    const tr = state.tr.replaceWith(from, to, state.schema.text(replacement));
    view.dispatch(tr);

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

  // Add keyboard shortcuts
  const { getShortcutLabel } = useKeyboardShortcuts({
    editor,
    onSave: () => {
      // Trigger content update for autosave
      if (editor) {
        const html = editor.getHTML();
        onUpdate?.(html);
      }
    }
  });

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
        .suggestion-highlight {
          position: relative;
          z-index: 1;
        }
        .suggestion-highlight:hover {
          background-color: rgba(59, 130, 246, 0.4) !important;
          transform: none;
          z-index: 2;
        }
        .hl-grammar {
          background-color: rgba(239, 68, 68, 0.2) !important;
          border-bottom-color: #ef4444 !important;
        }
        .hl-grammar:hover {
          background-color: rgba(239, 68, 68, 0.35) !important;
        }
        .hl-style {
          background-color: rgba(245, 158, 11, 0.2) !important;
          border-bottom-color: #f59e0b !important;
        }
        .hl-style:hover {
          background-color: rgba(245, 158, 11, 0.35) !important;
        }
        .hl-spelling {
          background-color: rgba(59, 130, 246, 0.2) !important;
          border-bottom-color: #3b82f6 !important;
        }
        .hl-spelling:hover {
          background-color: rgba(59, 130, 246, 0.35) !important;
        }
        /* Ensure proper text flow */
        .editor-content p {
          line-height: 1.6;
          margin: 0.5em 0;
        }
        .editor-content {
          word-wrap: break-word;
          overflow-wrap: break-word;
        }
      `}</style>

      {/* Fixed Toolbar inside editor card */}
      <div className="overflow-x-auto bg-slate-100 dark:bg-slate-200 text-slate-800 shadow-inner rounded-t-xl">
        <div className="flex gap-1 px-3 py-2 min-w-max">
          {/* Undo */}
          <button
            onClick={() => editor.chain().focus().undo().run()}
            disabled={!editor.can().undo()}
            className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-200 disabled:opacity-50 disabled:cursor-not-allowed rounded transition-colors"
            title={`Undo (${getShortcutLabel('undo')})`}
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
            title={`Redo (${getShortcutLabel('redo')})`}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 10h-10a8 8 0 00-8 8v2M21 10l-6 6m6-6l-6-6" />
            </svg>
          </button>

          {/* Separator */}
          <div className="w-px h-6 bg-slate-300 mx-1"></div>

          {/* Paragraph */}
          <button
            onClick={() => editor.chain().focus().setParagraph().run()}
            className={`px-2 py-1.5 rounded transition-colors text-sm font-semibold ${
              editor.isActive('paragraph') 
                ? 'bg-indigo-500 text-white' 
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200'
            }`}
            title="Paragraph"
          >
            P
          </button>

          {/* H1 */}
          <button
            onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
            className={`px-2 py-1.5 rounded transition-colors text-sm font-semibold ${
              editor.isActive('heading', { level: 1 }) 
                ? 'bg-indigo-500 text-white' 
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200'
            }`}
            title={`Heading 1 (${getShortcutLabel('h1')})`}
          >
            H1
          </button>

          {/* H2 */}
          <button
            onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
            className={`px-2 py-1.5 rounded transition-colors text-sm font-semibold ${
              editor.isActive('heading', { level: 2 }) 
                ? 'bg-indigo-500 text-white' 
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200'
            }`}
            title={`Heading 2 (${getShortcutLabel('h2')})`}
          >
            H2
          </button>

          {/* H3 */}
          <button
            onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
            className={`px-2 py-1.5 rounded transition-colors text-sm font-semibold ${
              editor.isActive('heading', { level: 3 }) 
                ? 'bg-indigo-500 text-white' 
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200'
            }`}
            title={`Heading 3 (${getShortcutLabel('h3')})`}
          >
            H3
          </button>

          {/* Separator */}
          <div className="w-px h-6 bg-slate-300 mx-1"></div>

          {/* Bold */}
          <button
            onClick={() => editor.chain().focus().toggleBold().run()}
            className={`p-1.5 rounded transition-colors ${
              editor.isActive('bold') 
                ? 'bg-indigo-500 text-white' 
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200'
            }`}
            title={`Bold (${getShortcutLabel('bold')})`}
          >
            <span className="font-bold text-sm">B</span>
          </button>

          {/* Italic */}
          <button
            onClick={() => editor.chain().focus().toggleItalic().run()}
            className={`p-1.5 rounded transition-colors ${
              editor.isActive('italic') 
                ? 'bg-indigo-500 text-white' 
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200'
            }`}
            title={`Italic (${getShortcutLabel('italic')})`}
          >
            <span className="italic text-sm">I</span>
          </button>

          {/* Underline */}
          <button
            onClick={() => editor.chain().focus().toggleUnderline().run()}
            className={`p-1.5 rounded transition-colors ${
              editor.isActive('underline') 
                ? 'bg-indigo-500 text-white' 
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200'
            }`}
            title={`Underline (${getShortcutLabel('underline')})`}
          >
            <span className="underline text-sm">U</span>
          </button>

          {/* Strikethrough */}
          <button
            onClick={() => editor.chain().focus().toggleStrike().run()}
            className={`p-1.5 rounded transition-colors ${
              editor.isActive('strike') 
                ? 'bg-indigo-500 text-white' 
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200'
            }`}
            title={`Strikethrough (${getShortcutLabel('strike')})`}
          >
            <span className="line-through text-sm">S</span>
          </button>

          {/* Highlight */}
          <button
            onClick={() => editor.chain().focus().toggleHighlight().run()}
            className={`p-1.5 rounded transition-colors ${
              editor.isActive('highlight') 
                ? 'bg-indigo-500 text-white' 
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200'
            }`}
            title={`Highlight (${getShortcutLabel('highlight')})`}
          >
            <span className="bg-yellow-200 px-1 rounded text-xs">H</span>
          </button>

          {/* Separator */}
          <div className="w-px h-6 bg-slate-300 mx-1"></div>

          {/* Align Left */}
          <button
            onClick={() => editor.chain().focus().setTextAlign('left').run()}
            className={`p-1.5 rounded transition-colors ${
              editor.isActive({ textAlign: 'left' }) 
                ? 'bg-indigo-500 text-white' 
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200'
            }`}
            title={`Align Left (${getShortcutLabel('alignLeft')})`}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h10M4 12h10M4 18h10" />
            </svg>
          </button>

          {/* Align Center */}
          <button
            onClick={() => editor.chain().focus().setTextAlign('center').run()}
            className={`p-1.5 rounded transition-colors ${
              editor.isActive({ textAlign: 'center' }) 
                ? 'bg-indigo-500 text-white' 
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200'
            }`}
            title={`Align Center (${getShortcutLabel('alignCenter')})`}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 6h10M4 12h16M7 18h10" />
            </svg>
          </button>

          {/* Align Right */}
          <button
            onClick={() => editor.chain().focus().setTextAlign('right').run()}
            className={`p-1.5 rounded transition-colors ${
              editor.isActive({ textAlign: 'right' }) 
                ? 'bg-indigo-500 text-white' 
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200'
            }`}
            title={`Align Right (${getShortcutLabel('alignRight')})`}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6h10M4 12h16M10 18h10" />
            </svg>
          </button>

          {/* Justify */}
          <button
            onClick={() => editor.chain().focus().setTextAlign('justify').run()}
            className={`p-1.5 rounded transition-colors ${
              editor.isActive({ textAlign: 'justify' }) 
                ? 'bg-indigo-500 text-white' 
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200'
            }`}
            title={`Justify (${getShortcutLabel('alignJustify')})`}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>

          {/* Separator */}
          <div className="w-px h-6 bg-slate-300 mx-1"></div>

          {/* Bullet List */}
          <button
            onClick={() => editor.chain().focus().toggleBulletList().run()}
            className={`p-1.5 rounded transition-colors ${
              editor.isActive('bulletList') 
                ? 'bg-indigo-500 text-white' 
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200'
            }`}
            title={`Bullet List (${getShortcutLabel('bulletList')})`}
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
            title={`Numbered List (${getShortcutLabel('orderedList')})`}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
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
          title={`Bold (${getShortcutLabel('bold')})`}
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
          title={`Italic (${getShortcutLabel('italic')})`}
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
          title={`Underline (${getShortcutLabel('underline')})`}
        >
          U
        </button>

        {/* Strikethrough */}
        <button
          onClick={() => editor.chain().focus().toggleStrike().run()}
          className={`px-3 py-1 text-sm line-through rounded-lg transition-colors hover:bg-slate-700/50 ${
            editor.isActive('strike') 
              ? 'bg-indigo-500 text-white' 
              : 'text-slate-200 hover:text-white'
          }`}
          title={`Strikethrough (${getShortcutLabel('strike')})`}
        >
          S
        </button>

        {/* Highlight */}
        <button
          onClick={() => editor.chain().focus().toggleHighlight().run()}
          className={`px-3 py-1 text-sm rounded-lg transition-colors hover:bg-slate-700/50 ${
            editor.isActive('highlight') 
              ? 'bg-indigo-500 text-white' 
              : 'text-slate-200 hover:text-white'
          }`}
          title={`Highlight (${getShortcutLabel('highlight')})`}
        >
          <span className="bg-yellow-200 text-slate-800 px-1 rounded text-xs">H</span>
        </button>

        {/* H1 */}
        <button
          onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
          className={`px-3 py-1 text-sm font-semibold rounded-lg transition-colors hover:bg-slate-700/50 ${
            editor.isActive('heading', { level: 1 }) 
              ? 'bg-indigo-500 text-white' 
              : 'text-slate-200 hover:text-white'
          }`}
          title={`Heading 1 (${getShortcutLabel('h1')})`}
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
          title={`Heading 2 (${getShortcutLabel('h2')})`}
        >
          H2
        </button>

        {/* H3 */}
        <button
          onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
          className={`px-3 py-1 text-sm font-semibold rounded-lg transition-colors hover:bg-slate-700/50 ${
            editor.isActive('heading', { level: 3 }) 
              ? 'bg-indigo-500 text-white' 
              : 'text-slate-200 hover:text-white'
          }`}
          title={`Heading 3 (${getShortcutLabel('h3')})`}
        >
          H3
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