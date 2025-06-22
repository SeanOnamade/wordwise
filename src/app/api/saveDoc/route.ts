import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { FieldValue, QueryDocumentSnapshot } from 'firebase-admin/firestore';
import { getAlternativeAdminDb } from '@/lib/firebase-admin';

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

// Helper function to test Firestore connection and trigger fallbacks
async function testFirestoreConnection() {
  console.log('🔥 Testing Firestore connection...');
  
  try {
    await adminDb.collection('test_connection').limit(1).get();
    console.log('✅ Firestore connection test successful');
    return { success: true, method: 'admin-sdk' };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('❌ Firestore connection test failed:', {
      name: error instanceof Error ? error.name : 'Unknown',
      message: errorMessage,
      code: (error as any)?.code,
      details: (error as any)?.details
    });

    // Check for DECODER error and immediately try REST API
    if (errorMessage.includes('DECODER routines::unsupported')) {
      console.error('🔍 DECODER error detected - this typically means the PEM private key is malformed');
      console.error('Common causes: Windows CRLF line endings, missing header/footer, or corrupted key data');
      console.log('🌐 Switching to REST API mode to bypass gRPC issues...');
      
      // Test REST API connection
      try {
        const testUserId = 'test-connection-user';
        await queryFirestoreREST(testUserId);
        console.log('✅ REST API connection test successful');
        return { success: true, method: 'rest-api' };
      } catch (restError) {
        console.error('❌ REST API connection test also failed:', restError);
        return { success: false, method: 'none', error: restError };
      }
    }
    
    return { success: false, method: 'none', error };
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

// REST API fallback for Firestore reads (bypasses gRPC issues)
async function queryFirestoreREST(userId: string) {
  console.log('🌐 Using Firestore REST API fallback...');
  
  try {
    const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID;
    const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY;
    const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
    
    if (!projectId || !privateKey || !clientEmail) {
      throw new Error('Missing Firebase credentials for REST API');
    }

    // Use Google Auth Library instead of manual JWT
    const { GoogleAuth } = require('google-auth-library');
    
    // Process private key properly
    let processedPrivateKey = privateKey;
    
    // Remove JSON quotes if present
    if (processedPrivateKey.startsWith('"') && processedPrivateKey.endsWith('"')) {
      processedPrivateKey = processedPrivateKey.slice(1, -1);
    }
    
    // Replace escaped newlines
    if (processedPrivateKey.includes('\\n')) {
      processedPrivateKey = processedPrivateKey.replace(/\\n/g, '\n');
    }

    // Create credentials object for Google Auth
    const credentials = {
      type: 'service_account',
      project_id: projectId,
      client_email: clientEmail,
      private_key: processedPrivateKey,
      private_key_id: 'dummy', // Not required for auth
      client_id: 'dummy', // Not required for auth
      auth_uri: 'https://accounts.google.com/o/oauth2/auth',
      token_uri: 'https://oauth2.googleapis.com/token'
    };

    // Initialize Google Auth with service account
    const auth = new GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/datastore']
    });

    console.log('🔐 Getting access token with Google Auth Library...');
    const authClient = await auth.getClient();
    const accessToken = await authClient.getAccessToken();

    if (!accessToken.token) {
      throw new Error('Failed to get access token from Google Auth Library');
    }

    console.log('✅ Google Auth Library authentication successful');

    // Query Firestore using REST API with updated collection path
    const firestoreUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/users/${userId}:runQuery`;
    
    const queryBody = {
      structuredQuery: {
        from: [{ 
          collectionId: 'documents'
        }],
        orderBy: [
          {
            field: { fieldPath: 'updatedAt' },
            direction: 'DESCENDING'
          }
        ]
      }
    };

    console.log('📡 Making Firestore REST API request...', {
      userId,
      collectionPath: `users/${userId}/documents`
    });

    const queryResponse = await fetch(firestoreUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(queryBody)
    });

    if (!queryResponse.ok) {
      const errorText = await queryResponse.text();
      console.error('❌ Firestore REST query failed:', {
        status: queryResponse.status,
        statusText: queryResponse.statusText,
        error: errorText
      });
      throw new Error(`Firestore REST query failed: ${queryResponse.status} - ${errorText}`);
    }

    const queryData = await queryResponse.json();
    console.log('✅ REST API query successful');

    // Transform REST API response to match Admin SDK format
    const documents = queryData
      .filter((item: any) => item.document)
      .map((item: any) => {
        const doc = item.document;
        const docId = doc.name.split('/').pop();
        
        // Convert Firestore values to plain objects
        const data: any = {};
        if (doc.fields) {
          for (const [key, value] of Object.entries(doc.fields)) {
            if (typeof value === 'object' && value !== null) {
              const fieldValue = value as any;
              if (fieldValue.stringValue !== undefined) {
                data[key] = fieldValue.stringValue;
              } else if (fieldValue.timestampValue !== undefined) {
                data[key] = new Date(fieldValue.timestampValue);
              } else if (fieldValue.integerValue !== undefined) {
                data[key] = parseInt(fieldValue.integerValue);
              } else if (fieldValue.doubleValue !== undefined) {
                data[key] = fieldValue.doubleValue;
              } else if (fieldValue.booleanValue !== undefined) {
                data[key] = fieldValue.booleanValue;
              }
            }
          }
        }

        return {
          id: docId,
          ...data
        };
      });

    console.log(`📄 REST API found ${documents.length} documents`);
    return documents;

  } catch (error) {
    console.error('❌ REST API fallback failed:', error);
    throw error;
  }
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

    // Test Firestore connection before proceeding
    await testFirestoreConnection();

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

    // Test Firestore connection and determine which method to use
    const connectionTest = await testFirestoreConnection();
    
    if (!connectionTest.success) {
      throw connectionTest.error || new Error('All connection methods failed');
    }

    if (docId) {
      // Load specific document
      console.log('📂 Loading specific document:', docId);
      
      if (connectionTest.method === 'rest-api') {
        // Use REST API for single document
        const documents = await queryFirestoreREST(userId);
        const document = documents.find((doc: any) => doc.id === docId);
        
        if (!document) {
          return NextResponse.json(
            { error: 'Document not found' },
            { status: 404 }
          );
        }

        return NextResponse.json({
          success: true,
          document,
          usedRestApi: true
        });
      } else {
        // Use Admin SDK with nested path
        const docRef = adminDb.collection('users').doc(userId).collection('documents').doc(docId);
        const docSnapshot = await docRef.get();
        
        if (!docSnapshot.exists) {
          return NextResponse.json(
            { error: 'Document not found' },
            { status: 404 }
          );
        }

        return NextResponse.json({
          success: true,
          document: docToJson(docSnapshot as QueryDocumentSnapshot)
        });
      }
    } else {
      // Load all user documents using nested path
      console.log('📚 Getting all documents for user:', userId);
      const querySnapshot = await adminDb.collection('users').doc(userId).collection('documents').get();
      
      const documents = querySnapshot.docs.map(docToJson);

      // Sort documents manually to ensure correct order
      documents.sort((a: { updatedAt?: any }, b: { updatedAt?: any }) => {
        const dateA = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
        const dateB = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
        return dateB - dateA;
      });
      
      return NextResponse.json({ documents });
    }
  } catch (error) {
    console.error('❌ GET Error in /api/saveDoc:', error);
    
    // Enhanced error response with diagnostics
    const errorDetails = error instanceof Error ? {
      name: error.name,
      message: error.message,
      stack: error.stack?.substring(0, 500), // Include a portion of the stack trace
      cause: (error as any).cause,
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

    // Test Firestore connection before proceeding
    await testFirestoreConnection();

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