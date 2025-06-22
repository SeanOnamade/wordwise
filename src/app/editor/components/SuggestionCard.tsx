'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Suggestion } from '@/store/editorStore';

interface SuggestionCardProps {
  suggestion: Suggestion;
  onApply: (id: string, replacement: string) => void;
  onDismiss: (id: string) => void;
  isApplying?: boolean;
  isDismissing?: boolean;
}

export default function SuggestionCard({
  suggestion,
  onApply,
  onDismiss,
  isApplying = false,
  isDismissing = false
}: SuggestionCardProps) {
  const { id, type, original, replacements, explanation } = suggestion;

  const handleApply = () => {
    if (replacements[0]) {
      onApply(id, replacements[0]);
    }
  };

  const handleDismiss = () => {
    onDismiss(id);
  };

  const getBadgeColor = (type: string) => {
    switch (type) {
      case 'grammar':
        return 'bg-red-600/20 text-red-300 hover:bg-red-600/30';
      case 'style':
        return 'bg-indigo-600/20 text-indigo-300 hover:bg-indigo-600/30';
      case 'spelling':
        return 'bg-purple-600/20 text-purple-300 hover:bg-purple-600/30';
      default:
        return 'bg-slate-600/20 text-slate-300 hover:bg-slate-600/30';
    }
  };

  return (
    <div className="p-4 border border-white/10 rounded-lg bg-white/5 backdrop-blur-sm hover:border-white/20 transition-colors shadow-lg">
      {/* Badge */}
      <div className="flex items-center justify-between mb-3">
        <Badge 
          variant="secondary"
          className={`text-xs font-medium px-2 py-1 rounded-full ${getBadgeColor(type)}`}
          title={explanation}
        >
          {type}
        </Badge>
      </div>

      {/* Diff View */}
      <div className="mb-4 space-y-2">
        {/* Original text with strikethrough */}
        <div className="flex items-start space-x-2">
          <span className="text-xs text-red-400 font-medium mt-0.5">−</span>
          <p className="text-sm text-red-300 line-through bg-red-500/10 px-2 py-1 rounded flex-1 backdrop-blur-sm">
            {original}
          </p>
        </div>

        {/* Replacement text */}
        {replacements[0] && (
          <div className="flex items-start space-x-2">
            <span className="text-xs text-green-400 font-medium mt-0.5">+</span>
            <p className="text-sm text-green-300 bg-green-500/10 px-2 py-1 rounded flex-1 backdrop-blur-sm">
              {replacements[0]}
            </p>
          </div>
        )}
      </div>

      {/* Explanation */}
      <p className="text-sm text-slate-200 mb-4 leading-relaxed">
        {explanation}
      </p>

      {/* Action Buttons */}
      <div className="flex space-x-2">
        {replacements[0] && (
          <Button
            size="sm"
            onClick={handleApply}
            className={`flex-1 bg-indigo-500 hover:bg-indigo-600 text-white text-xs py-1.5 backdrop-blur-sm ${
              isApplying ? 'cursor-not-allowed' : ''
            }`}
            title={`Apply suggestion: "${replacements[0]}"`}
            disabled={isApplying || isDismissing}
          >
            {isApplying ? (
              <div className="flex items-center justify-center">
                <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Applying...
              </div>
            ) : 'Apply'}
          </Button>
        )}
        <Button
          size="sm"
          variant="outline"
          onClick={handleDismiss}
          className={`flex-1 text-xs py-1.5 border-white/20 text-slate-200 hover:bg-white/10 hover:text-white backdrop-blur-sm ${
            isDismissing ? 'cursor-not-allowed' : ''
          }`}
          title="Dismiss this suggestion"
          disabled={isApplying || isDismissing}
        >
          {isDismissing ? (
            <div className="flex items-center justify-center">
              <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Dismissing...
            </div>
          ) : 'Dismiss'}
        </Button>
      </div>
    </div>
  );
} 