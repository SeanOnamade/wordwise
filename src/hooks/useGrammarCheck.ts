import { useCallback, useState } from 'react';
import { useEditorStore, Suggestion } from '@/store/editorStore';
import { checkWithLanguageTool } from '@/lib/languageTool';
import debounce from 'lodash/debounce';

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
          type: (m.rule.category.name.toLowerCase() === 'grammar' ? 'grammar' :
                m.rule.category.name.toLowerCase() === 'style' ? 'style' : 'spelling') as 'grammar' | 'style' | 'spelling',
          ruleKey: m.rule.id,
          original: currentText.slice(m.offset, m.offset + m.length),
          replacements: m.replacements.map(r => r.value),
          explanation: m.message,
          range: { from: m.offset, to: m.offset + m.length },
          status: 'new'
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