import { useCallback, useState } from 'react';
import { useEditorStore } from '@/store/editorStore';
import { checkWithLanguageTool } from '@/lib/languageTool';
import debounce from 'lodash/debounce';

export interface Suggestion {
  id: string;
  start: number;
  end: number;
  replacement: string;
  type: string;
  rule: string;
  message: string;
}

export function useGrammarCheck() {
  const { addSuggestion, clearSuggestions } = useEditorStore();
  const [isChecking, setIsChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const checkGrammar = useCallback(
    debounce(async (currentText: string) => {
      if (!currentText.trim()) {
        clearSuggestions();
        return;
      }

      setIsChecking(true);
      setError(null);

      try {
        // Get suggestions from LanguageTool
        const matches = await checkWithLanguageTool(currentText);

        // Clear existing suggestions
        clearSuggestions();

        // Map LT matches to our suggestion format
        const suggestions: Suggestion[] = matches.map(m => ({
          id: crypto.randomUUID(),
          start: m.offset,
          end: m.offset + m.length,
          replacement: m.replacements[0]?.value ?? '',
          type: m.rule.category.name.toLowerCase(),
          rule: m.rule.id,
          message: m.message
        }));

        // Add each suggestion to the store
        suggestions.forEach(addSuggestion);

      } catch (err) {
        console.error('Grammar check failed:', err);
        setError(err instanceof Error ? err.message : 'Grammar check failed');
      } finally {
        setIsChecking(false);
      }
    }, 1000),
    [addSuggestion, clearSuggestions]
  );

  return {
    checkGrammar,
    isChecking,
    error
  };
} 