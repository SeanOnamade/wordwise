'use client';

import { useEditorStore } from '@/store/editorStore';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { X, AlertCircle, TrendingUp, FileText } from 'lucide-react';
import { useState, useCallback, useEffect } from 'react';
import { Editor } from '@tiptap/react';
import { SmartReview, SmartReviewIssue } from '@/types/SmartReview';

interface SmartReviewDrawerProps {
  editor: Editor | null;
  onClose: () => void;
}

export default function SmartReviewDrawer({ editor, onClose }: SmartReviewDrawerProps) {
  const { 
    smartReview,
    addSmartReviewSuggestion,
    clearSmartReviewSuggestions,
    updateSmartReviewIssueStatus,
    closeSmartReview,
    setSmartReviewError,
    setSmartReviewLoading
  } = useEditorStore();
  


  // Convert Smart Review issues to editor suggestions (for highlighting only)
  const convertIssuesToSuggestions = useCallback((issues: SmartReviewIssue[]) => {
    return issues
      .filter((issue): issue is SmartReviewIssue & { range: { from: number; to: number } } => !!issue.range)
      .map(issue => ({
        id: issue.id,
        type: 'smart' as const,
        ruleKey: 'smart-review',
        original: issue.excerpt,
        replacements: [], // No replacements for tooltip-only suggestions
        explanation: issue.explanation,
        range: issue.range,
        status: 'new' as const
      }));
  }, []);

  // When Smart Review data is received
  useEffect(() => {
    if (!smartReview?.data?.issues || !editor) return;

    // Use a small delay to prevent setState during render issues
    const timeoutId = setTimeout(() => {
      // Double-check that data still exists
      if (!smartReview?.data?.issues) return;
      
      // Clear existing smart review suggestions first
      clearSmartReviewSuggestions();
      
      // Convert issues to suggestions and add them to the smart review store
      const suggestions = convertIssuesToSuggestions(smartReview.data.issues);
      suggestions.forEach(suggestion => {
        if (suggestion.range) {
          console.log('🟢 Adding smart review suggestion:', suggestion.id, suggestion.original);
          addSmartReviewSuggestion(suggestion);
        }
      });

      // Force refresh decorations
      const { view } = editor;
      if (!view) return;
      
      const tr = view.state.tr;
      tr.setMeta('smartReviewSuggestionsChanged', true);
      tr.setMeta('forceUpdate', true);
      view.dispatch(tr);
    }, 0);

    // Cleanup function
    return () => {
      clearTimeout(timeoutId);
      // Clear smart review suggestions when drawer closes
      if (editor?.view) {
        console.log('🧹 Clearing smart review suggestions on drawer close');
        clearSmartReviewSuggestions();
        const tr = editor.view.state.tr;
        tr.setMeta('smartReviewSuggestionsChanged', true);
        tr.setMeta('forceUpdate', true);
        editor.view.dispatch(tr);
      }
    };
  }, [smartReview?.data, editor, convertIssuesToSuggestions, addSmartReviewSuggestion, clearSmartReviewSuggestions]);





  // Early return if drawer is not open or smartReview is undefined
  if (!smartReview?.isOpen) return null;

  // Render loading state
  if (smartReview.loading) {
    return (
      <div className="h-full flex flex-col bg-transparent backdrop-blur-md">
        <div className="border-b border-white/10 bg-white/5 backdrop-blur-md sticky top-0 z-10">
          <div className="px-4 py-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-100 flex items-center gap-2">
                <TrendingUp className="w-4 h-4" />
                Smart Review
              </h3>
              <Button
                variant="ghost"
                size="sm"
                onClick={onClose}
                className="text-slate-400 hover:text-slate-200 h-6 w-6 p-0"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto">
          <div className="p-4 space-y-6">
            <div className="space-y-4">
              {/* Metrics Loading */}
              <div className="bg-white/5 rounded-lg p-4 animate-pulse">
                <div className="h-5 bg-slate-600 rounded w-1/4 mb-6"></div>
                <div className="space-y-6">
                  {/* Clarity */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="h-4 bg-slate-600 rounded w-20"></div>
                      <div className="h-4 bg-slate-600 rounded w-12"></div>
                    </div>
                    <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
                      <div className="h-full bg-purple-600/30 rounded-full w-3/4 animate-pulse"></div>
                    </div>
                    <div className="h-3 bg-slate-600 rounded w-full"></div>
                  </div>
                  {/* Academic Tone */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="h-4 bg-slate-600 rounded w-24"></div>
                      <div className="h-4 bg-slate-600 rounded w-12"></div>
                    </div>
                    <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
                      <div className="h-full bg-purple-600/30 rounded-full w-1/2 animate-pulse"></div>
                    </div>
                    <div className="h-3 bg-slate-600 rounded w-full"></div>
                  </div>
                  {/* Sentence Complexity */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="h-4 bg-slate-600 rounded w-32"></div>
                      <div className="h-4 bg-slate-600 rounded w-12"></div>
                    </div>
                    <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
                      <div className="h-full bg-purple-600/30 rounded-full w-2/3 animate-pulse"></div>
                    </div>
                    <div className="h-3 bg-slate-600 rounded w-full"></div>
                  </div>
                </div>
              </div>
              {/* Issues Loading */}
              <div className="bg-white/5 rounded-lg p-4 animate-pulse">
                <div className="h-5 bg-slate-600 rounded w-1/4 mb-6"></div>
                <div className="space-y-4">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="bg-white/5 rounded-lg p-4">
                      <div className="flex items-center gap-2 mb-3">
                        <div className="h-4 w-4 rounded-full bg-purple-600/30 animate-pulse"></div>
                        <div className="h-4 bg-slate-600 rounded w-3/4"></div>
                      </div>
                      <div className="h-3 bg-slate-600 rounded w-full"></div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Render error state
  if (smartReview.error) {
    return (
      <div className="h-full flex flex-col bg-transparent backdrop-blur-md">
        <div className="border-b border-white/10 bg-white/5 backdrop-blur-md sticky top-0 z-10">
          <div className="px-4 py-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-100 flex items-center gap-2">
                <TrendingUp className="w-4 h-4" />
                Smart Review
              </h3>
              <Button
                variant="ghost"
                size="sm"
                onClick={onClose}
                className="text-slate-400 hover:text-slate-200 h-6 w-6 p-0"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto">
          <div className="p-4">
            <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4">
              <div className="flex items-center gap-2 text-red-400 mb-2">
                <AlertCircle className="w-4 h-4" />
                <span className="font-medium">Error</span>
              </div>
              <p className="text-sm text-red-300">{smartReview.error}</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Early return if no data
  if (!smartReview.data) return null;

  return (
    <div className="h-full flex flex-col bg-transparent backdrop-blur-md">
      {/* Header */}
      <div className="border-b border-white/10 bg-white/5 backdrop-blur-md sticky top-0 z-10">
        <div className="px-4 py-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-100 flex items-center gap-2">
              <TrendingUp className="w-4 h-4" />
              Smart Review
            </h3>
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              className="text-slate-400 hover:text-slate-200 h-6 w-6 p-0"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        <div className="p-4 space-y-6">
          {/* Metrics Section */}
          <div className="bg-white/5 rounded-lg p-4">
            <h4 className="text-sm font-medium text-slate-200 mb-4 flex items-center gap-2">
              <TrendingUp className="w-4 h-4" />
              Writing Metrics
            </h4>
            <div className="space-y-4">
              {/* Clarity Score */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-medium">Clarity</h3>
                  <span className="text-sm text-slate-400">{smartReview.data.metrics.clarity.score}/100</span>
                </div>
                <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-purple-600 to-purple-400 transition-all duration-500"
                    style={{ width: `${smartReview.data.metrics.clarity.score}%` }}
                  />
                </div>
                <p className="text-sm text-slate-400">{smartReview.data.metrics.clarity.explanation}</p>
              </div>

              {/* Academic Tone Score */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-medium">Academic Tone</h3>
                  <span className="text-sm text-slate-400">{smartReview.data.metrics.academic_tone.score}/100</span>
                </div>
                <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-purple-600 to-purple-400 transition-all duration-500"
                    style={{ width: `${smartReview.data.metrics.academic_tone.score}%` }}
                  />
                </div>
                <p className="text-sm text-slate-400">{smartReview.data.metrics.academic_tone.explanation}</p>
              </div>

              {/* Sentence Complexity Score */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-medium">Sentence Complexity</h3>
                  <span className="text-sm text-slate-400">{smartReview.data.metrics.sentence_complexity.score}/100</span>
                </div>
                <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-purple-600 to-purple-400 transition-all duration-500"
                    style={{ width: `${smartReview.data.metrics.sentence_complexity.score}%` }}
                  />
                </div>
                <p className="text-sm text-slate-400">{smartReview.data.metrics.sentence_complexity.explanation}</p>
              </div>
            </div>
          </div>

          {/* Issues Section */}
          {smartReview.data.issues.length > 0 && (
            <div className="bg-white/5 rounded-lg p-4">
              <h4 className="text-sm font-medium text-slate-200 mb-4 flex items-center gap-2">
                <FileText className="w-4 h-4" />
                Writing Issues
              </h4>
              <div className="space-y-4">
                {smartReview.data.issues.map((issue) => (
                  <div key={issue.id} className="bg-white/5 rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <AlertCircle className="w-4 h-4 text-purple-400" />
                      <p className="text-sm font-medium text-slate-200">{issue.excerpt}</p>
                    </div>
                    <p className="text-sm text-slate-400">{issue.explanation}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
} 