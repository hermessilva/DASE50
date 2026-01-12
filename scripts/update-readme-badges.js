#!/usr/bin/env node

/**
 * Update README.md badge URLs with actual Gist ID
 * Usage: node scripts/update-readme-badges.js <gist-id>
 */

const fs = require('fs');
const path = require('path');

const gistId = process.argv[2];

if (!gistId) {
    console.error('Error: Gist ID is required');
    console.error('Usage: node scripts/update-readme-badges.js <gist-id>');
    process.exit(1);
}

const readmePath = path.join(__dirname, '..', 'README.md');
let readme = fs.readFileSync(readmePath, 'utf8');

// Replace all occurrences of BADGE_GIST_ID with actual gist ID
const updated = readme.replace(/BADGE_GIST_ID/g, gistId);

if (updated === readme) {
    console.log('No changes needed - README already has real Gist ID or BADGE_GIST_ID not found');
} else {
    fs.writeFileSync(readmePath, updated, 'utf8');
    console.log(`✓ Updated README.md with Gist ID: ${gistId}`);
}
