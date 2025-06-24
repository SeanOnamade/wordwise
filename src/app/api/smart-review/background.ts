import { NextResponse } from 'next/server';

// In a real implementation, you would store jobs in a database or queue
const jobs: Record<string, { status: 'pending' | 'done' | 'error', result?: any, error?: string }> = {};

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