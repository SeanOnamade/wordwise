import { NextResponse } from 'next/server';
import { SmartReview } from '@/types/SmartReview';

// Structured logging function with prefix for easy grepping in Vercel logs
function log(...args: any[]) {
  console.log('[smart-review]', ...args);
}

function logError(...args: any[]) {
  console.error('[smart-review] ❌', ...args);
}

function logSuccess(...args: any[]) {
  console.log('[smart-review] ✅', ...args);
}

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
    const actualExcerpt = content.slice(index, index + excerpt.length);
    return {
      from: index,
      to: index + actualExcerpt.length
    };
  }
  
  return undefined;
}

export async function POST(request: Request) {
  const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const startTime = Date.now();
  
  log(`🚀 Starting request ${requestId}`);
  
  try {
    // Environment check
    if (!process.env.OPENAI_API_KEY) {
      logError('Missing OpenAI API key');
      return NextResponse.json(
        { error: 'OPENAI_API_KEY env var not set', requestId },
        { status: 500 }
      );
    }

    let content: string;
    
    try {
      const body = await request.json();
      content = body.content;
      
      if (!content || typeof content !== 'string') {
        throw new Error('Content is required and must be a string');
      }
      
      if (content.length > 50000) {
        throw new Error('Content too long. Please limit to 50,000 characters.');
      }
      
      log('Content validation passed:', {
        length: content.length,
        wordCount: content.split(/\s+/).length
      });
    } catch (parseError) {
      logError('Request validation failed:', parseError);
      return NextResponse.json(
        { 
          error: parseError instanceof Error ? parseError.message : 'Invalid request body',
          requestId 
        },
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

    // 28-second hard timeout so Vercel never kills us at 30s
    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      logError('Request aborted after 28s timeout');
      controller.abort();
    }, 28000);

    log('Making OpenAI API request...');
    const openaiStartTime = Date.now();

    let response: Response;
    
    try {
      response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-4',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
          temperature: 0.3,
          max_tokens: 2000,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      
      const openaiDuration = Date.now() - openaiStartTime;
      log('OpenAI response received:', {
        status: response.status,
        duration: `${openaiDuration}ms`
      });

      if (!response.ok) {
        const errorText = await response.text();
        
        // Log specific error types
        if (response.status === 429) {
          logError('OpenAI Rate Limit/Quota Exceeded:', { status: response.status, error: errorText });
        } else if (response.status === 401) {
          logError('OpenAI Authentication Error:', { status: response.status });
        } else {
          logError('OpenAI API Error:', { status: response.status, error: errorText });
        }
        
        // Always return valid JSON
        return NextResponse.json(
          { 
            error: `OpenAI API error: ${response.status} - ${errorText}`,
            requestId 
          },
          { status: response.status }
        );
      }

      const data = await response.json();
      const aiResponse = data.choices?.[0]?.message?.content;
      
      if (!aiResponse) {
        throw new Error('No response content from OpenAI');
      }

      // Parse and validate AI response
      let smartReview: SmartReview;
      
      try {
        smartReview = JSON.parse(aiResponse);
        
        if (!smartReview.issues || !smartReview.metrics || !smartReview.suggestions) {
          throw new Error('Invalid response structure from AI');
        }
      } catch (parseError) {
        // Try to extract JSON from markdown if needed
        let cleanedResponse = aiResponse;
        
        if (aiResponse.includes('```json')) {
          const jsonMatch = aiResponse.match(/```json\s*([\s\S]*?)\s*```/);
          if (jsonMatch) {
            cleanedResponse = jsonMatch[1].trim();
          }
        }
        
        const jsonStart = cleanedResponse.indexOf('{');
        const jsonEnd = cleanedResponse.lastIndexOf('}');
        
        if (jsonStart !== -1 && jsonEnd !== -1 && jsonEnd > jsonStart) {
          try {
            smartReview = JSON.parse(cleanedResponse.substring(jsonStart, jsonEnd + 1));
            if (!smartReview.issues || !smartReview.metrics || !smartReview.suggestions) {
              throw new Error('Invalid extracted response structure');
            }
          } catch (extractError) {
            throw new Error('Failed to parse AI response as valid JSON');
          }
        } else {
          throw new Error('Failed to extract valid JSON from AI response');
        }
      }

      // Add IDs and positions to issues
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

      const totalDuration = Date.now() - startTime;
      
      logSuccess('Smart review completed successfully:', {
        requestId,
        duration: `${totalDuration}ms`,
        issuesCount: enhancedIssues.length
      });

      // Always return valid JSON
      return NextResponse.json({
        ...enhancedSmartReview,
        requestId,
        processingTime: totalDuration
      });

    } catch (fetchError) {
      clearTimeout(timeoutId);
      
      if (fetchError instanceof Error && fetchError.name === 'AbortError') {
        logError('Request timed out after 28s');
        // Always return valid JSON
        return NextResponse.json(
          { error: 'Request timed out. Please try again with shorter content.', requestId },
          { status: 408 }
        );
      }
      
      logError('OpenAI fetch error:', fetchError);
      // Always return valid JSON
      return NextResponse.json(
        { error: 'Failed to connect to OpenAI API', requestId },
        { status: 502 }
      );
    }

  } catch (error) {
    const totalDuration = Date.now() - startTime;
    
    logError('Smart Review critical error:', {
      requestId,
      error: error instanceof Error ? error.message : 'Unknown error',
      duration: `${totalDuration}ms`
    });
    
    // Always return valid JSON - this is crucial for eliminating "Unexpected token 'A'" errors
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'Smart Review failed',
        requestId
      },
      { status: 500 }
    );
  }
} 