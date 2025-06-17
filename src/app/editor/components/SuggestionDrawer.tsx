'use client';

import { useState } from 'react';
import { useEditorStore } from '@/store/editorStore';
import SuggestionCard from './SuggestionCard';
import { Badge } from '@/components/ui/badge';

interface SuggestionDrawerProps {
  editor: any;
}

export default function SuggestionDrawer({ editor }: SuggestionDrawerProps) {
  const { suggestions, updateSuggestionStatus } = useEditorStore();
  
  const pendingSuggestions = suggestions.filter(s => s.status === 'pending');

  const handleApplySuggestion = (suggestionId: string, replacement: string) => {
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
      updateSuggestionStatus(suggestionId, 'accepted');
      
      // Force refresh of decorations to remove highlights
      setTimeout(() => {
        const { view } = editor;
        const tr = view.state.tr;
        tr.setMeta('suggestionsChanged', true);
        view.dispatch(tr);
      }, 100);
    } else {
      console.log('Cannot apply suggestion: editor not ready or suggestion not found');
    }
  };

  const handleDismissSuggestion = (suggestionId: string) => {
    updateSuggestionStatus(suggestionId, 'rejected');
    
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

  return (
    <div className="h-full flex flex-col bg-transparent backdrop-blur-md">
      {/* Header */}
      <div className="border-b border-white/10 bg-white/5 backdrop-blur-md sticky top-0 z-10">
        <div className="px-4 py-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-100">
              Writing Suggestions
            </h3>
            {pendingSuggestions.length > 0 && (
              <Badge variant="secondary" className="text-xs bg-indigo-500 text-white">
                {pendingSuggestions.length}
              </Badge>
            )}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        <div className="p-4">
          {pendingSuggestions.length === 0 ? (
            /* Empty State */
            <div className="flex flex-col items-center justify-center h-64 text-center">
              <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mb-4">
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
              <h3 className="text-lg font-medium text-slate-400 mb-2">
                All Clear!
              </h3>
              <p className="text-sm text-slate-400 max-w-xs">
                Your writing looks great! No suggestions at the moment.
              </p>
            </div>
          ) : (
            /* Suggestions List */
            <div className="space-y-4">
              {pendingSuggestions.map((suggestion) => (
                <SuggestionCard
                  key={suggestion.id}
                  suggestion={suggestion}
                  onApply={handleApplySuggestion}
                  onDismiss={handleDismissSuggestion}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
} 