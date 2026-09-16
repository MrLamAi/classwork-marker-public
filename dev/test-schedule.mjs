import assert from 'node:assert/strict';
import '../public/schedule-data.js';
const ScheduleEngine = globalThis.ScheduleEngine;

console.log('=== 1. Testing Calendar & Cycle Days ===');
assert.equal(ScheduleEngine.CYCLE_DAYS.length, 150, 'Must have 150 cycle days');

const day1 = ScheduleEngine.getCycleDayInfo('2026-09-02');
assert.equal(day1.cycleDay, 'A');
assert.equal(day1.cycle, 1);
assert.equal(day1.tt, 'ST1');
assert.equal(day1.isSchoolCycleDay, true);

const holiday = ScheduleEngine.getCycleDayInfo('2026-10-01');
assert.equal(holiday.isSchoolCycleDay, false);
assert.equal(holiday.event, 'National Day');

console.log('=== 2. Testing Timings & Current Period ===');
// Normal timetable P2 is 09:00 - 09:40
const pNormal = ScheduleEngine.getCurrentPeriod('09:15', 'Normal');
assert.equal(pNormal.period, 2);
assert.equal(pNormal.isCurrent, true);

// ST1 timetable P2 is 08:35 - 09:05
const pST1 = ScheduleEngine.getCurrentPeriod('08:45', 'ST1');
assert.equal(pST1.period, 2);
assert.equal(pST1.isCurrent, true);

// ST1 timetable P3 starts at 09:05, at 09:00 it is upcoming (5 mins away)
const pUpcoming = ScheduleEngine.getCurrentPeriod('09:00', 'ST1');
assert.equal(pUpcoming.period, 2); // 09:00 is within P2 (08:35-09:05)

console.log('=== 3. Testing Class Normalization & Matching ===');
assert.equal(ScheduleEngine.matchClass('2D', 'CpLit 2D'), true);
assert.equal(ScheduleEngine.matchClass('2D', 'LifeEd 2D'), true);
assert.equal(ScheduleEngine.matchClass('1D', 'CpLit 1D'), true);
assert.equal(ScheduleEngine.matchClass('4C', 'CS 4C'), true);
assert.equal(ScheduleEngine.matchClass('4C', 'CS F4(CLP)'), true);
assert.equal(ScheduleEngine.matchClass('2D', '1D'), false);

console.log('=== 4. Testing Day Lessons & Off-Schedule Detection ===');
// 2026-09-02 is Day A (ST1)
const dayALessons = ScheduleEngine.getScheduledLessonsForDate('2026-09-02');
assert.equal(dayALessons.length, 2); // P2, P3 2D
assert.equal(dayALessons[0].class, '2D');
assert.equal(dayALessons[0].start, '08:35');

// Check 2D on Day A
const lessons2DonDayA = ScheduleEngine.getScheduledLessonsForClassAndDate('2D', '2026-09-02');
assert.equal(lessons2DonDayA.length, 2);

// Check 2D on Day B (2026-09-03) -> Should be 0 (off-schedule!)
const lessons2DonDayB = ScheduleEngine.getScheduledLessonsForClassAndDate('2D', '2026-09-03');
assert.equal(lessons2DonDayB.length, 0);

console.log('=== 5. Testing Previous & Next Scheduled Lesson Dates ===');
// From 2026-09-15 (Day D):
// 2D's previous lesson was 2026-09-10 (Day A)
const prev2D = ScheduleEngine.findPreviousScheduledLessonDate('2D', '2026-09-15');
assert.equal(prev2D.date, '2026-09-10');
assert.equal(prev2D.cycleDay, 'A');
assert.deepEqual(prev2D.periods, [2, 3]);

// 2D's next lesson is 2026-09-17 (Day F)
const next2D = ScheduleEngine.findNextScheduledLessonDate('2D', '2026-09-15');
assert.equal(next2D.date, '2026-09-17');
assert.equal(next2D.cycleDay, 'F');
assert.deepEqual(next2D.periods, [7, 8]);

// From 2026-09-03 (Day B), 1D is today! What was 1D's previous lesson before 2026-09-03? None (it was cycle 1 Day B)
const prev1D = ScheduleEngine.findPreviousScheduledLessonDate('1D', '2026-09-03');
assert.equal(prev1D, null);

// Next lesson for 1D after 2026-09-03 is Cycle 2 Day B (2026-09-11)
const next1D = ScheduleEngine.findNextScheduledLessonDate('1D', '2026-09-03');
assert.equal(next1D.date, '2026-09-11');
assert.equal(next1D.cycleDay, 'B');

console.log('=== 6. Testing Class Suggestions ===');
// On 2026-09-03 (Day B, ST1):
// At 08:15 (during P1 08:05-08:35, 4C):
const suggP1 = ScheduleEngine.getSuggestedClass('2026-09-03', '08:15');
assert.equal(suggP1.status, 'active_lesson');
assert.equal(suggP1.suggestedClass, '4C');

// At 08:50 (during P2 08:35-09:05, 1D):
const suggP2 = ScheduleEngine.getSuggestedClass('2026-09-03', '08:50');
assert.equal(suggP2.status, 'active_lesson');
assert.equal(suggP2.suggestedClass, '1D');

// Clean up scratch json
import fs from 'node:fs';
try { fs.unlinkSync('scratch_cycle_days.json'); } catch(e) {}

console.log('\nAll ScheduleEngine unit tests PASSED successfully!');
