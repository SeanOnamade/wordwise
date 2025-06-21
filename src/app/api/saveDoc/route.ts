import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';

export async function POST(request: Request) {
  try {
    const { userId, docId, title, content = '' } = await request.json();

    if (!userId || !docId || !title) {
      return NextResponse.json(
        { error: 'Missing required fields: userId, docId, and title are required' },
        { status: 400 }
      );
    }

    // Check if Firebase is configured
    if (!adminDb) {
      console.info('📝 Development mode: Document save skipped (no Firebase credentials)');
      return NextResponse.json({ 
        success: true,
        message: 'Document saved successfully (development mode)',
        note: 'Configure Firebase credentials for persistent storage'
      });
    }

    // Check if document exists
    const docRef = adminDb.collection('documents').doc(docId);
    const docSnapshot = await docRef.get();
    const isNewDoc = !docSnapshot.exists;

    await docRef.set({
      ownerUid: userId,
      title,
      content,
      updatedAt: FieldValue.serverTimestamp(),
      ...(isNewDoc && { createdAt: FieldValue.serverTimestamp() })
    }, { merge: true });

    return NextResponse.json({ 
      success: true,
      message: `Document ${isNewDoc ? 'created' : 'updated'} successfully`
    });
  } catch (error) {
    console.error('Error saving document:', error);
    return NextResponse.json(
      { error: 'Failed to save document' },
      { status: 500 }
    );
  }
}

// GET route for loading documents
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const docId = searchParams.get('docId');

    if (!userId) {
      return NextResponse.json(
        { error: 'userId is required' },
        { status: 400 }
      );
    }

    // Check if Firebase is configured
    if (!adminDb) {
      console.info('📂 Development mode: Document load skipped (no Firebase credentials)');
      return NextResponse.json({
        success: true,
        documents: [],
        note: 'Configure Firebase credentials for persistent storage'
      });
    }

    if (docId) {
      // Load specific document
      const docRef = adminDb.collection('documents').doc(docId);
      const docSnapshot = await docRef.get();
      
      if (!docSnapshot.exists) {
        return NextResponse.json(
          { error: 'Document not found' },
          { status: 404 }
        );
      }

      const docData = docSnapshot.data();
      
      // Check if user owns the document
      if (docData?.ownerUid !== userId) {
        return NextResponse.json(
          { error: 'Unauthorized' },
          { status: 403 }
        );
      }

      return NextResponse.json({
        success: true,
        document: {
          id: docSnapshot.id,
          ...docData
        }
      });
    } else {
      // Load all user documents
      const docsSnapshot = await adminDb
        .collection('documents')
        .where('ownerUid', '==', userId)
        .orderBy('updatedAt', 'desc')
        .limit(50)
        .get();

      const documents = docsSnapshot.docs.map((doc: any) => ({
        id: doc.id,
        ...doc.data()
      }));

      return NextResponse.json({
        success: true,
        documents
      });
    }
  } catch (error) {
    console.error('Error loading documents:', error);
    return NextResponse.json(
      { error: 'Failed to load documents' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const docId = searchParams.get('docId');

    if (!userId || !docId) {
      return NextResponse.json(
        { error: 'Missing required fields: userId and docId' },
        { status: 400 }
      );
    }

    // Check if Firebase is configured
    if (!adminDb) {
      console.info('📝 Development mode: Document deletion skipped (no Firebase credentials)');
      return NextResponse.json({ 
        success: true,
        message: 'Document deleted successfully (development mode)',
        note: 'Configure Firebase credentials for persistent storage'
      });
    }

    // Check if document exists and user owns it
    const docRef = adminDb.collection('documents').doc(docId);
    const docSnapshot = await docRef.get();
    
    if (!docSnapshot.exists) {
      return NextResponse.json(
        { error: 'Document not found' },
        { status: 404 }
      );
    }

    const docData = docSnapshot.data();
    if (docData?.ownerUid !== userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 403 }
      );
    }

    // Delete the document
    await docRef.delete();

    return NextResponse.json({ 
      success: true,
      message: 'Document deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting document:', error);
    return NextResponse.json(
      { error: 'Failed to delete document' },
      { status: 500 }
    );
  }
} 