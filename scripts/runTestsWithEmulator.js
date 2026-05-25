// ─────────────────────────────────────────────────────────────
// runTestsWithEmulator.js
// Cross-platform test runner that configures environment variables
// to execute test suites against the Firebase Local Emulators.
// ─────────────────────────────────────────────────────────────

import { spawn } from 'child_process';
import path from 'path';

// Set emulator host targets before initializing Admin SDK
process.env.FIRESTORE_EMULATOR_HOST = 'localhost:8080';
process.env.FIREBASE_AUTH_EMULATOR_HOST = 'localhost:9099';

console.log('🚀 Starting MindDialogue Jest test suite against Local Emulators...');
console.log(`📍 FIRESTORE_EMULATOR_HOST: ${process.env.FIRESTORE_EMULATOR_HOST}`);
console.log(`📍 FIREBASE_AUTH_EMULATOR_HOST: ${process.env.FIREBASE_AUTH_EMULATOR_HOST}`);

// Resolve local jest executable
const jestPath = path.resolve('node_modules/jest/bin/jest.js');
const args = ['--experimental-vm-modules', jestPath, ...process.argv.slice(2)];

// Spawn Jest process inheriting standard input/output channels
const jestProcess = spawn('node', args, {
  stdio: 'inherit',
  shell: true,
});

jestProcess.on('exit', (code) => {
  process.exit(code || 0);
});