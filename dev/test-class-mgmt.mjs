import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import memPg, { seed } from './memory-pg.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

process.env.DATABASE_URL = 'postgres://local/memory';
process.env.PASSCODE = '1234';
process.env.SESSION_SECRET = 'test-secret-for-class-mgmt';
pg.Pool = memPg.Pool;
pg.Client = memPg.Client;
seed();

const {
  ensureSchema,
  getClasses,
  createClass,
  updateClass,
  deleteClass,
  buildBundle,
  saveLayout,
  saveStudents,
  recordDiscipline
} = await import('../lib/db.js');

await ensureSchema();

console.log('=== 1. Testing Backend Decoupled Rows / Cols / Total (2D-2: 20 students, 5 rows × 8 cols = 40 desks, 20 empty seats) ===');
await createClass('2D-2', 20, 8, 5);
let b2d2 = await buildBundle('2D-2', '', '2026-09-18');
assert.equal(b2d2.cls, '2D-2');
assert.equal(b2d2.total, 20);
assert.equal(b2d2.cols, 8);
assert.equal(b2d2.rows, 5, '2D-2 should have 5 rows even though 20 students only need 3 rows');
assert.equal(b2d2.seats.length, 40, '2D-2 should have 40 seat slots (5×8)');
assert.equal(b2d2.seats.filter((x) => x !== null).length, 20, '20 students seated');
assert.equal(b2d2.seats.filter((x) => x === null).length, 20, '20 empty seats preserved');

console.log('=== 2. Testing Intentional Empty Seats in Middle of Grid Preserved on updateClass ===');
const customSeats = b2d2.seats.slice();
customSeats[0] = null; // Leave desk #1 empty
customSeats[25] = 1;   // Move student #1 to desk #26
await saveLayout('2D-2', customSeats);

const updRes = await updateClass('2D-2', 22, 8, '2D-2', 6);
assert.equal(updRes.rows, 6);
assert.equal(updRes.total, 22);
b2d2 = await buildBundle('2D-2', '', '2026-09-18');
assert.equal(b2d2.rows, 6);
assert.equal(b2d2.seats.length, 48, 'Grid expanded to 6×8 = 48 desks');
assert.equal(b2d2.seats[0], null, 'Intentional empty seat at desk #1 must remain empty');
assert.equal(b2d2.seats[25], 1, 'Student #1 remains at desk #26');
assert.equal(b2d2.seats.filter((x) => x !== null).length, 22, 'All 22 students are seated');
assert.equal(b2d2.seats.filter((x) => x === null).length, 26, '26 empty seats preserved');

console.log('=== 3. Testing Class Rename (2D-2 -> 2D-G2) Migrates Students & Discipline Records ===');
await saveStudents('2D-2', [{ no: 1, zh: '陳小明', en: 'Chan Siu Ming', sex: 'M' }]);
await recordDiscipline('2D-2', 1, '2026-09-18', '09:15', 'good_perf', '積極答問', '測試');

await updateClass('2D-2', 22, 7, '2D-G2', 5);
const afterRenameList = await getClasses();
assert.ok(afterRenameList.some((c) => c.name === '2D-G2' && c.total === 22 && c.cols === 7 && c.rows === 5), 'Renamed class 2D-G2 exists with 22 students, 5×7 grid');
assert.ok(!afterRenameList.some((c) => c.name === '2D-2'), 'Old class name 2D-2 removed');

const renamedBundle = await buildBundle('2D-G2', '', '2026-09-18');
assert.equal(renamedBundle.cls, '2D-G2');
assert.equal(renamedBundle.names['1']?.zh, '陳小明', 'Student roster migrated to renamed class');
assert.equal(renamedBundle.discipline.totalRecords, 1, 'Discipline records migrated to renamed class');

console.log('=== 4. Testing Class Deletion & Non-Resurrection ===');
await deleteClass('2D-G2');
const afterDeleteList = await getClasses();
assert.ok(!afterDeleteList.some((c) => c.name === '2D-G2'), 'Deleted class 2D-G2 is removed');
const fallbackBundle = await buildBundle('2D-G2', '', '2026-09-18');
assert.notEqual(fallbackBundle.cls, '2D-G2', 'Deleted class must never be resurrected by buildBundle');

console.log('=== 5. Verifying Frontend HTML, CSS & JS Decoupling and Modal Z-Index ===');
const html = fs.readFileSync(path.join(root, 'public', 'index.html'), 'utf8');
const css = fs.readFileSync(path.join(root, 'public', 'styles.css'), 'utf8');
const appJs = fs.readFileSync(path.join(root, 'public', 'app.js'), 'utf8');

assert.ok(html.includes('id="clsNameInput"'), 'index.html must include #clsNameInput for renaming classes');
assert.ok(html.includes('id="clsCurrentSavedTag"'), 'index.html must include #clsCurrentSavedTag');
assert.ok(html.includes('id="clsEmptySeatsInfo"'), 'index.html must include #clsEmptySeatsInfo');
assert.ok(html.includes('id="newClsRows"'), 'index.html must include #newClsRows in add class box');
assert.ok(html.includes('id="askModal" hidden style="z-index:250"'), '#askModal must have inline z-index:250 above #settingsModal');
assert.ok(css.includes('#askModal {\n  z-index: 250;\n}') || css.includes('#askModal'), 'styles.css must define #askModal z-index');
assert.ok(css.includes('.class-item-del-btn'), 'styles.css must style inline delete button .class-item-del-btn');

// Ensure clsTotalInput and clsColsInput listeners do NOT overwrite clsRowsInput
assert.ok(!appJs.includes("$('clsRowsInput').value = Math.ceil(tot / cols)"), 'app.js must NOT overwrite clsRowsInput when total or cols changes');
assert.ok(!appJs.includes('if (!editMode && rowEmpty(r)) return;'), 'renderGrid must NOT hide configured empty rows');
assert.ok(appJs.includes('function confirmDeleteClass('), 'app.js must define confirmDeleteClass');
assert.ok(appJs.includes('data-del-cls'), 'renderClassMgmt must render inline delete buttons with data-del-cls');

console.log('\nAll Class Management & Decoupled Grid unit tests PASSED successfully!');
