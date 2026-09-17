import assert from 'node:assert/strict';
import fs from 'node:fs';

console.log('=== 1. Checking public/app.js Definitions ===');
const appJs = fs.readFileSync('public/app.js', 'utf8');

// Verify STAMPS includes device and washroom
assert(appJs.includes("device:    { label: '展示電子器材', icon: '📱'"), 'STAMPS should include device');
assert(appJs.includes("washroom:  { label: '上洗手間', icon: '🚻'"), 'STAMPS should include washroom');

// Verify DISCIPLINE_TYPE_LABELS
assert(appJs.includes("device: '展示電子器材'"), 'DISCIPLINE_TYPE_LABELS should include device');
assert(appJs.includes("washroom: '上洗手間'"), 'DISCIPLINE_TYPE_LABELS should include washroom');

// Verify activeWashrooms tracking functions exist
assert(appJs.includes('function toggleWashroomForStudent('), 'toggleWashroomForStudent must be defined');
assert(appJs.includes('function syncActiveWashrooms('), 'syncActiveWashrooms must be defined');
assert(appJs.includes('function loadActiveWashrooms('), 'loadActiveWashrooms must be defined');
assert(appJs.includes('function saveActiveWashrooms('), 'saveActiveWashrooms must be defined');

console.log('=== 2. Checking public/styles.css Animations & Indicators ===');
const stylesCss = fs.readFileSync('public/styles.css', 'utf8');
assert(stylesCss.includes('@keyframes washroom-pulse'), 'Must define washroom-pulse keyframes');
assert(stylesCss.includes('.tile.in-washroom'), 'Must define .tile.in-washroom');
assert(stylesCss.includes('animation: washroom-pulse 2s infinite ease-in-out'), 'Must use 2s infinite ease-in-out pulse');
assert(stylesCss.includes('.tile-washroom-indicator'), 'Must define .tile-washroom-indicator');
assert(stylesCss.includes('.badge-device'), 'Must define badge-device');
assert(stylesCss.includes('.badge-washroom'), 'Must define badge-washroom');

console.log('=== 3. Checking public/index.html UI Elements ===');
const indexHtml = fs.readFileSync('public/index.html', 'utf8');
assert(indexHtml.includes('id="shWashroomBtn"'), 'Must have shWashroomBtn');
assert(indexHtml.includes('data-sh-stamp="device"'), 'Must have device stamp button');
assert(indexHtml.includes('data-sh-stamp="washroom"'), 'Must have washroom stamp button');

console.log('=== 4. Checking Database & Action Backend Handling ===');
import { register } from 'node:module';
register(new URL('./pg-hook.mjs', import.meta.url));
const mem = await import('./memory-pg.mjs');
mem.seed();
process.env.DATABASE_URL = 'memory://dev';

const { getClassDisciplineSummary, updateDisciplineRecord, recordDiscipline } = await import('../lib/db.js');

const studentNum = 42;
const todayStr = '2026-09-17';
const testClass = 'TEST_CLS';

// Log a device infraction
const recDevice = await recordDiscipline(testClass, studentNum, todayStr, '10:00', 'device', '展示電子器材', '課堂使用手機');
assert(recDevice && recDevice.id, 'Should log device record');

// Log a washroom entry
const recWashroom = await recordDiscipline(testClass, studentNum, todayStr, '10:05', 'washroom', '上洗手間', '10:05 離席 (離席中...)');
assert(recWashroom && recWashroom.id, 'Should log washroom record');

// Update washroom entry with return time
const updatedNote = '10:00 離席 - 10:07 回課室 (共 7 分鐘)';
const updated = await updateDisciplineRecord(recWashroom.id, updatedNote);
assert.equal(updated.note, updatedNote, 'Note should be updated');

// Test summary
const summary = await getClassDisciplineSummary(testClass, todayStr);
assert(summary.studentStats[studentNum], 'Student 42 summary should exist');
assert.equal(summary.studentStats[studentNum].totals.device, 1, 'Device count should be 1');
assert.equal(summary.studentStats[studentNum].totals.washroom, 1, 'Washroom count should be 1');
// Notice: washroom should NOT count towards total_infractions
assert.equal(summary.studentStats[studentNum].totals.total_infractions, 1, 'Only device should count towards total infractions');

console.log('\nAll Device & Washroom tracker tests PASSED successfully!');
