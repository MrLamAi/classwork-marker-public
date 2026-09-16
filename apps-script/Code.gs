/**
 * Marker Pro - classwork recorder
 *
 * Sheets
 *   Config   : Class | TotalStudents | Columns
 *   Sessions : Date  | Class | Assignment | SessionID
 *   Layout   : Class | Positions       (CSV of student numbers, "" = empty seat)
 *   Students : Class | No | Name (romanised) | NameZh (漢字) | NameEn (English first name) | Sex
 *   <Class>  : Date  | Assignment | SessionID | StudentNo | Timestamp
 */

var TZ            = "Asia/Hong_Kong";
var DEFAULT_TOTAL = 40;
var DEFAULT_COLS  = 8;
var MAX_ROWS      = 10;
var CLASS_HEADER  = ["Date", "Assignment", "SessionID", "StudentNo", "Timestamp"];

/* ---------------------------------------------------------- entry points */

function doGet(e) {
  var p = (e && e.parameter) ? e.parameter : {};
  var bundle = getBundle(p['class'], p.assignment, p.mode);

  var t = HtmlService.createTemplateFromFile('index');
  // < keeps a stray "</textarea>" inside a student name from breaking the page
  t.jsonBundle = JSON.stringify(bundle).replace(/</g, '\\u003c');

  return t.evaluate()
    .setTitle('Marker Pro')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function include(name) {
  return HtmlService.createHtmlOutputFromFile(name).getContent();
}

/**
 * Everything the page needs, in one round trip. Called by doGet and again by
 * the client whenever the class / assignment / mode changes.
 */
function getBundle(cls, asgn, mode) {
  bootstrapSheets();

  var config = getConfig();
  var entry  = null;
  for (var i = 0; i < config.length; i++) {
    if (config[i].name === String(cls)) { entry = config[i]; break; }
  }
  if (!entry) entry = config[0];

  cls = entry.name;
  ensureClassSheet_(cls);

  var sessions = getTodaySessions(cls);
  if (!asgn || sessions.indexOf(asgn) === -1) {
    if (sessions.length) {
      asgn = sessions[0];
    } else {
      asgn = createNewSession(cls, Utilities.formatDate(new Date(), TZ, "yyMMdd"));
      sessions = getTodaySessions(cls);
    }
  }

  return {
    mode:     (String(mode) === 'view') ? 'view' : 'record',
    cls:      cls,
    asgn:     asgn,
    total:    entry.total,
    cols:     entry.cols,
    seats:    loadLayout_(cls, entry.total, entry.cols),
    status:   getStatusMap(cls, asgn),
    names:    getStudents(cls),
    classes:  config.map(function (c) { return c.name; }),
    sessions: sessions
  };
}

/* ---------------------------------------------------------------- sheets */

function ss_() { return SpreadsheetApp.getActiveSpreadsheet(); }

function bootstrapSheets() {
  var ss = ss_();
  if (!ss.getSheetByName('Config')) {
    ss.insertSheet('Config')
      .appendRow(['Class', 'TotalStudents', 'Columns'])
      .appendRow(['1A', 32, 8])
      .appendRow(['2A', 30, 6]);
  }
  if (!ss.getSheetByName('Sessions')) {
    var sSh = ss.insertSheet('Sessions');
    sSh.appendRow(['Date', 'Class', 'Assignment', 'SessionID']);
    var todayStr = Utilities.formatDate(new Date(), TZ, "yyyy-MM-dd");
    sSh.appendRow([todayStr, '1A', '課堂工作紙 1 (DEMO)', 'DEMO']);
  }
  if (!ss.getSheetByName('Layout')) {
    var lSh = ss.insertSheet('Layout');
    lSh.appendRow(['Class', 'Positions']);
    var demoSeats = [];
    for (var s = 1; s <= 20; s++) demoSeats.push(s);
    while (demoSeats.length < 32) demoSeats.push('');
    lSh.appendRow(['1A', demoSeats.join(',')]);
  }
  var studSheet = ss.getSheetByName('Students');
  if (!studSheet) {
    studSheet = ss.insertSheet('Students');
    studSheet.appendRow(['Class', 'No', 'Name', 'NameZh', 'NameEn', 'Sex']);
    var demoRoster = [
      ['1A', 1, 'Chan Tai Man', '陳大文', '', 'M'],
      ['1A', 2, 'Wong Siu Ming', '黃小明', 'Michael', 'M'],
      ['1A', 3, 'Lee Ka Yan', '李嘉欣', '', 'F'],
      ['1A', 4, 'Ho Chun Kit', '何俊傑', '', 'M'],
      ['1A', 5, 'Ng Wai Lam', '吳偉霖', '', 'M'],
      ['1A', 6, 'Cheung Ho Yin', '張浩然', '', 'M'],
      ['1A', 7, 'Lam Ka Ying', '林嘉盈', '', 'F'],
      ['1A', 8, 'Tsang Chi Hang', '曾志恒', '', 'M'],
      ['1A', 9, 'Yeung Mei Ling', '楊美玲', 'Amy', 'F'],
      ['1A', 10, 'Kwok Tsz Ching', '郭子晴', '', 'F'],
      ['1A', 11, 'Au Yeung Kin', '歐陽建', '', 'M'],
      ['1A', 12, 'Poon Sze Wai', '潘思慧', '', 'F'],
      ['1A', 13, 'Chow Ka Ho', '周家豪', '', 'M'],
      ['1A', 14, 'Tam Yuen Ting', '譚婉婷', '', 'F'],
      ['1A', 15, 'Fung Chi Wai', '馮志偉', '', 'M'],
      ['1A', 16, 'So Man Kit', '蘇文杰', '', 'M'],
      ['1A', 17, 'Lau Hoi Ching', '劉凱靖', '', 'F'],
      ['1A', 18, 'Yip Ka Man', '葉家文', '', 'M'],
      ['1A', 19, 'Mak Tsz Kiu', '麥子翹', '', 'F'],
      ['1A', 20, 'Shum Wing Yan', '沈穎恩', 'Grace', 'F']
    ];
    for (var r = 0; r < demoRoster.length; r++) {
      studSheet.appendRow(demoRoster[r]);
    }
  }
}

/**
 * A class sheet must start with a header row, otherwise row 1 is invisible to
 * every "skip the header" loop below (that bug made student #N un-unmarkable
 * and duplicated its row on every second tap). Older sheets are migrated here.
 */
function ensureClassSheet_(cls) {
  var ss = ss_();
  var sh = ss.getSheetByName(cls);
  if (!sh) {
    sh = ss.insertSheet(cls);
    sh.appendRow(CLASS_HEADER);
    sh.setFrozenRows(1);
    return sh;
  }
  if (sh.getLastRow() === 0) {
    sh.appendRow(CLASS_HEADER);
    sh.setFrozenRows(1);
    return sh;
  }
  if (String(sh.getRange(1, 1).getValue()) !== CLASS_HEADER[0]) {
    sh.insertRowBefore(1);
    sh.getRange(1, 1, 1, CLASS_HEADER.length).setValues([CLASS_HEADER]);
    sh.setFrozenRows(1);
  }
  return sh;
}

function getConfig() {
  bootstrapSheets();
  var vals = ss_().getSheetByName('Config').getDataRange().getValues();
  var out  = [];
  for (var i = 1; i < vals.length; i++) {
    var name = String(vals[i][0]).trim();
    if (!name) continue;
    var total = Number(vals[i][1]) || DEFAULT_TOTAL;
    var cols  = Number(vals[i][2]) || DEFAULT_COLS;
    out.push({
      name:  name,
      total: Math.max(1, Math.min(200, total)),
      cols:  Math.max(2, Math.min(12, cols))
    });
  }
  if (!out.length) out.push({ name: '1A', total: DEFAULT_TOTAL, cols: DEFAULT_COLS });
  return out;
}

/* ---------------------------------------------------------------- layout */

function loadLayout_(cls, total, cols) {
  var vals = ss_().getSheetByName('Layout').getDataRange().getValues();
  var raw  = null;
  for (var i = 1; i < vals.length; i++) {
    if (String(vals[i][0]) === String(cls)) { raw = String(vals[i][1] === null ? '' : vals[i][1]); break; }
  }

  var arr = [];
  if (raw === null || raw === '') {
    for (var j = 0; j < total; j++) arr.push(j + 1);
  } else {
    var seen = {};
    raw.split(',').forEach(function (v) {
      var n = parseInt(String(v).trim(), 10);
      if (!n || n < 1 || n > total || seen[n]) { arr.push(null); return; }
      seen[n] = true;
      arr.push(n);
    });
  }

  // pad out to whole rows, never fewer rows than the class actually needs
  var minRows = Math.ceil(total / cols);
  var rows    = Math.min(MAX_ROWS, Math.max(minRows, Math.ceil(arr.length / cols)));
  var size    = rows * cols;
  while (arr.length < size) arr.push(null);
  arr.length = size;
  return arr;
}

function saveLayout(cls, seats) {
  var lock = LockService.getDocumentLock();
  lock.waitLock(20000);
  try {
    var sh  = ss_().getSheetByName('Layout');
    var str = (seats || []).map(function (v) {
      return (v === null || v === undefined || v === '') ? '' : String(parseInt(v, 10) || '');
    }).join(',');

    var vals = sh.getDataRange().getValues();
    var idx  = -1;
    for (var i = 1; i < vals.length; i++) {
      if (String(vals[i][0]) === String(cls)) { idx = i; break; }
    }
    if (idx > -1) sh.getRange(idx + 1, 2).setValue(str);
    else          sh.appendRow([cls, str]);
    return true;
  } finally {
    lock.releaseLock();
  }
}

/* -------------------------------------------------------------- students */

function cellStr_(v) { return (v === null || v === undefined) ? '' : String(v).trim(); }

function cleanSex_(v) {
  v = cellStr_(v).toUpperCase();
  return (v === 'M' || v === 'F') ? v : '';
}

function getStudents(cls) {
  bootstrapSheets();
  var vals = ss_().getSheetByName('Students').getDataRange().getValues();
  var out  = {};
  for (var i = 1; i < vals.length; i++) {
    if (String(vals[i][0]) !== String(cls)) continue;
    var no = parseInt(vals[i][1], 10);
    if (!no) continue;
    var name = cellStr_(vals[i][2]);
    var zh   = cellStr_(vals[i][3]);
    var en   = cellStr_(vals[i][4]);
    var sex  = cellStr_(vals[i][5]);
    if (name || zh || en) out[String(no)] = { zh: zh, name: name, en: en, sex: sex };
  }
  return out;
}

/**
 * @param {string} cls
 * @param {Array<{no:number, zh:string, name:string, en:string, sex:string}>} list  full replacement roster
 */
function saveStudents(cls, list) {
  var lock = LockService.getDocumentLock();
  lock.waitLock(20000);
  try {
    bootstrapSheets();
    var sh   = ss_().getSheetByName('Students');
    var vals = sh.getDataRange().getValues();

    var rows = [];
    for (var i = 1; i < vals.length; i++) {
      if (String(vals[i][0]).trim() !== '' && String(vals[i][0]) !== String(cls)) {
        rows.push([vals[i][0], vals[i][1], vals[i][2] || '', vals[i][3] || '', vals[i][4] || '', vals[i][5] || '']);
      }
    }
    (list || []).forEach(function (o) {
      var no   = parseInt(o && o.no, 10);
      var name = cellStr_(o && o.name);
      var zh   = cellStr_(o && o.zh);
      var en   = cellStr_(o && o.en);
      var sex  = cleanSex_(o && o.sex);
      if (no && (name || zh || en)) rows.push([cls, no, name, zh, en, sex]);
    });
    rows.sort(function (a, b) {
      if (String(a[0]) !== String(b[0])) return String(a[0]) < String(b[0]) ? -1 : 1;
      return Number(a[1]) - Number(b[1]);
    });

    if (sh.getLastRow() > 1) {
      sh.getRange(2, 1, sh.getLastRow() - 1, 6).clearContent();
    }
    if (rows.length) {
      sh.getRange(2, 1, rows.length, 6).setValues(rows);
    }
    return getStudents(cls);
  } finally {
    lock.releaseLock();
  }
}

/* ---------------------------------------------------------------- marking */

function sessionId_(asgn) {
  var m = String(asgn || '').match(/\(([^)]+)\)$/);
  return m ? m[1] : '';
}

function assignmentName_(asgn) {
  return String(asgn || '').replace(/\s*\([^)]*\)\s*$/, '');
}

function getStatusMap(cls, asgn) {
  var sh = ss_().getSheetByName(cls);
  if (!sh) return {};
  var sid = sessionId_(asgn);
  if (!sid) return {};

  var vals = sh.getDataRange().getValues();
  var map  = {};
  for (var i = 1; i < vals.length; i++) {
    if (String(vals[i][2]) !== sid) continue;
    var t = vals[i][4];
    map[String(vals[i][3])] = (t instanceof Date)
      ? Utilities.formatDate(t, TZ, "HH:mm")
      : String(t || '');
  }
  return map;
}

function getLiveStatus(cls, asgn) {
  return getStatusMap(cls, asgn);
}

function markDone(cls, asgn, n) {
  var lock = LockService.getDocumentLock();
  lock.waitLock(20000);
  try {
    var sid = sessionId_(asgn);
    if (!sid) return { status: 'error' };

    var sh   = ensureClassSheet_(cls);
    var vals = sh.getDataRange().getValues();
    for (var i = vals.length - 1; i >= 1; i--) {
      if (String(vals[i][2]) === sid && String(vals[i][3]) === String(n)) {
        sh.deleteRow(i + 1);
        return { status: 'unmarked' };
      }
    }
    var now = new Date();
    sh.appendRow([
      Utilities.formatDate(now, TZ, "yyyy-MM-dd"),
      assignmentName_(asgn),
      sid,
      Number(n),
      now
    ]);
    return { status: 'marked', time: Utilities.formatDate(now, TZ, "HH:mm") };
  } finally {
    lock.releaseLock();
  }
}

function clearCurrentSession(cls, asgn) {
  var lock = LockService.getDocumentLock();
  lock.waitLock(20000);
  try {
    var sh = ss_().getSheetByName(cls);
    if (!sh) return true;
    var sid = sessionId_(asgn);
    if (!sid) return true;

    var vals = sh.getDataRange().getValues();
    for (var i = vals.length - 1; i >= 1; i--) {
      if (String(vals[i][2]) === sid) sh.deleteRow(i + 1);
    }
    return true;
  } finally {
    lock.releaseLock();
  }
}

/* ---------------------------------------------------------------- sessions */

function getTodaySessions(cls) {
  var today = Utilities.formatDate(new Date(), TZ, "yyyy-MM-dd");
  var sh    = ss_().getSheetByName('Sessions');
  if (!sh) return [];

  var vals = sh.getDataRange().getValues();
  var out  = [];
  for (var i = 1; i < vals.length; i++) {
    var d = (vals[i][0] instanceof Date) ? Utilities.formatDate(vals[i][0], TZ, "yyyy-MM-dd") : '';
    if (d === today && String(vals[i][1]) === String(cls)) {
      out.push(vals[i][2] + " (" + vals[i][3] + ")");
    }
  }
  return out.reverse();
}

function createNewSession(cls, name) {
  bootstrapSheets();
  name = String(name || '').trim() || Utilities.formatDate(new Date(), TZ, "yyMMdd");
  var sid = Math.random().toString(36).substring(2, 6).toUpperCase();
  ss_().getSheetByName('Sessions').appendRow([new Date(), cls, name, sid]);
  return name + " (" + sid + ")";
}
