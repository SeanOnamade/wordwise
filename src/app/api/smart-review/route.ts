import { NextResponse } from 'next/server';
import { SmartReview } from '@/types/SmartReview';

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

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
2. **Compute three metrics** on a 0-100 scale, higher is better:  
   • *Clarity* (how easily ideas flow)  
   • *Academic Tone* (formality, absence of contractions, use of discipline-appropriate lexicon)  
   • *Sentence Complexity* (variety of structures; unnecessary complexity hurts the score).  
3. **Explain** each metric in one short sentence.  
4. Give **up to five prioritized suggestions** the user can apply next, each ≤ 20 words.  
5. Output **valid JSON** exactly matching the schema below—no extra keys, no markdown.

### JSON Schema
{
  "issues": [ { "excerpt": string, "explanation": string } ],   // 3-7 items
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
        model: 'gpt-4o',
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
        { error: `OpenAI API error: ${response.status}` },
        { status: 500 }
      );
    }

    const data = await response.json();
    const duration = Date.now() - startTime;

    console.log(`✨ Smart Review completed in ${duration}ms`);

    // Extract the JSON response from OpenAI
    const aiResponse = data.choices?.[0]?.message?.content;
    
    if (!aiResponse) {
      return NextResponse.json(
        { error: 'No response from OpenAI' },
        { status: 500 }
      );
    }

    try {
      const smartReview: SmartReview = JSON.parse(aiResponse);
      
      // Validate the response structure
      if (!smartReview.issues || !smartReview.metrics || !smartReview.suggestions) {
        throw new Error('Invalid response structure');
      }

      return NextResponse.json(smartReview);
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