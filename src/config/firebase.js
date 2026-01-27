const admin = require('firebase-admin');
const logger = require('./logger');

let firebaseInitialized = false;

/**
 * Initialize Firebase Admin SDK
 * Uses service account credentials from environment or file
 */
const initializeFirebase = () => {
  if (firebaseInitialized) {
    logger.info('Firebase Admin already initialized');
    return admin;
  }

  try {
    // Option 1: Service account from environment variable (recommended for production)
    if (process.env.FIREBASE_SERVICE_ACCOUNT) {
      const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
      
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        projectId: serviceAccount.project_id
      });
      
      logger.info('Firebase Admin initialized from environment variable');
    } 
    // Option 2: Service account from file (for local development)
    else if (process.env.FIREBASE_SERVICE_ACCOUNT_PATH) {
      const serviceAccount = require(process.env.FIREBASE_SERVICE_ACCOUNT_PATH);
      
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        projectId: serviceAccount.project_id
      });
      
      logger.info('Firebase Admin initialized from file');
    }
    // Option 3: Use application default credentials (for GCP environments)
    else {
      admin.initializeApp({
        credential: admin.credential.applicationDefault()
      });
      
      logger.info('Firebase Admin initialized with default credentials');
    }

    firebaseInitialized = true;
    logger.info('Firebase Admin SDK initialized successfully');
    
    return admin;
  } catch (error) {
    logger.error(`Failed to initialize Firebase Admin: ${error.message}`);
    throw error;
  }
};

/**
 * Get Firebase Admin instance
 */
const getFirebaseAdmin = () => {
  if (!firebaseInitialized) {
    throw new Error('Firebase Admin not initialized. Call initializeFirebase() first.');
  }
  return admin;
};

/**
 * Get FCM messaging instance
 */
const getMessaging = () => {
  if (!firebaseInitialized) {
    throw new Error('Firebase Admin not initialized. Call initializeFirebase() first.');
  }
  return admin.messaging();
};

module.exports = {
  initializeFirebase,
  getFirebaseAdmin,
  getMessaging
};
