import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

// Function to get the private key, with robust handling of different formats
const getPrivateKey = (): string => {
  const b64Key = process.env.FIREBASE_ADMIN_PRIVATE_KEY_B64;
  const directKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY;

  // Prefer the base64 encoded key for production environments
  if (b64Key) {
    try {
      const decoded = Buffer.from(b64Key, 'base64').toString('utf8');
      console.log('🔑 Using Base64 decoded private key, length:', decoded.length);
      return decoded;
    } catch (error) {
      console.error('Failed to decode Base64 private key:', error);
      // Fallback to direct key if decoding fails
    }
  }

  // Fallback for local development or if base64 key is missing
  if (directKey) {
    console.log('🔑 Using direct private key, length:', directKey.length);
    
    // Handle JSON-escaped private key
    let processedKey = directKey;
    
    // Remove surrounding quotes if present
    if (processedKey.startsWith('"') && processedKey.endsWith('"')) {
      processedKey = processedKey.slice(1, -1);
    }
    
    // Replace escaped newlines with actual newlines
    processedKey = processedKey.replace(/\\n/g, '\n');
    
    // Replace escaped quotes
    processedKey = processedKey.replace(/\\"/g, '"');
    
    // Ensure proper PEM format
    if (!processedKey.includes('-----BEGIN PRIVATE KEY-----')) {
      console.error('❌ Private key does not contain PEM header');
      return '';
    }
    
    if (!processedKey.includes('-----END PRIVATE KEY-----')) {
      console.error('❌ Private key does not contain PEM footer');
      return '';
    }
    
    console.log('✅ Private key appears to have valid PEM format');
    return processedKey;
  }

  console.warn('⚠️ No private key found in environment variables');
  return '';
};

let adminDb: ReturnType<typeof getFirestore> | null = null;

const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID;
const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
const privateKey = getPrivateKey();

if (projectId && clientEmail && privateKey) {
  const existingApp = getApps().find(app => app.name === 'admin');

  if (existingApp) {
    adminDb = getFirestore(existingApp);
  } else {
    try {
      console.log('🚀 Initializing Firebase Admin with credentials...');
      console.log('📋 Project ID:', projectId);
      console.log('📧 Client Email:', clientEmail?.substring(0, 20) + '...');
      console.log('🔑 Private Key Length:', privateKey.length);
      
      const adminApp = initializeApp({
        credential: cert({ projectId, clientEmail, privateKey }),
      }, 'admin');

      // Initialize Firestore with REST transport enabled
      adminDb = getFirestore(adminApp);
      adminDb.settings({ preferRest: true }); 

      console.log('✅ Firebase Admin initialized with REST transport.');
    } catch (error) {
      console.error('🔥 Firebase Admin initialization failed:', error);
    }
  }
} else {
  console.warn('⚠️ Firebase Admin credentials not set. Missing:', {
    projectId: !projectId,
    clientEmail: !clientEmail,
    privateKey: !privateKey
  });
}

// All alternative initialization logic has been removed for simplicity and reliability.
// The `preferRest: true` setting is the official and recommended way to handle
// serverless environment connection issues.

export { adminDb };
// Exporting getAlternativeAdminDb as null to avoid breaking imports,
// but it should be refactored out.
export const getAlternativeAdminDb = () => null; 