import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

// Check if we're in development and have credentials
const hasFirebaseCredentials = () => {
  return !!(
    process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID &&
    process.env.FIREBASE_ADMIN_CLIENT_EMAIL &&
    process.env.FIREBASE_ADMIN_PRIVATE_KEY
  );
};

// Server-side Firebase configuration
const firebaseAdminConfig = {
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  // Only use credentials if they exist
  ...(hasFirebaseCredentials() && {
    credential: cert({
      projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    }),
  }),
};

// Initialize Firebase Admin only if credentials are available
let adminApp: any = null;
let adminDb: any = null;

if (hasFirebaseCredentials()) {
  try {
    adminApp = getApps().length === 0 ? initializeApp(firebaseAdminConfig, 'admin') : getApps()[0];
    adminDb = getFirestore(adminApp);
  } catch (error) {
    console.warn('Firebase Admin initialization failed:', error);
  }
} else {
  console.info('🚧 Development mode: Firebase Admin credentials not configured');
}

export { adminApp, adminDb }; 