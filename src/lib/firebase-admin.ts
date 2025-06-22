import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import * as admin from 'firebase-admin';

// Check if we have admin credentials
const hasFirebaseCredentials = () => {
  return !!(
    process.env.FIREBASE_ADMIN_PROJECT_ID &&
    process.env.FIREBASE_ADMIN_CLIENT_EMAIL &&
    process.env.FIREBASE_ADMIN_PRIVATE_KEY
  );
};

// Function to properly format the private key
const formatPrivateKey = (key: string): string => {
  if (!key) return '';
  
  // Check if it's base64 encoded (alternative format)
  if (!key.includes('BEGIN PRIVATE KEY') && key.length > 100) {
    try {
      const decoded = Buffer.from(key, 'base64').toString('utf8');
      if (decoded.includes('BEGIN PRIVATE KEY')) {
        return decoded;
      }
    } catch (error) {
      console.warn('Failed to decode base64 private key, trying as regular key');
    }
  }
  
  // If the key already has proper line breaks, return as is
  if (key.includes('\n')) {
    return key;
  }
  
  // If the key has escaped newlines, replace them
  if (key.includes('\\n')) {
    return key.replace(/\\n/g, '\n');
  }
  
  // If it's a single line key, add proper formatting
  return key.replace(/-----BEGIN PRIVATE KEY-----(.*)-----END PRIVATE KEY-----/, 
    '-----BEGIN PRIVATE KEY-----\n$1\n-----END PRIVATE KEY-----\n');
};

// Initialize Firebase Admin
let adminApp: any = null;
let adminDb: any = null;

if (hasFirebaseCredentials()) {
  try {
    const processedPrivateKey = formatPrivateKey(process.env.FIREBASE_ADMIN_PRIVATE_KEY!);
    
    // Check if any Firebase app already exists
    const existingApp = getApps().find(app => app.name === 'admin');
    if (existingApp) {
      adminApp = existingApp;
      console.log('✅ Using existing Firebase Admin app');
    } else {
      console.log('🚀 Initializing Firebase Admin...');
      
      const adminCredentials = cert({
        projectId: process.env.FIREBASE_ADMIN_PROJECT_ID!,
        clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL!,
        privateKey: processedPrivateKey
      });

      adminApp = initializeApp({
        credential: adminCredentials,
        projectId: process.env.FIREBASE_ADMIN_PROJECT_ID
      }, 'admin');
      
      console.log('✅ Firebase Admin initialized successfully');
    }

    // Initialize Firestore with production-optimized settings
    adminDb = getFirestore(adminApp);
    
    // Configure Firestore settings for better serverless performance
    try {
      adminDb.settings({
        ignoreUndefinedProperties: true,
        // Optimize for serverless environments
        ssl: true,
        maxIdleChannels: 1,
        // Reduce connection pool size for serverless
        keepAliveTimeoutMs: 30000,
        keepAliveTimeMs: 30000
      });
      console.log('⚙️ Firestore settings configured for serverless environment');
    } catch (settingsError) {
      console.warn('⚠️ Could not configure Firestore settings:', settingsError);
    }
    
  } catch (error) {
    console.error('Firebase Admin initialization failed:', error);
    // Log more details about the error
    if (error instanceof Error) {
      console.error('Error details:', {
        name: error.name,
        message: error.message,
        stack: error.stack?.substring(0, 500) // Truncate stack trace
      });
    }
  }
} else {
  console.warn('⚠️ Firebase Admin credentials not configured properly:', {
    projectId: !!process.env.FIREBASE_ADMIN_PROJECT_ID,
    clientEmail: !!process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
    privateKey: !!process.env.FIREBASE_ADMIN_PRIVATE_KEY,
    privateKeyLength: process.env.FIREBASE_ADMIN_PRIVATE_KEY?.length || 0
  });
}

// Alternative initialization for production environments
function initializeFirebaseAdminAlternative() {
  console.log('🔄 Attempting alternative Firebase Admin initialization...');
  
  try {
    const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID;
    const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
    let privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY;

    if (!projectId || !clientEmail || !privateKey) {
      throw new Error('Missing required Firebase Admin environment variables for alternative init');
    }

    // More aggressive private key processing for production
    if (privateKey.includes('\\n')) {
      privateKey = privateKey.replace(/\\n/g, '\n');
    }
    
    // Ensure proper formatting
    if (!privateKey.startsWith('-----BEGIN')) {
      privateKey = '-----BEGIN PRIVATE KEY-----\n' + privateKey;
    }
    if (!privateKey.endsWith('-----')) {
      privateKey = privateKey + '\n-----END PRIVATE KEY-----';
    }

    // Clean up any double newlines or formatting issues
    privateKey = privateKey
      .replace(/-----BEGIN PRIVATE KEY-----\s+/g, '-----BEGIN PRIVATE KEY-----\n')
      .replace(/\s+-----END PRIVATE KEY-----/g, '\n-----END PRIVATE KEY-----');

    console.log('🔑 Alternative init private key format:', {
      length: privateKey.length,
      lines: privateKey.split('\n').length,
      startsCorrectly: privateKey.startsWith('-----BEGIN PRIVATE KEY-----'),
      endsCorrectly: privateKey.endsWith('-----END PRIVATE KEY-----')
    });

    const credential = admin.credential.cert({
      projectId,
      clientEmail,
      privateKey
    });

    const appName = 'wordwise-alternative';
    
    // Check if app already exists
    try {
      return admin.app(appName);
    } catch (error) {
      // App doesn't exist, create it
      const app = admin.initializeApp({
        credential,
        projectId
      }, appName);
      
      console.log('✅ Alternative Firebase Admin initialized successfully');
      return app;
    }
  } catch (error) {
    console.error('❌ Alternative Firebase Admin initialization failed:', error);
    throw error;
  }
}

// Export both the original and alternative admin instances
let alternativeAdminDb: admin.firestore.Firestore | null = null;

export function getAlternativeAdminDb(): admin.firestore.Firestore {
  if (!alternativeAdminDb) {
    const app = initializeFirebaseAdminAlternative();
    alternativeAdminDb = app.firestore();
    
    // Configure alternative Firestore with similar settings
    try {
      alternativeAdminDb.settings({
        ignoreUndefinedProperties: true,
        ssl: true,
        maxIdleChannels: 1,
        keepAliveTimeoutMs: 30000,
        keepAliveTimeMs: 30000
      });
      console.log('⚙️ Alternative Firestore settings configured');
    } catch (settingsError) {
      console.warn('⚠️ Could not configure alternative Firestore settings:', settingsError);
    }
  }
  return alternativeAdminDb;
}

export { adminApp, adminDb }; 