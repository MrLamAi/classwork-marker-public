/**
 * Schedule Engine & School Calendar Database for Classwork Marker (2026-2027)
 * 
 * Includes:
 * - Full 150 Cycle Days across 25 cycles with timetable flags (Normal, ST1, ST2)
 * - Non-cycle school events & holidays
 * - Exact period timings for Normal (40m), ST1 (30m), and ST2 (35m)
 * - Master 6-day timetable mapping for all teaching classes
 * - Real-time period detection, class suggestion, off-schedule alerts, and previous lesson lookup
 */
(function (root, factory) {
  var engine = factory();
  if (typeof exports === 'object' && typeof module !== 'undefined') {
    module.exports = engine;
  }
  if (typeof root !== 'undefined') {
    root.ScheduleEngine = engine;
  }
})(typeof globalThis !== 'undefined' ? globalThis : (typeof window !== 'undefined' ? window : (typeof self !== 'undefined' ? self : this)), function () {
  'use strict';

  // Master Default 150 Cycle Days
  var DEFAULT_CYCLE_DAYS = [
  {
    "date": "2026-09-02",
    "dayName": "Wed",
    "cycle": 1,
    "cycleDay": "A",
    "tt": "ST1",
    "event": ""
  },
  {
    "date": "2026-09-03",
    "dayName": "Thu",
    "cycle": 1,
    "cycleDay": "B",
    "tt": "ST1",
    "event": "Photo-taking Day (Student Card)"
  },
  {
    "date": "2026-09-04",
    "dayName": "Fri",
    "cycle": 1,
    "cycleDay": "C",
    "tt": "ST1",
    "event": ""
  },
  {
    "date": "2026-09-07",
    "dayName": "Mon",
    "cycle": 2,
    "cycleDay": "D",
    "tt": "ST1",
    "event": ""
  },
  {
    "date": "2026-09-08",
    "dayName": "Tue",
    "cycle": 2,
    "cycleDay": "E",
    "tt": "ST1",
    "event": ""
  },
  {
    "date": "2026-09-09",
    "dayName": "Wed",
    "cycle": 2,
    "cycleDay": "F",
    "tt": "ST1",
    "event": ""
  },
  {
    "date": "2026-09-10",
    "dayName": "Thu",
    "cycle": 2,
    "cycleDay": "A",
    "tt": "Normal",
    "event": ""
  },
  {
    "date": "2026-09-11",
    "dayName": "Fri",
    "cycle": 2,
    "cycleDay": "B",
    "tt": "Normal",
    "event": ""
  },
  {
    "date": "2026-09-14",
    "dayName": "Mon",
    "cycle": 3,
    "cycleDay": "C",
    "tt": "Normal",
    "event": ""
  },
  {
    "date": "2026-09-15",
    "dayName": "Tue",
    "cycle": 3,
    "cycleDay": "D",
    "tt": "Normal",
    "event": ""
  },
  {
    "date": "2026-09-16",
    "dayName": "Wed",
    "cycle": 3,
    "cycleDay": "E",
    "tt": "Normal",
    "event": ""
  },
  {
    "date": "2026-09-17",
    "dayName": "Thu",
    "cycle": 3,
    "cycleDay": "F",
    "tt": "Normal",
    "event": ""
  },
  {
    "date": "2026-09-18",
    "dayName": "Fri",
    "cycle": 3,
    "cycleDay": "A",
    "tt": "Normal",
    "event": "SU Election"
  },
  {
    "date": "2026-09-21",
    "dayName": "Mon",
    "cycle": 3,
    "cycleDay": "B",
    "tt": "Normal",
    "event": ""
  },
  {
    "date": "2026-09-22",
    "dayName": "Tue",
    "cycle": 3,
    "cycleDay": "C",
    "tt": "Normal",
    "event": ""
  },
  {
    "date": "2026-09-23",
    "dayName": "Wed",
    "cycle": 3,
    "cycleDay": "D",
    "tt": "Normal",
    "event": ""
  },
  {
    "date": "2026-09-24",
    "dayName": "Thu",
    "cycle": 3,
    "cycleDay": "E",
    "tt": "Normal",
    "event": ""
  },
  {
    "date": "2026-09-25",
    "dayName": "Fri",
    "cycle": 3,
    "cycleDay": "F",
    "tt": "Normal",
    "event": ""
  },
  {
    "date": "2026-09-28",
    "dayName": "Mon",
    "cycle": 4,
    "cycleDay": "A",
    "tt": "ST2",
    "event": "AGM of SU"
  },
  {
    "date": "2026-09-29",
    "dayName": "Tue",
    "cycle": 4,
    "cycleDay": "B",
    "tt": "Normal",
    "event": ""
  },
  {
    "date": "2026-09-30",
    "dayName": "Wed",
    "cycle": 4,
    "cycleDay": "C",
    "tt": "Normal",
    "event": ""
  },
  {
    "date": "2026-10-02",
    "dayName": "Fri",
    "cycle": 4,
    "cycleDay": "D",
    "tt": "Normal",
    "event": "F.6 Information Day 1"
  },
  {
    "date": "2026-10-05",
    "dayName": "Mon",
    "cycle": 5,
    "cycleDay": "E",
    "tt": "Normal",
    "event": ""
  },
  {
    "date": "2026-10-06",
    "dayName": "Tue",
    "cycle": 5,
    "cycleDay": "F",
    "tt": "Normal",
    "event": ""
  },
  {
    "date": "2026-10-07",
    "dayName": "Wed",
    "cycle": 5,
    "cycleDay": "A",
    "tt": "Normal",
    "event": ""
  },
  {
    "date": "2026-10-08",
    "dayName": "Thu",
    "cycle": 5,
    "cycleDay": "B",
    "tt": "Normal",
    "event": ""
  },
  {
    "date": "2026-10-09",
    "dayName": "Fri",
    "cycle": 5,
    "cycleDay": "C",
    "tt": "Normal",
    "event": ""
  },
  {
    "date": "2026-10-12",
    "dayName": "Mon",
    "cycle": 6,
    "cycleDay": "D",
    "tt": "Normal",
    "event": ""
  },
  {
    "date": "2026-10-13",
    "dayName": "Tue",
    "cycle": 6,
    "cycleDay": "E",
    "tt": "Normal",
    "event": ""
  },
  {
    "date": "2026-10-14",
    "dayName": "Wed",
    "cycle": 6,
    "cycleDay": "F",
    "tt": "Normal",
    "event": ""
  },
  {
    "date": "2026-10-15",
    "dayName": "Thu",
    "cycle": 6,
    "cycleDay": "A",
    "tt": "Normal",
    "event": ""
  },
  {
    "date": "2026-10-16",
    "dayName": "Fri",
    "cycle": 6,
    "cycleDay": "B",
    "tt": "Normal",
    "event": "Sports Friday"
  },
  {
    "date": "2026-10-20",
    "dayName": "Tue",
    "cycle": 6,
    "cycleDay": "C",
    "tt": "Normal",
    "event": ""
  },
  {
    "date": "2026-10-21",
    "dayName": "Wed",
    "cycle": 6,
    "cycleDay": "D",
    "tt": "Normal",
    "event": ""
  },
  {
    "date": "2026-10-22",
    "dayName": "Thu",
    "cycle": 6,
    "cycleDay": "E",
    "tt": "Normal",
    "event": ""
  },
  {
    "date": "2026-10-23",
    "dayName": "Fri",
    "cycle": 6,
    "cycleDay": "F",
    "tt": "Normal",
    "event": ""
  },
  {
    "date": "2026-10-26",
    "dayName": "Mon",
    "cycle": 7,
    "cycleDay": "A",
    "tt": "Normal",
    "event": ""
  },
  {
    "date": "2026-10-27",
    "dayName": "Tue",
    "cycle": 7,
    "cycleDay": "B",
    "tt": "Normal",
    "event": ""
  },
  {
    "date": "2026-10-28",
    "dayName": "Wed",
    "cycle": 7,
    "cycleDay": "C",
    "tt": "Normal",
    "event": ""
  },
  {
    "date": "2026-11-09",
    "dayName": "Mon",
    "cycle": 8,
    "cycleDay": "D",
    "tt": "Normal",
    "event": ""
  },
  {
    "date": "2026-11-10",
    "dayName": "Tue",
    "cycle": 8,
    "cycleDay": "E",
    "tt": "Normal",
    "event": ""
  },
  {
    "date": "2026-11-11",
    "dayName": "Wed",
    "cycle": 8,
    "cycleDay": "F",
    "tt": "Normal",
    "event": ""
  },
  {
    "date": "2026-11-12",
    "dayName": "Thu",
    "cycle": 8,
    "cycleDay": "A",
    "tt": "Normal",
    "event": ""
  },
  {
    "date": "2026-11-13",
    "dayName": "Fri",
    "cycle": 8,
    "cycleDay": "B",
    "tt": "Normal",
    "event": ""
  },
  {
    "date": "2026-11-16",
    "dayName": "Mon",
    "cycle": 9,
    "cycleDay": "C",
    "tt": "Normal",
    "event": ""
  },
  {
    "date": "2026-11-17",
    "dayName": "Tue",
    "cycle": 9,
    "cycleDay": "D",
    "tt": "Normal",
    "event": ""
  },
  {
    "date": "2026-11-18",
    "dayName": "Wed",
    "cycle": 9,
    "cycleDay": "E",
    "tt": "Normal",
    "event": ""
  },
  {
    "date": "2026-11-19",
    "dayName": "Thu",
    "cycle": 9,
    "cycleDay": "F",
    "tt": "Normal",
    "event": ""
  },
  {
    "date": "2026-11-20",
    "dayName": "Fri",
    "cycle": 9,
    "cycleDay": "A",
    "tt": "ST2",
    "event": "School Photo-taking (Classes and Units)"
  },
  {
    "date": "2026-11-23",
    "dayName": "Mon",
    "cycle": 9,
    "cycleDay": "B",
    "tt": "Normal",
    "event": ""
  },
  {
    "date": "2026-11-26",
    "dayName": "Thu",
    "cycle": 9,
    "cycleDay": "C",
    "tt": "Normal",
    "event": ""
  },
  {
    "date": "2026-11-27",
    "dayName": "Fri",
    "cycle": 9,
    "cycleDay": "D",
    "tt": "Normal",
    "event": ""
  },
  {
    "date": "2026-11-30",
    "dayName": "Mon",
    "cycle": 9,
    "cycleDay": "E",
    "tt": "Normal",
    "event": "STEAM Week"
  },
  {
    "date": "2026-12-01",
    "dayName": "Tue",
    "cycle": 10,
    "cycleDay": "F",
    "tt": "Normal",
    "event": "STEAM Week"
  },
  {
    "date": "2026-12-02",
    "dayName": "Wed",
    "cycle": 10,
    "cycleDay": "A",
    "tt": "Normal",
    "event": "STEAM Week"
  },
  {
    "date": "2026-12-03",
    "dayName": "Thu",
    "cycle": 10,
    "cycleDay": "B",
    "tt": "Normal",
    "event": "STEAM Week"
  },
  {
    "date": "2026-12-07",
    "dayName": "Mon",
    "cycle": 11,
    "cycleDay": "C",
    "tt": "Normal",
    "event": ""
  },
  {
    "date": "2026-12-08",
    "dayName": "Tue",
    "cycle": 11,
    "cycleDay": "D",
    "tt": "Normal",
    "event": ""
  },
  {
    "date": "2026-12-09",
    "dayName": "Wed",
    "cycle": 11,
    "cycleDay": "E",
    "tt": "Normal",
    "event": ""
  },
  {
    "date": "2026-12-10",
    "dayName": "Thu",
    "cycle": 11,
    "cycleDay": "F",
    "tt": "Normal",
    "event": ""
  },
  {
    "date": "2026-12-11",
    "dayName": "Fri",
    "cycle": 11,
    "cycleDay": "A",
    "tt": "Normal",
    "event": "Sports Friday"
  },
  {
    "date": "2026-12-14",
    "dayName": "Mon",
    "cycle": 11,
    "cycleDay": "B",
    "tt": "Normal",
    "event": ""
  },
  {
    "date": "2026-12-15",
    "dayName": "Tue",
    "cycle": 11,
    "cycleDay": "C",
    "tt": "Normal",
    "event": ""
  },
  {
    "date": "2026-12-16",
    "dayName": "Wed",
    "cycle": 11,
    "cycleDay": "D",
    "tt": "Normal",
    "event": ""
  },
  {
    "date": "2026-12-17",
    "dayName": "Thu",
    "cycle": 11,
    "cycleDay": "E",
    "tt": "Normal",
    "event": ""
  },
  {
    "date": "2027-01-04",
    "dayName": "Mon",
    "cycle": 12,
    "cycleDay": "F",
    "tt": "Normal",
    "event": "F.1-F.5 First Term Examination"
  },
  {
    "date": "2027-01-05",
    "dayName": "Tue",
    "cycle": 12,
    "cycleDay": "A",
    "tt": "Normal",
    "event": "F.1-F.5 First Term Examination"
  },
  {
    "date": "2027-01-06",
    "dayName": "Wed",
    "cycle": 12,
    "cycleDay": "B",
    "tt": "Normal",
    "event": "F.1-F.5 First Term Examination"
  },
  {
    "date": "2027-01-07",
    "dayName": "Thu",
    "cycle": 12,
    "cycleDay": "C",
    "tt": "Normal",
    "event": "F.1-F.5 First Term Examination"
  },
  {
    "date": "2027-01-08",
    "dayName": "Fri",
    "cycle": 12,
    "cycleDay": "D",
    "tt": "Normal",
    "event": "F.1-F.5 First Term Examination"
  },
  {
    "date": "2027-01-11",
    "dayName": "Mon",
    "cycle": 13,
    "cycleDay": "E",
    "tt": "Normal",
    "event": "F.1-F.5 First Term Examination"
  },
  {
    "date": "2027-01-12",
    "dayName": "Tue",
    "cycle": 13,
    "cycleDay": "F",
    "tt": "Normal",
    "event": "F.1-F.5 First Term Examination"
  },
  {
    "date": "2027-01-13",
    "dayName": "Wed",
    "cycle": 13,
    "cycleDay": "A",
    "tt": "Normal",
    "event": "F.1-F.5 First Term Examination"
  },
  {
    "date": "2027-01-14",
    "dayName": "Thu",
    "cycle": 13,
    "cycleDay": "B",
    "tt": "Normal",
    "event": "F.1-F.5 First Term Examination"
  },
  {
    "date": "2027-01-15",
    "dayName": "Fri",
    "cycle": 13,
    "cycleDay": "C",
    "tt": "Normal",
    "event": "F.1-F.5 First Term Examination; Last School Day of F.6 (Farewell Assembly)"
  },
  {
    "date": "2027-01-18",
    "dayName": "Mon",
    "cycle": 14,
    "cycleDay": "D",
    "tt": "Normal",
    "event": "F.1-F.5 First Term Examination; Revision Holidays for F.6"
  },
  {
    "date": "2027-01-19",
    "dayName": "Tue",
    "cycle": 14,
    "cycleDay": "E",
    "tt": "Normal",
    "event": "Revision Holidays for F.6; Second Term Begins"
  },
  {
    "date": "2027-01-20",
    "dayName": "Wed",
    "cycle": 14,
    "cycleDay": "F",
    "tt": "Normal",
    "event": "F.6 Mock Examination"
  },
  {
    "date": "2027-01-21",
    "dayName": "Thu",
    "cycle": 14,
    "cycleDay": "A",
    "tt": "Normal",
    "event": "F.6 Mock Examination"
  },
  {
    "date": "2027-01-22",
    "dayName": "Fri",
    "cycle": 14,
    "cycleDay": "B",
    "tt": "Normal",
    "event": "F.6 Mock Examination"
  },
  {
    "date": "2027-01-25",
    "dayName": "Mon",
    "cycle": 15,
    "cycleDay": "C",
    "tt": "Normal",
    "event": "F.6 Mock Examination"
  },
  {
    "date": "2027-01-26",
    "dayName": "Tue",
    "cycle": 15,
    "cycleDay": "D",
    "tt": "Normal",
    "event": "F.6 Mock Examination"
  },
  {
    "date": "2027-01-27",
    "dayName": "Wed",
    "cycle": 15,
    "cycleDay": "E",
    "tt": "Normal",
    "event": "F.6 Mock Examination"
  },
  {
    "date": "2027-01-28",
    "dayName": "Thu",
    "cycle": 15,
    "cycleDay": "F",
    "tt": "Normal",
    "event": "F.6 Mock Examination"
  },
  {
    "date": "2027-01-29",
    "dayName": "Fri",
    "cycle": 15,
    "cycleDay": "A",
    "tt": "Normal",
    "event": "F.6 Mock Examination"
  },
  {
    "date": "2027-02-15",
    "dayName": "Mon",
    "cycle": 15,
    "cycleDay": "B",
    "tt": "Normal",
    "event": "F.6 Mock Examination"
  },
  {
    "date": "2027-02-16",
    "dayName": "Tue",
    "cycle": 15,
    "cycleDay": "C",
    "tt": "Normal",
    "event": "F.6 Mock Examination"
  },
  {
    "date": "2027-02-17",
    "dayName": "Wed",
    "cycle": 15,
    "cycleDay": "D",
    "tt": "Normal",
    "event": "F.6 Mock Examination"
  },
  {
    "date": "2027-02-18",
    "dayName": "Thu",
    "cycle": 15,
    "cycleDay": "E",
    "tt": "Normal",
    "event": "F.6 Mock Examination"
  },
  {
    "date": "2027-02-19",
    "dayName": "Fri",
    "cycle": 15,
    "cycleDay": "F",
    "tt": "Normal",
    "event": "F.6 Mock Examination"
  },
  {
    "date": "2027-02-22",
    "dayName": "Mon",
    "cycle": 16,
    "cycleDay": "A",
    "tt": "Normal",
    "event": "F.6 Mock Examination"
  },
  {
    "date": "2027-02-23",
    "dayName": "Tue",
    "cycle": 16,
    "cycleDay": "B",
    "tt": "Normal",
    "event": "F.6 Mock Examination"
  },
  {
    "date": "2027-02-24",
    "dayName": "Wed",
    "cycle": 16,
    "cycleDay": "C",
    "tt": "Normal",
    "event": ""
  },
  {
    "date": "2027-02-25",
    "dayName": "Thu",
    "cycle": 16,
    "cycleDay": "D",
    "tt": "Normal",
    "event": ""
  },
  {
    "date": "2027-02-26",
    "dayName": "Fri",
    "cycle": 16,
    "cycleDay": "E",
    "tt": "ST2",
    "event": ""
  },
  {
    "date": "2027-03-02",
    "dayName": "Tue",
    "cycle": 17,
    "cycleDay": "F",
    "tt": "Normal",
    "event": "F.6 Mark Checking & Central Mark Checking; Chinese Culture Week"
  },
  {
    "date": "2027-03-03",
    "dayName": "Wed",
    "cycle": 17,
    "cycleDay": "A",
    "tt": "Normal",
    "event": "F.6 Mark Checking & Central Mark Checking; Chinese Culture Week"
  },
  {
    "date": "2027-03-04",
    "dayName": "Thu",
    "cycle": 17,
    "cycleDay": "B",
    "tt": "Normal",
    "event": "F.6 Mark Checking & Central Mark Checking; Chinese Culture Week"
  },
  {
    "date": "2027-03-08",
    "dayName": "Mon",
    "cycle": 18,
    "cycleDay": "C",
    "tt": "Normal",
    "event": ""
  },
  {
    "date": "2027-03-09",
    "dayName": "Tue",
    "cycle": 18,
    "cycleDay": "D",
    "tt": "Normal",
    "event": ""
  },
  {
    "date": "2027-03-10",
    "dayName": "Wed",
    "cycle": 18,
    "cycleDay": "E",
    "tt": "Normal",
    "event": ""
  },
  {
    "date": "2027-03-11",
    "dayName": "Thu",
    "cycle": 18,
    "cycleDay": "F",
    "tt": "Normal",
    "event": ""
  },
  {
    "date": "2027-03-12",
    "dayName": "Fri",
    "cycle": 18,
    "cycleDay": "A",
    "tt": "Normal",
    "event": "Sports Friday"
  },
  {
    "date": "2027-03-15",
    "dayName": "Mon",
    "cycle": 18,
    "cycleDay": "B",
    "tt": "Normal",
    "event": ""
  },
  {
    "date": "2027-03-16",
    "dayName": "Tue",
    "cycle": 18,
    "cycleDay": "C",
    "tt": "Normal",
    "event": ""
  },
  {
    "date": "2027-03-17",
    "dayName": "Wed",
    "cycle": 18,
    "cycleDay": "D",
    "tt": "Normal",
    "event": ""
  },
  {
    "date": "2027-03-18",
    "dayName": "Thu",
    "cycle": 18,
    "cycleDay": "E",
    "tt": "Normal",
    "event": ""
  },
  {
    "date": "2027-03-19",
    "dayName": "Fri",
    "cycle": 18,
    "cycleDay": "F",
    "tt": "Normal",
    "event": ""
  },
  {
    "date": "2027-03-22",
    "dayName": "Mon",
    "cycle": 19,
    "cycleDay": "A",
    "tt": "Normal",
    "event": ""
  },
  {
    "date": "2027-03-23",
    "dayName": "Tue",
    "cycle": 19,
    "cycleDay": "B",
    "tt": "Normal",
    "event": ""
  },
  {
    "date": "2027-03-24",
    "dayName": "Wed",
    "cycle": 19,
    "cycleDay": "C",
    "tt": "Normal",
    "event": ""
  },
  {
    "date": "2027-04-08",
    "dayName": "Thu",
    "cycle": 19,
    "cycleDay": "D",
    "tt": "Normal",
    "event": ""
  },
  {
    "date": "2027-04-09",
    "dayName": "Fri",
    "cycle": 19,
    "cycleDay": "E",
    "tt": "Normal",
    "event": "F.3 Information Day"
  },
  {
    "date": "2027-04-12",
    "dayName": "Mon",
    "cycle": 20,
    "cycleDay": "F",
    "tt": "Normal",
    "event": ""
  },
  {
    "date": "2027-04-13",
    "dayName": "Tue",
    "cycle": 20,
    "cycleDay": "A",
    "tt": "Normal",
    "event": ""
  },
  {
    "date": "2027-04-14",
    "dayName": "Wed",
    "cycle": 20,
    "cycleDay": "B",
    "tt": "Normal",
    "event": ""
  },
  {
    "date": "2027-04-15",
    "dayName": "Thu",
    "cycle": 20,
    "cycleDay": "C",
    "tt": "Normal",
    "event": "National Security Education Day"
  },
  {
    "date": "2027-04-16",
    "dayName": "Fri",
    "cycle": 20,
    "cycleDay": "D",
    "tt": "Normal",
    "event": ""
  },
  {
    "date": "2027-04-21",
    "dayName": "Wed",
    "cycle": 21,
    "cycleDay": "E",
    "tt": "Normal",
    "event": ""
  },
  {
    "date": "2027-04-22",
    "dayName": "Thu",
    "cycle": 21,
    "cycleDay": "F",
    "tt": "Normal",
    "event": ""
  },
  {
    "date": "2027-04-23",
    "dayName": "Fri",
    "cycle": 21,
    "cycleDay": "A",
    "tt": "Normal",
    "event": "Sports Friday"
  },
  {
    "date": "2027-04-26",
    "dayName": "Mon",
    "cycle": 21,
    "cycleDay": "B",
    "tt": "Normal",
    "event": "Counselling Week"
  },
  {
    "date": "2027-04-27",
    "dayName": "Tue",
    "cycle": 21,
    "cycleDay": "C",
    "tt": "Normal",
    "event": "Counselling Week"
  },
  {
    "date": "2027-04-28",
    "dayName": "Wed",
    "cycle": 21,
    "cycleDay": "D",
    "tt": "Normal",
    "event": "Counselling Week; F.3 TSA (Speaking Assessment)"
  },
  {
    "date": "2027-04-29",
    "dayName": "Thu",
    "cycle": 21,
    "cycleDay": "E",
    "tt": "Normal",
    "event": "Counselling Week; F.3 TSA (Speaking Assessment)"
  },
  {
    "date": "2027-04-30",
    "dayName": "Fri",
    "cycle": 21,
    "cycleDay": "F",
    "tt": "Normal",
    "event": "Counselling Week"
  },
  {
    "date": "2027-05-03",
    "dayName": "Mon",
    "cycle": 22,
    "cycleDay": "A",
    "tt": "Normal",
    "event": ""
  },
  {
    "date": "2027-05-04",
    "dayName": "Tue",
    "cycle": 22,
    "cycleDay": "B",
    "tt": "Normal",
    "event": ""
  },
  {
    "date": "2027-05-05",
    "dayName": "Wed",
    "cycle": 22,
    "cycleDay": "C",
    "tt": "Normal",
    "event": ""
  },
  {
    "date": "2027-05-06",
    "dayName": "Thu",
    "cycle": 22,
    "cycleDay": "D",
    "tt": "Normal",
    "event": ""
  },
  {
    "date": "2027-05-07",
    "dayName": "Fri",
    "cycle": 22,
    "cycleDay": "E",
    "tt": "Normal",
    "event": ""
  },
  {
    "date": "2027-05-10",
    "dayName": "Mon",
    "cycle": 23,
    "cycleDay": "F",
    "tt": "Normal",
    "event": "English Week"
  },
  {
    "date": "2027-05-11",
    "dayName": "Tue",
    "cycle": 23,
    "cycleDay": "A",
    "tt": "Normal",
    "event": "English Week"
  },
  {
    "date": "2027-05-12",
    "dayName": "Wed",
    "cycle": 23,
    "cycleDay": "B",
    "tt": "Normal",
    "event": "English Week"
  },
  {
    "date": "2027-05-17",
    "dayName": "Mon",
    "cycle": 24,
    "cycleDay": "C",
    "tt": "Normal",
    "event": ""
  },
  {
    "date": "2027-05-18",
    "dayName": "Tue",
    "cycle": 24,
    "cycleDay": "D",
    "tt": "Normal",
    "event": ""
  },
  {
    "date": "2027-05-19",
    "dayName": "Wed",
    "cycle": 24,
    "cycleDay": "E",
    "tt": "Normal",
    "event": ""
  },
  {
    "date": "2027-05-20",
    "dayName": "Thu",
    "cycle": 24,
    "cycleDay": "F",
    "tt": "Normal",
    "event": ""
  },
  {
    "date": "2027-05-21",
    "dayName": "Fri",
    "cycle": 24,
    "cycleDay": "A",
    "tt": "Normal",
    "event": ""
  },
  {
    "date": "2027-05-25",
    "dayName": "Tue",
    "cycle": 24,
    "cycleDay": "B",
    "tt": "Normal",
    "event": ""
  },
  {
    "date": "2027-05-26",
    "dayName": "Wed",
    "cycle": 24,
    "cycleDay": "C",
    "tt": "Normal",
    "event": ""
  },
  {
    "date": "2027-05-27",
    "dayName": "Thu",
    "cycle": 24,
    "cycleDay": "D",
    "tt": "Normal",
    "event": ""
  },
  {
    "date": "2027-05-28",
    "dayName": "Fri",
    "cycle": 24,
    "cycleDay": "E",
    "tt": "Normal",
    "event": "Champion House Day"
  },
  {
    "date": "2027-05-31",
    "dayName": "Mon",
    "cycle": 24,
    "cycleDay": "F",
    "tt": "Normal",
    "event": ""
  },
  {
    "date": "2027-06-01",
    "dayName": "Tue",
    "cycle": 25,
    "cycleDay": "A",
    "tt": "ST1",
    "event": ""
  },
  {
    "date": "2027-06-02",
    "dayName": "Wed",
    "cycle": 25,
    "cycleDay": "B",
    "tt": "ST1",
    "event": ""
  },
  {
    "date": "2027-06-03",
    "dayName": "Thu",
    "cycle": 25,
    "cycleDay": "C",
    "tt": "ST1",
    "event": ""
  },
  {
    "date": "2027-06-04",
    "dayName": "Fri",
    "cycle": 25,
    "cycleDay": "D",
    "tt": "ST1",
    "event": ""
  },
  {
    "date": "2027-06-07",
    "dayName": "Mon",
    "cycle": 25,
    "cycleDay": "E",
    "tt": "ST1",
    "event": ""
  },
  {
    "date": "2027-06-08",
    "dayName": "Tue",
    "cycle": 25,
    "cycleDay": "F",
    "tt": "ST1",
    "event": ""
  }
];


  // Master Default non-cycle events (holidays, special days)
  var DEFAULT_NON_CYCLE_EVENTS = {
  "2026-09-01": "First Day of School",
  "2026-09-19": "PTA Orientation Activity Day",
  "2026-09-26": "The Day following the Mid-Autumn Festival",
  "2026-10-01": "National Day",
  "2026-10-19": "The Day following Chung Yeung Festival",
  "2026-10-29": "School Sports Day  [H]",
  "2026-10-30": "School Sports Day  [H]",
  "2026-11-02": "Test Days",
  "2026-11-03": "Test Days",
  "2026-11-04": "Staff Development Day",
  "2026-11-05": "Test Days",
  "2026-11-06": "Test Days",
  "2026-11-07": "AGM of PTA & F.1 Parents' Day",
  "2026-11-14": "S1 Admission Talk & School Visit",
  "2026-11-24": "School Outing",
  "2026-11-25": "The day after School Outing",
  "2026-12-04": "STEAM Week; National Constitution Day",
  "2026-12-18": "Singing Contest & Christmas Celebrations",
  "2026-12-21": "Christmas & New Year Holidays",
  "2026-12-22": "Christmas & New Year Holidays",
  "2026-12-23": "Christmas & New Year Holidays",
  "2026-12-24": "Christmas & New Year Holidays",
  "2026-12-25": "Christmas & New Year Holidays",
  "2026-12-26": "Christmas & New Year Holidays",
  "2026-12-27": "Christmas & New Year Holidays",
  "2026-12-28": "Christmas & New Year Holidays",
  "2026-12-29": "Christmas & New Year Holidays",
  "2026-12-30": "Christmas & New Year Holidays",
  "2026-12-31": "Christmas & New Year Holidays",
  "2027-01-01": "Christmas & New Year Holidays",
  "2027-01-02": "Christmas & New Year Holidays; Alumni's Day",
  "2027-01-09": "F.1-F.5 First Term Examination",
  "2027-01-10": "F.1-F.5 First Term Examination",
  "2027-01-16": "F.1-F.5 First Term Examination",
  "2027-01-17": "F.1-F.5 First Term Examination",
  "2027-01-23": "F.6 Mock Examination",
  "2027-01-24": "F.6 Mock Examination",
  "2027-01-30": "F.6 Mock Examination",
  "2027-01-31": "F.6 Mock Examination",
  "2027-02-01": "F.6 Mock Examination; Lunar New Year Holidays",
  "2027-02-02": "F.6 Mock Examination; Lunar New Year Holidays",
  "2027-02-03": "F.6 Mock Examination; Lunar New Year Holidays",
  "2027-02-04": "F.6 Mock Examination; Lunar New Year Holidays",
  "2027-02-05": "F.6 Mock Examination; Lunar New Year Holidays",
  "2027-02-06": "F.6 Mock Examination; Lunar New Year Holidays",
  "2027-02-07": "F.6 Mock Examination; Lunar New Year Holidays",
  "2027-02-08": "F.6 Mock Examination; Lunar New Year Holidays",
  "2027-02-09": "F.6 Mock Examination; Lunar New Year Holidays",
  "2027-02-10": "F.6 Mock Examination; Lunar New Year Holidays",
  "2027-02-11": "F.6 Mock Examination; Lunar New Year Holidays",
  "2027-02-12": "F.6 Mock Examination; Lunar New Year Holidays",
  "2027-02-13": "F.6 Mock Examination; Lunar New Year Holidays",
  "2027-02-14": "F.6 Mock Examination",
  "2027-02-20": "F.6 Mock Examination",
  "2027-02-21": "F.6 Mock Examination",
  "2027-02-27": "Parents' Day",
  "2027-03-01": "The day after Parents' Day",
  "2027-03-05": "Chinese Culture Week",
  "2027-03-07": "PTA Outing",
  "2027-03-13": "Interview for F.1 Discretionary Places",
  "2027-03-25": "Life-wide Learning Day (First day of F.5 study trip)",
  "2027-03-26": "Easter Holidays",
  "2027-03-27": "Easter Holidays",
  "2027-03-28": "Easter Holidays",
  "2027-03-29": "Easter Holidays",
  "2027-03-30": "Easter Holidays",
  "2027-03-31": "Easter Holidays",
  "2027-04-01": "Easter Holidays",
  "2027-04-02": "Easter Holidays",
  "2027-04-03": "Easter Holidays",
  "2027-04-05": "Ching Ming Festival",
  "2027-04-06": "Test Days",
  "2027-04-07": "Test Days",
  "2027-04-19": "Test Days",
  "2027-04-20": "Test Days",
  "2027-05-01": "Labour Day",
  "2027-05-13": "English Week; The Birthday of the Buddha",
  "2027-05-14": "English Week",
  "2027-05-22": "Speech Day (2026-2027)",
  "2027-05-24": "The day after Speech Day",
  "2027-06-09": "Tuen Ng Festival",
  "2027-06-10": "Staff Development Day",
  "2027-06-11": "F.1-F.5 Final Examination",
  "2027-06-12": "F.1-F.5 Final Examination",
  "2027-06-13": "F.1-F.5 Final Examination",
  "2027-06-14": "F.1-F.5 Final Examination",
  "2027-06-15": "F.1-F.5 Final Examination",
  "2027-06-16": "F.1-F.5 Final Examination",
  "2027-06-17": "F.1-F.5 Final Examination; F.3 TSA (Written Assessment)",
  "2027-06-18": "F.1-F.5 Final Examination; F.3 TSA (Written Assessment)",
  "2027-06-19": "F.1-F.5 Final Examination",
  "2027-06-20": "F.1-F.5 Final Examination",
  "2027-06-21": "F.1-F.5 Final Examination",
  "2027-06-22": "F.1-F.5 Final Examination",
  "2027-06-23": "F.1-F.5 Final Examination",
  "2027-06-24": "F.1-F.5 Final Examination",
  "2027-06-25": "F.1-F.5 Final Examination",
  "2027-06-26": "F.1-F.5 Final Examination",
  "2027-06-27": "F.1-F.5 Final Examination",
  "2027-06-28": "F.1-F.5 Final Examination",
  "2027-06-29": "F.1-F.5 Final Examination",
  "2027-06-30": "Mark Checking, Central Mark Checking",
  "2027-07-01": "HKSAR Establishment Day; Mark Checking, Central Mark Checking",
  "2027-07-02": "Mark Checking, Central Mark Checking",
  "2027-07-03": "Mark Checking, Central Mark Checking",
  "2027-07-04": "Mark Checking, Central Mark Checking",
  "2027-07-05": "Mark Checking, Central Mark Checking",
  "2027-07-06": "Mark Checking, Central Mark Checking; Post-examination Activities",
  "2027-07-07": "Post-examination Activities; F.4, F.5 Supplementary Lessons",
  "2027-07-08": "Post-examination Activities; F.1-F.4 Re-examination; F.4, F.5 Supplementary Lessons",
  "2027-07-09": "Post-examination Activities; F.1-F.4 Re-examination; F.4, F.5 Supplementary Lessons",
  "2027-07-10": "Post-examination Activities; F.1-F.4 Re-examination; F.4, F.5 Supplementary Lessons; F.6 Information Day 2",
  "2027-07-11": "Post-examination Activities; F.1-F.4 Re-examination; F.4, F.5 Supplementary Lessons",
  "2027-07-12": "Post-examination Activities; F.1-F.4 Re-examination; F.4, F.5 Supplementary Lessons",
  "2027-07-13": "Post-examination Activities; F.4, F.5 Supplementary Lessons; Pre-S1 Attainment Test",
  "2027-07-14": "Post-examination Activities; F.4, F.5 Supplementary Lessons; Release of HKDSE Examination Results",
  "2027-07-15": "F.4, F.5 Supplementary Lessons; Release of Examination Results & Prize-giving Ceremony",
  "2027-07-16": "F.4, F.5 Supplementary Lessons; F.1-F.3 Summer Enhancement Course; Summer Holidays",
  "2027-07-17": "F.4, F.5 Supplementary Lessons; F.1-F.3 Summer Enhancement Course; F.1 Orientation Day; Summer Holidays",
  "2027-07-18": "F.4, F.5 Supplementary Lessons; F.1-F.3 Summer Enhancement Course; Summer Holidays",
  "2027-07-19": "F.4, F.5 Supplementary Lessons; F.1-F.3 Summer Enhancement Course; Summer Holidays",
  "2027-07-20": "F.4, F.5 Supplementary Lessons; F.1-F.3 Summer Enhancement Course; Summer Holidays",
  "2027-07-21": "F.4, F.5 Supplementary Lessons; F.1-F.3 Summer Enhancement Course; Summer Holidays",
  "2027-07-22": "F.1-F.3 Summer Enhancement Course; F.4-F.5 Summer Enhancement Course; Summer Holidays",
  "2027-07-23": "F.1-F.3 Summer Enhancement Course; F.4-F.5 Summer Enhancement Course; Summer Holidays",
  "2027-07-24": "F.1-F.3 Summer Enhancement Course; F.4-F.5 Summer Enhancement Course; Summer Holidays",
  "2027-07-25": "F.1-F.3 Summer Enhancement Course; F.4-F.5 Summer Enhancement Course; Summer Holidays",
  "2027-07-26": "F.1-F.3 Summer Enhancement Course; F.4-F.5 Summer Enhancement Course; Summer Holidays",
  "2027-07-27": "F.1-F.3 Summer Enhancement Course; F.4-F.5 Summer Enhancement Course; Summer Holidays",
  "2027-07-28": "F.1-F.3 Summer Enhancement Course; F.4-F.5 Summer Enhancement Course; Summer Holidays",
  "2027-07-29": "F.1-F.3 Summer Enhancement Course; F.4-F.5 Summer Enhancement Course; Summer Holidays",
  "2027-07-30": "F.4-F.5 Summer Enhancement Course; Summer Holidays",
  "2027-07-31": "F.4-F.5 Summer Enhancement Course; Summer Holidays",
  "2027-08-01": "F.4-F.5 Summer Enhancement Course; Summer Holidays",
  "2027-08-02": "F.4-F.5 Summer Enhancement Course; Summer Holidays",
  "2027-08-03": "F.4-F.5 Summer Enhancement Course; Summer Holidays",
  "2027-08-04": "F.4-F.5 Summer Enhancement Course; Summer Holidays",
  "2027-08-05": "Summer Holidays",
  "2027-08-06": "Summer Holidays",
  "2027-08-07": "Summer Holidays",
  "2027-08-08": "Summer Holidays",
  "2027-08-09": "Summer Holidays",
  "2027-08-10": "Summer Holidays",
  "2027-08-11": "Summer Holidays",
  "2027-08-12": "Summer Holidays",
  "2027-08-13": "Summer Holidays",
  "2027-08-14": "Summer Holidays",
  "2027-08-15": "Summer Holidays",
  "2027-08-16": "Summer Holidays",
  "2027-08-17": "Summer Holidays",
  "2027-08-18": "Summer Holidays",
  "2027-08-19": "Summer Holidays",
  "2027-08-20": "Summer Holidays",
  "2027-08-21": "Summer Holidays",
  "2027-08-22": "Summer Holidays",
  "2027-08-23": "Summer Holidays; First Staff Meeting (2027-2028)",
  "2027-08-24": "Summer Holidays",
  "2027-08-25": "Summer Holidays",
  "2027-08-26": "Summer Holidays; First Panel Meetings",
  "2027-08-27": "Summer Holidays; Class Teachers' Meeting & F.1 Activity Day",
  "2027-08-28": "Summer Holidays",
  "2027-08-29": "Summer Holidays",
  "2027-08-30": "Summer Holidays",
  "2027-08-31": "Summer Holidays"
};

  // Exact period timings
  var TIMINGS = {
    Normal: {
      1: { start: '08:20', end: '09:00' },
      2: { start: '09:00', end: '09:40' },
      3: { start: '09:40', end: '10:20' },
      4: { start: '10:40', end: '11:20' },
      5: { start: '11:20', end: '12:00' },
      6: { start: '12:00', end: '12:40' },
      7: { start: '14:00', end: '14:40' },
      8: { start: '14:40', end: '15:20' }
    },
    ST1: {
      1: { start: '08:05', end: '08:35' },
      2: { start: '08:35', end: '09:05' },
      3: { start: '09:05', end: '09:35' },
      4: { start: '09:50', end: '10:20' },
      5: { start: '10:20', end: '10:50' },
      6: { start: '10:50', end: '11:20' },
      7: { start: '11:35', end: '12:05' },
      8: { start: '12:05', end: '12:35' }
    },
    ST2: {
      1: { start: '08:05', end: '08:40' },
      2: { start: '08:40', end: '09:15' },
      3: { start: '09:15', end: '09:50' },
      4: { start: '10:05', end: '10:40' },
      5: { start: '10:40', end: '11:15' },
      6: { start: '11:15', end: '11:50' },
      7: { start: '13:10', end: '13:45' },
      8: { start: '13:45', end: '14:20' }
    }
  };

  // Master Default Timetable definition by Cycle Day A-F
  var DEFAULT_SCHEDULE = {
    A: [
      { period: 2, class: '2D', rawClass: 'CpLit 2D', subject: '中國語文及文化', room: '502' },
      { period: 3, class: '2D', rawClass: 'CpLit 2D', subject: '中國語文及文化', room: '502' }
    ],
    B: [
      { period: 1, class: '4C', rawClass: 'CS 4C', subject: '公民與社會發展科', room: '303' },
      { period: 2, class: '1D', rawClass: 'CpLit 1D', subject: '中國語文及文化', room: '502' },
      { period: 3, class: '1D', rawClass: 'CpLit 1D', subject: '中國語文及文化', room: '502' },
      { period: 4, class: '4C', rawClass: 'CS F4(CLP)', subject: '公民與社會發展科', room: '308' },
      { period: 7, class: '2B', rawClass: 'CpLit 2B', subject: '中國語文及文化', room: '502' },
      { period: 8, class: '2B', rawClass: 'CpLit 2B', subject: '中國語文及文化', room: '502' }
    ],
    C: [
      { period: 4, class: '2A', rawClass: 'CpLit 2A', subject: '中國語文及文化', room: '502' },
      { period: 5, class: '2A', rawClass: 'CpLit 2A', subject: '中國語文及文化', room: '502' },
      { period: 7, class: '1A', rawClass: 'CpLit 1A', subject: '中國語文及文化', room: '502' },
      { period: 8, class: '1A', rawClass: 'CpLit 1A', subject: '中國語文及文化', room: '502' }
    ],
    D: [],
    E: [
      { period: 4, class: '2C', rawClass: 'CpLit 2C', subject: '中國語文及文化', room: '502' },
      { period: 5, class: '2C', rawClass: 'CpLit 2C', subject: '中國語文及文化', room: '502' },
      { period: 6, class: '4C', rawClass: 'CS 4C', subject: '公民與社會發展科', room: '303' }
    ],
    F: [
      { period: 7, class: '2D', rawClass: 'LifeEd 2D', subject: '生涯規劃', room: '204' },
      { period: 8, class: '2D', rawClass: 'LifeEd 2D', subject: '生涯規劃', room: '204' }
    ]
  };

  // Master Default Class Profile & designated regular cycle days
  var DEFAULT_CLASS_PROFILE = {
    '1A': { fullName: '1A (中化)', subject: '中國語文及文化', defaultRoom: '502', regularDays: ['C'], summary: 'Day C 第 7–8 堂 (502室)' },
    '1D': { fullName: '1D (中化)', subject: '中國語文及文化', defaultRoom: '502', regularDays: ['B'], summary: 'Day B 第 2–3 堂 (502室)' },
    '2A': { fullName: '2A (中化)', subject: '中國語文及文化', defaultRoom: '502', regularDays: ['C'], summary: 'Day C 第 4–5 堂 (502室)' },
    '2B': { fullName: '2B (中化)', subject: '中國語文及文化', defaultRoom: '502', regularDays: ['B'], summary: 'Day B 第 7–8 堂 (502室)' },
    '2C': { fullName: '2C (中化)', subject: '中國語文及文化', defaultRoom: '502', regularDays: ['E'], summary: 'Day E 第 4–5 堂 (502室)' },
    '2D': { fullName: '2D (中化/生涯)', subject: '中化 (Day A) / 生涯規劃 (Day F)', defaultRoom: '502 / 204', regularDays: ['A', 'F'], summary: 'Day A 第 2–3 堂 (502室), Day F 第 7–8 堂 (204室)' },
    '4C': { fullName: '4C (公社科)', subject: '公民與社會發展科', defaultRoom: '303 / 308', regularDays: ['B', 'E'], summary: 'Day B 第 1 堂 (303室) & 第 4 堂 (308室), Day E 第 6 堂 (303室)' }
  };

  /* ----------------------------------------------------------- active state & persistence */

  var STORAGE_KEY_SCHEDULE = 'cm_custom_schedule';
  var STORAGE_KEY_CALENDAR = 'cm_custom_calendar';

  var activeCycleDays = JSON.parse(JSON.stringify(DEFAULT_CYCLE_DAYS));
  var activeNonCycleEvents = JSON.parse(JSON.stringify(DEFAULT_NON_CYCLE_EVENTS));
  var activeSchedule = JSON.parse(JSON.stringify(DEFAULT_SCHEDULE));
  var activeClassProfile = JSON.parse(JSON.stringify(DEFAULT_CLASS_PROFILE));
  var activeCycleDateMap = {};

  /* ----------------------------------------------------------- helpers */

  function normalizeClass(name) {
    if (!name) return '';
    return String(name)
      .replace(/^(cplit|cs|lifeed)\s*/i, '')
      .replace(/\(.*?\)/g, '')
      .trim()
      .toUpperCase();
  }

  function matchClass(a, b) {
    var na = normalizeClass(a), nb = normalizeClass(b);
    if (!na || !nb) return false;
    if (na === nb) return true;
    if ((na === '4C' && nb.includes('4')) || (nb === '4C' && na.includes('4'))) return true;
    return false;
  }

  function parseMinutes(hhmm) {
    if (!hhmm) return 0;
    var parts = hhmm.split(':');
    return parseInt(parts[0], 10) * 60 + parseInt(parts[1], 10);
  }

  function rebuildDateIndex() {
    activeCycleDateMap = {};
    activeCycleDays.forEach(function (d) {
      if (d && d.date) {
        activeCycleDateMap[d.date] = d;
      }
    });
  }

  function rebuildClassProfile() {
    var prof = {};
    var days = ['A', 'B', 'C', 'D', 'E', 'F'];
    days.forEach(function (d) {
      var list = activeSchedule[d] || [];
      list.forEach(function (item) {
        var cls = normalizeClass(item.class);
        if (!cls) return;
        if (!prof[cls]) {
          prof[cls] = {
            fullName: cls + (item.subject ? ' (' + item.subject + ')' : ''),
            subject: item.subject || '',
            defaultRoom: item.room || '',
            regularDays: [],
            summary: ''
          };
        }
        if (prof[cls].regularDays.indexOf(d) === -1) {
          prof[cls].regularDays.push(d);
        }
        if (item.room && !prof[cls].defaultRoom) {
          prof[cls].defaultRoom = item.room;
        }
      });
    });

    // Merge default class profiles for fallback
    Object.keys(DEFAULT_CLASS_PROFILE).forEach(function (cls) {
      if (!prof[cls]) {
        prof[cls] = JSON.parse(JSON.stringify(DEFAULT_CLASS_PROFILE[cls]));
      }
    });

    // Build summaries
    Object.keys(prof).forEach(function (cls) {
      var p = prof[cls];
      var slotSummaries = [];
      days.forEach(function (d) {
        var slots = (activeSchedule[d] || []).filter(function (l) { return matchClass(cls, l.class); });
        if (slots.length > 0) {
          var pNums = slots.map(function (s) { return s.period; }).sort(function (a, b) { return a - b; });
          var r = slots[0].room || p.defaultRoom || '';
          slotSummaries.push('Day ' + d + ' 第 ' + pNums.join(', ') + ' 堂' + (r ? ' (' + r + '室)' : ''));
        }
      });
      if (slotSummaries.length > 0) {
        p.summary = slotSummaries.join(', ');
      }
    });

    activeClassProfile = prof;
  }

  function loadPersistedData() {
    try {
      if (typeof localStorage !== 'undefined') {
        var savedSched = localStorage.getItem(STORAGE_KEY_SCHEDULE);
        if (savedSched) {
          var parsedSched = JSON.parse(savedSched);
          if (parsedSched && typeof parsedSched === 'object') {
            activeSchedule = parsedSched;
          }
        }
        var savedCal = localStorage.getItem(STORAGE_KEY_CALENDAR);
        if (savedCal) {
          var parsedCal = JSON.parse(savedCal);
          if (parsedCal && Array.isArray(parsedCal.cycleDays) && parsedCal.cycleDays.length > 0) {
            activeCycleDays = parsedCal.cycleDays;
            if (parsedCal.nonCycleEvents && typeof parsedCal.nonCycleEvents === 'object') {
              activeNonCycleEvents = parsedCal.nonCycleEvents;
            }
          }
        }
      }
    } catch (e) {
      console.warn('[ScheduleEngine] Could not load persisted overrides:', e);
    }
    rebuildDateIndex();
    rebuildClassProfile();
  }

  function setSchedule(newSchedule) {
    if (!newSchedule || typeof newSchedule !== 'object') {
      throw new Error('課表資料格式無效');
    }
    var days = ['A', 'B', 'C', 'D', 'E', 'F'];
    var cleanSched = {};
    days.forEach(function (d) {
      cleanSched[d] = Array.isArray(newSchedule[d]) ? newSchedule[d] : [];
    });
    activeSchedule = cleanSched;
    rebuildClassProfile();
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(STORAGE_KEY_SCHEDULE, JSON.stringify(activeSchedule));
      }
    } catch (e) {
      console.warn('[ScheduleEngine] Failed to save schedule to localStorage:', e);
    }
    return true;
  }

  function resetSchedule() {
    activeSchedule = JSON.parse(JSON.stringify(DEFAULT_SCHEDULE));
    rebuildClassProfile();
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.removeItem(STORAGE_KEY_SCHEDULE);
      }
    } catch (e) {
      console.warn('[ScheduleEngine] Failed to remove schedule from localStorage:', e);
    }
    return true;
  }

  function isCustomSchedule() {
    try {
      return !!(typeof localStorage !== 'undefined' && localStorage.getItem(STORAGE_KEY_SCHEDULE));
    } catch (e) {
      return false;
    }
  }

  function setCalendar(cycleDays, nonCycleEvents) {
    if (!Array.isArray(cycleDays) || cycleDays.length === 0) {
      throw new Error('校曆必須包含至少一個有效循環日');
    }
    activeCycleDays = JSON.parse(JSON.stringify(cycleDays));
    activeNonCycleEvents = (nonCycleEvents && typeof nonCycleEvents === 'object')
      ? JSON.parse(JSON.stringify(nonCycleEvents))
      : {};
    rebuildDateIndex();
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(STORAGE_KEY_CALENDAR, JSON.stringify({
          cycleDays: activeCycleDays,
          nonCycleEvents: activeNonCycleEvents
        }));
      }
    } catch (e) {
      console.warn('[ScheduleEngine] Failed to save calendar to localStorage:', e);
    }
    return true;
  }

  function resetCalendar() {
    activeCycleDays = JSON.parse(JSON.stringify(DEFAULT_CYCLE_DAYS));
    activeNonCycleEvents = JSON.parse(JSON.stringify(DEFAULT_NON_CYCLE_EVENTS));
    rebuildDateIndex();
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.removeItem(STORAGE_KEY_CALENDAR);
      }
    } catch (e) {
      console.warn('[ScheduleEngine] Failed to remove calendar from localStorage:', e);
    }
    return true;
  }

  function isCustomCalendar() {
    try {
      return !!(typeof localStorage !== 'undefined' && localStorage.getItem(STORAGE_KEY_CALENDAR));
    } catch (e) {
      return false;
    }
  }

  function parseCalendarCsv(csvText) {
    if (!csvText || typeof csvText !== 'string' || !csvText.trim()) {
      return { error: '請提供有效的校曆 CSV 或文字內容' };
    }
    var rawLines = csvText.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
    var lines = [];
    for (var i = 0; i < rawLines.length; i++) {
      var l = rawLines[i].trim();
      if (l) lines.push(l);
    }
    if (lines.length === 0) {
      return { error: '校曆文字內容為空' };
    }

    var firstLine = lines[0];
    var delimiter = (firstLine.indexOf('\t') !== -1 && firstLine.split('\t').length >= 3) ? '\t' : ',';

    function splitLine(line) {
      if (delimiter === '\t') return line.split('\t').map(function (s) { return s.trim(); });
      var res = [];
      var cur = '';
      var inQuotes = false;
      for (var c = 0; c < line.length; c++) {
        var ch = line[c];
        if (ch === '"') {
          if (inQuotes && line[c + 1] === '"') {
            cur += '"';
            c++;
          } else {
            inQuotes = !inQuotes;
          }
        } else if (ch === ',' && !inQuotes) {
          res.push(cur.trim());
          cur = '';
        } else {
          cur += ch;
        }
      }
      res.push(cur.trim());
      return res;
    }

    var hCols = splitLine(firstLine).map(function (s) { return s.toLowerCase().replace(/[\s_\-]/g, ''); });
    var colMap = { date: -1, dayName: -1, cycle: -1, cycleDay: -1, tt: -1, event: -1 };

    for (var cIdx = 0; cIdx < hCols.length; cIdx++) {
      var col = hCols[cIdx];
      if (col.indexOf('date') !== -1 || col.indexOf('日期') !== -1) colMap.date = cIdx;
      else if (col.indexOf('dayname') !== -1 || col.indexOf('weekday') !== -1 || col.indexOf('星期') !== -1) colMap.dayName = cIdx;
      else if (col === 'cycle' || col.indexOf('循環週') !== -1 || col.indexOf('週次') !== -1) colMap.cycle = cIdx;
      else if (col.indexOf('cycleday') !== -1 || col === 'day' || col.indexOf('循環日') !== -1 || col.indexOf('日次') !== -1) colMap.cycleDay = cIdx;
      else if (col.indexOf('timetable') !== -1 || col === 'tt' || col.indexOf('類型') !== -1 || col.indexOf('模式') !== -1 || col.indexOf('時間表') !== -1) colMap.tt = cIdx;
      else if (col.indexOf('event') !== -1 || col.indexOf('holiday') !== -1 || col.indexOf('活動') !== -1 || col.indexOf('假期') !== -1 || col.indexOf('備註') !== -1) colMap.event = cIdx;
    }

    var startLineIdx = 0;
    if (colMap.date !== -1 || colMap.cycleDay !== -1) {
      startLineIdx = 1;
    } else {
      colMap = { date: 0, dayName: 1, cycle: 2, cycleDay: 3, tt: 4, event: 5 };
    }

    function normalizeDate(raw) {
      if (!raw) return null;
      var s = raw.trim();
      var m = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/);
      if (m) {
        var y = m[1], mo = ('0' + m[2]).slice(-2), da = ('0' + m[3]).slice(-2);
        return y + '-' + mo + '-' + da;
      }
      var m2 = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/);
      if (m2) {
        var da2 = ('0' + m2[1]).slice(-2), mo2 = ('0' + m2[2]).slice(-2), y2 = m2[3];
        return y2 + '-' + mo2 + '-' + da2;
      }
      return null;
    }

    var parsedCycleDays = [];
    var parsedNonCycleEvents = {};
    var errors = [];
    var warnings = [];
    var previewRows = [];

    for (var lineNum = startLineIdx; lineNum < lines.length; lineNum++) {
      var rawL = lines[lineNum];
      var parts = splitLine(rawL);
      if (parts.length === 0 || (parts.length === 1 && !parts[0])) continue;

      var rawDate = colMap.date >= 0 && colMap.date < parts.length ? parts[colMap.date] : '';
      var dateStr = normalizeDate(rawDate);
      if (!dateStr) {
        errors.push('第 ' + (lineNum + 1) + ' 行：無法識別有效日期「' + rawDate + '」');
        continue;
      }

      var dayName = colMap.dayName >= 0 && colMap.dayName < parts.length ? parts[colMap.dayName] : '';
      if (!dayName) {
        try {
          var dt = new Date(dateStr + 'T00:00:00');
          var dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
          dayName = dayNames[dt.getDay()] || '';
        } catch (e) {}
      }

      var rawCycle = colMap.cycle >= 0 && colMap.cycle < parts.length ? parts[colMap.cycle] : '';
      var cycleNum = parseInt(String(rawCycle).replace(/\D/g, ''), 10);
      if (isNaN(cycleNum)) cycleNum = 0;

      var rawCycleDay = colMap.cycleDay >= 0 && colMap.cycleDay < parts.length ? parts[colMap.cycleDay] : '';
      var cycleDay = String(rawCycleDay).toUpperCase().trim();
      if (cycleDay.indexOf('DAY') !== -1) {
        cycleDay = cycleDay.replace(/DAY\s*/, '').trim();
      }
      var isValidCycleDay = /^[A-F]$/.test(cycleDay);

      var rawTt = colMap.tt >= 0 && colMap.tt < parts.length ? parts[colMap.tt] : '';
      var tt = 'Normal';
      if (/st1/i.test(rawTt)) tt = 'ST1';
      else if (/st2/i.test(rawTt)) tt = 'ST2';

      var rawEvent = colMap.event >= 0 && colMap.event < parts.length ? parts[colMap.event] : '';

      if (isValidCycleDay) {
        parsedCycleDays.push({
          date: dateStr,
          dayName: dayName,
          cycle: cycleNum || (parsedCycleDays.length > 0 ? parsedCycleDays[parsedCycleDays.length - 1].cycle : 1),
          cycleDay: cycleDay,
          tt: tt,
          event: rawEvent || ''
        });
      } else {
        if (rawEvent) {
          parsedNonCycleEvents[dateStr] = rawEvent;
        }
      }

      if (previewRows.length < 15) {
        previewRows.push({
          date: dateStr,
          dayName: dayName,
          cycle: cycleNum || '—',
          cycleDay: isValidCycleDay ? cycleDay : '— (非循環日/假期)',
          tt: tt,
          event: rawEvent || '—'
        });
      }
    }

    parsedCycleDays.sort(function (a, b) { return a.date.localeCompare(b.date); });

    return {
      cycleDays: parsedCycleDays,
      nonCycleEvents: parsedNonCycleEvents,
      totalLines: lines.length - startLineIdx,
      cycleDaysCount: parsedCycleDays.length,
      eventsCount: Object.keys(parsedNonCycleEvents).length,
      previewRows: previewRows,
      errors: errors,
      warnings: warnings
    };
  }

  function exportCalendarCsv() {
    var rows = ['Date,DayName,Cycle,CycleDay,TimetableType,Event'];
    var allDates = {};
    activeCycleDays.forEach(function (d) {
      allDates[d.date] = {
        date: d.date,
        dayName: d.dayName || '',
        cycle: d.cycle || '',
        cycleDay: d.cycleDay || '',
        tt: d.tt || 'Normal',
        event: d.event || ''
      };
    });
    Object.keys(activeNonCycleEvents).forEach(function (d) {
      if (!allDates[d]) {
        var dayName = '';
        try {
          var dt = new Date(d + 'T00:00:00');
          var dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
          dayName = dayNames[dt.getDay()] || '';
        } catch (e) {}
        allDates[d] = {
          date: d,
          dayName: dayName,
          cycle: '',
          cycleDay: '',
          tt: '',
          event: activeNonCycleEvents[d] || ''
        };
      } else if (!allDates[d].event && activeNonCycleEvents[d]) {
        allDates[d].event = activeNonCycleEvents[d];
      }
    });

    var sortedDates = Object.keys(allDates).sort();
    sortedDates.forEach(function (d) {
      var item = allDates[d];
      var ev = item.event || '';
      var line = [
        item.date,
        item.dayName,
        item.cycle,
        item.cycleDay,
        item.tt,
        ev.indexOf(',') !== -1 ? '"' + ev.replace(/"/g, '""') + '"' : ev
      ].join(',');
      rows.push(line);
    });

    return rows.join('\r\n');
  }

  /* ----------------------------------------------------------- APIs */

  function getCycleDayInfo(dateStr) {
    if (!dateStr) return null;
    var cleanDate = dateStr.trim();
    if (activeCycleDateMap[cleanDate]) {
      var d = activeCycleDateMap[cleanDate];
      return {
        date: d.date,
        dayName: d.dayName,
        cycle: d.cycle,
        cycleDay: d.cycleDay,
        tt: d.tt,
        event: d.event || '',
        isSchoolCycleDay: true
      };
    }
    return {
      date: cleanDate,
      event: activeNonCycleEvents[cleanDate] || '',
      isSchoolCycleDay: false
    };
  }

  function getPeriodTiming(period, timetableType) {
    var tt = timetableType || 'Normal';
    if (!TIMINGS[tt]) tt = 'Normal';
    return TIMINGS[tt][period] || null;
  }

  function getCurrentPeriod(timeStr, timetableType) {
    var tt = timetableType || 'Normal';
    if (!TIMINGS[tt]) tt = 'Normal';
    var nowMins = parseMinutes(timeStr);
    var periodMap = TIMINGS[tt];

    // Check if within any period
    for (var p = 1; p <= 8; p++) {
      var t = periodMap[p];
      if (!t) continue;
      var sM = parseMinutes(t.start);
      var eM = parseMinutes(t.end);
      if (nowMins >= sM && nowMins < eM) {
        return {
          period: p,
          isCurrent: true,
          isUpcoming: false,
          start: t.start,
          end: t.end,
          minsUntilStart: 0,
          minsRemaining: eM - nowMins
        };
      }
    }

    // Check if within 15 minutes before an upcoming period
    for (var upP = 1; upP <= 8; upP++) {
      var upT = periodMap[upP];
      if (!upT) continue;
      var upSM = parseMinutes(upT.start);
      if (nowMins < upSM && (upSM - nowMins) <= 15) {
        return {
          period: upP,
          isCurrent: false,
          isUpcoming: true,
          start: upT.start,
          end: upT.end,
          minsUntilStart: upSM - nowMins,
          minsRemaining: 0
        };
      }
    }

    return null;
  }

  function getScheduledLessonsForDate(dateStr) {
    var info = getCycleDayInfo(dateStr);
    if (!info || !info.isSchoolCycleDay || !info.cycleDay) return [];
    var lessons = activeSchedule[info.cycleDay] || [];
    var tt = info.tt || 'Normal';
    return lessons.map(function (l) {
      var timing = getPeriodTiming(l.period, tt);
      return {
        period: l.period,
        class: l.class,
        rawClass: l.rawClass,
        subject: l.subject,
        room: l.room,
        start: timing ? timing.start : '',
        end: timing ? timing.end : ''
      };
    });
  }

  function getScheduledLessonsForClassAndDate(clsName, dateStr) {
    var all = getScheduledLessonsForDate(dateStr);
    return all.filter(function (l) {
      return matchClass(clsName, l.class);
    });
  }

  function findPreviousScheduledLessonDate(clsName, beforeDate) {
    if (!beforeDate || !clsName) return null;
    for (var i = activeCycleDays.length - 1; i >= 0; i--) {
      var d = activeCycleDays[i];
      if (d.date < beforeDate) {
        var dayLessons = activeSchedule[d.cycleDay] || [];
        var matched = dayLessons.filter(function (l) {
          return matchClass(clsName, l.class);
        });
        if (matched.length > 0) {
          var tt = d.tt || 'Normal';
          return {
            date: d.date,
            dayName: d.dayName,
            cycle: d.cycle,
            cycleDay: d.cycleDay,
            tt: d.tt,
            event: d.event || '',
            periods: matched.map(function (m) { return m.period; }),
            lessons: matched.map(function (m) {
              var timing = getPeriodTiming(m.period, tt);
              return {
                period: m.period,
                class: m.class,
                rawClass: m.rawClass,
                subject: m.subject,
                room: m.room,
                start: timing ? timing.start : '',
                end: timing ? timing.end : ''
              };
            })
          };
        }
      }
    }
    return null;
  }

  function findNextScheduledLessonDate(clsName, afterDate) {
    if (!afterDate || !clsName) return null;
    for (var i = 0; i < activeCycleDays.length; i++) {
      var d = activeCycleDays[i];
      if (d.date > afterDate) {
        var dayLessons = activeSchedule[d.cycleDay] || [];
        var matched = dayLessons.filter(function (l) {
          return matchClass(clsName, l.class);
        });
        if (matched.length > 0) {
          var tt = d.tt || 'Normal';
          return {
            date: d.date,
            dayName: d.dayName,
            cycle: d.cycle,
            cycleDay: d.cycleDay,
            tt: d.tt,
            event: d.event || '',
            periods: matched.map(function (m) { return m.period; }),
            lessons: matched.map(function (m) {
              var timing = getPeriodTiming(m.period, tt);
              return {
                period: m.period,
                class: m.class,
                rawClass: m.rawClass,
                subject: m.subject,
                room: m.room,
                start: timing ? timing.start : '',
                end: timing ? timing.end : ''
              };
            })
          };
        }
      }
    }
    return null;
  }

  function getClassProfile(clsName) {
    var norm = normalizeClass(clsName);
    return activeClassProfile[norm] || null;
  }

  function getSuggestedClass(dateStr, timeStr) {
    var info = getCycleDayInfo(dateStr);
    if (!info || !info.isSchoolCycleDay) {
      return {
        status: 'not_school_day',
        event: info ? info.event : '',
        suggestedClass: null,
        periodInfo: null,
        dayLessons: []
      };
    }

    var dayLessons = getScheduledLessonsForDate(dateStr);
    var pInfo = getCurrentPeriod(timeStr, info.tt);

    if (pInfo) {
      var currentLesson = dayLessons.find(function (l) { return l.period === pInfo.period; });
      if (currentLesson) {
        return {
          status: pInfo.isCurrent ? 'active_lesson' : 'upcoming_lesson',
          suggestedClass: currentLesson.class,
          currentLesson: currentLesson,
          periodInfo: pInfo,
          dayLessons: dayLessons,
          cycleInfo: info
        };
      }
    }

    var nowMins = parseMinutes(timeStr);
    var upcoming = dayLessons.find(function (l) {
      return parseMinutes(l.start) >= nowMins;
    });

    return {
      status: upcoming ? 'upcoming_today' : (dayLessons.length > 0 ? 'completed_today' : 'free_day'),
      suggestedClass: upcoming ? upcoming.class : (dayLessons.length > 0 ? dayLessons[0].class : null),
      currentLesson: upcoming || null,
      periodInfo: pInfo,
      dayLessons: dayLessons,
      cycleInfo: info
    };
  }

  // Load custom data from localStorage on initialization
  loadPersistedData();

  return {
    DEFAULT_CYCLE_DAYS: DEFAULT_CYCLE_DAYS,
    DEFAULT_NON_CYCLE_EVENTS: DEFAULT_NON_CYCLE_EVENTS,
    DEFAULT_SCHEDULE: DEFAULT_SCHEDULE,
    DEFAULT_CLASS_PROFILE: DEFAULT_CLASS_PROFILE,
    CYCLE_DAYS: activeCycleDays,
    NON_CYCLE_EVENTS: activeNonCycleEvents,
    TIMINGS: TIMINGS,
    SCHEDULE: activeSchedule,
    CLASS_PROFILE: activeClassProfile,
    normalizeClass: normalizeClass,
    matchClass: matchClass,
    getCycleDayInfo: getCycleDayInfo,
    getPeriodTiming: getPeriodTiming,
    getCurrentPeriod: getCurrentPeriod,
    getScheduledLessonsForDate: getScheduledLessonsForDate,
    getScheduledLessonsForClassAndDate: getScheduledLessonsForClassAndDate,
    findPreviousScheduledLessonDate: findPreviousScheduledLessonDate,
    findNextScheduledLessonDate: findNextScheduledLessonDate,
    getClassProfile: getClassProfile,
    getSuggestedClass: getSuggestedClass,
    // Dynamic management APIs
    getSchedule: function () { return JSON.parse(JSON.stringify(activeSchedule)); },
    setSchedule: setSchedule,
    resetSchedule: resetSchedule,
    isCustomSchedule: isCustomSchedule,
    getCalendarDays: function () { return JSON.parse(JSON.stringify(activeCycleDays)); },
    getNonCycleEvents: function () { return JSON.parse(JSON.stringify(activeNonCycleEvents)); },
    setCalendar: setCalendar,
    resetCalendar: resetCalendar,
    isCustomCalendar: isCustomCalendar,
    parseCalendarCsv: parseCalendarCsv,
    exportCalendarCsv: exportCalendarCsv,
    rebuildDateIndex: rebuildDateIndex,
    rebuildClassProfile: rebuildClassProfile
  };
});
