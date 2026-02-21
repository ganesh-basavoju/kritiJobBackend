/**
 * Migration Script for Premium Subscription System
 * 
 * Run this script once to add default values to existing records
 * Usage: node src/migrations/add-subscription-fields.js
 */

const mongoose = require('mongoose');
require('dotenv').config();

const CandidateProfile = require('../models/CandidateProfile');
const Application = require('../models/Application');

async function migrate() {
  try {
    // Connect to database
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✓ Connected to MongoDB');

    // 1. Update CandidateProfiles
    console.log('\n📝 Updating CandidateProfiles...');
    const candidateResult = await CandidateProfile.updateMany(
      { isPremium: { $exists: false } },
      { 
        $set: { 
          isPremium: false,
          subscriptionExpiresAt: null,
          monthlyApplications: []
        } 
      }
    );
    console.log(`✓ Updated ${candidateResult.modifiedCount} candidate profiles`);

    // 2. Update Applications
    console.log('\n📝 Updating Applications...');
    const applicationResult = await Application.updateMany(
      { isPremiumApplication: { $exists: false } },
      { 
        $set: { 
          isPremiumApplication: false
        } 
      }
    );
    console.log(`✓ Updated ${applicationResult.modifiedCount} applications`);

    // 3. Create indexes if they don't exist
    console.log('\n📝 Creating indexes...');
    await CandidateProfile.collection.createIndex({ isPremium: 1 });
    await Application.collection.createIndex({ isPremiumApplication: -1 });
    console.log('✓ Indexes created');

    console.log('\n✅ Migration completed successfully!\n');
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await mongoose.connection.close();
    console.log('Database connection closed');
    process.exit(0);
  }
}

// Run migration
migrate();
