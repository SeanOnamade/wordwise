import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';

export async function POST(request: Request) {
  try {
    const { userId, docId, suggestionId, decision } = await request.json();

    if (!userId || !docId || !suggestionId || !decision) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    if (!['accepted', 'rejected'].includes(decision)) {
      return NextResponse.json(
        { error: 'Invalid decision. Must be accepted or rejected' },
        { status: 400 }
      );
    }

    await adminDb.collection('decisions').add({
      userId,
      docId,
      suggestionId,
      decision,
      createdAt: FieldValue.serverTimestamp(),
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error recording decision:', error);
    return NextResponse.json(
      { error: 'Failed to record decision' },
      { status: 500 }
    );
  }
} 