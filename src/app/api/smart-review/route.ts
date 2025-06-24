import { NextResponse } from 'next/server';
import { SmartReview } from '@/types/SmartReview';

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

// Function to find the position of excerpt in the document
function findTextPosition(content: string, excerpt: string): { from: number; to: number } | undefined {
  // Try exact match first
  let index = content.indexOf(excerpt);
  if (index !== -1) {
    return {
      from: index,
      to: index + excerpt.length
    };
  }
  
  // Try case-insensitive match
  index = content.toLowerCase().indexOf(excerpt.toLowerCase());
  if (index !== -1) {
    // Find the actual text in the original content
    const actualExcerpt = content.slice(index, index + excerpt.length);
    return {
      from: index,
      to: index + actualExcerpt.length
    };
  }
  
  // Try fuzzy match with word boundaries
  const words = excerpt.split(/\s+/);
  if (words.length > 1) {
    const firstWord = words[0];
    const lastWord = words[words.length - 1];
    
    // Find positions in content
    let startIndex = content.toLowerCase().indexOf(firstWord.toLowerCase());
    if (startIndex === -1) return undefined;
    
    // Look for the last word after the first word
    let endIndex = content.toLowerCase().indexOf(lastWord.toLowerCase(), startIndex);
    if (endIndex === -1) return undefined;
    
    // Get the actual text from the content
    const actualText = content.slice(startIndex, endIndex + lastWord.length);
    
    // Verify that this is a reasonable match
    const cleanActual = actualText.replace(/\s+/g, ' ').trim().toLowerCase();
    const cleanExpected = excerpt.replace(/\s+/g, ' ').trim().toLowerCase();
    
    // Only use this match if it's reasonably similar
    if (cleanActual.includes(cleanExpected) || cleanExpected.includes(cleanActual)) {
      return {
        from: startIndex,
        to: endIndex + lastWord.length
      };
    }
  }
  
  // If no match found, try one more time with normalized whitespace
  const normalizedContent = content.replace(/\s+/g, ' ');
  const normalizedExcerpt = excerpt.replace(/\s+/g, ' ');
  index = normalizedContent.indexOf(normalizedExcerpt);
  if (index !== -1) {
    // Map the position back to the original content
    let originalIndex = 0;
    let normalizedIndex = 0;
    
    while (normalizedIndex < index) {
      if (!/\s/.test(content[originalIndex]) || 
          (content[originalIndex] === ' ' && content[originalIndex - 1] !== ' ')) {
        normalizedIndex++;
      }
      originalIndex++;
    }
    
    // Find the end position
    let originalEndIndex = originalIndex;
    let remainingChars = normalizedExcerpt.length;
    
    while (remainingChars > 0) {
      if (!/\s/.test(content[originalEndIndex]) || 
          (content[originalEndIndex] === ' ' && content[originalEndIndex - 1] !== ' ')) {
        remainingChars--;
      }
      originalEndIndex++;
    }
    
    return {
      from: originalIndex,
      to: originalEndIndex
    };
  }
  
  return undefined;
}

export async function POST(request: Request) {
  try {
    if (!OPENAI_API_KEY) {
      return NextResponse.json(
        { error: 'OpenAI API key not configured' },
        { status: 500 }
      );
    }

    const { content } = await request.json();

    if (!content || typeof content !== 'string') {
      return NextResponse.json(
        { error: 'Content is required and must be a string' },
        { status: 400 }
      );
    }

    // Check content length (reasonable limit for API)
    if (content.length > 50000) {
      return NextResponse.json(
        { error: 'Content too long. Please limit to 50,000 characters.' },
        { status: 400 }
      );
    }

    const systemPrompt = `You are WordWise, an academic-writing coach for ESL graduate students. Return concise, actionable feedback. Never change voice; never reveal chain-of-thought.`;

    const userPrompt = `### Context
The user is an ESL graduate student writing academic English. They value clarity, formal tone, and concise sentences.

### Task
1. **Detect issues** the LanguageTool pass may have missed (awkward phrasing, misuse of discourse markers, vague pronouns, etc.).  
2. **For each issue**, provide 2-3 **specific replacement suggestions** that improve the text.
3. **Compute three metrics** on a 0-100 scale, higher is better:  
   • *Clarity* (how easily ideas flow)  
   • *Academic Tone* (formality, absence of contractions, use of discipline-appropriate lexicon)  
   • *Sentence Complexity* (variety of structures; unnecessary complexity hurts the score).  
4. **Explain** each metric in one short sentence.  
5. Give **up to five prioritized suggestions** the user can apply next, each ≤ 20 words.  
6. Output **valid JSON** exactly matching the schema below—no extra keys, no markdown.

### JSON Schema
{
  "issues": [ { 
    "excerpt": string,           // exact text that needs improvement (5-15 words)
    "explanation": string,       // why this needs improvement
    "replacements": [ string ]   // 2-3 specific replacement options
  } ],   // 3-7 items
  "metrics": {
      "clarity": { "score": integer, "comment": string },
      "academic_tone": { "score": integer, "comment": string },
      "sentence_complexity": { "score": integer, "comment": string }
  },
  "suggestions": [ string ]   // ≤5 strings
}

### User Document
"""START_OF_DOC
${content}
END_OF_DOC"""`;

    const startTime = Date.now();

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4',
        messages: [
          {
            role: 'system',
            content: systemPrompt,
          },
          {
            role: 'user',
            content: userPrompt,
          },
        ],
        temperature: 0.3,
        max_tokens: 2000,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('OpenAI API error:', response.status, errorText);
      return NextResponse.json(
        { error: `OpenAI API error: ${response.status} - ${errorText}` },
        { status: response.status }
      );
    }

    const data = await response.json();
    const duration = Date.now() - startTime;

    console.log(`✨ Smart Review completed in ${duration}ms`);

    // Extract the JSON response from OpenAI
    const aiResponse = data.choices?.[0]?.message?.content;
    
    if (!aiResponse) {
      console.error('No response from OpenAI:', data);
      return NextResponse.json(
        { error: 'No response from OpenAI' },
        { status: 500 }
      );
    }

    try {
      const smartReview: SmartReview = JSON.parse(aiResponse);
      
      // Validate the response structure
      if (!smartReview.issues || !smartReview.metrics || !smartReview.suggestions) {
        console.error('Invalid response structure:', smartReview);
        throw new Error('Invalid response structure');
      }

      // Add IDs and status to issues, and find their positions in the text
      const enhancedIssues = smartReview.issues.map((issue, index) => {
        const position = findTextPosition(content, issue.excerpt);
        return {
          ...issue,
          id: `smart-review-issue-${index}-${Date.now()}`,
          status: 'new' as const,
          range: position
        };
      });

      const enhancedSmartReview = {
        ...smartReview,
        issues: enhancedIssues
      };

      return NextResponse.json(enhancedSmartReview);
    } catch (parseError) {
      console.error('Failed to parse OpenAI response:', parseError);
      console.error('Raw response:', aiResponse);
      return NextResponse.json(
        { error: 'Failed to parse AI response' },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('Smart Review API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 