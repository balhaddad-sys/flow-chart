/**
 * Admin script to migrate legacy section documents to new schema
 * Run with: node functions/admin/migrateSections.js
 */

const admin = require('firebase-admin');

admin.initializeApp();
const db = admin.firestore();

async function migrateSections() {
  try {
    console.log('Searching for sections to migrate...');

    const sectionsSnapshot = await db
      .collectionGroup('sections')
      .get();

    console.log(`Found ${sectionsSnapshot.size} sections total`);

    let migrated = 0;
    const batch = db.batch();

    sectionsSnapshot.forEach(doc => {
      const data = doc.data();

      // Only migrate if missing new fields
      if (!('questionsStatus' in data)) {
        const updates = {
          questionsStatus: 'PENDING',
          questionsCount: 0,
        };

        // If section is analyzed, check if questions might exist
        if (data.aiStatus === 'ANALYZED') {
          updates.questionsStatus = 'PENDING'; // Will be updated when questions are generated
        }

        console.log(`Migrating: ${doc.ref.path}`);
        batch.update(doc.ref, updates);
        migrated++;
      }
    });

    if (migrated > 0) {
      await batch.commit();
      console.log(`\n✓ Migrated ${migrated} sections to new schema`);
    } else {
      console.log('\nNo sections need migration.');
    }

    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

migrateSections();
