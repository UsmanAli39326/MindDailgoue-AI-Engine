// ─────────────────────────────────────────────────────────────
// seedDoctors.js
// Seeding script to populate the 'clinical_doctors' Firestore collection
// with specialist records for live verification and frontend testing.
// ─────────────────────────────────────────────────────────────

import { db } from './src/config/firebase.js';

const mockDoctors = [
  {
    name: 'Dr. Sarah Jenkins, Psy.D.',
    role: 'Crisis Intervention Specialist',
    phone: '+1-800-555-0144',
    clinicUrl: 'https://minddialogue-clinical.com/sarah-jenkins',
    specialties: ['suicide']
  },
  {
    name: 'Dr. Marcus Vance, Ph.D.',
    role: 'Clinical Psychologist (Somatic/CBT)',
    phone: '+1-800-555-0188',
    clinicUrl: 'https://minddialogue-clinical.com/marcus-vance',
    specialties: ['self_harm']
  },
  {
    name: 'Dr. Emily Ross, LCSW',
    role: 'Licensed Family & Abuse Counselor',
    phone: '+1-800-555-0211',
    clinicUrl: 'https://minddialogue-clinical.com/emily-ross',
    specialties: ['abuse']
  },
  {
    name: 'Dr. Arthur Pendelton, MD',
    role: 'Psychiatrist & Violence De-escalation Director',
    phone: '+1-800-555-0299',
    clinicUrl: 'https://minddialogue-clinical.com/arthur-pendelton',
    specialties: ['violence']
  }
];

async function seed() {
  if (!db) {
    console.error('❌ Firestore DB is not initialized. Please ensure your .env has correct credentials.');
    process.exit(1);
  }

  console.log('🌱 Starting Firestore Specialized Clinical Doctors Seeding...');

  try {
    const collectionRef = db.collection('clinical_doctors');
    
    // Check if doctors are already seeded
    const snapshot = await collectionRef.limit(1).get();
    if (!snapshot.empty) {
      console.log('ℹ️ Clinical doctors already seeded in Firestore. Skipping duplicate seeding.');
      process.exit(0);
    }

    // Seed the mock doctors
    for (const doc of mockDoctors) {
      const docRef = await collectionRef.add(doc);
      console.log(`✅ Seeded specialized clinical doctor: ${doc.name} (Doc ID: ${docRef.id})`);
    }

    console.log('🎉 Seeding successfully completed!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Seeding failed with error:', error.message);
    process.exit(1);
  }
}

seed();
