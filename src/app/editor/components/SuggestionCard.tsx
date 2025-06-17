'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

interface Suggestion {
  id: string;
  type: 'grammar' | 'style' | 'spelling';
  original: string;
  replacement?: string;
  explanation: string;
  status?: 'pending' | 'accepted' | 'rejected';
}

interface SuggestionCardProps {
  suggestion: Suggestion;
  onApply: (suggestionId: string, replacement: string) => void;
  onDismiss: (suggestionId: string) => void;
}

export default function SuggestionCard({ suggestion, onApply, onDismiss }: SuggestionCardProps) {
  const handleApply = () => {
    if (suggestion.replacement) {
      onApply(suggestion.id, suggestion.replacement);
    }
  };

  const handleDismiss = () => {
    onDismiss(suggestion.id);
  };

  const getBadgeVariant = (type: string) => {
    switch (type) {
      case 'grammar':
        return 'destructive';
      case 'style':
        return 'secondary';
      case 'spelling':
        return 'default';
      default:
        return 'secondary';
    }
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
          className={`text-xs font-medium px-2 py-1 rounded-full ${getBadgeColor(suggestion.type)}`}
        >
          {suggestion.type}
        </Badge>
      </div>

      {/* Diff View */}
      <div className="mb-4 space-y-2">
        {/* Original text with strikethrough */}
        <div className="flex items-start space-x-2">
          <span className="text-xs text-red-400 font-medium mt-0.5">−</span>
          <p className="text-sm text-red-300 line-through bg-red-500/10 px-2 py-1 rounded flex-1 backdrop-blur-sm">
            {suggestion.original}
          </p>
        </div>

        {/* Replacement text */}
        {suggestion.replacement && (
          <div className="flex items-start space-x-2">
            <span className="text-xs text-green-400 font-medium mt-0.5">+</span>
            <p className="text-sm text-green-300 bg-green-500/10 px-2 py-1 rounded flex-1 backdrop-blur-sm">
              {suggestion.replacement}
            </p>
          </div>
        )}
      </div>

      {/* Explanation */}
      <p className="text-sm text-slate-200 mb-4 leading-relaxed">
        {suggestion.explanation}
      </p>

      {/* Action Buttons */}
      <div className="flex space-x-2">
        {suggestion.replacement && (
          <Button
            size="sm"
            onClick={handleApply}
            className="flex-1 bg-indigo-500 hover:bg-indigo-600 text-white text-xs py-1.5 backdrop-blur-sm"
          >
            Apply
          </Button>
        )}
        <Button
          size="sm"
          variant="outline"
          onClick={handleDismiss}
          className="flex-1 text-xs py-1.5 border-white/20 text-slate-200 hover:bg-white/10 hover:text-white backdrop-blur-sm"
        >
          Dismiss
        </Button>
      </div>
    </div>
  );
} 