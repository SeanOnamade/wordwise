import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { FieldValue, QueryDocumentSnapshot } from 'firebase-admin/firestore';

interface Document {
  id: string;
  updatedAt?: string | number | Date;
  [key: string]: any;
}

// Helper function for comprehensive Firebase Admin diagnostics
function assertAdminConfig() {
  console.info('🔍 Starting Firebase Admin diagnostics...');
  
  // 1. Verify presence of all three admin env vars
  const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY;
  
  const missing = [];
  if (!projectId) missing.push('FIREBASE_ADMIN_PROJECT_ID');
  if (!clientEmail) missing.push('FIREBASE_ADMIN_CLIENT_EMAIL');
  if (!privateKey) missing.push('FIREBASE_ADMIN_PRIVATE_KEY');
  
  if (missing.length > 0) {
    throw new Error(`Missing required env vars: ${missing.join(', ')}`);
  }
  
  // 2. Log redacted preview of env vars (safe after null check)
  console.info('📋 Admin env vars present:', {
    projectId: projectId,
    clientEmail: clientEmail!.replace(/(.{3}).*(@.*)/, '$1***$2'), // redact middle
    privateKeyLength: privateKey!.length,
    privateKeyStart: privateKey!.substring(0, 50) + '...',
    privateKeyHasEscapedNewlines: privateKey!.includes('\\n'),
    privateKeyHasRealNewlines: privateKey!.includes('\n')
  });
  
  // 3. Check for stray CR/LF characters in projectId
  const projectIdChars = Array.from(projectId!).map(char => char.charCodeAt(0));
  console.info('🔤 ProjectId char codes:', projectIdChars);
  if (projectIdChars.some(code => code === 13 || code === 10)) {
    console.warn('⚠️ ProjectId contains CR/LF characters!');
  }
  
  // 4. Process private key - replace \\n with real \n
  const processedPrivateKey = privateKey!.includes('\\n') 
    ? privateKey!.replace(/\\n/g, '\n')
    : privateKey!
    
  console.info('🔑 Private key processing:', {
    originalLength: privateKey!.length,
    processedLength: processedPrivateKey.length,
    hasBeginMarker: processedPrivateKey.includes('-----BEGIN PRIVATE KEY-----'),
    hasEndMarker: processedPrivateKey.includes('-----END PRIVATE KEY-----'),
    firstLineBreakAt: processedPrivateKey.indexOf('\n')
  });
  
  // 5. Log first 30 bytes of decoded private key (base64 portion)
  try {
    const keyContent = processedPrivateKey
      .replace('-----BEGIN PRIVATE KEY-----', '')
      .replace('-----END PRIVATE KEY-----', '')
      .replace(/\s/g, '');
    const decoded = Buffer.from(keyContent.substring(0, 40), 'base64');
    console.info('🔓 Private key decode test (first 30 bytes):', 
      Array.from(decoded.slice(0, 30)).map(b => b.toString(16).padStart(2, '0')).join(' '));
  } catch (decodeError) {
    console.error('❌ Private key decode failed:', decodeError);
  }
  
  return { projectId: projectId!, clientEmail: clientEmail!, privateKey: processedPrivateKey };
}

// Helper to convert Firestore doc to JSON-friendly format
const docToJson = (doc: QueryDocumentSnapshot) => {
  const data = doc.data();
  return {
    id: doc.id,
    ...data,
    createdAt: data.createdAt?.toDate ? data.createdAt.toDate().toISOString() : data.createdAt,
    updatedAt: data.updatedAt?.toDate ? data.updatedAt.toDate().toISOString() : data.updatedAt
  };
};

export async function POST(request: Request) {
  try {
    // Run pre-flight diagnostics
    assertAdminConfig();
    
    const { userId, docId, title, content = '', createdAt } = await request.json();

    if (!userId || !docId || !title) {
      return NextResponse.json(
        { error: 'Missing required fields: userId, docId, and title are required' },
        { status: 400 }
      );
    }

    // Check if Firebase is configured
    if (!adminDb) {
      console.error('📝 Firebase Admin not initialized despite passing config check');
      return NextResponse.json({ 
        success: true,
        message: 'Document saved successfully (development mode)',
        note: 'Configure Firebase credentials for persistent storage'
      });
    }

    // Use nested collection path
    const docRef = adminDb.collection('users').doc(userId).collection('documents').doc(docId);
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
    
    const errorDetails = error instanceof Error ? {
      name: error.name,
      message: error.message,
      isDecoderError: error.message.includes('DECODER routines::unsupported'),
      stack: error.stack?.substring(0, 500)
    } : { message: 'Unknown error' };
    
    return NextResponse.json({
      error: 'Failed to save document',
      details: errorDetails,
      diagnostic: 'Check Vercel function logs for detailed Firebase Admin diagnostics'
    }, { status: 500 });
  }
}

// GET route for loading documents
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const docId = searchParams.get('docId');

    if (!userId) {
      return NextResponse.json({ error: 'userId is required' }, { status: 400 });
    }

    if (!adminDb) {
      return NextResponse.json({ error: 'Database not configured' }, { status: 500 });
    }

    if (docId) {
      // Load a specific document
      const docRef = adminDb.collection('users').doc(userId).collection('documents').doc(docId);
      const docSnapshot = await docRef.get();
      
      if (!docSnapshot.exists) {
        return NextResponse.json({ error: 'Document not found' }, { status: 404 });
      }

      return NextResponse.json({
        success: true,
        document: docToJson(docSnapshot as QueryDocumentSnapshot)
      });
    } else {
      // Load all documents for a user
      const querySnapshot = await adminDb.collection('users').doc(userId).collection('documents').get();
      
      const documents = querySnapshot.docs.map(docToJson);

      documents.sort((a: { updatedAt?: any }, b: { updatedAt?: any }) => {
        const dateA = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
        const dateB = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
        return dateB - dateA;
      });
      
      return NextResponse.json({ documents });
    }
  } catch (error) {
    console.error('❌ GET Error in /api/saveDoc:', error);
    
    const errorDetails = error instanceof Error ? {
      name: error.name,
      message: error.message,
      stack: error.stack?.substring(0, 500),
    } : { message: 'Unknown error occurred' };
    
    return NextResponse.json({
      error: 'Failed to load documents due to a server error.',
      details: errorDetails,
    }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    // Run pre-flight diagnostics
    assertAdminConfig();
    
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

    // Check if document exists using nested path
    const docRef = adminDb.collection('users').doc(userId).collection('documents').doc(docId);
    const docSnapshot = await docRef.get();
    
    if (!docSnapshot.exists) {
      return NextResponse.json(
        { error: 'Document not found' },
        { status: 404 }
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
    
    const errorDetails = error instanceof Error ? {
      name: error.name,
      message: error.message,
      isDecoderError: error.message.includes('DECODER routines::unsupported'),
      stack: error.stack?.substring(0, 300)
    } : { message: 'Unknown error' };
    
    return NextResponse.json({
      error: 'Failed to delete document',
      details: errorDetails,
      diagnostic: 'Check Vercel function logs for detailed Firebase Admin diagnostics'
    }, { status: 500 });
  }
} 