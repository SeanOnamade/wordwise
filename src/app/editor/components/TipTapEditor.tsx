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
import Placeholder from '@tiptap/extension-placeholder';

// Remove unused imports
const unusedImports = [
  'SmartReviewSuggestion',
  'SmartReviewIssue',
  'EditorStore'
].join(', ');

// Plugin key for suggestion highlights
const suggestionHighlightKey = new PluginKey('suggestionHighlight');

// Performance-optimized highlight colors
const getHighlightColor = (type: string): string => {
  const colors = {
    grammar: 'rgba(239, 68, 68, 0.2)', // red-500 with 20% opacity
    style: 'rgba(245, 158, 11, 0.2)',  // amber-500 with 20% opacity
    spelling: 'rgba(59, 130, 246, 0.2)', // blue-500 with 20% opacity
    smart: 'rgba(147, 51, 234, 0.2)'  // purple-500 with 20% opacity
  };
  return colors[type as keyof typeof colors] || colors.grammar;
};

const getHighlightBorder = (type: string): string => {
  const colors = {
    grammar: '#ef4444', // red-500
    style: '#f59e0b',   // amber-500
    spelling: '#3b82f6', // blue-500
    smart: '#9333ea'    // purple-500
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
    
    // For smart review suggestions, adjust the range to include the full word
    if (type === 'smart') {
      // Expand range to include the full word
      const text = doc.textBetween(from, to);
      if (text.startsWith(' ')) from += 1;
      if (text.endsWith(' ')) to -= 1;
    }
    
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

// Create optimized suggestion highlight plugin for grammar suggestions
const createGrammarHighlightPlugin = () => {
  let currentSuggestions: Suggestion[] = [];
  let recalculateTimeout: NodeJS.Timeout | null = null;
  
  const recalculatePositions = (doc: any, suggestions: Suggestion[]) => {
    if (!suggestions?.length) return suggestions;
    
    return suggestions.map(suggestion => {
      const { range, type, id, status } = suggestion;
      if (status !== 'new') return suggestion;
      
      let { from, to } = range;
      
      // Get the text of the original suggestion
      const originalText = doc.textBetween(from, to);
      
      // Find this text in the document starting from the original position
      const searchStartPos = Math.max(0, from - 100); // Look back up to 100 chars
      const searchEndPos = Math.min(doc.content.size, to + 100); // Look forward up to 100 chars
      const searchArea = doc.textBetween(searchStartPos, searchEndPos);
      
      // Find the text in the search area
      const relativePos = searchArea.indexOf(originalText);
      if (relativePos !== -1) {
        // Adjust positions based on the found text
        from = searchStartPos + relativePos;
        to = from + originalText.length;
      }
      
      return {
        ...suggestion,
        range: { from, to }
      };
    });
  };
  
  return new Plugin({
    key: new PluginKey('grammarHighlight'),
    state: {
      init() {
        return DecorationSet.empty;
      },
      apply(tr, old) {
        // Handle new suggestions
        const newSuggestions = tr.getMeta('grammarSuggestions');
        if (newSuggestions !== undefined) {
          currentSuggestions = newSuggestions;
          return createDecorations(tr.doc, currentSuggestions);
        }

        // Handle suggestion dismissal
        const dismissedInfo = tr.getMeta('dismissedSuggestion');
        if (dismissedInfo) {
          const { id } = dismissedInfo;
          currentSuggestions = currentSuggestions.filter(s => s.id !== id);
          return createDecorations(tr.doc, currentSuggestions);
        }

        // For force updates
        if (tr.getMeta('forceUpdate')) {
          return createDecorations(tr.doc, currentSuggestions);
        }

        // If there are document changes, debounce recalculation
        if (tr.docChanged) {
          if (recalculateTimeout) {
            clearTimeout(recalculateTimeout);
          }
          
          recalculateTimeout = setTimeout(() => {
            const updatedSuggestions = recalculatePositions(tr.doc, currentSuggestions);
            currentSuggestions = updatedSuggestions;
            
            // Trigger a simple force update by setting a flag
            // The component will handle the actual update
            if (typeof window !== 'undefined') {
              window.dispatchEvent(new CustomEvent('highlightRecalculated', {
                detail: { type: 'grammar', suggestions: updatedSuggestions }
              }));
            }
          }, 2000); // 2 second debounce
          
          // Return current decorations for now
          return createDecorations(tr.doc, currentSuggestions);
        }

        return old;
      }
    },
    props: {
      decorations(state) {
        return this.getState(state);
      }
    }
  });
};

// Create optimized suggestion highlight plugin for smart review suggestions
const createSmartReviewHighlightPlugin = () => {
  let currentSuggestions: Suggestion[] = [];
  let recalculateTimeout: NodeJS.Timeout | null = null;
  
  const recalculatePositions = (doc: any, suggestions: Suggestion[]) => {
    if (!suggestions?.length) return suggestions;
    
    return suggestions.map(suggestion => {
      const { range, type, id, status } = suggestion;
      if (status !== 'new') return suggestion;
      
      let { from, to } = range;
      
      // Get the text of the original suggestion
      const originalText = doc.textBetween(from, to);
      
      // Find this text in the document starting from the original position
      const searchStartPos = Math.max(0, from - 100); // Look back up to 100 chars
      const searchEndPos = Math.min(doc.content.size, to + 100); // Look forward up to 100 chars
      const searchArea = doc.textBetween(searchStartPos, searchEndPos);
      
      // Find the text in the search area
      const relativePos = searchArea.indexOf(originalText);
      if (relativePos !== -1) {
        // Adjust positions based on the found text
        from = searchStartPos + relativePos;
        to = from + originalText.length;
      }
      
      return {
        ...suggestion,
        range: { from, to }
      };
    });
  };
  
  return new Plugin({
    key: new PluginKey('smartReviewHighlight'),
    state: {
      init() {
        return DecorationSet.empty;
      },
      apply(tr, oldDecorations) {
        // Handle new suggestions
        const newSuggestions = tr.getMeta('smartReviewSuggestions');
        if (newSuggestions !== undefined) {
          currentSuggestions = newSuggestions;
          return createDecorations(tr.doc, currentSuggestions);
        }

        // Handle suggestion dismissal
        const dismissedInfo = tr.getMeta('dismissedSuggestion');
        if (dismissedInfo) {
          const { id } = dismissedInfo;
          currentSuggestions = currentSuggestions.filter(s => s.id !== id);
          return createDecorations(tr.doc, currentSuggestions);
        }

        // For force updates
        if (tr.getMeta('forceUpdate') || tr.getMeta('smartReviewSuggestionsChanged')) {
          return createDecorations(tr.doc, currentSuggestions);
        }

        // If there are document changes, debounce recalculation
        if (tr.docChanged) {
          if (recalculateTimeout) {
            clearTimeout(recalculateTimeout);
          }
          
          recalculateTimeout = setTimeout(() => {
            const updatedSuggestions = recalculatePositions(tr.doc, currentSuggestions);
            currentSuggestions = updatedSuggestions;
            
            // Trigger a simple force update by setting a flag
            // The component will handle the actual update
            if (typeof window !== 'undefined') {
              window.dispatchEvent(new CustomEvent('highlightRecalculated', {
                detail: { type: 'smartReview', suggestions: updatedSuggestions }
              }));
            }
          }, 2000); // 2 second debounce
          
          // Return current decorations for now
          return createDecorations(tr.doc, currentSuggestions);
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

// Create extensions that add the plugins
const GrammarHighlightExtension = Extension.create({
  name: 'grammarHighlight',
  addProseMirrorPlugins() {
    return [createGrammarHighlightPlugin()];
  }
});

const SmartReviewHighlightExtension = Extension.create({
  name: 'smartReviewHighlight',
  addProseMirrorPlugins() {
    return [createSmartReviewHighlightPlugin()];
  }
});

interface TipTapEditorProps {
  content?: string;
  suggestions: Suggestion[];
  onUpdate?: (content: string) => void;
  onTextChange?: (text: string) => void;
  onEditorCreate?: (editor: any) => void;
  onGrammarCheckStart?: () => void;
  onGrammarCheckEnd?: () => void;
  onSuggestionApplied?: () => Promise<void>;
}

export default function TipTapEditor({
  content = '',
  suggestions = [],
  onUpdate,
  onTextChange,
  onEditorCreate,
  onGrammarCheckStart,
  onGrammarCheckEnd,
  onSuggestionApplied
}: TipTapEditorProps) {
  
  const updateTimeoutRef = useRef<NodeJS.Timeout>();
  const lastSuggestionsRef = useRef<Suggestion[]>([]);
  const lastCheckRef = useRef<string>('');
  const { 
    addGrammarSuggestion, 
    updateGrammarSuggestions,
    clearGrammarSuggestions, 
    updateSuggestionStatus, 
    setWordCount,
    grammarSuggestions,
    smartReviewSuggestions,
    getActiveSuggestions
  } = useEditorStore();

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

  // Debounced grammar check - now only affects grammar suggestions
  const debouncedGrammarCheck = useRef(
    debounce(async (rawText: string) => {
      if (rawText.length < 3 || rawText === lastCheckRef.current) return;
      lastCheckRef.current = rawText;
      
      try {
        onGrammarCheckStart?.();
        
        // Clear only grammar suggestions
        clearGrammarSuggestions();
        
        // Get new suggestions from LanguageTool
        const grammarSuggestions = await checkText(rawText);
        
        // Update only grammar suggestions
        updateGrammarSuggestions(grammarSuggestions);
        
        console.log('📝 Grammar check update (isolated):', {
          newGrammarCount: grammarSuggestions.length,
          smartReviewCount: smartReviewSuggestions.length
        });
      } catch (error) {
        console.error('Grammar check failed:', error);
      } finally {
        onGrammarCheckEnd?.();
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
        'Mod-.': () => {
          // Navigate to next suggestion
          const activeSuggestions = getActiveSuggestions().filter(s => s.status === 'new');
          if (activeSuggestions.length > 0) {
            const sortedSuggestions = activeSuggestions.sort((a, b) => a.range.from - b.range.from);
            const currentPos = this.editor.state.selection.from;
            const nextSuggestion = sortedSuggestions.find(s => s.range.from > currentPos) || sortedSuggestions[0];
            
            this.editor.commands.setTextSelection({ from: nextSuggestion.range.from, to: nextSuggestion.range.to });
            console.log('🔍 Navigated to next suggestion:', nextSuggestion.ruleKey);
          }
          return true;
        },
        'Mod-,': () => {
          // Navigate to previous suggestion
          const activeSuggestions = getActiveSuggestions().filter(s => s.status === 'new');
          if (activeSuggestions.length > 0) {
            const sortedSuggestions = activeSuggestions.sort((a, b) => b.range.from - a.range.from);
            const currentPos = this.editor.state.selection.from;
            const prevSuggestion = sortedSuggestions.find(s => s.range.from < currentPos) || sortedSuggestions[0];
            
            this.editor.commands.setTextSelection({ from: prevSuggestion.range.from, to: prevSuggestion.range.to });
            console.log('🔍 Navigated to previous suggestion:', prevSuggestion.ruleKey);
          }
          return true;
        },
      }
    }
  });

  // Memoized extensions array with separated plugins
  const extensions = useMemo(() => [
    StarterKit.configure({
      history: {
        depth: 100,
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
    GrammarHighlightExtension,
    SmartReviewHighlightExtension,
    Placeholder.configure({
      placeholder: 'Start writing your masterpiece...',
    }),
  ], []);
  
  // Performance-optimized update handler
  const handleUpdate = useCallback(({ editor, transaction }: { editor: any, transaction?: any }) => {
    // Debounce content updates to prevent excessive re-renders
    if (updateTimeoutRef.current) {
      clearTimeout(updateTimeoutRef.current);
    }
    
    updateTimeoutRef.current = setTimeout(() => {
      const html = editor.getHTML();
      const text = editor.getText();
      
      // Only check for suggestion dismissal if there's an actual text change
      if (transaction?.docChanged) {
        const { from, to } = transaction;
        const activeSuggestion = getActiveSuggestions().find((s: Suggestion) => 
          s.status === 'new' && 
          s.range.from <= from && 
          s.range.to >= to
        );
        
        if (activeSuggestion) {
          console.log('🎯 Dismissing suggestion due to text change:', activeSuggestion.id);
          updateSuggestionStatus(activeSuggestion.id, 'dismissed');
          // Also dismiss any active tooltip
          setTooltip({ show: false, suggestion: null, position: { x: 0, y: 0 }, element: null });
        }
        
        // Additionally check if any active tooltip's suggestion was affected by the edit
        if (tooltip.show && tooltip.suggestion) {
          const tooltipRange = tooltip.suggestion.range;
          if (from <= tooltipRange.to && to >= tooltipRange.from) {
            // The edit overlaps with the tooltip's suggestion range
            setTooltip({ show: false, suggestion: null, position: { x: 0, y: 0 }, element: null });
          }
        }
      }
      
      onUpdate?.(html);
      onTextChange?.(text);
      
      // Run grammar check on the plain text
      if (text.trim().length >= 3) {
        debouncedGrammarCheck(text);
      }
    }, 100); // 100ms debounce for content updates
  }, [getActiveSuggestions, updateSuggestionStatus, onUpdate, onTextChange, debouncedGrammarCheck, tooltip, setTooltip]);
  
  // Create editor with performance optimizations
  const editor = useEditor({
    extensions,
    content,
    onUpdate: handleUpdate,
    onSelectionUpdate: ({ editor }) => {
      // Dismiss tooltip when user starts selecting text
      if (editor.state.selection.from !== editor.state.selection.to) {
        setTooltip({ show: false, suggestion: null, position: { x: 0, y: 0 }, element: null });
      }
    },
    editorProps: {
      attributes: {
        class: 'prose prose-lg max-w-none focus:outline-none min-h-[400px] p-4 editor-content',
        'data-placeholder': 'Start writing...',
        spellcheck: 'false',
      },
      transformPastedHTML: (html) => {
        return html.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
      },
    },
    immediatelyRender: false,
    shouldRerenderOnTransaction: false,
  });

  // Update editor content when content prop changes
  useEffect(() => {
    if (editor && content !== editor.getHTML()) {
      editor.commands.setContent(content);
    }
  }, [editor, content]);

  // Notify parent when editor is created and initialize word count
  useEffect(() => {
    if (editor && onEditorCreate) {
      console.log('🔄 Editor instance created and passed to parent');
      onEditorCreate(editor);
      
      // Initialize word count
      const text = editor.getText();
      const wordCount = text.trim().split(/\s+/).filter(Boolean).length;
      setWordCount(wordCount);
    }
  }, [editor, onEditorCreate, setWordCount]);

  // Return editor instance on cleanup
  useEffect(() => {
    return () => {
      if (editor && onEditorCreate) {
        console.log('🔄 Editor instance cleanup');
        onEditorCreate(null);
      }
    };
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

  // Handle suggestion dismissal
  const handleDismissSuggestion = useCallback((suggestionId: string) => {
    const suggestion = getActiveSuggestions().find(s => s.id === suggestionId);
    if (!suggestion) return;
    
    console.log('🎯 Dismissing suggestion:', {
      id: suggestionId,
      type: suggestion.type,
      range: suggestion.range
    });
    
    // Update suggestion status
    updateSuggestionStatus(suggestionId, 'dismissed');
    
    // Hide tooltip
    setTooltip({ show: false, suggestion: null, position: { x: 0, y: 0 }, element: null });
    
    // Force refresh of decorations with dismissal info
    if (editor) {
      const { view } = editor;
      const tr = view.state.tr;
      
      // Add dismissal metadata but DON'T update ranges since this is a manual dismissal
      tr.setMeta('dismissedSuggestion', {
        id: suggestionId,
        range: suggestion.range,
        skipRangeUpdate: true // Add flag to indicate this is a manual dismissal
      });
      
      // Update appropriate suggestion system
      if (suggestion.type === 'smart') {
        tr.setMeta('smartReviewSuggestionsChanged', true);
      } else {
        tr.setMeta('grammarSuggestionsChanged', true);
      }
      
      tr.setMeta('forceUpdate', true);
      view.dispatch(tr);
    }
  }, [editor, getActiveSuggestions, updateSuggestionStatus, setTooltip]);

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
        const suggestion = getActiveSuggestions().find(s => s.id === suggestionId);
        
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

    // Handle click on highlights
    const handleHighlightClick = (event: Event) => {
      const target = event.target as HTMLElement;
      const highlight = target.closest('[data-suggestion-id]') as HTMLElement;
      
      if (highlight && highlight.dataset.suggestionId) {
        const suggestionId = highlight.dataset.suggestionId;
        // Dismiss the suggestion
        handleDismissSuggestion(suggestionId);
        // Prevent any default editor behavior
        event.preventDefault();
        event.stopPropagation();
      }
    };

    editorElement.addEventListener('mouseover', handleHighlightHover, true);
    editorElement.addEventListener('mouseout', handleHighlightLeave, true);
    editorElement.addEventListener('click', handleHighlightClick, true);

    return () => {
      editorElement.removeEventListener('mouseover', handleHighlightHover, true);
      editorElement.removeEventListener('mouseout', handleHighlightLeave, true);
      editorElement.removeEventListener('click', handleHighlightClick, true);
    };
  }, [editor, getActiveSuggestions, showTooltip, hideTooltip, handleDismissSuggestion]);

  // Update grammar suggestions when they change
  useEffect(() => {
    if (!editor) return;
    
    const timeoutId = setTimeout(() => {
      const { view } = editor;
      if (!view) return;
      
      const tr = view.state.tr;
      tr.setMeta('grammarSuggestions', grammarSuggestions);
      tr.setMeta('forceUpdate', true);
      view.dispatch(tr);
    }, 0);
    
    return () => clearTimeout(timeoutId);
  }, [editor, grammarSuggestions]);

  // Update smart review suggestions when they change
  useEffect(() => {
    if (!editor) return;
    
    const timeoutId = setTimeout(() => {
      const { view } = editor;
      if (!view) return;
      
      const tr = view.state.tr;
      tr.setMeta('smartReviewSuggestions', smartReviewSuggestions);
      tr.setMeta('forceUpdate', true);
      view.dispatch(tr);
    }, 0);
    
    return () => clearTimeout(timeoutId);
  }, [editor, smartReviewSuggestions]);

  // Listen for highlight recalculation events
  useEffect(() => {
    if (!editor) return;

    const handleHighlightRecalculated = (event: CustomEvent) => {
      const { type, suggestions } = event.detail;
      
      console.log('🔄 Highlight recalculated:', { type, count: suggestions.length });
      
      // Force a decoration update
      const { view } = editor;
      if (!view) return;
      
      const tr = view.state.tr;
      if (type === 'grammar') {
        tr.setMeta('grammarSuggestions', suggestions);
      } else if (type === 'smartReview') {
        tr.setMeta('smartReviewSuggestions', suggestions);
      }
      tr.setMeta('forceUpdate', true);
      view.dispatch(tr);
    };

    window.addEventListener('highlightRecalculated', handleHighlightRecalculated as EventListener);
    
    return () => {
      window.removeEventListener('highlightRecalculated', handleHighlightRecalculated as EventListener);
    };
  }, [editor]);
  
  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (updateTimeoutRef.current) {
        clearTimeout(updateTimeoutRef.current);
      }
    };
  }, []);

  // Handle suggestion application
  const handleApplySuggestion = useCallback(async (suggestionId: string, replacement: string) => {
    if (!editor) return;
    
    const suggestion = getActiveSuggestions().find(s => s.id === suggestionId);
    if (!suggestion) return;

    const { from, to } = suggestion.range;
    
    // Get the text content around the suggestion
    const doc = editor.state.doc;
    const beforeChar = from > 0 ? doc.textBetween(from - 1, from) : '';
    const afterChar = to < doc.content.size ? doc.textBetween(to, to + 1) : '';
    
    // Clean up the replacement text
    const cleanReplacement = replacement.trim();
    
    // Only preserve spaces if they exist in the original text
    const shouldPreserveLeadingSpace = beforeChar === ' ' && suggestion.original.startsWith(' ');
    const shouldPreserveTrailingSpace = afterChar === ' ' && suggestion.original.endsWith(' ');
    
    // Build the final replacement text with preserved spaces only if they existed in original
    const finalReplacement = `${shouldPreserveLeadingSpace ? ' ' : ''}${cleanReplacement}${shouldPreserveTrailingSpace ? ' ' : ''}`;
    
    // Calculate length differences for range updates
    const originalLength = to - from;
    const newLength = finalReplacement.length;
    const lengthDiff = newLength - originalLength;

    console.log('🔄 Applying suggestion:', {
      suggestionId,
      original: suggestion.original,
      replacement: finalReplacement,
      range: { from, to },
      lengthDiff,
      context: {
        beforeChar,
        afterChar,
        preserveLeading: shouldPreserveLeadingSpace,
        preserveTrailing: shouldPreserveTrailingSpace
      }
    });

    // Use TipTap's transaction system for precise replacement
    const { view } = editor;
    const { state } = view;
    
    // Create a transaction to replace the text
    const tr = state.tr.replaceWith(from, to, state.schema.text(finalReplacement));
    view.dispatch(tr);

    // Update suggestion status
    updateSuggestionStatus(suggestionId, 'applied');
    
    // Update ranges of all remaining suggestions that come after this one
    const { updateSuggestionRanges } = useEditorStore.getState();
    if (updateSuggestionRanges && lengthDiff !== 0) {
      console.log('📐 Updating ranges for remaining suggestions');
      updateSuggestionRanges(from, lengthDiff, suggestionId);
    }
    
    // Hide tooltip
    setTooltip({ show: false, suggestion: null, position: { x: 0, y: 0 }, element: null });

    // Force refresh of decorations after suggestion application
    setTimeout(() => {
      const { view } = editor;
      const tr = view.state.tr;
      tr.setMeta('suggestionsChanged', true);
      tr.setMeta('forceUpdate', true);
      view.dispatch(tr);
    }, 50);

    // Trigger immediate autosave after suggestion application
    if (onSuggestionApplied) {
      console.log('💾 Triggering immediate autosave after suggestion application in TipTapEditor');
      await onSuggestionApplied();
    }
  }, [editor, getActiveSuggestions, updateSuggestionStatus, onSuggestionApplied]);

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
      <div className="bg-slate-50 rounded-2xl overflow-hidden">
        {/* Loading Toolbar */}
        <div className="overflow-x-auto bg-slate-100 dark:bg-slate-200 text-slate-800 shadow-inner rounded-t-xl">
          <div className="flex gap-1 px-3 py-2 min-w-max animate-pulse">
            {[...Array(12)].map((_, i) => (
              <div key={i} className="h-8 w-8 bg-slate-200 rounded"></div>
            ))}
          </div>
        </div>
        {/* Loading Content */}
        <div className="p-6 space-y-4 animate-pulse">
          {/* Title-like */}
          <div className="h-6 bg-slate-200 rounded w-1/2"></div>
          {/* Paragraphs */}
          <div className="space-y-3">
            <div className="h-4 bg-slate-200 rounded w-full"></div>
            <div className="h-4 bg-slate-200 rounded w-5/6"></div>
            <div className="h-4 bg-slate-200 rounded w-4/5"></div>
          </div>
          <div className="space-y-3">
            <div className="h-4 bg-slate-200 rounded w-full"></div>
            <div className="h-4 bg-slate-200 rounded w-3/4"></div>
            <div className="h-4 bg-slate-200 rounded w-4/5"></div>
          </div>
          <div className="space-y-3">
            <div className="h-4 bg-slate-200 rounded w-5/6"></div>
            <div className="h-4 bg-slate-200 rounded w-full"></div>
            <div className="h-4 bg-slate-200 rounded w-4/5"></div>
          </div>
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
          cursor: pointer;
          user-select: none;
          -webkit-user-select: none;
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
        .hl-smart {
          background-color: rgba(147, 51, 234, 0.2) !important;
          border-bottom-color: #9333ea !important;
        }
        .hl-smart:hover {
          background-color: rgba(147, 51, 234, 0.35) !important;
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
              tooltip.suggestion.type === 'smart' ? 'bg-purple-100 text-purple-800' :
              'bg-purple-100 text-purple-800'
            }`}>
              {tooltip.suggestion.type}
            </span>
          </div>

          {/* Original → Replacement (only for non-smart suggestions) */}
          {tooltip.suggestion.type !== 'smart' && (
            <div className="mb-3">
              <div className="flex items-center space-x-2 text-sm">
                <span className="text-red-600 line-through">{tooltip.suggestion.original}</span>
                <span className="text-gray-400">→</span>
                <span className="text-green-600 font-medium">
                  {tooltip.suggestion.replacements && tooltip.suggestion.replacements.length > 0 
                    ? tooltip.suggestion.replacements[0] 
                    : 'No replacement available'}
                </span>
              </div>
            </div>
          )}
          
          {/* Smart Review - just show the highlighted text */}
          {tooltip.suggestion.type === 'smart' && (
            <div className="mb-3">
              <div className="text-sm">
                <span className="text-purple-400 font-medium">"{tooltip.suggestion.original}"</span>
              </div>
            </div>
          )}

          {/* Explanation */}
          <p className="text-sm text-gray-600 mb-3">
            {tooltip.suggestion.explanation}
          </p>

          {/* Action Buttons */}
          <div className="flex space-x-2">
            {tooltip.suggestion?.type === 'smart' ? (
              // Smart Review suggestions only have Dismiss
              <button
                onClick={() => handleDismissSuggestion(tooltip.suggestion!.id)}
                className="flex-1 px-3 py-1 bg-gray-600 text-white rounded text-sm font-medium hover:bg-gray-700 transition-colors"
              >
                Dismiss
              </button>
            ) : (
              // Grammar suggestions have Apply + Dismiss
              <>
                <button
                  onClick={() => {
                    if (tooltip.suggestion?.replacements && tooltip.suggestion.replacements.length > 0) {
                      handleApplySuggestion(tooltip.suggestion.id, tooltip.suggestion.replacements[0]);
                    }
                  }}
                  disabled={!tooltip.suggestion?.replacements || tooltip.suggestion.replacements.length === 0}
                  className="flex-1 px-3 py-1 bg-green-600 text-white rounded text-sm font-medium hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Apply
                </button>
                <button
                  onClick={() => handleDismissSuggestion(tooltip.suggestion!.id)}
                  className="flex-1 px-3 py-1 bg-gray-600 text-white rounded text-sm font-medium hover:bg-gray-700 transition-colors"
                >
                  Dismiss
                </button>
              </>
            )}
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