'use client';

import { useEditorStore } from '@/store/editorStore';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { X, AlertCircle, CheckCircle, TrendingUp, FileText, Lightbulb } from 'lucide-react';

export default function SmartReviewDrawer() {
  const { smartReview, closeSmartReview } = useEditorStore();

  if (!smartReview.isOpen) return null;

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
              onClick={closeSmartReview}
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
          {smartReview.loading ? (
            /* Loading State */
            <div className="space-y-4">
              <div className="bg-white/5 rounded-lg p-4 animate-pulse">
                <div className="h-5 bg-slate-600 rounded w-3/4 mb-3"></div>
                <div className="space-y-2">
                  <div className="h-3 bg-slate-600 rounded w-full"></div>
                  <div className="h-3 bg-slate-600 rounded w-4/5"></div>
                </div>
              </div>
              <div className="bg-white/5 rounded-lg p-4 animate-pulse">
                <div className="h-5 bg-slate-600 rounded w-1/2 mb-3"></div>
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="h-3 bg-slate-600 rounded w-20"></div>
                    <div className="h-2 bg-slate-600 rounded flex-1"></div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="h-3 bg-slate-600 rounded w-20"></div>
                    <div className="h-2 bg-slate-600 rounded flex-1"></div>
                  </div>
                </div>
              </div>
            </div>
          ) : smartReview.error ? (
            /* Error State */
            <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4">
              <div className="flex items-center gap-2 text-red-400 mb-2">
                <AlertCircle className="w-4 h-4" />
                <span className="font-medium">Error</span>
              </div>
              <p className="text-sm text-red-300">{smartReview.error}</p>
            </div>
          ) : smartReview.data ? (
            /* Results */
            <>
              {/* Metrics Section */}
              <div className="bg-white/5 rounded-lg p-4">
                <h4 className="text-sm font-medium text-slate-200 mb-4 flex items-center gap-2">
                  <TrendingUp className="w-4 h-4" />
                  Writing Metrics
                </h4>
                <div className="space-y-4">
                  {/* Clarity */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm text-slate-300">Clarity</span>
                      <span className="text-sm font-medium text-slate-200">
                        {smartReview.data.metrics.clarity.score}%
                      </span>
                    </div>
                    <div className="w-full h-2 bg-slate-600 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-blue-500 to-blue-400 transition-all duration-300"
                        style={{ 
                          width: `${smartReview.data.metrics.clarity.score}%` 
                        }}
                      />
                    </div>
                    <p className="text-xs text-slate-400 mt-1">
                      {smartReview.data.metrics.clarity.comment}
                    </p>
                  </div>

                  {/* Academic Tone */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm text-slate-300">Academic Tone</span>
                      <span className="text-sm font-medium text-slate-200">
                        {smartReview.data.metrics.academic_tone.score}%
                      </span>
                    </div>
                    <div className="w-full h-2 bg-slate-600 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-purple-500 to-purple-400 transition-all duration-300"
                        style={{ 
                          width: `${smartReview.data.metrics.academic_tone.score}%` 
                        }}
                      />
                    </div>
                    <p className="text-xs text-slate-400 mt-1">
                      {smartReview.data.metrics.academic_tone.comment}
                    </p>
                  </div>

                  {/* Sentence Complexity */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm text-slate-300">Sentence Complexity</span>
                      <span className="text-sm font-medium text-slate-200">
                        {smartReview.data.metrics.sentence_complexity.score}%
                      </span>
                    </div>
                    <div className="w-full h-2 bg-slate-600 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-green-500 to-green-400 transition-all duration-300"
                        style={{ 
                          width: `${smartReview.data.metrics.sentence_complexity.score}%` 
                        }}
                      />
                    </div>
                    <p className="text-xs text-slate-400 mt-1">
                      {smartReview.data.metrics.sentence_complexity.comment}
                    </p>
                  </div>
                </div>
              </div>

              {/* Issues Section */}
              {smartReview.data.issues.length > 0 && (
                <div className="bg-white/5 rounded-lg p-4">
                  <h4 className="text-sm font-medium text-slate-200 mb-4 flex items-center gap-2">
                    <FileText className="w-4 h-4" />
                    Potential Issues
                  </h4>
                  <div className="space-y-3">
                    {smartReview.data.issues.map((issue, index) => (
                      <div
                        key={index}
                        className="bg-white/5 rounded-md p-3 border border-white/10"
                      >
                        <div className="text-sm text-slate-200 font-medium mb-1">
                          "{issue.excerpt}"
                        </div>
                        <div className="text-xs text-slate-400">
                          {issue.explanation}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Suggestions Section */}
              {smartReview.data.suggestions.length > 0 && (
                <div className="bg-white/5 rounded-lg p-4">
                  <h4 className="text-sm font-medium text-slate-200 mb-4 flex items-center gap-2">
                    <Lightbulb className="w-4 h-4" />
                    Next Steps
                  </h4>
                  <ul className="space-y-2">
                    {smartReview.data.suggestions.map((suggestion, index) => (
                      <li
                        key={index}
                        className="text-sm text-slate-300 flex items-start gap-2"
                      >
                        <span className="text-indigo-400 mt-0.5">•</span>
                        {suggestion}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          ) : (
            /* Empty State */
            <div className="flex flex-col items-center justify-center h-64 text-center">
              <div className="w-16 h-16 bg-indigo-500/20 rounded-full flex items-center justify-center mb-4">
                <TrendingUp className="w-8 h-8 text-indigo-400" />
              </div>
              <h3 className="text-lg font-medium text-slate-400 mb-2">
                No Analysis Yet
              </h3>
              <p className="text-sm text-slate-400 max-w-xs">
                Click the Smart Review button to get AI-powered insights about your writing.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
} 