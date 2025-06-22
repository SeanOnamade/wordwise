import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { FieldValue, QueryDocumentSnapshot } from 'firebase-admin/firestore';
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

    // Create JWT token for authentication
    const jwt = require('jsonwebtoken');
    const now = Math.floor(Date.now() / 1000);
    const payload = {
      iss: clientEmail,
      sub: clientEmail,
      aud: 'https://firestore.googleapis.com/google.firestore.v1.Firestore',
      iat: now,
      exp: now + 3600, // 1 hour
      scope: 'https://www.googleapis.com/auth/datastore'
    };

    // More thorough private key processing for JWT
    let processedPrivateKey = privateKey;
    
    // Remove JSON quotes if present
    if (processedPrivateKey.startsWith('"') && processedPrivateKey.endsWith('"')) {
      processedPrivateKey = processedPrivateKey.slice(1, -1);
    }
    
    // Replace escaped newlines
    if (processedPrivateKey.includes('\\n')) {
      processedPrivateKey = processedPrivateKey.replace(/\\n/g, '\n');
    }
    
    // Ensure proper PEM format
    if (!processedPrivateKey.startsWith('-----BEGIN PRIVATE KEY-----')) {
      processedPrivateKey = '-----BEGIN PRIVATE KEY-----\n' + processedPrivateKey;
    }
    if (!processedPrivateKey.endsWith('-----END PRIVATE KEY-----')) {
      processedPrivateKey = processedPrivateKey + '\n-----END PRIVATE KEY-----';
    }
    
    // Clean up any double formatting
    processedPrivateKey = processedPrivateKey
      .replace(/-----BEGIN PRIVATE KEY-----\s+/g, '-----BEGIN PRIVATE KEY-----\n')
      .replace(/\s+-----END PRIVATE KEY-----/g, '\n-----END PRIVATE KEY-----');

    console.log('🔑 JWT private key processing:', {
      originalLength: privateKey.length,
      processedLength: processedPrivateKey.length,
      startsWithQuote: privateKey.startsWith('"'),
      hasEscapedNewlines: privateKey.includes('\\n'),
      finalHasRealNewlines: processedPrivateKey.includes('\n'),
      finalStartsCorrectly: processedPrivateKey.startsWith('-----BEGIN PRIVATE KEY-----'),
      finalEndsCorrectly: processedPrivateKey.endsWith('-----END PRIVATE KEY-----')
    });

    const token = jwt.sign(payload, processedPrivateKey, { algorithm: 'RS256' });

    // Get access token
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
        assertion: token
      })
    });

    if (!tokenResponse.ok) {
      throw new Error(`Token request failed: ${tokenResponse.status}`);
    }

    const tokenData = await tokenResponse.json();
    const accessToken = tokenData.access_token;

    // Query Firestore using REST API
    const firestoreUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents:runQuery`;
    
    const queryBody = {
      structuredQuery: {
        from: [{ collectionId: 'documents' }],
        where: {
          fieldFilter: {
            field: { fieldPath: 'ownerUid' },
            op: 'EQUAL',
            value: { stringValue: userId }
          }
        },
        orderBy: [
          {
            field: { fieldPath: 'updatedAt' },
            direction: 'DESCENDING'
          }
        ],
        limit: 50
      }
    };

    const queryResponse = await fetch(firestoreUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(queryBody)
    });

    if (!queryResponse.ok) {
      throw new Error(`Firestore REST query failed: ${queryResponse.status}`);
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
        // Use Admin SDK
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
      }
    } else {
      // Load all user documents
      console.log('📂 Loading all documents for user:', userId);
      
      if (connectionTest.method === 'rest-api') {
        console.log('🌐 Using REST API for document query...');
        const documents = await queryFirestoreREST(userId);
        
        return NextResponse.json({
          success: true,
          documents,
          usedRestApi: true,
          note: 'Used Firestore REST API to bypass serverless gRPC limitations'
        });
      } else {
        console.log('🔧 Using Admin SDK for document query...');
        
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

          const documents = docsSnapshot.docs.map((doc: QueryDocumentSnapshot) => ({
            id: doc.id,
            ...doc.data()
          }));

          return NextResponse.json({
            success: true,
            documents
          });
        } catch (queryError) {
          console.error('📂 Firestore query error:', queryError);
          
          // Final fallback to REST API if Admin SDK query fails
          if (queryError instanceof Error && queryError.message.includes('DECODER routines::unsupported')) {
            console.error('🔍 DECODER error during READ operation detected!');
            console.error('🌐 Final fallback to REST API...');
            
            try {
              const documents = await queryFirestoreREST(userId);
              
              return NextResponse.json({
                success: true,
                documents,
                usedRestFallback: true,
                note: 'Used Firestore REST API to bypass serverless gRPC limitations'
              });
            } catch (restError) {
              console.error('❌ REST API fallback also failed:', restError);
            }
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
    }
  } catch (error) {
    console.error('Error loading documents:', error);
    
    // Enhanced error response with diagnostics
    const errorDetails = error instanceof Error ? {
      name: error.name,
      message: error.message,
      isDecoderError: error.message.includes('DECODER routines::unsupported'),
      stack: error.stack?.substring(0, 500)
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