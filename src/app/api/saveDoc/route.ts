import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import { getAlternativeAdminDb } from '@/lib/firebase-admin';

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

// Diagnostic Firestore test
async function testFirestoreConnection() {
  if (!adminDb) {
    throw new Error('AdminDb not initialized');
  }
  
  console.info('🔥 Testing Firestore connection...');
  
  try {
    // Try a simple document get operation on a non-reserved collection
    const testDocRef = adminDb.collection('test_connection').doc('ping');
    const startTime = Date.now();
    await testDocRef.get();
    const duration = Date.now() - startTime;
    
    console.info('✅ Firestore connection test successful:', { duration });
    return true;
  } catch (firestoreError) {
    console.error('❌ Firestore connection test failed:', {
      name: firestoreError instanceof Error ? firestoreError.name : 'Unknown',
      message: firestoreError instanceof Error ? firestoreError.message : 'Unknown error',
      code: (firestoreError as any)?.code,
      details: (firestoreError as any)?.details
    });
    
    // If it's the DECODER error, log additional diagnostics
    if (firestoreError instanceof Error && firestoreError.message.includes('DECODER routines::unsupported')) {
      console.error('🔍 DECODER error detected - this typically means the PEM private key is malformed');
      console.error('Common causes: Windows CRLF line endings, missing header/footer, or corrupted key data');
    }
    
    throw firestoreError;
  }
}

// Helper function to retry Firestore operations with exponential backoff
async function retryFirestoreOperation<T>(
  operation: () => Promise<T>,
  maxRetries: number = 3,
  baseDelay: number = 1000
): Promise<T> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      if (attempt === maxRetries) {
        throw error; // Last attempt, re-throw the error
      }
      
      if (error instanceof Error && 
          (error.message.includes('DECODER routines::unsupported') || 
           error.message.includes('Getting metadata from plugin failed'))) {
        const delay = baseDelay * Math.pow(2, attempt - 1);
        console.log(`🔄 Retry attempt ${attempt}/${maxRetries} after ${delay}ms delay...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      } else {
        throw error; // Non-retryable error
      }
    }
  }
  throw new Error('Max retries exceeded');
}

export async function POST(request: Request) {
  try {
    // Run pre-flight diagnostics
    assertAdminConfig();
    
    const { userId, docId, title, content = '' } = await request.json();

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

    // Test Firestore connection before proceeding
    await testFirestoreConnection();

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
    
    // Enhanced error response with diagnostics
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
    // Run pre-flight diagnostics
    assertAdminConfig();
    
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const docId = searchParams.get('docId');

    console.log('📂 Loading documents request:', { userId, docId });

    if (!userId) {
      return NextResponse.json(
        { error: 'userId is required' },
        { status: 400 }
      );
    }

    // Check if Firebase is configured
    if (!adminDb) {
      console.warn('📂 Firebase Admin not initialized - missing credentials');
      return NextResponse.json({
        success: true,
        documents: [],
        note: 'Firebase Admin not configured - check environment variables'
      });
    }

    // Test Firestore connection before proceeding
    await testFirestoreConnection();

    if (docId) {
      // Load specific document
      console.log('📂 Loading specific document:', docId);
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
      console.log('📂 Loading all documents for user:', userId);
      
      try {
        // Add detailed diagnostics before the query
        console.log('🔍 Pre-query diagnostics:', {
          adminDbExists: !!adminDb,
          userId: userId,
          userIdType: typeof userId,
          userIdLength: userId.length,
          environment: process.env.NODE_ENV,
          vercelEnv: process.env.VERCEL_ENV
        });

        // Log the exact query being attempted
        console.log('📊 Attempting Firestore query with parameters:', {
          collection: 'documents',
          whereField: 'ownerUid',
          whereOperator: '==',
          whereValue: userId,
          orderByField: 'updatedAt',
          orderByDirection: 'desc',
          limitValue: 50
        });

        const docsSnapshot = await retryFirestoreOperation(async () => {
          return await adminDb
            .collection('documents')
            .where('ownerUid', '==', userId)
            .orderBy('updatedAt', 'desc')
            .limit(50)
            .get();
        });

        console.log('📂 Query completed, found documents:', docsSnapshot.size);

        const documents = docsSnapshot.docs.map((doc: any) => ({
          id: doc.id,
          ...doc.data()
        }));

        return NextResponse.json({
          success: true,
          documents
        });
      } catch (queryError) {
        console.error('📂 Firestore query error:', queryError);
        
        // Enhanced error logging for DECODER issues
        if (queryError instanceof Error && queryError.message.includes('DECODER routines::unsupported')) {
          console.error('🔍 DECODER error during READ operation detected!');
          console.error('💡 Attempting fallback with alternative Firebase Admin initialization...');
          
          try {
            const alternativeDb = getAlternativeAdminDb();
            console.log('🔄 Retrying query with alternative admin...');
            
            const docsSnapshot = await alternativeDb
              .collection('documents')
              .where('ownerUid', '==', userId)
              .orderBy('updatedAt', 'desc')
              .limit(50)
              .get();

            console.log('✅ Alternative admin query successful! Found documents:', docsSnapshot.size);

            const documents = docsSnapshot.docs.map((doc: any) => ({
              id: doc.id,
              ...doc.data()
            }));

            return NextResponse.json({
              success: true,
              documents,
              usedFallback: true
            });
          } catch (fallbackError) {
            console.error('❌ Alternative admin also failed:', fallbackError);
            // Continue to original error handling below
          }
          
          console.error('🔑 Re-checking private key format in production:');
          
          const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY;
          if (privateKey) {
            console.error('🔑 Production private key analysis:', {
              length: privateKey.length,
              hasEscapedNewlines: privateKey.includes('\\n'),
              hasRealNewlines: privateKey.includes('\n'),
              startsWithBegin: privateKey.startsWith('-----BEGIN'),
              endsWithEnd: privateKey.endsWith('-----'),
              firstNewlineAt: privateKey.indexOf('\n'),
              firstEscapedAt: privateKey.indexOf('\\n'),
              // Show first and last 50 chars
              prefix: privateKey.substring(0, 50),
              suffix: privateKey.substring(privateKey.length - 50)
            });
            
            // Try to decode a small portion to see if it's valid
            try {
              const keyContent = privateKey
                .replace('-----BEGIN PRIVATE KEY-----', '')
                .replace('-----END PRIVATE KEY-----', '')
                .replace(/\s/g, '');
              const testDecode = Buffer.from(keyContent.substring(0, 40), 'base64');
              console.error('🔓 Private key decode test in production:', 
                Array.from(testDecode.slice(0, 20)).map(b => b.toString(16).padStart(2, '0')).join(' '));
            } catch (decodeErr) {
              console.error('❌ Private key decode failed in production:', decodeErr);
            }
          }
          
          console.error('💡 Hypothesis: Private key works for writes but fails for reads in serverless environment');
          console.error('💡 This could be due to different Node.js crypto implementations or memory constraints');
        }
        
        // Return more specific error information
        return NextResponse.json({
          error: 'Database query failed',
          details: queryError instanceof Error ? queryError.message : 'Unknown error',
          code: 'FIRESTORE_QUERY_ERROR',
          isDecoderError: queryError instanceof Error && queryError.message.includes('DECODER routines::unsupported'),
          troubleshooting: 'Check Vercel function logs for detailed diagnostics'
        }, { status: 500 });
      }
    }
  } catch (error) {
    console.error('Error loading documents:', error);
    
    // Return more detailed error information
    const errorDetails = error instanceof Error ? {
      name: error.name,
      message: error.message,
      isDecoderError: error.message.includes('DECODER routines::unsupported'),
      stack: error.stack?.substring(0, 300)
    } : { message: 'Unknown error' };
    
    return NextResponse.json({
      error: 'Failed to load documents',
      details: errorDetails,
      diagnostic: 'Check Vercel function logs for detailed Firebase Admin diagnostics'
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

    // Test Firestore connection before proceeding
    await testFirestoreConnection();

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