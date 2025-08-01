'use client';

import { useState, useMemo } from 'react';
import { useEditorStore, Suggestion } from '@/store/editorStore';
import SuggestionCard from './SuggestionCard';
import { Badge } from '@/components/ui/badge';

interface SuggestionDrawerProps {
  editor: any;
  isLoading?: boolean;
  onSuggestionApplied?: () => Promise<void>;
}

export default function SuggestionDrawer({ editor, isLoading = false, onSuggestionApplied }: SuggestionDrawerProps) {
  const { updateSuggestionStatus, getActiveSuggestions } = useEditorStore();
  const [applyingId, setApplyingId] = useState<string | null>(null);
  const [dismissingId, setDismissingId] = useState<string | null>(null);
  
  // Get all active suggestions from both grammar and smart review systems
  const allSuggestions = getActiveSuggestions();
  
  // Filter and sort suggestions
  const visible = useMemo(() => {
    // Remove duplicates by keeping first occurrence of each id
    const uniqueSuggestions = allSuggestions.reduce<Suggestion[]>((acc, curr) => {
      if (!acc.some(s => s.id === curr.id)) {
        acc.push(curr);
      }
      return acc;
    }, []);

    // Filter active suggestions and sort by position
    const sorted = uniqueSuggestions
      .filter(s => s.status === 'new')
      .sort((a, b) => {
        // Primary sort: position in text (range.from)
        const positionDiff = a.range.from - b.range.from;
        if (positionDiff !== 0) return positionDiff;
        
        // Secondary sort: rule key
        const ruleKeyDiff = a.ruleKey.localeCompare(b.ruleKey);
        if (ruleKeyDiff !== 0) return ruleKeyDiff;
        
        // Tertiary sort: range.to
        return a.range.to - b.range.to;
      });

    // Debug log
    console.log('📑 SORTED combined suggestions:', sorted.map(s => [s.type, s.ruleKey, s.range.from]));

    return sorted;
  }, [allSuggestions]);

  const handleApplySuggestion = async (suggestionId: string, replacement: string) => {
    setApplyingId(suggestionId);
    
    try {
      const suggestion = allSuggestions.find(s => s.id === suggestionId);
      
      if (suggestion && editor) {
        const { from, to } = suggestion.range;
        const originalLength = to - from;
        const newLength = replacement.length;
        const lengthDiff = newLength - originalLength;

        console.log('🔄 Applying suggestion from drawer:', {
          suggestionId,
          type: suggestion.type,
          original: suggestion.original,
          replacement,
          range: { from, to },
          lengthDiff
        });

        // Use TipTap's precise replacement method
        const { view } = editor;
        const { state } = view;
        
        // Create a transaction to replace the text
        const tr = state.tr.replaceWith(from, to, state.schema.text(replacement));
        view.dispatch(tr);
        
        // Update suggestion status
        updateSuggestionStatus(suggestionId, 'applied');
        
        // Update ranges of all remaining suggestions that come after this one
        const { updateSuggestionRanges } = useEditorStore.getState();
        if (updateSuggestionRanges && lengthDiff !== 0) {
          console.log('📐 Updating ranges for remaining suggestions from drawer');
          updateSuggestionRanges(from, lengthDiff, suggestionId);
        }
        
        // Force refresh of decorations for both systems
        setTimeout(() => {
          const { view } = editor;
          const tr = view.state.tr;
          tr.setMeta('grammarSuggestionsChanged', true);
          tr.setMeta('smartReviewSuggestionsChanged', true);
          tr.setMeta('forceUpdate', true);
          view.dispatch(tr);
        }, 50);

        // Trigger immediate autosave after suggestion application
        if (onSuggestionApplied) {
          console.log('💾 Triggering immediate autosave after suggestion application in drawer');
          await onSuggestionApplied();
        }
      }
    } catch (error) {
      console.error('Error applying suggestion:', error);
    } finally {
      setApplyingId(null);
    }
  };

  const handleDismissSuggestion = async (suggestionId: string) => {
    setDismissingId(suggestionId);
    
    try {
      updateSuggestionStatus(suggestionId, 'dismissed');
      
      // Force refresh of decorations for both systems
      if (editor) {
        setTimeout(() => {
          const { view } = editor;
          const tr = view.state.tr;
          tr.setMeta('grammarSuggestionsChanged', true);
          tr.setMeta('smartReviewSuggestionsChanged', true);
          tr.setMeta('forceUpdate', true);
          view.dispatch(tr);
        }, 100);
      }
    } catch (error) {
      console.error('Error dismissing suggestion:', error);
    } finally {
      setDismissingId(null);
    }
  };

  return (
    <div className="h-full flex flex-col bg-transparent backdrop-blur-md">
      {/* Header */}
      <div className="flex-shrink-0 border-b border-white/10 bg-white/5 backdrop-blur-md z-10">
        <div className="px-4 py-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-100">
              Writing Suggestions
            </h3>
            {visible.length > 0 && (
              <Badge variant="secondary" className="text-xs bg-indigo-500/90 text-white backdrop-blur-sm">
                {visible.length}
              </Badge>
            )}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-transparent">
        <div className="p-4">
          {isLoading ? (
            /* Loading State */
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="bg-white/5 backdrop-blur-sm rounded-lg p-4 animate-pulse">
                  <div className="h-4 bg-slate-600/50 rounded w-3/4 mb-2"></div>
                  <div className="h-3 bg-slate-600/50 rounded w-1/2 mb-4"></div>
                  <div className="flex space-x-2">
                    <div className="h-8 bg-slate-600/50 rounded w-20"></div>
                    <div className="h-8 bg-slate-600/50 rounded w-20"></div>
                  </div>
                </div>
              ))}
            </div>
          ) : visible.length === 0 ? (
            /* Empty State */
            <div className="flex flex-col items-center justify-center min-h-[400px] text-center">
              <div className="w-16 h-16 bg-green-500/20 backdrop-blur-sm rounded-full flex items-center justify-center mb-4 animate-pulse">
                <svg 
                  className="w-8 h-8 text-green-400" 
                  fill="none" 
                  stroke="currentColor" 
                  viewBox="0 0 24 24"
                >
                  <path 
                    strokeLinecap="round" 
                    strokeLinejoin="round" 
                    strokeWidth={2} 
                    d="M5 13l4 4L19 7" 
                  />
                </svg>
              </div>
              <h3 className="text-lg font-medium text-slate-300 mb-2">
                All Clear!
              </h3>
              <p className="text-sm text-slate-400 max-w-xs">
                Your writing looks great! No suggestions at the moment.
              </p>
              <div className="mt-6 text-xs text-slate-500">
                Start typing to get real-time suggestions
              </div>
            </div>
          ) : (
            /* Suggestions List */
            <div className="space-y-4 pb-4">
              {visible.map((suggestion) => (
                <SuggestionCard
                  key={suggestion.id}
                  suggestion={suggestion}
                  onApply={handleApplySuggestion}
                  onDismiss={handleDismissSuggestion}
                  isApplying={applyingId === suggestion.id}
                  isDismissing={dismissingId === suggestion.id}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
} 