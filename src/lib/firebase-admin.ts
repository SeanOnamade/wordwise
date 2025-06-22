import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

// Function to get the private key, preferring a base64 version
const getPrivateKey = (): string => {
  const b64Key = process.env.FIREBASE_ADMIN_PRIVATE_KEY_B64;
  const directKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY;

  // Prefer the base64 encoded key for production environments
  if (b64Key) {
    try {
      return Buffer.from(b64Key, 'base64').toString('utf8');
    } catch (error) {
      console.error('Failed to decode Base64 private key:', error);
      // Fallback to direct key if decoding fails
    }
  }

  // Fallback for local development or if base64 key is missing
  if (directKey) {
    return directKey.replace(/\\n/g, '\n');
  }

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
  console.warn('⚠️ Firebase Admin credentials not set. Skipping initialization.');
}

// All alternative initialization logic has been removed for simplicity and reliability.
// The `preferRest: true` setting is the official and recommended way to handle
// serverless environment connection issues.

export { adminDb };
// Exporting getAlternativeAdminDb as null to avoid breaking imports,
// but it should be refactored out.
export const getAlternativeAdminDb = () => null; 