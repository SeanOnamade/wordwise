import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

// Function to format the private key from environment variables
const formatPrivateKey = (key?: string): string => {
  if (!key) return '';
  return key.replace(/\\n/g, '\n');
};

let adminDb: ReturnType<typeof getFirestore> | null = null;

const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID;
const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
const privateKey = formatPrivateKey(process.env.FIREBASE_ADMIN_PRIVATE_KEY);

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