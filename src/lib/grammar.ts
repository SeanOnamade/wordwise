interface Position {
  start: number;
  end: number;
}

interface LTMatch {
  message: string;
  shortMessage: string;
  replacements: { value: string }[];
  offset: number;
  length: number;
  rule: {
    id: string;
    description: string;
    category: {
      id: string;
      name: string;
    };
  };
  context?: {
    text: string;
  };
}

interface LTResponse {
  matches: LTMatch[];
}

interface GrammarSuggestion {
  id: string;
  type: 'spelling' | 'grammar' | 'style';
  ruleKey: string;
  original: string;
  replacements: string[];
  explanation: string;
  range: { from: number; to: number };
  status: 'new' | 'applied' | 'dismissed';
}

// Helper to map LanguageTool categories to our types
function mapLTCategory(categoryId: string): 'spelling' | 'grammar' | 'style' {
  if (categoryId.toLowerCase().includes('spell')) return 'spelling';
  if (categoryId.toLowerCase().includes('style')) return 'style';
  return 'grammar';
}

// Find exact word boundaries in text and adjust for TipTap document structure
function findWordBoundaries(text: string, searchText: string, startOffset: number): { from: number; to: number } | null {
  // Clean the search text
  const cleanSearchText = searchText.trim();
  if (!cleanSearchText) return null;
  
  // Find the word starting from the offset
  const contextStart = Math.max(0, startOffset - 50);
  const contextEnd = Math.min(text.length, startOffset + cleanSearchText.length + 50);
  const context = text.substring(contextStart, contextEnd);
  
  // Create a regex to find the exact word
  const escapedText = cleanSearchText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const wordRegex = new RegExp(`\\b${escapedText}\\b`, 'gi');
  
  let match;
  while ((match = wordRegex.exec(context)) !== null) {
    const absoluteStart = contextStart + match.index;
    const absoluteEnd = absoluteStart + match[0].length;
    
    // Check if this match is close to our expected offset
    if (Math.abs(absoluteStart - startOffset) <= 5) {
      // Adjust positions for TipTap document structure
      // TipTap adds 1 position for the opening paragraph node
      const adjustedFrom = absoluteStart + 1;
      const adjustedTo = absoluteEnd + 1;
      
      return {
        from: adjustedFrom,
        to: adjustedTo
      };
    }
  }
  
  // Fallback: use the original offset but trim whitespace and adjust for document structure
  const originalText = text.substring(startOffset, startOffset + cleanSearchText.length);
  const trimStart = originalText.search(/\S/);
  const trimEnd = originalText.search(/\s*$/);
  
  const fallbackFrom = startOffset + (trimStart >= 0 ? trimStart : 0) + 1;
  const fallbackTo = startOffset + (trimEnd >= 0 ? trimEnd : cleanSearchText.length) + 1;
  
  return {
    from: fallbackFrom,
    to: fallbackTo
  };
}

// Convert LanguageTool suggestion to our format
function convertLTSuggestion(match: LTMatch, fullText: string): GrammarSuggestion {
  // TEMP LOG – remove after working
  console.log('🟡 RAW', match.rule.id, match);

  // Extract the original text from the match
  const originalFromContext = fullText.substring(match.offset, match.offset + match.length);
  
  // Find exact word boundaries
  const boundaries = findWordBoundaries(fullText, originalFromContext, match.offset);
  const range = boundaries || { from: match.offset + 1, to: match.offset + match.length + 1 };

  console.log('📍 Position mapping:', {
    original: { from: match.offset, to: match.offset + match.length },
    adjusted: range,
    text: originalFromContext,
    fullTextPreview: fullText.slice(Math.max(0, match.offset - 10), match.offset + match.length + 10)
  });

  return {
    id: crypto.randomUUID(),
    type: mapLTCategory(match.rule.category.id),
    ruleKey: match.rule.id,
    original: originalFromContext.trim(),
    replacements: match.replacements?.map(r => r.value) ?? [],
    explanation: match.message,
    range,
    status: 'new'
  };
}

export async function checkText(plainText: string, lang = 'en-US'): Promise<GrammarSuggestion[]> {
  try {
    const ltUrl = (process.env.NEXT_PUBLIC_LT_URL || 'http://localhost:8010') + '/v2/check';
    
    // Use the plain text directly - no HTML conversion needed
    console.log('📝 Checking text:', { length: plainText.length, preview: plainText.slice(0, 100) });
    
    // Call LanguageTool API
    const response = await fetch(ltUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        text: plainText,
        language: lang,
        enabledOnly: 'false',
        level: 'picky',
        disabledRules: 'WHITESPACE_RULE'  // Ignore HTML whitespace
      }).toString(),
    });

    if (!response.ok) {
      throw new Error(`LanguageTool API error: ${response.status}`);
    }

    const data: LTResponse = await response.json();
    
    // ‼️ probe
    console.log('🟡 RAW matches', data.matches.length, data.matches);
    
    // Convert LanguageTool suggestions to our format
    return data.matches.map(match => convertLTSuggestion(match, plainText));
  } catch (error) {
    console.error('Grammar check failed:', error);
    return [];
  }
} 