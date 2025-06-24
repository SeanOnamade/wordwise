import { NextResponse } from 'next/server';

// In a real implementation, you would store jobs in a database or queue
const jobs: Record<string, { status: 'pending' | 'done' | 'error', result?: any, error?: string }> = {};

// Shortened system and user prompts for background job
const systemPrompt = `You are WordWise, an academic-writing coach for ESL graduate students. Give concise, actionable feedback.`;

const userPrompt = (content: string) => `TASK:
1. Find issues LanguageTool may miss (awkward phrasing, discourse markers, vague pronouns, etc.).
2. For each, give 2-3 specific replacement suggestions.
3. Rate on 0-100 scale (higher is better): 
   - Clarity
   - Academic Tone
   - Sentence Complexity
4. Explain each metric in one short sentence.
5. Give up to 5 prioritized next suggestions (≤20 words each).
6. Output valid JSON matching this schema—no extra keys, no markdown.

SCHEMA:
{
  "issues": [ { 
    "excerpt": string,
    "explanation": string,
    "replacements": [ string ]
  } ],
  "metrics": {
    "clarity": { "score": integer, "comment": string },
    "academic_tone": { "score": integer, "comment": string },
    "sentence_complexity": { "score": integer, "comment": string }
  },
  "suggestions": [ string ]
}

USER DOCUMENT:
"""START_OF_DOC
${content}
END_OF_DOC"""`;

export async function POST(request: Request) {
  const jobId = `job_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  try {
    const { content } = await request.json();
    if (!content || typeof content !== 'string') {
      return NextResponse.json({ error: 'Content is required', jobId }, { status: 400 });
    }
    // Mark job as pending
    jobs[jobId] = { status: 'pending' };
    // Simulate async processing (replace with real OpenAI call)
    setTimeout(() => {
      jobs[jobId] = { status: 'done', result: { message: 'Smart Review complete (mock)', contentLength: content.length } };
    }, 5000); // Simulate 5s processing
    return NextResponse.json({ jobId, status: 'pending' });
  } catch (error) {
    jobs[jobId] = { status: 'error', error: error instanceof Error ? error.message : 'Unknown error' };
    return NextResponse.json({ error: 'Failed to start job', jobId }, { status: 500 });
  }
}

export async function GET(request: Request) {
  // For polling job status
  const { searchParams } = new URL(request.url);
  const jobId = searchParams.get('jobId');
  if (!jobId || !jobs[jobId]) {
    return NextResponse.json({ error: 'Job not found', jobId }, { status: 404 });
  }
  return NextResponse.json({ jobId, ...jobs[jobId] });
} 