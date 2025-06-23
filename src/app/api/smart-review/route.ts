import { NextResponse } from 'next/server';
import { SmartReview } from '@/types/SmartReview';

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

// Structured logging function with prefix for easy grepping in Vercel logs
function log(...args: any[]) {
  console.log('[smart-review]', ...args);
}

function logError(...args: any[]) {
  console.error('[smart-review] ❌', ...args);
}

function logInfo(...args: any[]) {
  console.info('[smart-review] ℹ️', ...args);
}

function logDebug(...args: any[]) {
  console.debug('[smart-review] 🔍', ...args);
}

function logSuccess(...args: any[]) {
  console.log('[smart-review] ✅', ...args);
}

function logWarning(...args: any[]) {
  console.warn('[smart-review] ⚠️', ...args);
}

// Function to find the position of excerpt in the document
function findTextPosition(content: string, excerpt: string): { from: number; to: number } | undefined {
  logDebug('Finding text position for excerpt:', excerpt.substring(0, 50) + '...');
  
  // Try exact match first
  let index = content.indexOf(excerpt);
  if (index !== -1) {
    logDebug('Found exact match at position:', index);
    return {
      from: index,
      to: index + excerpt.length
    };
  }
  
  // Try case-insensitive match
  index = content.toLowerCase().indexOf(excerpt.toLowerCase());
  if (index !== -1) {
    logDebug('Found case-insensitive match at position:', index);
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
    if (startIndex === -1) {
      logWarning('Could not find first word in fuzzy match:', firstWord);
      return undefined;
    }
    
    // Look for the last word after the first word
    let endIndex = content.toLowerCase().indexOf(lastWord.toLowerCase(), startIndex);
    if (endIndex === -1) {
      logWarning('Could not find last word in fuzzy match:', lastWord);
      return undefined;
    }
    
    // Get the actual text from the content
    const actualText = content.slice(startIndex, endIndex + lastWord.length);
    
    // Verify that this is a reasonable match
    const cleanActual = actualText.replace(/\s+/g, ' ').trim().toLowerCase();
    const cleanExpected = excerpt.replace(/\s+/g, ' ').trim().toLowerCase();
    
    // Only use this match if it's reasonably similar
    if (cleanActual.includes(cleanExpected) || cleanExpected.includes(cleanActual)) {
      logDebug('Found fuzzy match at position:', startIndex);
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
    logDebug('Found normalized whitespace match');
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
  
  logWarning('No text position found for excerpt:', excerpt.substring(0, 50) + '...');
  return undefined;
}

export async function POST(request: Request) {
  const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const startTime = Date.now();
  
  log(`🚀 Starting request ${requestId}`);
  
  try {
    // Environment diagnostics
    logInfo('Environment check:', {
      hasOpenAIKey: !!OPENAI_API_KEY,
      keyLength: OPENAI_API_KEY?.length || 0,
      keyPrefix: OPENAI_API_KEY?.substring(0, 7) || 'none',
      keySuffix: OPENAI_API_KEY?.substring(-4) || 'none',
      nodeEnv: process.env.NODE_ENV,
      vercelEnv: process.env.VERCEL_ENV,
      runtime: process.env.VERCEL_REGION || 'local'
    });

    // Check for OpenAI API key first
    if (!OPENAI_API_KEY) {
      logError('Missing OpenAI API key');
      return NextResponse.json(
        { error: 'Missing key', requestId },
        { status: 500 }
      );
    }

    let content: string;
    let requestBody: any;
    
    try {
      const bodyText = await request.text();
      logDebug('Request body length:', bodyText.length);
      
      requestBody = JSON.parse(bodyText);
      content = requestBody.content;
      
      logInfo('Request parsed successfully:', {
        contentLength: content?.length || 0,
        contentType: typeof content,
        hasContent: !!content
      });
    } catch (parseError) {
      logError('Failed to parse request body:', parseError);
      return NextResponse.json(
        { error: 'Invalid JSON in request body', requestId },
        { status: 400 }
      );
    }

    if (!content || typeof content !== 'string') {
      logError('Invalid content provided:', { type: typeof content, hasContent: !!content });
      return NextResponse.json(
        { error: 'Content is required and must be a string', requestId },
        { status: 400 }
      );
    }

    // Check content length (reasonable limit for API)
    if (content.length > 50000) {
      logError('Content too long:', content.length);
      return NextResponse.json(
        { error: 'Content too long. Please limit to 50,000 characters.', requestId },
        { status: 400 }
      );
    }

    logInfo('Content validation passed:', {
      length: content.length,
      wordCount: content.split(/\s+/).length,
      preview: content.substring(0, 100) + '...'
    });

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

    const openaiStartTime = Date.now();
    log('🔄 Making OpenAI API request...');
    
    // Create AbortController with 28s timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      logError('OpenAI API request timed out after 28s');
      controller.abort();
    }, 28000);

    let response: Response;
    let data: any;

    try {
      const requestPayload = {
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
      };

      logDebug('OpenAI request payload:', {
        model: requestPayload.model,
        messageCount: requestPayload.messages.length,
        systemPromptLength: systemPrompt.length,
        userPromptLength: userPrompt.length,
        temperature: requestPayload.temperature,
        maxTokens: requestPayload.max_tokens
      });

      response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${OPENAI_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestPayload),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      const openaiDuration = Date.now() - openaiStartTime;

      logInfo('OpenAI API response received:', {
        status: response.status,
        statusText: response.statusText,
        duration: `${openaiDuration}ms`,
        headers: {
          contentType: response.headers.get('content-type'),
          contentLength: response.headers.get('content-length'),
          ratelimitRemaining: response.headers.get('x-ratelimit-remaining-requests'),
          ratelimitReset: response.headers.get('x-ratelimit-reset-requests')
        }
      });

      if (!response.ok) {
        const errorText = await response.text();
        
        // Parse error details for better diagnostics
        let errorDetails = null;
        try {
          errorDetails = JSON.parse(errorText);
        } catch (e) {
          // Error text is not JSON, keep as string
        }
        
        // Log specific error types for common issues
        if (response.status === 401) {
          logError('OpenAI API Authentication Error - Invalid API Key:', {
            status: response.status,
            keyPrefix: OPENAI_API_KEY?.substring(0, 7),
            error: errorDetails || errorText,
            duration: `${openaiDuration}ms`
          });
        } else if (response.status === 429) {
          logError('OpenAI API Rate Limit/Quota Exceeded:', {
            status: response.status,
            error: errorDetails || errorText,
            duration: `${openaiDuration}ms`,
            ratelimitHeaders: {
              remaining: response.headers.get('x-ratelimit-remaining-requests'),
              reset: response.headers.get('x-ratelimit-reset-requests'),
              limitRequests: response.headers.get('x-ratelimit-limit-requests'),
              limitTokens: response.headers.get('x-ratelimit-limit-tokens')
            }
          });
        } else if (response.status === 402) {
          logError('OpenAI API Billing/Payment Required:', {
            status: response.status,
            error: errorDetails || errorText,
            duration: `${openaiDuration}ms`
          });
        } else {
          logError('OpenAI API error:', {
            status: response.status,
            statusText: response.statusText,
            error: errorDetails || errorText,
            duration: `${openaiDuration}ms`
          });
        }
        
        return NextResponse.json(
          { error: `OpenAI API error: ${response.status} - ${errorText}`, requestId },
          { status: response.status }
        );
      }

      data = await response.json();
      
      logInfo('OpenAI response structure:', {
        hasChoices: !!data.choices,
        choicesLength: data.choices?.length,
        hasMessage: !!data.choices?.[0]?.message,
        hasContent: !!data.choices?.[0]?.message?.content,
        finishReason: data.choices?.[0]?.finish_reason,
        usage: data.usage
      });

    } catch (fetchError) {
      clearTimeout(timeoutId);
      const openaiDuration = Date.now() - openaiStartTime;
      
      if (fetchError instanceof Error && fetchError.name === 'AbortError') {
        logError('OpenAI API request aborted due to timeout:', { duration: `${openaiDuration}ms` });
        return NextResponse.json(
          { error: 'Request timed out. Please try again with shorter content.', requestId },
          { status: 408 }
        );
      }
      
      logError('OpenAI API fetch error:', {
        error: fetchError,
        duration: `${openaiDuration}ms`,
        name: fetchError instanceof Error ? fetchError.name : 'unknown',
        message: fetchError instanceof Error ? fetchError.message : 'unknown'
      });
      return NextResponse.json(
        { error: 'Failed to connect to OpenAI API', requestId },
        { status: 502 }
      );
    }

    // Extract the JSON response from OpenAI
    const aiResponse = data.choices?.[0]?.message?.content;
    
    if (!aiResponse) {
      logError('No response content from OpenAI:', {
        choices: data.choices,
        hasChoices: !!data.choices,
        choicesLength: data.choices?.length
      });
      return NextResponse.json(
        { error: 'No response from OpenAI', requestId },
        { status: 500 }
      );
    }

    logInfo('AI response received:', {
      length: aiResponse.length,
      type: typeof aiResponse,
      startsWithBrace: aiResponse.trim().startsWith('{'),
      endsWithBrace: aiResponse.trim().endsWith('}'),
      preview: aiResponse.substring(0, 200) + '...'
    });

    try {
      const smartReview: SmartReview = JSON.parse(aiResponse);
      
      logDebug('Initial JSON parse successful');
      
      // Validate the response structure
      if (!smartReview.issues || !smartReview.metrics || !smartReview.suggestions) {
        logError('Invalid response structure:', {
          hasIssues: !!smartReview.issues,
          hasMetrics: !!smartReview.metrics,
          hasSuggestions: !!smartReview.suggestions,
          issuesType: typeof smartReview.issues,
          metricsType: typeof smartReview.metrics,
          suggestionsType: typeof smartReview.suggestions
        });
        return NextResponse.json(
          { error: 'Invalid response structure from AI', requestId },
          { status: 500 }
        );
      }

      logInfo('Response structure validation passed:', {
        issuesCount: smartReview.issues.length,
        metricsKeys: Object.keys(smartReview.metrics),
        suggestionsCount: smartReview.suggestions.length
      });

      // Add IDs and status to issues, and find their positions in the text
      const enhancedIssues = smartReview.issues.map((issue, index) => {
        const position = findTextPosition(content, issue.excerpt);
        const issueId = `smart-review-issue-${index}-${Date.now()}`;
        
        logDebug(`Processing issue ${index + 1}:`, {
          id: issueId,
          excerpt: issue.excerpt.substring(0, 50) + '...',
          hasPosition: !!position,
          position
        });
        
        return {
          ...issue,
          id: issueId,
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
        totalDuration: `${totalDuration}ms`,
        issuesProcessed: enhancedIssues.length,
        issuesWithPositions: enhancedIssues.filter(i => i.range).length,
        metrics: Object.keys(smartReview.metrics).map(key => ({
          [key]: smartReview.metrics[key as keyof typeof smartReview.metrics].score
        }))
      });

      return NextResponse.json({
        ...enhancedSmartReview,
        requestId,
        processingTime: totalDuration
      });
      
    } catch (parseError) {
      logError('Failed to parse OpenAI response as JSON:', {
        error: parseError,
        responseLength: aiResponse.length,
        responseStart: aiResponse.substring(0, 200),
        responseEnd: aiResponse.substring(Math.max(0, aiResponse.length - 200))
      });
      
      // Try to extract JSON if it's wrapped in markdown or other text
      let cleanedResponse = aiResponse;
      
      // Remove markdown code blocks
      if (aiResponse.includes('```json')) {
        const jsonMatch = aiResponse.match(/```json\s*([\s\S]*?)\s*```/);
        if (jsonMatch) {
          cleanedResponse = jsonMatch[1].trim();
          logInfo('Extracted JSON from markdown code block');
        }
      } else if (aiResponse.includes('```')) {
        const jsonMatch = aiResponse.match(/```\s*([\s\S]*?)\s*```/);
        if (jsonMatch) {
          cleanedResponse = jsonMatch[1].trim();
          logInfo('Extracted content from generic code block');
        }
      }
      
      // Try to find JSON in the response
      const jsonStart = cleanedResponse.indexOf('{');
      const jsonEnd = cleanedResponse.lastIndexOf('}');
      
      if (jsonStart !== -1 && jsonEnd !== -1 && jsonEnd > jsonStart) {
        const extractedJson = cleanedResponse.substring(jsonStart, jsonEnd + 1);
        logInfo('Attempting to parse extracted JSON:', {
          originalLength: aiResponse.length,
          extractedLength: extractedJson.length,
          extractedStart: extractedJson.substring(0, 100)
        });
        
        try {
          const smartReview: SmartReview = JSON.parse(extractedJson);
          
          // Validate the response structure
          if (!smartReview.issues || !smartReview.metrics || !smartReview.suggestions) {
            logError('Invalid extracted response structure:', {
              hasIssues: !!smartReview.issues,
              hasMetrics: !!smartReview.metrics,
              hasSuggestions: !!smartReview.suggestions
            });
            return NextResponse.json(
              { error: 'Invalid extracted response structure from AI', requestId },
              { status: 500 }
            );
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

          const totalDuration = Date.now() - startTime;
          
          logSuccess('Smart review completed successfully (after JSON extraction):', {
            requestId,
            totalDuration: `${totalDuration}ms`,
            issuesProcessed: enhancedIssues.length
          });

          return NextResponse.json({
            ...enhancedSmartReview,
            requestId,
            processingTime: totalDuration
          });
        } catch (extractedParseError) {
          logError('Failed to parse extracted JSON:', {
            error: extractedParseError,
            extractedLength: extractedJson.length,
            extractedPreview: extractedJson.substring(0, 200)
          });
        }
      }
      
      return NextResponse.json(
        { 
          error: 'Failed to parse AI response', 
          details: parseError instanceof Error ? parseError.message : 'Unknown parse error',
          requestId
        },
        { status: 500 }
      );
    }
  } catch (error) {
    const totalDuration = Date.now() - startTime;
    
    logError('Smart Review API critical error:', {
      requestId,
      error,
      duration: `${totalDuration}ms`,
      name: error instanceof Error ? error.name : 'unknown',
      message: error instanceof Error ? error.message : 'unknown',
      stack: error instanceof Error ? error.stack : undefined
    });
    
    return NextResponse.json(
      { 
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error',
        requestId
      },
      { status: 500 }
    );
  }
} 