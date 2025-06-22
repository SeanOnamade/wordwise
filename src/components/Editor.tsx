'use client';

import { useEditor, EditorContent } from '@tiptap/react';
import { Extension } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import { Color } from '@tiptap/extension-color';
import { Highlight } from '@tiptap/extension-highlight';
import { Underline } from '@tiptap/extension-underline';
import { Link } from '@tiptap/extension-link';
import { TextAlign } from '@tiptap/extension-text-align';
// import { Superscript } from '@tiptap/extension-superscript';
// import { Subscript } from '@tiptap/extension-subscript';
// import { Table, TableRow, TableCell, TableHeader } from '@tiptap/extension-table';
import { GrammarHighlight } from '@/lib/tiptap-extensions';
import { useEditorStore } from '@/store/editorStore';
import { useEffect, useCallback, useState, useRef } from 'react';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { useAutosave } from '@/hooks/useAutosave';
import { Decoration, DecorationSet } from '@tiptap/pm/view';
import { auth, createPerformanceTrace } from '@/lib/firebase';
import ThemeToggle from '@/components/ThemeToggle';
import KeyboardShortcuts from '@/components/KeyboardShortcuts';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Toggle } from '@/components/ui/toggle';
import { checkText } from '@/lib/grammar';
import debounce from 'lodash/debounce';
import { useGrammarCheck } from '@/hooks/useGrammarCheck';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';
import ShareButton from '@/components/ShareButton';
import ExportButton from '@/components/ExportButton';
// import { db } from '@/lib/firebase'; // Temporarily disabled

// Create plugin key for grammar highlights
const grammarHighlightPluginKey = new PluginKey('grammarHighlight');

// Create decoration plugin for inline highlighting
const createGrammarHighlightPlugin = (suggestions: any[]) => {
  return new Plugin({
    key: grammarHighlightPluginKey,
    state: {
      init() {
        return DecorationSet.empty;
      },
      apply(tr, oldDecorations) {
        // Map existing decorations through document changes
        let decorations = oldDecorations.map(tr.mapping, tr.doc);
        
        // Get current suggestions from the transaction meta or use provided suggestions
        const currentSuggestions = tr.getMeta(grammarHighlightPluginKey) || suggestions;
        
        // Rebuild decorations if suggestions changed
        if (tr.getMeta('suggestionsChanged')) {
          decorations = createDecorations(tr.doc, currentSuggestions);
        }
        
        return decorations;
      }
    },
    props: {
      decorations(state) {
        return this.getState(state);
      }
    }
  });
};

// Create TipTap extension that wraps the plugin
const createGrammarHighlightExtension = (suggestions: any[]) => {
  return Extension.create({
    name: 'grammarHighlightDecorations',
    addProseMirrorPlugins() {
      return [createGrammarHighlightPlugin(suggestions)];
    }
  });
};

// Create decorations from suggestions
const createDecorations = (doc: any, suggestions: any[]) => {
  const decorations: Decoration[] = [];
  
  suggestions
    .filter(suggestion => suggestion.status === 'pending')
    .forEach(suggestion => {
      const { range, type } = suggestion;
      const { from, to } = range;
      
      // Validate range bounds
      if (from >= 0 && to <= doc.content.size && from < to) {
        const decoration = Decoration.inline(from, to, {
          class: `hl-${type}`,
          'data-suggestion-id': suggestion.id,
          'data-suggestion-type': type
        });
        decorations.push(decoration);
      }
    });
  
  return DecorationSet.create(doc, decorations);
};

const Editor = () => {
  const { editor, setEditor, suggestions, addSuggestion, clearSuggestions, currentDoc, setCurrentDoc, updateDocument, wordCount, setWordCount, updateSuggestionStatus } = useEditorStore();
  
  // Core Functionality Tracking
  const [performanceMetrics, setPerformanceMetrics] = useState({
    lastResponseTime: 0,
    averageResponseTime: 0,
    totalChecks: 0,
    suggestionAccuracy: 0,
    userSatisfaction: 0
  });
  
  // Debug: Log suggestions state changes
  useEffect(() => {
    console.log('Suggestions state updated:', suggestions);
  }, [suggestions]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [grammarSource, setGrammarSource] = useState<'languagetool' | 'mock' | null>(null);
  const [tooltip, setTooltip] = useState<{ show: boolean; text: string; element: HTMLElement | null; suggestionId?: string }>({
    show: false,
    text: '',
    element: null,
    suggestionId: undefined,
  });
  const [inlineActions, setInlineActions] = useState<{ show: boolean; element: HTMLElement | null; suggestionId: string }>({
    show: false,
    element: null,
    suggestionId: '',
  });
  const lastCheckRef = useRef<string>('');

  // Debounced grammar check - wrapped in useRef to maintain reference
  const debouncedGrammarCheck = useRef(
    debounce(async (rawText: string) => {
      console.log('🔄 debounce fires', { rawText });
      
      if (rawText.length < 3 || rawText === lastCheckRef.current) return;
      lastCheckRef.current = rawText;
      
      console.log('👀 GRAMMAR EFFECT fired', { length: rawText.length });
      setIsLoading(true);
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
        
        setGrammarSource('languagetool');
      } catch (error) {
        console.error('Grammar check failed:', error);
      } finally {
        setIsLoading(false);
      }
    }, 800)
  ).current;

  // Create editor with performance optimizations
  const tiptapEditor = useEditor({
    extensions: [
      StarterKit.configure({
        bulletList: {
          keepMarks: true,
          keepAttributes: true,
          HTMLAttributes: {
            class: 'editor-bullet-list',
          },
        },
        orderedList: {
          keepMarks: true,
          keepAttributes: true,
          HTMLAttributes: {
            class: 'editor-ordered-list',
          },
        },
        listItem: {
          HTMLAttributes: {
            class: 'editor-list-item',
          },
        },
      }),
      Color,
      Highlight.configure({
        multicolor: true,
      }),
      Underline,
      Link.configure({
        openOnClick: true,
        HTMLAttributes: {
          class: 'text-blue-600 hover:text-blue-800 underline',
        },
      }),
      TextAlign.configure({
        types: ['heading', 'paragraph'],
        alignments: ['left', 'center', 'right', 'justify'],
      }),
      GrammarHighlight,
      createGrammarHighlightExtension(suggestions),
    ],
    content: currentDoc?.content || '',
    immediatelyRender: false,
    onUpdate: ({ editor }) => {
      const content = editor.getHTML();
      const text = editor.getText();
      
      // ‼️ probe
      console.log('🎯 onUpdate', { htmlSnippet: content.slice(0,30), textLen: text.length });
      
      console.log('✍️ Editor update triggered');
      
      // Update word count
      const words = text.trim().split(/\s+/).filter(word => word.length > 0);
      setWordCount(words.length);
      
      // Update current doc content
      if (currentDoc) {
        console.log('📝 Editor content updated:', { 
          contentLength: content.length,
          docId: currentDoc.id,
          wordCount: words.length
        });
        
        // Update store
        setCurrentDoc({
          ...currentDoc,
          content,
          lastModified: new Date()
        });
      } else {
        console.warn('⚠️ No current document to update');
      }
      
      // Run grammar check on the plain text
      if (text.trim().length >= 3) {
      debouncedGrammarCheck(text);
      }
    },
    editorProps: {
      attributes: {
        class: 'prose prose-lg max-w-none focus:outline-none min-h-[400px] p-4',
        'data-placeholder': 'Start writing your essay here. Grammar and style suggestions will appear as you type...',
      },
    },
  });

  // 40-word rule tooltip functionality
  const checkSentenceLength = useCallback((text: string) => {
    const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
    const longSentences: Array<{
      sentence: string;
      wordCount: number;
      start: number;
      end: number;
    }> = [];
    
    let currentPos = 0;
    sentences.forEach(sentence => {
      const trimmedSentence = sentence.trim();
      if (trimmedSentence.length > 0) {
        const words = trimmedSentence.split(/\s+/).filter(w => w.length > 0);
        if (words.length > 40) {
          const start = text.indexOf(trimmedSentence, currentPos);
          const end = start + trimmedSentence.length;
          longSentences.push({
            sentence: trimmedSentence,
            wordCount: words.length,
            start,
            end
          });
        }
        currentPos += trimmedSentence.length;
      }
    });
    
    return longSentences;
  }, []);

  // Update decorations when suggestions change
  useEffect(() => {
    if (tiptapEditor) {
      const { view } = tiptapEditor;
      const tr = view.state.tr;
      tr.setMeta(grammarHighlightPluginKey, suggestions);
      tr.setMeta('suggestionsChanged', true);
      view.dispatch(tr);
    }
  }, [tiptapEditor, suggestions]);

  useEffect(() => {
    if (tiptapEditor) {
      setEditor(tiptapEditor);
      
      // Add event listeners for highlight interactions
      const editorElement = tiptapEditor.view.dom;
      
      // Click handler for highlights
      const handleHighlightClick = (event: Event) => {
        const target = event.target as HTMLElement;
        const highlight = target.closest('[data-suggestion-id]') as HTMLElement;
        
        if (highlight && highlight.dataset.suggestionId) {
          const suggestionId = highlight.dataset.suggestionId;
          const suggestion = suggestions.find(s => s.id === suggestionId);
          
          if (suggestion && suggestion.replacements?.[0]) {
            // Show inline actions instead of immediately applying
            setInlineActions({
              show: true,
              element: highlight,
              suggestionId
            });
            setTooltip({ show: false, text: '', element: null });
          }
        }
      };
      
      // Enhanced hover handler for tooltips and inline actions
      const handleHighlightHover = (event: Event) => {
        const target = event.target as HTMLElement;
        const highlight = target.closest('[data-suggestion-id]') as HTMLElement;
        
        if (highlight && highlight.dataset.suggestionId) {
          const suggestionId = highlight.dataset.suggestionId;
          const suggestion = suggestions.find(s => s.id === suggestionId);
          
          if (suggestion) {
            // Hide inline actions when hovering over different suggestion
            if (inlineActions.suggestionId !== suggestionId) {
              setInlineActions({ show: false, element: null, suggestionId: '' });
            }
            
            // Show tooltip with suggestion details
            const tooltipText = `${suggestion.type.toUpperCase()}: ${suggestion.explanation}${
              suggestion.replacements?.[0] ? `\n\nSuggested: "${suggestion.replacements[0]}"` : ''
            }\n\nClick to see options or use the suggestions panel.`;
            
            showTooltip(highlight, tooltipText, suggestionId);
          }
        }
      };
      
      // Mouse leave handler to hide tooltips and inline actions
      const handleHighlightLeave = (event: Event) => {
        const target = event.target as HTMLElement;
        const highlight = target.closest('[data-suggestion-id]') as HTMLElement;
        
        if (highlight) {
          // Small delay before hiding to allow moving to inline actions
          setTimeout(() => {
            const mouseOverActions = document.querySelector('.inline-actions:hover');
            const mouseOverTooltip = document.querySelector('.grammar-tooltip:hover');
            
            if (!mouseOverActions && !mouseOverTooltip) {
              hideTooltip();
              setInlineActions({ show: false, element: null, suggestionId: '' });
            }
          }, 100);
        }
      };
      
      // Global click handler to hide inline actions when clicking elsewhere
      const handleGlobalClick = (event: Event) => {
        const target = event.target as HTMLElement;
        const isInlineAction = target.closest('.inline-actions');
        const isHighlight = target.closest('[data-suggestion-id]');
        
        if (!isInlineAction && !isHighlight) {
          setInlineActions({ show: false, element: null, suggestionId: '' });
          hideTooltip();
        }
      };
      
      editorElement.addEventListener('click', handleHighlightClick);
      editorElement.addEventListener('mouseenter', handleHighlightHover, true);
      editorElement.addEventListener('mouseleave', handleHighlightLeave, true);
      document.addEventListener('click', handleGlobalClick);
      
      return () => {
        editorElement.removeEventListener('click', handleHighlightClick);
        editorElement.removeEventListener('mouseenter', handleHighlightHover, true);
        editorElement.removeEventListener('mouseleave', handleHighlightLeave, true);
        document.removeEventListener('click', handleGlobalClick);
      };
    }
  }, [tiptapEditor, setEditor, suggestions, inlineActions.suggestionId]);

  // Autosave integration
  console.log('📄 Current document state:', { 
    docId: currentDoc?.id, 
    hasContent: !!currentDoc?.content,
    isAuthenticated: !!auth?.currentUser 
  });
  
  const { forceSave } = useAutosave({
    docId: currentDoc?.id || '',
    content: currentDoc?.content || '',
    title: currentDoc?.title || '',
    createdAt: currentDoc?.createdAt || null,
    enabled: !!currentDoc?.id && !!auth?.currentUser
  });

  const saveDocument = async () => {
    if (!currentDoc || !tiptapEditor || typeof window === 'undefined' || !auth?.currentUser) return;
    
    setIsSaving(true);
    try {
      const response = await fetch('/api/saveDoc', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: auth.currentUser?.uid,
          docId: currentDoc.id,
          title: currentDoc.title,
          content: tiptapEditor.getHTML(),
        }),
      });
      
      if (response.ok) {
        const data = await response.json();
        console.log('Document saved successfully:', data.message);
      }
    } catch (error) {
      console.error('Save failed:', error);
    }
    setIsSaving(false);
  };

  // Keyboard shortcuts handler
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!tiptapEditor) return;

      // Ctrl+S for save
      if (event.ctrlKey && event.key === 's') {
        event.preventDefault();
        saveDocument();
        return;
      }

      // Ctrl+? for shortcuts
      if (event.ctrlKey && (event.key === '?' || event.key === '/')) {
        event.preventDefault();
        // The KeyboardShortcuts component handles its own state
        return;
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [tiptapEditor, saveDocument]);

  // Enhanced show tooltip function
  const showTooltip = (element: HTMLElement, text: string, suggestionId?: string) => {
    setTooltip({
      show: true,
      text,
      element,
      suggestionId,
    });
  };

  // Enhanced hide tooltip function
  const hideTooltip = () => {
    setTooltip({
      show: false,
      text: '',
      element: null,
      suggestionId: undefined,
    });
  };

  // Enhanced apply suggestion with undo support
  const handleApplySuggestion = async (suggestionId: string, replacement: string) => {
    const suggestion = suggestions.find(s => s.id === suggestionId);
    
    if (suggestion && editor) {
      const { original } = suggestion;
    
      // Simple approach: replace in the HTML content
      const currentHTML = editor.getHTML();
      const escapedOriginal = original.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      
      // Create a regex that matches the original text
      const regex = new RegExp(`\\b${escapedOriginal}\\b`, 'i');
      
      if (regex.test(currentHTML)) {
        const newHTML = currentHTML.replace(regex, replacement);
        editor.commands.setContent(newHTML);
        console.log('Applied suggestion using HTML replacement:', suggestionId, `"${original}" -> "${replacement}"`);
    } else {
        // Fallback: try direct text replacement without word boundaries
        const simpleRegex = new RegExp(escapedOriginal, 'i');
        if (simpleRegex.test(currentHTML)) {
          const newHTML = currentHTML.replace(simpleRegex, replacement);
          editor.commands.setContent(newHTML);
          console.log('Applied suggestion using simple replacement:', suggestionId, `"${original}" -> "${replacement}"`);
        } else {
          console.log('Could not find original text to replace in HTML:', original);
    }
      }
      
      // Update suggestion status
      updateSuggestionStatus(suggestionId, 'applied');
    
      // Force refresh of decorations to remove highlights
      setTimeout(() => {
        const { view } = editor;
        const tr = view.state.tr;
        tr.setMeta('suggestionsChanged', true);
        view.dispatch(tr);
      }, 100);

      // Trigger immediate autosave after suggestion application
      console.log('💾 Triggering immediate autosave after suggestion application');
      await forceSave();
    } else {
      console.log('Cannot apply suggestion: editor not ready or suggestion not found');
    }
  };

  // Enhanced reject suggestion function
  const handleDismissSuggestion = (suggestionId: string) => {
    updateSuggestionStatus(suggestionId, 'dismissed');
    
    // Force refresh of decorations to remove highlights
    if (editor) {
      setTimeout(() => {
        const { view } = editor;
        const tr = view.state.tr;
        tr.setMeta('suggestionsChanged', true);
        view.dispatch(tr);
      }, 100);
    }
  };

  // Helper function to escape special regex characters
  const escapeRegExp = (string: string) => {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  };

  // Clear decorations when clearing suggestions
  const clearAllHighlights = () => {
    if (!tiptapEditor) {
      console.log('🧹 Clearing highlights - decorations will update automatically when suggestions are cleared');
      return;
    }
    
    // Decorations will be automatically cleared when suggestions array is empty
    // due to the useEffect that updates decorations when suggestions change
    console.log('🧹 Highlights cleared automatically via decoration system');
  };

  // Remove specific highlight when suggestion is applied/dismissed
  const removeHighlight = (suggestionId: string) => {
    if (!tiptapEditor) return;
    
    // With the decoration system, highlights are automatically removed when
    // the suggestion status changes to 'accepted' or 'rejected' because
    // we filter for suggestions with status === 'pending' in createDecorations
    console.log('🎯 Highlight will be automatically removed for suggestion:', suggestionId);
  };

  if (!tiptapEditor) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading editor...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900 transition-colors duration-500">
      <div className="max-w-7xl mx-auto py-6 px-4">
        {/* Header */}
        <header className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-lg rounded-2xl shadow-xl border border-white/20 dark:border-slate-700/50 p-6 mb-8 transition-colors duration-300" role="banner">
          <div className="flex justify-between items-center">
            <div className="flex items-center space-x-4">
              <label htmlFor="document-title" className="sr-only">Document title</label>
              <input
                id="document-title"
                type="text"
                value={currentDoc?.title || ''}
                onChange={(e) => currentDoc && setCurrentDoc({ ...currentDoc, title: e.target.value })}
                className="text-2xl font-bold bg-transparent border-none focus:outline-none focus:ring-2 focus:ring-blue-500/30 rounded-lg px-3 py-1 text-slate-800 dark:text-slate-200 placeholder-slate-400 dark:placeholder-slate-500 transition-colors duration-300"
                placeholder="✍️ Untitled Document"
                aria-label="Document title"
                aria-describedby="document-info"
              />
              <div id="document-info" className="flex items-center space-x-2" role="status" aria-live="polite">
                <Badge 
                  variant="secondary"
                  className="text-sm font-medium"
                  aria-label={`Word count: ${wordCount} words`}
                >
                  📝 {wordCount} {wordCount === 1 ? 'word' : 'words'}
                </Badge>
                {performanceMetrics.totalChecks > 0 && (
                  <Badge 
                    variant={performanceMetrics.lastResponseTime < 2000 ? "default" : "destructive"}
                    className="text-xs font-medium"
                    aria-label={`Grammar check response time: ${performanceMetrics.lastResponseTime} milliseconds`}
                  >
                    ⚡ {performanceMetrics.lastResponseTime}ms
                  </Badge>
                )}
                {suggestions.filter(s => s.status === 'new').length > 0 && (
                  <Badge 
                    variant="destructive"
                    className="text-xs font-medium"
                    aria-label={`${suggestions.filter(s => s.status === 'new').length} pending suggestions`}
                  >
                    {suggestions.filter(s => s.status === 'new').length}
                  </Badge>
                )}
              </div>
            </div>
            <div className="flex items-center space-x-3">
              <KeyboardShortcuts />
              <ThemeToggle />
              <Button
                onClick={saveDocument}
                disabled={isSaving}
                size="lg"
                className="flex items-center gap-2 font-medium"
              >
                {isSaving ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                    <span>💾 Saving...</span>
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3-3m0 0l-3 3m3-3v12" />
                    </svg>
                    <span>Save</span>
                  </>
                )}
              </Button>
              <ExportButton />
              {process.env.NODE_ENV === 'development' && (
                <Button
                  onClick={() => {
                    // Test Sentry error reporting
                    throw new Error('Test error for Sentry monitoring');
                  }}
                  variant="destructive"
                  size="sm"
                  className="text-xs"
                  title="Test Sentry (Development only)"
                >
                  🐛 Test
                </Button>
              )}
            </div>
          </div>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Editor */}
          <div className="lg:col-span-2 order-2 lg:order-1">
            <div className="bg-white/90 dark:bg-slate-900/90 backdrop-blur-lg rounded-2xl shadow-2xl border border-white/30 dark:border-slate-700/30 overflow-hidden transition-colors duration-300">
              {/* Toolbar */}
              <div className="border-b border-slate-200/50 dark:border-slate-700/50 bg-slate-50/50 dark:bg-slate-800/50 p-3 lg:p-4 transition-colors duration-300">
                <div className="flex items-center space-x-1 lg:space-x-2 flex-wrap gap-1">
                {/* Undo/Redo */}
                <Button
                  onClick={() => tiptapEditor.chain().focus().undo().run()}
                  disabled={!tiptapEditor.can().undo()}
                  variant="ghost"
                  size="sm"
                  aria-label="Undo (Ctrl+Z)"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
                  </svg>
                </Button>
                <Button
                  onClick={() => tiptapEditor.chain().focus().redo().run()}
                  disabled={!tiptapEditor.can().redo()}
                  variant="ghost"
                  size="sm"
                  aria-label="Redo (Ctrl+Y)"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 10h-10a8 8 0 00-8 8v2m18-10l-6 6m6-6l-6-6" />
                  </svg>
                </Button>
                <div className="w-px h-6 bg-slate-300 dark:bg-slate-600"></div>
                
                                {/* Formatting */}
                <Toggle
                  pressed={tiptapEditor.isActive('bold')}
                  onPressedChange={() => tiptapEditor.chain().focus().toggleBold().run()}
                  size="sm"
                  aria-label="Bold (Ctrl+B)"
                >
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M5 2a1 1 0 000 2v12a1 1 0 001 1h4.5a4.5 4.5 0 001.242-8.757A4 4 0 0010.5 2H5zm5.5 6A2.5 2.5 0 008 5.5V8h2.5zM8 10v2.5a2.5 2.5 0 002.5 2.5H12a2.5 2.5 0 000-5H8z" />
                  </svg>
                </Toggle>
                <Toggle
                  pressed={tiptapEditor.isActive('italic')}
                  onPressedChange={() => tiptapEditor.chain().focus().toggleItalic().run()}
                  size="sm"
                  aria-label="Italic (Ctrl+I)"
                >
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M8 1a1 1 0 000 2h2.5L7 13H5a1 1 0 100 2h6a1 1 0 100-2H8.5l3.5-10H14a1 1 0 100-2H8z" />
                  </svg>
                </Toggle>
                <Toggle
                  pressed={tiptapEditor.isActive('underline')}
                  onPressedChange={() => tiptapEditor.chain().focus().toggleUnderline().run()}
                  size="sm"
                  aria-label="Underline (Ctrl+U)"
                >
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M4 16h12v1H4v-1zM6 3v6a4 4 0 008 0V3h-1v6a3 3 0 01-6 0V3H6z" />
                  </svg>
                </Toggle>
                <Toggle
                  pressed={tiptapEditor.isActive('strike')}
                  onPressedChange={() => tiptapEditor.chain().focus().toggleStrike().run()}
                  size="sm"
                  aria-label="Strikethrough"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 12h12" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 9l8 0" opacity="0.5" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 15l8 0" opacity="0.5" />
                  </svg>
                </Toggle>

                {/* Link */}
                <Toggle
                  pressed={tiptapEditor.isActive('link')}
                  onPressedChange={() => {
                    const url = window.prompt('Enter URL:');
                    if (url) {
                      tiptapEditor.chain().focus().setLink({ href: url }).run();
                    }
                  }}
                  size="sm"
                  aria-label="Add Link"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                  </svg>
                </Toggle>

                {/* Code Block */}
                <Toggle
                  pressed={tiptapEditor.isActive('codeBlock')}
                  onPressedChange={() => tiptapEditor.chain().focus().toggleCodeBlock().run()}
                  size="sm"
                  aria-label="Code Block"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 9l-3 3 3 3M16 9l3 3-3 3M12 12h.01" />
                  </svg>
                </Toggle>

                {/* Blockquote */}
                <Toggle
                  pressed={tiptapEditor.isActive('blockquote')}
                  onPressedChange={() => tiptapEditor.chain().focus().toggleBlockquote().run()}
                  size="sm"
                  aria-label="Blockquote"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 10h2a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v2a2 2 0 002 2zm10 0h2a2 2 0 002-2V6a2 2 0 00-2-2h-2a2 2 0 00-2 2v2a2 2 0 002 2z" />
                  </svg>
                </Toggle>

                {/* Horizontal Rule */}
                <Toggle
                  pressed={false}
                  onPressedChange={() => tiptapEditor.chain().focus().setHorizontalRule().run()}
                  size="sm"
                  aria-label="Horizontal Rule"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 12h16" />
                  </svg>
                </Toggle>

                <div className="w-px h-6 bg-slate-300 dark:bg-slate-600"></div>

                {/* Text Alignment */}
                <div className="flex space-x-1">
                  <Toggle
                    pressed={tiptapEditor.isActive({ textAlign: 'left' })}
                    onPressedChange={() => tiptapEditor.chain().focus().setTextAlign('left').run()}
                    size="sm"
                    aria-label="Align Left"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h10M4 18h14" />
                    </svg>
                  </Toggle>
                  <Toggle
                    pressed={tiptapEditor.isActive({ textAlign: 'center' })}
                    onPressedChange={() => tiptapEditor.chain().focus().setTextAlign('center').run()}
                    size="sm"
                    aria-label="Align Center"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M7 12h10M6 18h12" />
                    </svg>
                  </Toggle>
                  <Toggle
                    pressed={tiptapEditor.isActive({ textAlign: 'right' })}
                    onPressedChange={() => tiptapEditor.chain().focus().setTextAlign('right').run()}
                    size="sm"
                    aria-label="Align Right"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M10 12h10M8 18h12" />
                    </svg>
                  </Toggle>
                  <Toggle
                    pressed={tiptapEditor.isActive({ textAlign: 'justify' })}
                    onPressedChange={() => tiptapEditor.chain().focus().setTextAlign('justify').run()}
                    size="sm"
                    aria-label="Justify"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                    </svg>
                  </Toggle>
                </div>

                <div className="w-px h-6 bg-slate-300 dark:bg-slate-600"></div>
                  <button
                    onClick={() => tiptapEditor.chain().focus().toggleHeading({ level: 1 }).run()}
                    className={`px-3 py-1 rounded transition-colors ${
                      tiptapEditor.isActive('heading', { level: 1 }) 
                        ? 'bg-blue-100 dark:bg-blue-900/50 text-blue-800 dark:text-blue-200' 
                        : 'hover:bg-gray-100 dark:hover:bg-gray-800 text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    H1
                  </button>
                  <button
                    onClick={() => tiptapEditor.chain().focus().toggleHeading({ level: 2 }).run()}
                    className={`px-3 py-1 rounded transition-colors ${
                      tiptapEditor.isActive('heading', { level: 2 }) 
                        ? 'bg-blue-100 dark:bg-blue-900/50 text-blue-800 dark:text-blue-200' 
                        : 'hover:bg-gray-100 dark:hover:bg-gray-800 text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    H2
                  </button>
                  <button
                    onClick={() => tiptapEditor.chain().focus().setParagraph().run()}
                    className={`px-3 py-1 rounded transition-colors ${
                      tiptapEditor.isActive('paragraph') 
                        ? 'bg-blue-100 dark:bg-blue-900/50 text-blue-800 dark:text-blue-200' 
                        : 'hover:bg-gray-100 dark:hover:bg-gray-800 text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    P
                  </button>
                  <div className="w-px h-6 bg-gray-300 dark:bg-slate-600"></div>
                  <button
                    onClick={() => tiptapEditor.chain().focus().toggleBulletList().run()}
                    className={`px-3 py-1 rounded transition-colors ${
                      tiptapEditor.isActive('bulletList') 
                        ? 'bg-blue-100 dark:bg-blue-900/50 text-blue-800 dark:text-blue-200' 
                        : 'hover:bg-gray-100 dark:hover:bg-gray-800 text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    •
                  </button>
                  <button
                    onClick={() => tiptapEditor.chain().focus().toggleOrderedList().run()}
                    className={`px-3 py-1 rounded transition-colors ${
                      tiptapEditor.isActive('orderedList') 
                        ? 'bg-blue-100 dark:bg-blue-900/50 text-blue-800 dark:text-blue-200' 
                        : 'hover:bg-gray-100 dark:hover:bg-gray-800 text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    1.
                  </button>
                </div>
              </div>
              
              {/* Editor Content */}
              <div className="relative">
                <EditorContent editor={tiptapEditor} />
                {isLoading && (
                  <div className="absolute top-4 right-4 bg-gradient-to-r from-blue-500 to-indigo-600 text-white px-4 py-2 rounded-xl text-sm flex items-center space-x-3 shadow-lg backdrop-blur-lg border border-white/20">
                    <div className="relative">
                      <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent"></div>
                      <div className="absolute inset-0 rounded-full bg-white/20 animate-ping"></div>
                    </div>
                    <span className="font-medium">🔍 Analyzing writing...</span>
                  </div>
                )}
                
                {/* Enhanced Tooltip */}
                {tooltip.show && tooltip.element && (
                  <div
                    className="grammar-tooltip"
                    style={{
                      position: 'fixed',
                      top: tooltip.element.getBoundingClientRect().top - 60,
                      left: tooltip.element.getBoundingClientRect().left + (tooltip.element.offsetWidth / 2),
                      transform: 'translateX(-50%)',
                      zIndex: 1000,
                      maxWidth: '320px',
                      whiteSpace: 'pre-line',
                    }}
                  >
                    {tooltip.text}
                  </div>
                )}
                
                {/* Inline Accept/Reject Actions */}
                {inlineActions.show && inlineActions.element && (() => {
                  const suggestion = suggestions.find(s => s.id === inlineActions.suggestionId);
                  const rect = inlineActions.element.getBoundingClientRect();
                  
                  return (
                    <div
                      className="inline-actions fixed z-50 bg-white rounded-lg shadow-xl border border-gray-200 p-1 flex items-center space-x-1"
                      style={{
                        top: rect.bottom + 8,
                        left: rect.left + (rect.width / 2),
                        transform: 'translateX(-50%)',
                      }}
                    >
                      {suggestion?.replacements[0] && (
                        <button
                          onClick={() => handleApplySuggestion(inlineActions.suggestionId, suggestion.replacements[0])}
                          className="px-3 py-1 bg-green-600 text-white rounded text-xs font-medium hover:bg-green-700 transition-colors flex items-center space-x-1"
                          title={`Apply: "${suggestion.replacements[0]}"`}
                        >
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                          <span>Apply</span>
                        </button>
                      )}
                      <button
                        onClick={() => handleDismissSuggestion(inlineActions.suggestionId)}
                        className="px-3 py-1 bg-gray-600 text-white rounded text-xs font-medium hover:bg-gray-700 transition-colors flex items-center space-x-1"
                        title="Dismiss this suggestion"
                      >
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                        <span>Dismiss</span>
                      </button>
                      <button
                        onClick={() => setInlineActions({ show: false, element: null, suggestionId: '' })}
                        className="px-2 py-1 text-gray-400 hover:text-gray-600 transition-colors"
                        title="Close"
                      >
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  );
                })()}
              </div>
            </div>
          </div>
          
          {/* Suggestions Panel */}
          <aside className="lg:col-span-1 order-1 lg:order-2" role="complementary" aria-label="Writing suggestions">
            <div className="bg-white/90 dark:bg-slate-900/90 backdrop-blur-lg rounded-2xl shadow-2xl border border-white/30 dark:border-slate-700/30 p-6 lg:sticky lg:top-6 transition-colors duration-300">
              <h2 className="text-xl font-bold mb-6 flex items-center text-slate-800 dark:text-slate-200 transition-colors duration-300" id="suggestions-heading">
                <svg className="w-6 h-6 mr-3 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                </svg>
                Smart Suggestions
                {suggestions.filter(s => s.status === 'new').length > 0 && (
                  <Badge 
                    variant="destructive"
                    className="ml-auto text-xs font-medium"
                    aria-label={`${suggestions.filter(s => s.status === 'new').length} pending suggestions`}
                  >
                    {suggestions.filter(s => s.status === 'new').length}
                  </Badge>
                )}
              </h2>
              
              {grammarSource === 'languagetool' && (
                <div className="mb-4 p-2 rounded text-xs bg-green-50 text-green-700 border border-green-200">
                  ✓ Using LanguageTool for grammar checking
                </div>
              )}
              
              {suggestions.filter(s => s.status === 'new').length === 0 ? (
                <div className="text-center py-12">
                  <div className="bg-gradient-to-br from-green-100 to-emerald-100 rounded-full w-20 h-20 mx-auto mb-4 flex items-center justify-center">
                    <svg className="w-10 h-10 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <h3 className="font-semibold text-slate-800 dark:text-slate-200 mb-2 transition-colors duration-300">Perfect Writing! ✨</h3>
                  <p className="text-slate-600 dark:text-slate-400 text-sm leading-relaxed transition-colors duration-300">No suggestions yet. Start typing to see intelligent grammar and style recommendations.</p>
                </div>
              ) : (
                <div className="space-y-4 max-h-96 overflow-y-auto pr-2 custom-scrollbar">
                  {suggestions.filter(s => s.status === 'new').map((suggestion) => (
                    <div
                      key={suggestion.id}
                      className="group p-5 bg-gradient-to-br from-white to-slate-50 dark:from-slate-800 dark:to-slate-900 border border-slate-200/50 dark:border-slate-700/50 rounded-xl hover:shadow-lg hover:border-blue-200 dark:hover:border-blue-600 transition-all duration-300 hover:-translate-y-1"
                    >
                      <div className="flex justify-between items-start mb-3">
                        <span className={`inline-flex items-center text-xs px-3 py-1 rounded-full font-medium shadow-sm ${
                          suggestion.type === 'grammar' ? 'bg-gradient-to-r from-red-500 to-pink-500 text-white' :
                          suggestion.type === 'style' ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-white' :
                          'bg-gradient-to-r from-blue-500 to-indigo-500 text-white'
                        }`}>
                          {suggestion.type === 'grammar' ? '📝' : suggestion.type === 'style' ? '✨' : '🔤'} {suggestion.type}
                        </span>
                      </div>
                      
                      <div className="mb-4">
                        <p className="font-semibold text-red-700 mb-2 bg-red-50 px-3 py-1 rounded-lg border border-red-200">
                          "{suggestion.original}"
                        </p>
                        {suggestion.replacements[0] && (
                          <p className="font-semibold text-green-700 mb-3 bg-green-50 px-3 py-1 rounded-lg border border-green-200">
                            → "{suggestion.replacements[0]}"
                          </p>
                        )}
                        <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed bg-slate-50 dark:bg-slate-800 p-3 rounded-lg border border-slate-200 dark:border-slate-700 transition-colors duration-300">
                          {suggestion.explanation}
                        </p>
                      </div>
                      
                      <div className="flex space-x-2">
                        {suggestion.replacements[0] && (
                          <button
                            onClick={() => handleApplySuggestion(suggestion.id, suggestion.replacements[0])}
                            className="flex-1 px-4 py-2 bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-lg hover:from-green-700 hover:to-emerald-700 text-sm font-medium transition-all duration-200 hover:scale-105 hover:shadow-md"
                          >
                            ✓ Apply Fix
                          </button>
                        )}
                        <button
                          onClick={() => handleDismissSuggestion(suggestion.id)}
                          className="px-4 py-2 bg-gradient-to-r from-slate-500 to-slate-600 text-white rounded-lg hover:from-slate-600 hover:to-slate-700 text-sm font-medium transition-all duration-200 hover:scale-105"
                        >
                          ✕ Dismiss
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
};

export default Editor; 