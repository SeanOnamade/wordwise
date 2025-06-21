interface Position {
  start: number;
  end: number;
}

interface TipTapToPlainTextMap {
  text: string;
  positions: Position[];
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

// Convert TipTap JSON to plain text while maintaining position mapping
function convertTipTapToPlainText(html: string): TipTapToPlainTextMap {
  // Create a temporary div to parse HTML
  const div = document.createElement('div');
  div.innerHTML = html;
  
  const positions: Position[] = [];
  let plainText = '';
  let htmlIndex = 0;

  // Recursive function to process nodes
  function processNode(node: Node) {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = node.textContent || '';
      const start = plainText.length;
      plainText += text;
      positions.push({ start, end: plainText.length });
      htmlIndex += text.length;
    } else if (node.nodeType === Node.ELEMENT_NODE) {
      // Skip certain elements
      if ((node as Element).tagName === 'SCRIPT' || (node as Element).tagName === 'STYLE') {
        return;
      }
      
      // Process child nodes
      node.childNodes.forEach(processNode);
      
      // Add space after block elements
      if (window.getComputedStyle(node as Element).display === 'block') {
        plainText += '\n';
        htmlIndex++;
      }
    }
  }

  processNode(div);
  return { text: plainText, positions };
}

// Map plain text position back to TipTap position
function mapPlainTextToTipTap(plainTextPos: number, positions: Position[]): number {
  for (const pos of positions) {
    if (plainTextPos >= pos.start && plainTextPos <= pos.end) {
      return pos.start + (plainTextPos - pos.start);
    }
  }
  return plainTextPos;
}

// Helper to map LanguageTool categories to our types
function mapLTCategory(categoryId: string): 'spelling' | 'grammar' | 'style' {
  if (categoryId.toLowerCase().includes('spell')) return 'spelling';
  if (categoryId.toLowerCase().includes('style')) return 'style';
  return 'grammar';
}

// Convert LanguageTool suggestion to our format
function convertLTSuggestion(match: LTMatch, positions: Position[]): GrammarSuggestion {
  // TEMP LOG – remove after working
  console.log('🟡 RAW', match.rule.id, match);

  const start = match.offset;
  const end = start + match.length;
  const original = match.context?.text.slice(start, end) || '';

  return {
    id: crypto.randomUUID(),
    type: mapLTCategory(match.rule.category.id),
    ruleKey: match.rule.id,
    original,
    replacements: match.replacements?.map(r => r.value) ?? [],
    explanation: match.message,
    range: { from: start, to: end },
    status: 'new'
  };
}

export async function checkText(content: string, lang = 'en-US'): Promise<GrammarSuggestion[]> {
  try {
    const ltUrl = (process.env.NEXT_PUBLIC_LT_URL || 'http://localhost:8010') + '/v2/check';
    
    // Convert TipTap HTML to plain text while maintaining position mapping
    const { text, positions } = convertTipTapToPlainText(content);
    
    // Call LanguageTool API
    const response = await fetch(ltUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        text: text,
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
    return data.matches.map(match => convertLTSuggestion(match, positions));
  } catch (error) {
    console.error('Grammar check failed:', error);
    return [];
  }
} 