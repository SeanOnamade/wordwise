const admin = require('firebase-admin');

// ------------------ INSTRUCTIONS ------------------
// 1. If you haven't already, go to your Firebase Project Settings -> Service accounts.
// 2. Click "Generate new private key" and download the JSON file.
// 3. Place the downloaded file in the root directory of your project.
// 4. Rename the file to 'serviceAccountKey.json'.
// 5. Run this script from your terminal: `node scripts/addCreatedAt.js`
// ----------------------------------------------------

try {
  const serviceAccount = require('../serviceAccountKey.json');
  
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });

  const db = admin.firestore();

  async function migrateData() {
    console.log("Starting data migration...");
    const oldDocsSnapshot = await db.collection('documents').get();
    
    if (oldDocsSnapshot.empty) {
      console.log("No documents found in the old 'documents' collection. Nothing to migrate.");
      return;
    }

    console.log(`Found ${oldDocsSnapshot.docs.length} documents in the old collection. Starting migration...`);
    
    let batch = db.batch();
    let opsCount = 0; // Each move is 2 ops (set, delete)
    let movedCount = 0;

    for (const oldDoc of oldDocsSnapshot.docs) {
      const data = oldDoc.data();
      const docId = oldDoc.id;
      const ownerUid = data.ownerUid;

      if (!ownerUid) {
        console.warn(`Skipping doc ${docId} because it has no 'ownerUid'.`);
        continue;
      }
      
      const newDocRef = db.collection('users').doc(ownerUid).collection('documents').doc(docId);
      
      const newData = { ...data };
      if (!newData.createdAt && newData.updatedAt) {
        newData.createdAt = newData.updatedAt;
        console.log(`- Doc ${docId}: 'createdAt' missing. Will be set from 'updatedAt'.`);
      }
      
      console.log(`- Migrating doc ${docId} to new path for user ${ownerUid}...`);
      
      batch.set(newDocRef, newData);
      batch.delete(oldDoc.ref);
      
      opsCount += 2;
      movedCount++;

      // Batches can handle up to 500 operations.
      if (opsCount >= 498) {
        await batch.commit();
        console.log(`Committed a batch of document migrations.`);
        batch = db.batch();
        opsCount = 0;
      }
    }

    if (opsCount > 0) {
      await batch.commit();
      console.log(`Committed the final batch of document migrations.`);
    }

    console.log(`\nMigration complete. A total of ${movedCount} documents were moved to the new user-specific collections.`);
  }

  migrateData().catch(error => {
    console.error("\nMigration failed:", error);
  });

} catch (error) {
  if (error.code === 'MODULE_NOT_FOUND') {
    console.error("\nERROR: `serviceAccountKey.json` not found.");
    console.error("Please follow the instructions at the top of the script to download your service account key and place it in the project's root directory.\n");
  } else {
    console.error("\nAn unexpected error occurred:", error);
  }
} 