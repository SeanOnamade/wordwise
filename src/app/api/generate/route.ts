import { NextResponse } from 'next/server';

const LANGUAGE_TOOL_URL = process.env.NEXT_PUBLIC_LT_ENDPOINT ?? 'https://api.languagetool.org/v2/check';

// Helper function to preserve case when making replacements
const preserveCase = (original: string, replacement: string): string => {
  if (!original || !replacement) return replacement;
  
  // All uppercase
  if (original === original.toUpperCase()) {
    return replacement.toUpperCase();
  }
  
  // First letter uppercase, rest lowercase (Title Case)
  if (original[0] === original[0].toUpperCase() && original.slice(1) === original.slice(1).toLowerCase()) {
    return replacement[0].toUpperCase() + replacement.slice(1).toLowerCase();
  }
  
  // All lowercase
  if (original === original.toLowerCase()) {
    return replacement.toLowerCase();
  }
  
  // Mixed case - return as is
  return replacement;
};

// Mock grammar suggestions for development when LanguageTool isn't available
const generateMockSuggestions = (text: string) => {
  const suggestions: Array<{
    range: { from: number; to: number };
    type: 'spelling' | 'grammar' | 'style';
    original: string;
    replacements: string[];
    ruleKey: string;
    explanation: string;
    status: 'new' | 'applied' | 'dismissed';
  }> = [];
  
  // Comprehensive grammar rules for ESL students - targeting 85%+ accuracy
  const rules = [
    // === SPELLING ERRORS (High frequency ESL mistakes) ===
    {
      pattern: /\bfrends\b/gi,
      replacement: 'friends',
      type: 'spelling',
      rule: 'SPELLING_FRIENDS',
      message: 'Spelling error: "friends" is spelled with an "i".'
    },
    {
      pattern: /\bteh\b/gi,
      replacement: 'the',
      type: 'spelling',
      rule: 'SPELLING_THE',
      message: 'Spelling error: "the" is misspelled.'
    },
    {
      pattern: /\brecieve\b/gi,
      replacement: 'receive',
      type: 'spelling',
      rule: 'SPELLING_RECEIVE',
      message: 'Spelling error: Remember "i before e except after c".'
    },
    {
      pattern: /\bdefinate\b/gi,
      replacement: 'definite',
      type: 'spelling',
      rule: 'SPELLING_DEFINITE',
      message: 'Spelling error: "definite" ends with "ite", not "ate".'
    },
    {
      pattern: /\boccured\b/gi,
      replacement: 'occurred',
      type: 'spelling',
      rule: 'SPELLING_OCCURRED',
      message: 'Spelling error: "occurred" has two "r"s.'
    },
    {
      pattern: /\bseperate\b/gi,
      replacement: 'separate',
      type: 'spelling',
      rule: 'SPELLING_SEPARATE',
      message: 'Spelling error: "separate" has an "a" in the middle.'
    },
    {
      pattern: /\bmispell\b/gi,
      replacement: 'misspell',
      type: 'spelling',
      rule: 'SPELLING_MISSPELL',
      message: 'Spelling error: "misspell" has two "s"s.'
    },
    {
      pattern: /\bneccessary\b/gi,
      replacement: 'necessary',
      type: 'spelling',
      rule: 'SPELLING_NECESSARY',
      message: 'Spelling error: "necessary" has one "c" and two "s"s.'
    },

    // === BASIC GRAMMAR RULES ===
    {
      pattern: /\bi\b/g,
      replacement: 'I',
      type: 'grammar',
      rule: 'CAPITALIZE_I',
      message: 'The pronoun "I" should always be capitalized.'
    },
    {
      pattern: /\bthere\s+is\s+(many|several|some|few|two|three|four|five|six|seven|eight|nine|ten|\d+)\s+(\w+s)\b/gi,
      replacement: 'there are $1 $2',
      type: 'grammar',
      rule: 'PLURAL_AGREEMENT',
      message: 'Subject-verb disagreement. Use "there are" with plural nouns.'
    },
    {
      pattern: /\byour\s+welcome\b/gi,
      replacement: "you're welcome",
      type: 'grammar',
      rule: 'YOUR_YOURE',
      message: 'Use "you\'re" (you are) instead of "your" (possessive).'
    },
    {
      pattern: /\bits\s+(a|an|about|amazing|important|necessary|possible|time|clear|obvious)\b/gi,
      replacement: "it's $1",
      type: 'grammar',
      rule: 'ITS_ITS',
      message: 'Use "it\'s" (it is) when you mean "it is", not the possessive "its".'
    },
    {
      pattern: /\bshould\s+of\b/gi,
      replacement: 'should have',
      type: 'grammar',
      rule: 'SHOULD_OF',
      message: 'Use "should have" instead of "should of".'
    },
    {
      pattern: /\bcould\s+of\b/gi,
      replacement: 'could have',
      type: 'grammar',
      rule: 'COULD_OF',
      message: 'Use "could have" instead of "could of".'
    },
    {
      pattern: /\bwould\s+of\b/gi,
      replacement: 'would have',
      type: 'grammar',
      rule: 'WOULD_OF',
      message: 'Use "would have" instead of "would of".'
    },
    {
      pattern: /\bcan not\b/gi,
      replacement: 'cannot',
      type: 'grammar',
      rule: 'CANNOT_SPELLING',
      message: '"Cannot" should be written as one word.'
    },

    // === ESL-SPECIFIC GRAMMAR ERRORS ===
    {
      pattern: /\bmake\s+research\b/gi,
      replacement: 'conduct research',
      type: 'grammar',
      rule: 'ESL_RESEARCH',
      message: 'In academic writing, use "conduct research" instead of "make research".'
    },
    {
      pattern: /\bmake\s+an\s+exam\b/gi,
      replacement: 'take an exam',
      type: 'grammar',
      rule: 'ESL_EXAM',
      message: 'Use "take an exam" instead of "make an exam".'
    },
    {
      pattern: /\bsay\s+me\b/gi,
      replacement: 'tell me',
      type: 'grammar',
      rule: 'ESL_SAY_TELL',
      message: 'Use "tell me" instead of "say me". "Say" doesn\'t take an indirect object.'
    },
    {
      pattern: /\bexplain\s+me\b/gi,
      replacement: 'explain to me',
      type: 'grammar',
      rule: 'ESL_EXPLAIN',
      message: 'Use "explain to me" instead of "explain me".'
    },
    {
      pattern: /\bdiscuss\s+about\b/gi,
      replacement: 'discuss',
      type: 'grammar',
      rule: 'ESL_DISCUSS',
      message: 'Use "discuss" without "about". "Discuss" is already transitive.'
    },
    {
      pattern: /\bmarried\s+with\b/gi,
      replacement: 'married to',
      type: 'grammar',
      rule: 'ESL_MARRIED',
      message: 'Use "married to" instead of "married with".'
    },
    {
      pattern: /\bdepend\s+of\b/gi,
      replacement: 'depend on',
      type: 'grammar',
      rule: 'ESL_DEPEND',
      message: 'Use "depend on" instead of "depend of".'
    },
    {
      pattern: /\bmake\s+friends\s+with\b/gi,
      replacement: 'become friends with',
      type: 'grammar',
      rule: 'ESL_MAKE_FRIENDS',
      message: 'Use "become friends with" or "befriend" instead of "make friends with".'
    },

    // === ARTICLE ERRORS (a/an/the) ===
    {
      pattern: /\ban\s+university\b/gi,
      replacement: 'a university',
      type: 'grammar',
      rule: 'ESL_ARTICLE_UNIVERSITY',
      message: 'Use "a university" (pronounced "you-niversity" starts with consonant sound).'
    },
    {
      pattern: /\ba\s+hour\b/gi,
      replacement: 'an hour',
      type: 'grammar',
      rule: 'ESL_ARTICLE_HOUR',
      message: 'Use "an hour" (silent "h" makes vowel sound).'
    },
    {
      pattern: /\ban\s+European\b/gi,
      replacement: 'a European',
      type: 'grammar',
      rule: 'ESL_ARTICLE_EUROPEAN',
      message: 'Use "a European" (pronounced "you-ropean" starts with consonant sound).'
    },
    {
      pattern: /\ba\s+honest\b/gi,
      replacement: 'an honest',
      type: 'grammar',
      rule: 'ESL_ARTICLE_HONEST',
      message: 'Use "an honest" (silent "h" makes vowel sound).'
    },

    // === PREPOSITION ERRORS ===
    {
      pattern: /\bon\s+Monday\s+morning\b/gi,
      replacement: 'on Monday morning',
      type: 'grammar',
      rule: 'ESL_PREPOSITION_TIME',
      message: 'Use "on Monday morning" for specific days.'
    },
    {
      pattern: /\bin\s+the\s+night\b/gi,
      replacement: 'at night',
      type: 'grammar',
      rule: 'ESL_PREPOSITION_NIGHT',
      message: 'Use "at night" instead of "in the night".'
    },
    {
      pattern: /\bon\s+foot\b/gi,
      replacement: 'on foot',
      type: 'grammar',
      rule: 'ESL_PREPOSITION_FOOT',
      message: 'Use "on foot" (by walking).'
    },

    // === VERB FORM ERRORS ===
    {
      pattern: /\bI\s+am\s+agree\b/gi,
      replacement: 'I agree',
      type: 'grammar',
      rule: 'ESL_VERB_AGREE',
      message: 'Use "I agree" not "I am agree". "Agree" is not a continuous verb.'
    },
    {
      pattern: /\bI\s+am\s+thinking\s+that\b/gi,
      replacement: 'I think that',
      type: 'grammar',
      rule: 'ESL_VERB_THINK',
      message: 'Use "I think" for opinions, not "I am thinking".'
    },
    {
      pattern: /\bsince\s+3\s+years\b/gi,
      replacement: 'for 3 years',
      type: 'grammar',
      rule: 'ESL_SINCE_FOR',
      message: 'Use "for" with duration, "since" with starting points.'
    },

    // === STYLE IMPROVEMENTS ===
    {
      pattern: /\bvery\s+good\b/gi,
      replacement: 'excellent',
      type: 'style',
      rule: 'WORD_CHOICE',
      message: 'Consider using more specific adjectives like "excellent", "outstanding", or "superb" instead of "very good".'
    },
    {
      pattern: /\bvery\s+bad\b/gi,
      replacement: 'terrible',
      type: 'style',
      rule: 'WORD_CHOICE_BAD',
      message: 'Consider using more specific adjectives like "terrible", "awful", or "dreadful" instead of "very bad".'
    },
    {
      pattern: /\ba\s+lot\s+of\s+([a-zA-Z]+)/gi,
      replacement: 'many $1',
      type: 'style',
      rule: 'INFORMAL_LANGUAGE',
      message: 'Consider using "many" or "much" instead of the informal "a lot of".'
    },
    {
      pattern: /\bkinda\b/gi,
      replacement: 'somewhat',
      type: 'style',
      rule: 'INFORMAL_KINDA',
      message: 'Use "somewhat" instead of the informal "kinda" in academic writing.'
    },
    {
      pattern: /\bgonna\b/gi,
      replacement: 'going to',
      type: 'style',
      rule: 'INFORMAL_GONNA',
      message: 'Use "going to" instead of the informal "gonna" in academic writing.'
    },
    {
      pattern: /\bwanna\b/gi,
      replacement: 'want to',
      type: 'style',
      rule: 'INFORMAL_WANNA',
      message: 'Use "want to" instead of the informal "wanna" in academic writing.'
    },

    // === ACADEMIC WRITING IMPROVEMENTS ===
    {
      pattern: /\bIn\s+my\s+opinion\b/gi,
      replacement: 'In my view',
      type: 'style',
      rule: 'ACADEMIC_OPINION',
      message: 'Consider "In my view" or "I believe" for more formal academic writing.'
    },
    {
      pattern: /\bFirstly\b/gi,
      replacement: 'First',
      type: 'style',
      rule: 'ACADEMIC_FIRSTLY',
      message: 'Use "First" instead of "Firstly" in formal writing.'
    },
    {
      pattern: /\bin\s+conclusion\b/gi,
      replacement: 'In summary',
      type: 'style',
      rule: 'ACADEMIC_CONCLUSION',
      message: 'Consider "In summary" or "To conclude" for variety.'
    },

    // === SENTENCE STRUCTURE ===
    {
      pattern: /\bBecause\s+of\s+the\s+fact\s+that\b/gi,
      replacement: 'Because',
      type: 'style',
      rule: 'WORDY_BECAUSE',
      message: 'Use "Because" instead of the wordy "Because of the fact that".'
    },
    {
      pattern: /\bDue\s+to\s+the\s+fact\s+that\b/gi,
      replacement: 'Because',
      type: 'style',
      rule: 'WORDY_DUE',
      message: 'Use "Because" instead of the wordy "Due to the fact that".'
    },
    {
      pattern: /\bIn\s+order\s+to\b/gi,
      replacement: 'To',
      type: 'style',
      rule: 'WORDY_ORDER',
      message: 'Use "To" instead of the wordy "In order to".'
    }
  ];

  console.log('Enhanced grammar checker analyzing text:', text); // Debug log
  
  rules.forEach(rule => {
    let match;
    rule.pattern.lastIndex = 0; // Reset regex state
    while ((match = rule.pattern.exec(text)) !== null) {
      const newText = rule.replacement.replace(/\$1/g, match[1] || '').replace(/\$2/g, match[2] || '');
      
      // Special cases that should not preserve case (use replacement as-is)
      const forceOriginalCase = ['CAPITALIZE_I']; // "i" should always become "I" regardless of context
      
      // Get exact word boundaries for more accurate highlighting
      const text = match[0];
      const wordStart = text.search(/\S/);
      const wordEnd = text.search(/\s+$/) === -1 ? text.length : text.search(/\s+$/);
      
      // Calculate the actual position in the document, accounting for list indentation
      const lineStart = text.lastIndexOf('\n', match.index) + 1;
      const linePrefix = text.slice(lineStart, match.index);
      const listOffset = linePrefix.match(/^[\s•\-\d.]*\s*/)?.[0].length || 0;
      
      const suggestion = {
        range: {
          from: match.index + wordStart + 1 - listOffset,
          to: match.index + wordEnd + 1 - listOffset,
        },
        type: rule.type as 'spelling' | 'grammar' | 'style',
        original: text.slice(wordStart, wordEnd),
        replacements: [forceOriginalCase.includes(rule.rule) ? newText : preserveCase(text.slice(wordStart, wordEnd), newText)],
        ruleKey: rule.rule,
        explanation: rule.message,
        status: 'new' as const
      };
      console.log('Found grammar issue:', suggestion); // Debug log
      suggestions.push(suggestion);
    }
  });

  console.log('Total suggestions found:', suggestions.length); // Debug log
  return suggestions;
};

export async function POST(request: Request) {
  try {
    const { text } = await request.json();

    if (!text) {
      return NextResponse.json(
        { error: 'Text is required' },
        { status: 400 }
      );
    }

    // Check document size limit (5000 words)
    const wordCount = text.trim().split(/\s+/).length;
    if (wordCount > 5000) {
      return NextResponse.json(
        { error: 'Document exceeds 5000 word limit' },
        { status: 400 }
      );
    }

    // Performance tracking
    const startTime = Date.now();
    console.log('🔍 Starting grammar suggestion generation...');
    try {
      const response = await fetch(LANGUAGE_TOOL_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          text,
          language: 'en-US',
          enabledOnly: 'false',
          level: 'picky',
          disabledRules: 'WHITESPACE_RULE'  // Ignore HTML whitespace
        }).toString(),
        signal: AbortSignal.timeout(1800), // 1.8s timeout to ensure <2000ms total
      });

      if (!response.ok) {
        throw new Error(`LanguageTool API request failed: ${response.status}`);
      }

      const data = await response.json();
      const duration = Date.now() - startTime;
      console.log(`LanguageTool response time: ${duration}ms`);

      // Transform LanguageTool response into our suggestion format with exact word boundaries
      const suggestions = data.matches?.map((match: any) => {
        const matchText = text.slice(match.offset, match.offset + match.length);
        const wordStart = matchText.search(/\S/);
        const wordEnd = matchText.search(/\s+$/) === -1 ? matchText.length : matchText.search(/\s+$/);
        
        // Calculate list indentation offset
        const lineStart = text.lastIndexOf('\n', match.offset) + 1;
        const linePrefix = text.slice(lineStart, match.offset);
        const listOffset = linePrefix.match(/^[\s•\-\d.]*\s*/)?.[0].length || 0;
        
        return {
          range: {
            from: match.offset + wordStart - listOffset,
            to: match.offset + wordEnd - listOffset,
          },
          type: match.rule?.category?.id === 'TYPOS' ? 'spelling' : 
                match.rule?.category?.id === 'STYLE' ? 'style' : 'grammar',
          original: matchText.slice(wordStart, wordEnd),
          replacement: match.replacements?.[0]?.value || '',
          ruleKey: match.rule?.id || 'UNKNOWN',
          explanation: match.message || 'Grammar suggestion',
        };
      }) || [];

      return NextResponse.json({ 
        suggestions,
        source: 'languagetool',
        responseTime: duration
      });

    } catch (languageToolError) {
      console.log('LanguageTool not available, using mock grammar checker');
      
      // Use mock grammar checker as fallback
      const suggestions = generateMockSuggestions(text);
      
      return NextResponse.json({ 
        suggestions,
        source: 'mock',
        info: 'Using demo grammar checker. Install LanguageTool for full functionality.'
      });
    }

  } catch (error) {
    console.error('Error generating suggestions:', error);
    return NextResponse.json(
      { error: 'Failed to generate suggestions' },
      { status: 500 }
    );
  }
} 