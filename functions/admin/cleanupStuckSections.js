/**
 * Admin script to clean up sections stuck in PENDING/PROCESSING status
 * Run with: node functions/admin/cleanupStuckSections.js
 */

const admin = require('firebase-admin');

// Initialize with application default credentials (uses GOOGLE_APPLICATION_CREDENTIALS env var)
admin.initializeApp();

const db = admin.firestore();

async function cleanupStuckSections() {
  try {
    console.log('Searching for stuck sections...');

    // Find sections stuck in PENDING or PROCESSING for more than 10 minutes
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);

    const stuckSections = await db
      .collectionGroup('sections')
      .where('aiStatus', 'in', ['PENDING', 'PROCESSING'])
      .get();

    console.log(`Found ${stuckSections.size} potentially stuck sections`);

    if (stuckSections.empty) {
      console.log('No stuck sections found. Exiting.');
      process.exit(0);
    }

    let cleaned = 0;
    const batch = db.batch();

    stuckSections.forEach(doc => {
      const data = doc.data();
      const createdAt = data.createdAt?.toDate();

      // Only clean up sections older than 10 minutes
      if (createdAt && createdAt < tenMinutesAgo) {
        console.log(`Marking as FAILED: ${doc.ref.path}`);
        console.log(`  Title: ${data.title || 'N/A'}`);
        console.log(`  Status: ${data.aiStatus}`);
        console.log(`  Created: ${createdAt}`);

        batch.update(doc.ref, {
          aiStatus: 'FAILED',
          errorMessage: 'Processing timed out. Please re-upload the file.',
          lastErrorAt: admin.firestore.FieldValue.serverTimestamp()
        });

        cleaned++;
      }
    });

    if (cleaned > 0) {
      await batch.commit();
      console.log(`\n✓ Cleaned up ${cleaned} stuck sections`);
    } else {
      console.log('\nNo sections old enough to clean up.');
    }

    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

cleanupStuckSections();
