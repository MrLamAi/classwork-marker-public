/* Marker Pro - Vercel client.
   Same UI as the Apps Script build; google.script.run is replaced by fetch. */
(function () {
'use strict';

var APP_VERSION = '2.5.0';
var APP_COMMIT  = '6854ad0';

/* =============================================================== state */

var S         = null;        // bundle from /api/bundle
var mode      = 'record';    // 'record' | 'view'  (client-side only now)
var editMode  = false;
var showNames = true;
var nameMode  = 'zh';        // 'zh' | 'en' | 'both' | 'off'
var orient    = 'teacher';   // 'teacher' | 'student'

var dragging  = null;
var picked    = null;
var hist      = [];
var pending   = {};
var seatsSnapshot = null;
var pollTimer = null;
var busyN     = 0;

var rosterDraft = null;
var askHandler  = null;
var rosterEditCls = null;  // class being edited in roster/import tabs

var appModule   = 'discipline'; // 'classwork' | 'discipline' (default: discipline)
var activeStamp = 'none';       // 'none' | 'no_hw' | 'no_book' | 'sleeping' | 'talking' | 'good_perf' | 'warning'
var currentShStudent = null;    // student number currently open in studentHistoryModal
var currentShFilter  = 'all';   // 'all' | 'no_hw' | 'no_book' | 'sleeping' | 'talking' | 'good_perf' | 'warning'
var currentShHistory = [];      // cached history records of the open student

var STAMPS = {
  no_hw:     { label: '欠交功課', icon: '❌', class: 'badge-no_hw' },
  no_book:   { label: '欠帶課本', icon: '📖', class: 'badge-no_book' },
  sleeping:  { label: '課堂睡覺', icon: '😴', class: 'badge-sleeping' },
  talking:   { label: '說話分心', icon: '🗣️', class: 'badge-talking' },
  good_perf: { label: '積極答問', icon: '⭐', class: 'badge-good_perf' },
  warning:   { label: '違規警告', icon: '⚠️', class: 'badge-warning' }
};

/* Discipline preferences configuration - persisted in localStorage */
var disciplinePrefsDefaults = {
  enableFloatingBar: true,
  floatingCollapsed: false,
  floatingChips: ['no_hw', 'no_book', 'sleeping', 'talking', 'good_perf', 'warning'],
  badgeMode: 'icons', // 'icons' | 'count' | 'off'
  badgePos: 'top-right' // 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left' | 'floating-right'
};
var disciplinePrefs = loadDisciplinePrefs();

function loadDisciplinePrefs() {
  try {
    var saved = localStorage.getItem('disciplinePrefs');
    if (saved) {
      var p = JSON.parse(saved);
      return {
        enableFloatingBar: p.enableFloatingBar !== undefined ? !!p.enableFloatingBar : true,
        floatingCollapsed: !!p.floatingCollapsed,
        floatingChips: Array.isArray(p.floatingChips) ? p.floatingChips : disciplinePrefsDefaults.floatingChips,
        badgeMode: p.badgeMode || 'icons',
        badgePos: p.badgePos || 'top-right'
      };
    }
  } catch (e) {}
  return JSON.parse(JSON.stringify(disciplinePrefsDefaults));
}

function saveDisciplinePrefs() {
  try { localStorage.setItem('disciplinePrefs', JSON.stringify(disciplinePrefs)); } catch (e) {}
}

/* Tile design configuration - persisted in localStorage */
var tileDesignDefaults = {
  topleft:  { field: 'seat',    size: 10, align: 'left' },
  topright: { field: 'none',    size: 10, align: 'right' },
  main:     { field: 'classno', size: 32, align: 'center' },
  bottom:   { field: 'name',    size: 12, align: 'center' },
  time:     { field: 'time',    size: 12, align: 'center' }
};
var tileDesign = loadTileDesign();

function loadTileDesign() {
  try {
    var saved = localStorage.getItem('tileDesign');
    if (saved) {
      var d = JSON.parse(saved);
      // merge with defaults for any missing keys
      var out = {};
      for (var k in tileDesignDefaults) {
        var def = tileDesignDefaults[k];
        out[k] = {
          field: (d[k] && d[k].field !== undefined) ? d[k].field : def.field,
          size: (d[k] && d[k].size !== undefined) ? d[k].size : def.size,
          align: (d[k] && d[k].align !== undefined) ? d[k].align : (def.align || 'center')
        };
      }
      return out;
    }
  } catch (e) {}
  return JSON.parse(JSON.stringify(tileDesignDefaults));
}

function saveTileDesign() {
  try { localStorage.setItem('tileDesign', JSON.stringify(tileDesign)); } catch (e) {}
}

/* ============================================================== helpers */

function $(id) { return document.getElementById(id); }

function esc(s) {
  return String(s === null || s === undefined ? '' : s).replace(/[&<>"']/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
  });
}

function busy(on) {
  busyN = Math.max(0, busyN + (on ? 1 : -1));
  document.body.classList.toggle('busy', busyN > 0);
}

function toast(msg, kind) {
  var t = document.createElement('div');
  t.className = 'toast' + (kind ? ' ' + kind : '');
  t.textContent = msg;
  $('toasts').appendChild(t);
  setTimeout(function () { t.remove(); }, 2800);
}

function hhmm(d) {
  return ('0' + d.getHours()).slice(-2) + ':' + ('0' + d.getMinutes()).slice(-2);
}

function todayDateStr(d) {
  var dt = d || new Date();
  var y = dt.getFullYear();
  var m = ('0' + (dt.getMonth() + 1)).slice(-2);
  var day = ('0' + dt.getDate()).slice(-2);
  return y + '-' + m + '-' + day;
}

function csvCell(s) {
  var str = String(s === null || s === undefined ? '' : s);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return '"' + str.replace(/"/g, '""') + '"';
  }
  return str;
}

try {
  window.todayDateStr = todayDateStr;
  window.csvCell = csvCell;
} catch (e) {}

function studentOf(n) { return (S && S.names) ? (S.names[String(n)] || null) : null; }

/** Display name based on selected nameMode ('zh' | 'en' | 'both' | 'off'). */
function nameOf(n) {
  if (nameMode === 'off' || !showNames) return '';
  var r = studentOf(n);
  if (!r) return '';
  if (nameMode === 'zh') return r.zh || r.name || r.en || '';
  if (nameMode === 'en') return r.en || r.name || r.zh || '';
  if (nameMode === 'both') {
    var zh = r.zh || '';
    var en = r.en || (r.name !== r.zh ? r.name : '');
    if (zh && en) return zh + ' ' + en;
    return zh || en || r.name || '';
  }
  return r.name || r.zh || r.en || '';
}

function hasAnyName(r) { return !!(r && (r.zh || r.name || r.en || r.sex)); }
function doneCount() { return Object.keys(S ? S.status : {}).length; }
function rowsNow() { return S ? Math.ceil(S.seats.length / S.cols) : 0; }

function rowEmpty(r) {
  for (var i = r * S.cols; i < (r + 1) * S.cols; i++) if (S.seats[i]) return false;
  return true;
}

function eventsOf(n) {
  if (!S || !Array.isArray(S.events)) return [];
  var num = parseInt(n, 10);
  return S.events.filter(function (e) { return parseInt(e.student_no, 10) === num; });
}

function seatOf(n) {
  if (!S || !S.seats) return '';
  var idx = S.seats.indexOf(parseInt(n, 10));
  return idx >= 0 ? '#' + (idx + 1) : '';
}

/* ============================================================ api layer */

function AuthError() { this.name = 'AuthError'; this.message = 'Session expired'; }

function api(path, opts) {
  opts = opts || {};
  var quiet = opts.quiet;
  var isLogin = path.indexOf('/api/login') === 0;
  if (!quiet) busy(true);

  return fetch(path, {
    method: opts.body ? 'POST' : 'GET',
    headers: opts.body ? { 'Content-Type': 'application/json' } : undefined,
    body: opts.body ? JSON.stringify(opts.body) : undefined,
    credentials: 'same-origin'
  }).then(function (res) {
    if (res.status === 401 && !isLogin) { lock(); throw new AuthError(); }
    return res.json().catch(function () { return {}; }).then(function (data) {
      if (!res.ok) throw new Error(data.error || ('HTTP ' + res.status));
      return data;
    });
  }).finally(function () {
    if (!quiet) busy(false);
  });
}

function post(body) { return api('/api/action', { body: body }); }

function fail(err) {
  if (err && err.name === 'AuthError') return;
  toast(err && err.message ? err.message : 'Something went wrong', 'err');
}

/* ========================================================= passcode gate */

function lock() {
  document.body.classList.remove('authed');
  if (pollTimer) { clearInterval(pollTimer); pollTimer = null; }
  setTimeout(function () { $('gateInput').focus(); }, 40);
}

function unlock() {
  document.body.classList.add('authed');
  $('gateInput').value = '';
  $('gateErr').textContent = '';
}

function submitPasscode(e) {
  e.preventDefault();
  var code = $('gateInput').value;
  if (!code) return;

  $('gateBtn').disabled = true;
  $('gateErr').textContent = '';

  api('/api/login', { body: { passcode: code } })
    .then(function () {
      unlock();
      return start();
    })
    .catch(function (err) {
      $('gateErr').textContent = (err && err.message) || 'Could not sign in';
    })
    .finally(function () { $('gateBtn').disabled = false; });
}

function boot() {
  var p = new URLSearchParams(location.search);
  mode = p.get('mode') === 'view' ? 'view' : 'record';
  showNames = (mode !== 'view');

  var gf = $('gateForm');
  if (gf) gf.addEventListener('submit', submitPasscode);

  try {
    wire();
  } catch (err) {
    console.error('Error during wire():', err);
  }

  start().catch(function (err) {
    if (!(err && err.name === 'AuthError')) fail(err);
  });
}

/** Load the first bundle. A 401 drops us to the gate instead. */
function start() {
  var p = new URLSearchParams(location.search);
  var requestedCls = p.get('class') || '';
  var requestedDate = p.get('date') || '';

  // Auto-suggest class based on real-time schedule if no class param is provided
  if (!requestedCls && window.ScheduleEngine) {
    var curDate = requestedDate || todayDateStr();
    var curTime = hhmm(new Date());
    var sugg = ScheduleEngine.getSuggestedClass(curDate, curTime);
    if (sugg && sugg.suggestedClass) {
      requestedCls = sugg.suggestedClass;
    }
  }

  return load(requestedCls, p.get('assignment') || '', requestedDate);
}

function applyModeDefaults() {
  orient = (mode === 'view') ? 'student' : 'teacher';
}

function syncUrl() {
  var p = new URLSearchParams();
  if (S) {
    p.set('class', S.cls);
    if (S.asgn) p.set('assignment', S.asgn);
    if (S.date) p.set('date', S.date);
  }
  if (mode === 'view') p.set('mode', 'view');
  history.replaceState(null, '', location.pathname + '?' + p.toString());
}

function wire() {
  renderSettingsVersion();
  if ($('clsSel')) $('clsSel').addEventListener('change', function () { load(this.value, '', S ? S.date : '').catch(fail); });
  if ($('dateSel')) $('dateSel').addEventListener('change', function () { load(S.cls, '', this.value).catch(fail); });

  if ($('datePickerBtn')) {
    $('datePickerBtn').addEventListener('click', function (e) {
      e.stopPropagation();
      var menu = $('dateDropdownMenu');
      if (menu) menu.hidden = !menu.hidden;
    });
  }

  var dateDropMenu = $('dateDropdownMenu');
  if (dateDropMenu) {
    dateDropMenu.addEventListener('click', function (e) {
      var btnDate = e.target.closest('[data-jump-date]');
      if (btnDate && btnDate.dataset.jumpDate) {
        dateDropMenu.hidden = true;
        load(S.cls, '', btnDate.dataset.jumpDate).catch(fail);
        return;
      }
      var btnCls = e.target.closest('[data-jump-class]');
      if (btnCls && btnCls.dataset.jumpClass) {
        dateDropMenu.hidden = true;
        load(btnCls.dataset.jumpClass, '', S ? S.date : '').catch(fail);
        return;
      }
    });
  }

  document.addEventListener('click', function (e) {
    var wrap = $('dateFieldWrap');
    if (wrap && !wrap.contains(e.target)) {
      var menu = $('dateDropdownMenu');
      if (menu) menu.hidden = true;
    }
  });

  var schedBanner = $('scheduleNoticeBanner');
  if (schedBanner) {
    schedBanner.addEventListener('click', function (e) {
      var btnDate = e.target.closest('[data-jump-date]');
      if (btnDate && btnDate.dataset.jumpDate) {
        var targetDate = btnDate.dataset.jumpDate;
        load(S.cls, '', targetDate).catch(fail);
        return;
      }
      var btnCls = e.target.closest('[data-jump-class]');
      if (btnCls && btnCls.dataset.jumpClass) {
        var targetCls = btnCls.dataset.jumpClass;
        load(targetCls, '', S ? S.date : '').catch(fail);
        return;
      }
    });
  }

  // Check period and refresh schedule banner every 60 seconds
  setInterval(function () {
    if (document.visibilityState === 'visible' && S) {
      renderScheduleBanner();
    }
  }, 60000);

  if ($('flipBtn')) $('flipBtn').addEventListener('click', function () {
    orient = (orient === 'teacher') ? 'student' : 'teacher';
    render();
  });

  if ($('settingsBtn')) $('settingsBtn').addEventListener('click', function () {
    openSettingsModal('overview');
  });

  if ($('namesBtn')) $('namesBtn').addEventListener('click', function () {
    var cycle = { zh: 'en', en: 'both', both: 'off', off: 'zh' };
    nameMode = cycle[nameMode] || 'zh';
    showNames = (nameMode !== 'off');
    render();
  });

  if ($('layoutBtn')) $('layoutBtn').addEventListener('click', startEdit);
  if ($('confirmLessonBtn')) $('confirmLessonBtn').addEventListener('click', toggleConfirmLesson);
  if ($('clearBtn')) $('clearBtn').addEventListener('click', confirmClear);

  // LMS Module Switcher (Segmented Pill)
  if ($('modClassworkBtn')) $('modClassworkBtn').addEventListener('click', function () { switchModule('classwork'); });
  if ($('modDisciplineBtn')) $('modDisciplineBtn').addEventListener('click', function () { switchModule('discipline'); });

  // Student History Modal 1-tap buttons
  Array.prototype.forEach.call(document.querySelectorAll('[data-sh-stamp]'), function (btn) {
    btn.addEventListener('click', function () {
      if (!currentShStudent) return;
      var type = btn.dataset.shStamp;
      var label = btn.dataset.label;
      var note = $('shNoteInput') ? $('shNoteInput').value.trim() : '';
      var tile = document.querySelector('.tile[data-n="' + currentShStudent + '"]');
      recordDisciplineForStudent(currentShStudent, type, label, note, tile);
      if ($('shNoteInput')) $('shNoteInput').value = '';
    });
  });

  if ($('shToggleClassworkBtn')) {
    $('shToggleClassworkBtn').addEventListener('click', function () {
      if (!currentShStudent) return;
      markStudent(currentShStudent);
      var isDone = !!(S.status && S.status[String(currentShStudent)]);
      updateShClassworkBtn(isDone);
    });
  }

  // Student name inline edit in profile modal
  if ($('shEditNameToggleBtn')) {
    $('shEditNameToggleBtn').addEventListener('click', function () {
      if (!currentShStudent) return;
      var form = $('shEditNameForm');
      if (!form) return;
      var r = studentOf(currentShStudent);
      if ($('shEditZh')) $('shEditZh').value = (r && r.zh) || '';
      if ($('shEditEn')) $('shEditEn').value = (r && (r.en || (r.name !== r.zh ? r.name : ''))) || '';
      if ($('shEditSex')) $('shEditSex').value = (r && r.sex) || '';
      form.hidden = !form.hidden;
      if (!form.hidden && $('shEditZh')) $('shEditZh').focus();
    });
  }

  if ($('shCancelNameBtn')) {
    $('shCancelNameBtn').addEventListener('click', function () {
      if ($('shEditNameForm')) $('shEditNameForm').hidden = true;
    });
  }

  if ($('shSaveNameBtn')) {
    $('shSaveNameBtn').addEventListener('click', function () {
      if (!currentShStudent) return;
      var n = currentShStudent;
      var zh = $('shEditZh') ? $('shEditZh').value.trim() : '';
      var en = $('shEditEn') ? $('shEditEn').value.trim() : '';
      var sex = $('shEditSex') ? $('shEditSex').value.trim() : '';

      post({
        action: 'updateStudent',
        cls: S.cls,
        no: n,
        zh: zh,
        en: en,
        sex: sex
      })
        .then(function (res) {
          if (res && res.names) {
            S.names = res.names;
          } else {
            if (!S.names) S.names = {};
            S.names[String(n)] = { zh: zh, en: en, name: en || zh, sex: sex };
          }
          var r = studentOf(n);
          var nameZh = (r && r.zh) || '';
          var nameEn = (r && (r.en || r.name)) || '';
          var sexLabel = (r && r.sex) ? (r.sex === 'M' ? '男' : '女') : '';
          $('shTitle').innerHTML = esc(nameZh || ('學生 #' + n)) +
            (nameEn ? ' <span class="sh-name-en" id="shNameEn">' + esc(nameEn) + '</span>' : '');
          $('shSex').textContent = sexLabel || '未設性別';
          $('shSex').style.display = sexLabel ? 'inline-block' : 'none';
          if ($('shEditNameForm')) $('shEditNameForm').hidden = true;
          renderGrid();
          toast('學生 #' + n + ' 姓名已更新', 'ok');
        })
        .catch(fail);
    });
  }

  // Settings modal tabs
  Array.prototype.forEach.call(document.querySelectorAll('[data-settab]'), function (btn) {
    btn.addEventListener('click', function () {
      showSettingsTab(btn.dataset.settab);
    });
  });

  // Overview tab & export actions
  if ($('overviewClsSel')) {
    $('overviewClsSel').addEventListener('change', function () {
      var targetCls = this.value;
      if (targetCls && S && targetCls !== S.cls) {
        load(targetCls, '', S.date).then(function () {
          renderOverviewTab();
        }).catch(fail);
      }
    });
  }

  if ($('overviewDateSel')) {
    $('overviewDateSel').addEventListener('change', function () {
      var targetDate = this.value;
      if (targetDate && S && targetDate !== S.date) {
        load(S.cls, '', targetDate).then(function () {
          renderOverviewTab();
        }).catch(fail);
      }
    });
  }

  Array.prototype.forEach.call(document.querySelectorAll('.overview-view-pill'), function (pill) {
    pill.addEventListener('click', function () {
      overviewCurrentView = pill.dataset.view || 'daily';
      renderOverviewTab();
    });
  });

  if ($('overviewSearchInput')) {
    $('overviewSearchInput').addEventListener('input', function () {
      filterOverviewTable(this.value);
    });
  }

  if ($('copySummaryBtn')) $('copySummaryBtn').addEventListener('click', copyLogSummary);
  if ($('exportLogCsvBtn')) $('exportLogCsvBtn').addEventListener('click', openExportModal);
  if ($('exportRecordsBtn')) $('exportRecordsBtn').addEventListener('click', openExportModal);
  if ($('confirmExportBtn')) $('confirmExportBtn').addEventListener('click', performExport);
  if ($('clearDateDisciplineBtn')) $('clearDateDisciplineBtn').addEventListener('click', clearDateDiscipline);
  if ($('overviewConfirmLessonBtn')) $('overviewConfirmLessonBtn').addEventListener('click', toggleConfirmLesson);
  if ($('overviewPrevDateSel')) $('overviewPrevDateSel').addEventListener('change', function () {
    if (this.value) {
      load(S.cls, S.asgn, S.date, this.value).then(function () {
        toast('已將上一堂參考日期校正為：' + (S.previousLessonDate || '未指定'), 'ok');
      }).catch(fail);
    } else {
      load(S.cls, S.asgn, S.date, 'auto').then(function () {
        toast('已恢復系統自動推算上一堂日期', 'ok');
      }).catch(fail);
    }
  });

  // Discipline preferences tab actions
  if ($('prefEnableFloatingBar')) {
    $('prefEnableFloatingBar').addEventListener('change', function () {
      disciplinePrefs.enableFloatingBar = this.checked;
      if ($('prefFloatingChipsWrap')) $('prefFloatingChipsWrap').style.display = this.checked ? 'block' : 'none';
      saveDisciplinePrefs();
      renderFloatingStampBar();
    });
  }

  Array.prototype.forEach.call(document.querySelectorAll('.pref-chip-choice input'), function (inp) {
    inp.addEventListener('change', function () {
      var chips = [];
      Array.prototype.forEach.call(document.querySelectorAll('.pref-chip-choice input'), function (c) {
        if (c.checked) chips.push(c.value);
      });
      disciplinePrefs.floatingChips = chips;
      saveDisciplinePrefs();
      renderFloatingStampBar();
    });
  });

  Array.prototype.forEach.call(document.querySelectorAll('input[name="badgeMode"]'), function (inp) {
    inp.addEventListener('change', function () {
      if (this.checked) {
        disciplinePrefs.badgeMode = this.value;
        saveDisciplinePrefs();
        renderGrid();
      }
    });
  });

  Array.prototype.forEach.call(document.querySelectorAll('input[name="badgePos"]'), function (inp) {
    inp.addEventListener('change', function () {
      if (this.checked) {
        disciplinePrefs.badgePos = this.value;
        saveDisciplinePrefs();
        renderGrid();
      }
    });
  });

  // API tab code tabs
  Array.prototype.forEach.call(document.querySelectorAll('[data-apicode]'), function (btn) {
    btn.addEventListener('click', function () {
      var lang = btn.dataset.apicode;
      Array.prototype.forEach.call(document.querySelectorAll('[data-apicode]'), function (b) {
        b.classList.toggle('is-on', b === btn);
      });
      showApiCode(lang);
    });
  });

  if ($('apiSendTestBtn')) $('apiSendTestBtn').addEventListener('click', sendApiTestSignal);

  initFloatingToolbox();

  if ($('cancelEdit')) $('cancelEdit').addEventListener('click', cancelEdit);
  if ($('saveEdit')) $('saveEdit').addEventListener('click', saveEdit);
  Array.prototype.forEach.call(document.querySelectorAll('.tools.edit [data-act]'), function (b) {
    b.addEventListener('click', function () { layoutAction(b.dataset.act); });
  });

  var res = $('reserve');
  if (res) {
    res.addEventListener('dragover', function (e) { e.preventDefault(); res.classList.add('over'); });
    res.addEventListener('dragleave', function () { res.classList.remove('over'); });
    res.addEventListener('drop', function (e) {
      e.preventDefault(); res.classList.remove('over');
      unseat(dragging); dragging = null;
    });
    res.addEventListener('click', function (e) {
      if (picked && picked.from !== null && !e.target.closest('.tile')) { unseat(picked); picked = null; }
    });
  }

  Array.prototype.forEach.call(document.querySelectorAll('[data-close]'), function (b) {
    b.addEventListener('click', function () { closeModal(b.dataset.close); });
  });

  // Class Management actions
  function updateCapacityDisplay() {
    var tot = parseInt($('clsTotalInput').value, 10) || 0;
    var cols = parseInt($('clsColsInput').value, 10) || 1;
    var rows = parseInt($('clsRowsInput').value, 10) || 1;
    if ($('clsCapacityVal')) $('clsCapacityVal').textContent = rows * cols;
  }

  if ($('clsTotalInput')) {
    $('clsTotalInput').addEventListener('input', function () {
      var tot = parseInt(this.value, 10) || 0;
      var cols = parseInt($('clsColsInput').value, 10) || 8;
      if (cols > 0 && tot > 0) {
        $('clsRowsInput').value = Math.ceil(tot / cols);
      }
      updateCapacityDisplay();
    });
  }

  if ($('clsColsInput')) {
    $('clsColsInput').addEventListener('input', function () {
      var tot = parseInt($('clsTotalInput').value, 10) || 0;
      var cols = parseInt(this.value, 10) || 1;
      if (cols > 0 && tot > 0) {
        $('clsRowsInput').value = Math.ceil(tot / cols);
      }
      updateCapacityDisplay();
    });
  }

  if ($('clsRowsInput')) {
    $('clsRowsInput').addEventListener('input', function () {
      updateCapacityDisplay();
    });
  }

  if ($('updateClsBtn')) {
    $('updateClsBtn').addEventListener('click', function () {
      var total = parseInt($('clsTotalInput').value, 10);
      var cols = parseInt($('clsColsInput').value, 10);
      if (!total || total < 1 || !cols || cols < 2) {
        toast('學生總數或列數設定無效', 'err');
        return;
      }
      post({ action: 'updateClass', cls: S.cls, total: total, cols: cols })
        .then(function () {
          toast('班級設定已成功儲存', 'ok');
          return load(S.cls, S.asgn);
        })
        .then(function () {
          openSettingsModal('classes');
        })
        .catch(fail);
    });
  }

  if ($('toggleAddClsBoxBtn')) {
    $('toggleAddClsBoxBtn').addEventListener('click', function () {
      var box = $('addClsBox');
      if (box) {
        box.hidden = !box.hidden;
        if (!box.hidden && $('newClsName')) $('newClsName').focus();
      }
    });
  }

  if ($('addClsBtn')) {
    $('addClsBtn').addEventListener('click', function () {
      var name = $('newClsName').value.trim();
      var total = parseInt($('newClsTotal').value, 10) || 40;
      var cols = parseInt($('newClsCols').value, 10) || 8;
      if (!name) {
        toast('請輸入班別名稱', 'err');
        return;
      }
      post({ action: 'createClass', name: name, total: total, cols: cols })
        .then(function () {
          toast('班級 ' + name + ' 已建立', 'ok');
          if ($('addClsBox')) $('addClsBox').hidden = true;
          if ($('newClsName')) $('newClsName').value = '';
          return load(name, '');
        })
        .then(function () {
          openSettingsModal('classes');
        })
        .catch(fail);
    });
  }

  if ($('deleteCurClsBtn')) {
    $('deleteCurClsBtn').addEventListener('click', function () {
      var name = S.cls;
      var list = S.classList || (S.classes || []).map(function (c) { return { name: c }; });
      if (list.length <= 1) {
        toast('系統僅剩一個班級，無法刪除', 'err');
        return;
      }
      ask({
        title: '刪除班級 ' + name + '？',
        msg: '此操作將永久刪除 ' + name + ' 班的座次表、歷次作業記錄與學生名單，無法還原。確認刪除？',
        ok: '確認刪除',
        onOk: function () {
          post({ action: 'deleteClass', cls: name })
            .then(function () {
              toast('班級 ' + name + ' 已刪除', 'ok');
              return load('', '');
            })
            .then(function () {
              openSettingsModal('classes');
            })
            .catch(fail);
        }
      });
    });
  }

  // Compact quick sex setup button
  var sexBtn = $('applySexSplit');
  if (sexBtn) {
    sexBtn.addEventListener('click', function () {
      var k = parseInt($('sexSplitNo').value, 10);
      if (!k || k < 1) return;
      var order = $('sexOrderSel').value;
      var total = S._rosterTotal || S.total;
      for (var n = 1; n <= total; n++) {
        var rec = rosterDraft[n] || (rosterDraft[n] = {});
        if (order === 'boysStart') {
          rec.sex = (n < k) ? 'F' : 'M';
        } else {
          rec.sex = (n < k) ? 'M' : 'F';
        }
      }
      renderRoster();
      if (order === 'boysStart') {
        toast('性別已設定：1..' + (k - 1) + ' = F (女), ' + k + '..' + total + ' = M (男)', 'ok');
      } else {
        toast('性別已設定：1..' + (k - 1) + ' = M (男), ' + k + '..' + total + ' = F (女)', 'ok');
      }
    });
  }

  // Open import modal button (from Student List page)
  var openImpBtn = $('openImportBtn');
  if (openImpBtn) {
    openImpBtn.addEventListener('click', function () {
      var cls = rosterEditCls || S.cls;
      if ($('importTargetCls')) $('importTargetCls').textContent = cls;
      if ($('importPreview')) $('importPreview').hidden = true;
      if ($('importInfo')) $('importInfo').textContent = '';
      openModal('importModal');
      setTimeout(function () { if ($('importBox')) $('importBox').focus(); }, 60);
    });
  }

  // Apply import button in import modal footer
  var applyImpBtn = $('applyImportBtn');
  if (applyImpBtn) {
    applyImpBtn.addEventListener('click', function () {
      if (!$('importBox')) return;
      var parsed = parseRoster($('importBox').value);
      applyParsedRoster(parsed);
    });
  }

  // xClass CSV export for currently loaded class in settings
  var curExpBtn = $('exportCurXClassBtn');
  if (curExpBtn) {
    curExpBtn.addEventListener('click', function () {
      var fmt = $('xclassFmtSel') ? $('xclassFmtSel').value : 'en';
      exportXClassForClass(S.cls, fmt);
    });
  }

  // Import preview and Roster actions
  if ($('previewBtn')) $('previewBtn').addEventListener('click', previewImport);
  if ($('rosterSave')) $('rosterSave').addEventListener('click', saveRoster);
  if ($('rosterWipe')) {
    $('rosterWipe').addEventListener('click', function () {
      rosterDraft = {}; renderRoster(); toast('Names cleared - press Save list to confirm');
    });
  }

  // Class selector in roster tab
  if ($('rosterClsSel')) {
    $('rosterClsSel').addEventListener('change', function () { switchRosterClass(this.value); });
  }
  if ($('importClsSel')) {
    $('importClsSel').addEventListener('change', function () {
      if ($('rosterClsSel')) $('rosterClsSel').value = this.value;
      switchRosterClass(this.value);
    });
  }

  // Tile design field selectors
  ['tdTopLeft', 'tdTopRight', 'tdMain', 'tdBottom', 'tdTime'].forEach(function (id) {
    if ($(id)) $(id).addEventListener('change', function () { applyTileDesignFromControls(); });
  });

  Array.prototype.forEach.call(document.querySelectorAll('.td-align-btn'), function (btn) {
    btn.addEventListener('click', function () {
      var sel = document.querySelector('.td-item.td-selected');
      if (!sel) return;
      var key = sel.dataset.item;
      if (!key || !tileDesign[key]) return;
      tileDesign[key].align = btn.dataset.align || 'center';
      saveTileDesign();
      updateTileDesignPreview();
      selectTileDesignItem(key);
      render();
    });
  });

  // Tile design reset
  if ($('tdReset')) {
    $('tdReset').addEventListener('click', function () {
      tileDesign = JSON.parse(JSON.stringify(tileDesignDefaults));
      saveTileDesign();
      initTileDesignTab();
      render();
      toast('Tile design reset to default', 'ok');
    });
  }

  // Tile design preview card: click items to select + show slider
  if ($('tdPreviewCard')) {
    $('tdPreviewCard').addEventListener('click', function (e) {
      var item = e.target.closest('[data-item]');
      if (!item) return;
      selectTileDesignItem(item.dataset.item);
    });
  }

  // Tile design slider
  if ($('tdSlider')) {
    $('tdSlider').addEventListener('input', function () {
      var sel = document.querySelector('.td-item.td-selected');
      if (!sel) return;
      var key = sel.dataset.item;
      var sz = parseInt(this.value, 10);
      tileDesign[key].size = sz;
      if ($('tdSliderVal')) $('tdSliderVal').textContent = sz + 'px';
      sel.style.fontSize = sz + 'px';
      saveTileDesign();
    });
  }

  if ($('askOk')) {
    $('askOk').addEventListener('click', function () {
      var cb = askHandler; var v = $('askInput') ? $('askInput').value : '';
      closeModal('askModal'); if (cb) cb(v);
    });
  }
  if ($('askInput')) {
    $('askInput').addEventListener('keydown', function (e) { if (e.key === 'Enter') $('askOk').click(); });
  }

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') {
      if (picked) { picked = null; render(); return; }
      var openList = document.querySelectorAll('.backdrop:not([hidden])');
      if (openList.length) {
        closeModal(openList[openList.length - 1].id);
      }
    }
  });
}

/* ============================================================== loading */

function load(cls, asgn, date, prevDate) {
  if (editMode) return Promise.resolve();
  var q = new URLSearchParams();
  if (cls) q.set('class', cls);
  if (asgn) q.set('assignment', asgn);
  if (date) q.set('date', date);
  if (prevDate) q.set('prev_date', prevDate);

  return api('/api/bundle?' + q.toString()).then(function (b) {
    S = b;
    S.events = b.events || [];
    S.date = b.date || todayDateStr();
    S.previousLessonDate = b.previousLessonDate || (b.discipline && b.discipline.previousLessonDate) || null;
    S.distinctLessonDates = b.distinctLessonDates || (b.discipline && b.discipline.distinctDates) || [];
    S.isTodayConfirmed = !!b.isTodayConfirmed;
    S.discipline = b.discipline || { studentStats: {}, totalRecords: 0 };
    S.dateEvents = b.dateEvents || [];
    if (window.ScheduleEngine) {
      var schedPrev = ScheduleEngine.findPreviousScheduledLessonDate(S.cls, S.date);
      S.scheduledPreviousDate = schedPrev ? schedPrev.date : null;
      if (!S.previousLessonDate && S.scheduledPreviousDate) {
        S.previousLessonDate = S.scheduledPreviousDate;
      }
    }
    pending = {};
    unlock();
    applyModeDefaults();
    syncUrl();
    render();
    startPoll();
  });
}

function toggleConfirmLesson() {
  if (!S) return;
  var curDate = S.date || todayDateStr();
  if (S.isTodayConfirmed) {
    ask({
      title: '取消開課登記？',
      msg: '確定要取消 ' + S.cls + ' 班於 ' + curDate + ' 的開課登記嗎？',
      ok: '取消登記',
      onOk: function () {
        post({ action: 'deleteLessonDate', cls: S.cls, date: curDate })
          .then(function () {
            S.isTodayConfirmed = false;
            renderConfirmLessonBtns();
            renderOverviewTab();
            toast('已取消開課登記', 'ok');
          })
          .catch(fail);
      }
    });
  } else {
    post({ action: 'confirmLesson', cls: S.cls, date: curDate, note: '全員表現良好' })
      .then(function () {
        S.isTodayConfirmed = true;
        if (S.distinctLessonDates && S.distinctLessonDates.indexOf(curDate) < 0) {
          S.distinctLessonDates.unshift(curDate);
        }
        renderConfirmLessonBtns();
        renderOverviewTab();
        toast('✓ 已確認 ' + curDate + ' 課堂（全員表現良好，無違規記錄）', 'ok');
      })
      .catch(fail);
  }
}

function renderConfirmLessonBtns() {
  var b1 = $('confirmLessonBtn');
  var b2 = $('overviewConfirmLessonBtn');
  var isConf = !!(S && S.isTodayConfirmed);

  if (b1) {
    if (isConf) {
      b1.innerHTML = '✓ 本堂已開課（全員良好）';
      b1.classList.add('is-confirmed');
      b1.title = '點擊可取消開課登記';
    } else {
      b1.innerHTML = '🟢 本堂全員良好';
      b1.classList.remove('is-confirmed');
      b1.title = '登記當日課堂已進行（全員紀律良好，無違規記錄）';
    }
  }

  if (b2) {
    if (isConf) {
      b2.innerHTML = '✓ 本堂已開課（點擊取消）';
      b2.classList.add('is-confirmed');
    } else {
      b2.innerHTML = '🟢 確認/補記本日已開課';
      b2.classList.remove('is-confirmed');
    }
  }
}

/* =============================================================== render */

function render() {
  document.body.classList.toggle('edit-mode', editMode);
  document.body.classList.toggle('view-mode', mode === 'view' && !editMode);
  document.body.classList.toggle('orient-student', orient === 'student');
  document.body.classList.toggle('show-names', showNames);
  document.body.classList.toggle('module-discipline', appModule === 'discipline');

  renderBar();
  renderScheduleBanner();
  renderConfirmLessonBtns();
  renderGrid();
  renderReserve();
  renderFloatingStampBar();
}

function renderBar() {
  var cSel = $('clsSel'), dSel = $('dateSel');
  var curD = S.date || todayDateStr();

  // Find today's scheduled lessons
  var dayLessons = window.ScheduleEngine ? ScheduleEngine.getScheduledLessonsForDate(curD) : [];
  var classLessonMap = {};
  dayLessons.forEach(function (l) {
    if (!classLessonMap[l.class]) classLessonMap[l.class] = [];
    classLessonMap[l.class].push('P' + l.period);
  });

  cSel.innerHTML = S.classes.map(function (c) {
    var periods = classLessonMap[c] || [];
    if (periods.length === 0 && window.ScheduleEngine) {
      for (var k in classLessonMap) {
        if (ScheduleEngine.matchClass(c, k)) {
          periods = classLessonMap[k];
          break;
        }
      }
    }
    var tag = periods.length > 0 ? (' ★ (' + periods.join(',') + ')') : '';
    return '<option value="' + esc(c) + '"' + (c === S.cls ? ' selected' : '') + '>' + esc(c) + tag + '</option>';
  }).join('');

  // Populate dateSel: Today, scheduled previous date, and any distinct dates from discipline records & recent days
  var datesSet = {};
  var today = todayDateStr();
  datesSet[today] = true;
  if (S.date) datesSet[S.date] = true;
  if (S.scheduledPreviousDate) datesSet[S.scheduledPreviousDate] = true;
  if (Array.isArray(S.dateEvents)) {
    S.dateEvents.forEach(function (e) { if (e.date) datesSet[e.date] = true; });
  }
  if (Array.isArray(S.distinctLessonDates)) {
    S.distinctLessonDates.forEach(function (d) { if (d) datesSet[d] = true; });
  }
  var now = new Date();
  for (var di = 1; di <= 5; di++) {
    var past = new Date(now.getTime() - di * 86400000);
    var pStr = past.getFullYear() + '-' + String(past.getMonth() + 1).padStart(2, '0') + '-' + String(past.getDate()).padStart(2, '0');
    datesSet[pStr] = true;
  }
  var sortedDates = Object.keys(datesSet).sort().reverse();
  dSel.innerHTML = sortedDates.map(function (d) {
    var label = d;
    if (d === today) {
      label = d + '（今日）';
    } else if (d === S.scheduledPreviousDate) {
      label = d + '（排程上一堂）';
    }
    return '<option value="' + esc(d) + '"' + (d === S.date ? ' selected' : '') + '>' + esc(label) + '</option>';
  }).join('');

  if ($('datePickerText')) {
    $('datePickerText').textContent = S.date || today;
  }

  var menuItems = $('dateMenuItems');
  if (menuItems) {
    menuItems.innerHTML = sortedDates.map(function (d) {
      var label = d;
      if (d === today) {
        label = d + '（今日）';
      } else if (d === S.scheduledPreviousDate) {
        label = d + '（排程上一堂）';
      }
      var isCur = (d === S.date);
      return '<button type="button" class="date-menu-item ' + (isCur ? 'is-selected' : '') + '" data-jump-date="' + esc(d) + '">' +
        '<span class="date-item-label">' + esc(label) + '</span>' +
        (isCur ? '<span class="date-item-check">✓</span>' : '') +
      '</button>';
    }).join('');
  }

  cSel.disabled = dSel.disabled = editMode;

  updateMeter();

  $('flipBtn').innerHTML = '<span class="gl">&#8645;</span>' +
    (orient === 'teacher' ? '教師視角' : '學生視角');
  $('flipBtn').title = '目前為' + (orient === 'teacher' ? '教師視角' : '學生視角') + '。點擊翻轉 180°。';

  var has = Object.keys(S.names || {}).length > 0;
  var modeLabels = {
    zh: '姓名: 中',
    en: '姓名: En',
    both: '姓名: 中+En',
    off: '姓名: 關閉'
  };
  $('namesBtn').textContent = modeLabels[nameMode] || '姓名';
  $('namesBtn').classList.toggle('on', nameMode !== 'off');
  $('namesBtn').disabled = !has;
  $('namesBtn').title = has ? '點擊切換 中 / En / 中+En / 關閉' : '請先設定學生名單';

  $('undoBtn').disabled = hist.length === 0;

  if (editMode) {
    var seated = S.seats.filter(function (v) { return v; }).length;
    $('editHint').textContent = picked
      ? '點擊座位以放置 #' + picked.n
      : seated + ' / ' + S.total + ' 位學生已排座';
  }
}

function renderScheduleBanner() {
  var banner = $('scheduleNoticeBanner');
  var badge = $('dateNoticeBadge');
  var warnBox = $('dateMenuWarningBox');
  if (!window.ScheduleEngine || !S) return;

  var curDate = S.date || todayDateStr();
  var today = todayDateStr();
  var isToday = (curDate === today);
  var curTime = hhmm(new Date());

  var cycleInfo = ScheduleEngine.getCycleDayInfo(curDate);
  var classLessonsToday = ScheduleEngine.getScheduledLessonsForClassAndDate(S.cls, curDate);
  var allLessonsToday = ScheduleEngine.getScheduledLessonsForDate(curDate);
  var prevSched = ScheduleEngine.findPreviousScheduledLessonDate(S.cls, curDate);
  var nextSched = ScheduleEngine.findNextScheduledLessonDate(S.cls, curDate);
  var prof = ScheduleEngine.getClassProfile(S.cls);

  var periodInfo = (cycleInfo && cycleInfo.isSchoolCycleDay)
    ? ScheduleEngine.getCurrentPeriod(curTime, cycleInfo.tt)
    : null;

  if (banner) {
    banner.className = 'schedule-banner';
    banner.hidden = true; // Folded into date dropdown menu to preserve vertical screen space
  }

  var leftHtml = '';
  var rightHtml = '';
  var hasWarning = false;
  var badgeText = '';
  var badgeKind = '';

  // Case 1: Non-school cycle day (Holiday / Weekend / Special non-cycle day)
  if (!cycleInfo || !cycleInfo.isSchoolCycleDay) {
    hasWarning = true;
    badgeText = '🏫 1';
    badgeKind = 'has-warning';
    var eventDesc = (cycleInfo && cycleInfo.event) ? ('（' + esc(cycleInfo.event) + '）') : '（假期 / 非循環上課日）';
    leftHtml = '<div class="schedule-banner-left">' +
      '<span class="schedule-badge">🏫 非課堂日</span> ' +
      '<span><b>' + esc(curDate) + '</b> ' + eventDesc + '，今日無常規課堂。</span>' +
      '</div>';
  }
  // Case 2: Selected class has NO lesson today (Off-schedule / Make-up lesson)
  else if (classLessonsToday.length === 0) {
    hasWarning = true;
    badgeText = '⚠️ 1';
    badgeKind = 'has-warning';
    var cDayLabel = 'Day ' + cycleInfo.cycleDay + (cycleInfo.tt !== 'Normal' ? ' · ' + cycleInfo.tt : '');
    var regSummary = prof ? ('（' + S.cls + ' 常規為 ' + prof.summary + '）') : '';
    leftHtml = '<div class="schedule-banner-left">' +
      '<span class="schedule-badge">⚠️ 本日無此班課堂</span> ' +
      '<span>今日 <b>' + cDayLabel + '</b> 並無 <b>' + esc(S.cls) + ' 班</b>課堂' + regSummary + '。<span class="muted">若為調堂/補堂可正常登記。</span></span>' +
      '</div>';
  }
  // Case 3: Selected class HAS lesson today!
  else {
    var pList = classLessonsToday.map(function (l) {
      return '第 ' + l.period + ' 堂 (' + l.start + '–' + l.end + ')';
    }).join('、');
    var room = classLessonsToday[0].room;

    if (isToday && periodInfo && periodInfo.isCurrent) {
      var activeLessonNow = allLessonsToday.find(function (l) { return l.period === periodInfo.period; });
      var isThisClassNow = activeLessonNow && ScheduleEngine.matchClass(S.cls, activeLessonNow.class);

      if (isThisClassNow) {
        leftHtml = '<div class="schedule-banner-left">' +
          '<span class="schedule-badge">🟢 現正上課中</span> ' +
          '<span><b>' + esc(S.cls) + ' 班</b> · 第 ' + periodInfo.period + ' 堂 (' + periodInfo.start + '–' + periodInfo.end + ') · ' + room + '室' +
          ' <span class="muted">(尚餘 ' + periodInfo.minsRemaining + ' 分鐘)</span></span>' +
          '</div>';
      } else if (activeLessonNow) {
        hasWarning = true;
        badgeText = '🔔 1';
        badgeKind = 'has-info';
        leftHtml = '<div class="schedule-banner-left">' +
          '<span class="schedule-badge">🔔 目前課堂</span> ' +
          '<span>現在為第 ' + periodInfo.period + ' 堂 (' + periodInfo.start + '–' + periodInfo.end + ')：<b>' + esc(activeLessonNow.class) + ' 班</b> (' + activeLessonNow.room + '室)。</span>' +
          '<button type="button" class="sched-btn primary" data-jump-class="' + esc(activeLessonNow.class) + '">👉 切換至 ' + esc(activeLessonNow.class) + ' 班</button>' +
          '</div>';
      }
    } else {
      var cDayLabel = 'Cycle ' + cycleInfo.cycle + ' · Day ' + cycleInfo.cycleDay + (cycleInfo.tt !== 'Normal' ? ' (' + cycleInfo.tt + ')' : '');
      leftHtml = '<div class="schedule-banner-left">' +
        '<span class="schedule-badge">📅 課堂安排</span> ' +
        '<span>今日 <b>' + cDayLabel + '</b>：<b>' + esc(S.cls) + ' 班</b> 於 ' + pList + ' · ' + room + '室</span>' +
        '</div>';
    }
  }

  // Right side: Previous / Next lesson navigation
  var navItems = [];
  if (prevSched) {
    var prevText = prevSched.date + ' (' + prevSched.dayName + ' · Day ' + prevSched.cycleDay + ' · P' + prevSched.periods.join(',') + ')';
    navItems.push('<span class="sched-nav-pill">📅 <b>上一堂</b>: ' + prevText +
      ' <button type="button" class="sched-btn" data-jump-date="' + prevSched.date + '" title="切換至上一堂 (' + prevSched.date + ')">跳至上一堂</button></span>');
  } else {
    navItems.push('<span class="sched-nav-pill muted">📅 上一堂: 無更早紀錄</span>');
  }

  if (nextSched && nextSched.date !== curDate) {
    var nextText = nextSched.date + ' (' + nextSched.dayName + ' · Day ' + nextSched.cycleDay + ')';
    navItems.push('<span class="sched-nav-pill">📅 <b>下一堂</b>: ' + nextText +
      ' <button type="button" class="sched-btn" data-jump-date="' + nextSched.date + '" title="切換至下一堂 (' + nextSched.date + ')">跳至下一堂</button></span>');
  }

  rightHtml = '<div class="schedule-banner-right">' + navItems.join('') + '</div>';

  if (badge) {
    if (hasWarning && badgeText) {
      badge.hidden = false;
      badge.textContent = badgeText;
      badge.className = 'date-notice-badge ' + badgeKind;
    } else {
      badge.hidden = true;
    }
  }

  if (warnBox) {
    warnBox.innerHTML = '<div class="schedule-banner" style="margin:0;border:none">' + leftHtml + rightHtml + '</div>';
    warnBox.style.display = 'block';
  }

  if (banner) {
    banner.innerHTML = leftHtml + rightHtml;
  }
}

function updateMeter() {
  if (!S) return;
  var fill = $('meterFill');
  var doneEl = $('meterDone');
  var totalEl = $('meterTotal');

  if (appModule === 'discipline') {
    var discStudents = 0;
    var stats = (S.discipline && S.discipline.studentStats) ? S.discipline.studentStats : {};
    for (var n = 1; n <= S.total; n++) {
      var st = stats[String(n)];
      if (st && st.today_badges && st.today_badges.length > 0) discStudents++;
    }
    fill.style.width = (S.total ? (discStudents / S.total * 100) : 0) + '%';
    fill.style.background = 'linear-gradient(90deg, #f59e0b, #ef4444)';
    doneEl.textContent = discStudents;
    totalEl.textContent = '/ ' + S.total + ' 人有常規記錄';
  } else {
    var done = doneCount();
    fill.style.width = (S.total ? (done / S.total * 100) : 0) + '%';
    fill.style.background = 'linear-gradient(90deg, var(--done), #22c55e)';
    doneEl.textContent = done;
    totalEl.textContent = '/ ' + S.total + ' 完成繳交';
  }
}

function renderGrid() {
  var grid = $('grid');
  var cols = S.cols;

  if (editMode) ensureHeadroom();

  var rows = rowsNow();
  var order = [];
  for (var r = 0; r < rows; r++) order.push(r);
  if (orient === 'teacher') order.reverse();   // row 0 sits nearest the screen

  grid.innerHTML = '';
  var shown = 0;

  order.forEach(function (r) {
    if (!editMode && rowEmpty(r)) return;      // hide unused back rows when marking
    shown++;
    var idx = [];
    for (var k = 0; k < cols; k++) idx.push(r * cols + k);
    if (orient === 'student') idx.reverse();   // students see the mirror image
    idx.forEach(function (gi) { grid.appendChild(seatEl(gi)); });
  });

  grid.style.gridTemplateColumns = 'repeat(' + cols + ', minmax(0, 1fr))';
  grid.style.gridTemplateRows = 'repeat(' + Math.max(1, shown) + ', minmax(72px, 1fr))';
}

function seatEl(gi) {
  var num  = S.seats[gi];
  var seat = document.createElement('div');
  seat.className = 'seat' + (num ? '' : ' empty');
  seat.dataset.idx = gi + 1;

  if (editMode) {
    seat.addEventListener('dragover', function (e) { e.preventDefault(); seat.classList.add('over'); });
    seat.addEventListener('dragleave', function () { seat.classList.remove('over'); });
    seat.addEventListener('drop', function (e) {
      e.preventDefault(); seat.classList.remove('over');
      place(dragging, gi); dragging = null;
    });
    seat.addEventListener('click', function () { tapSeat(gi); });
  }
  if (num) seat.appendChild(tileEl(num, gi));
  return seat;
}

/**
 * Resolve a tile design field to its display value.
 * @param {string} field - field key from tileDesign (classno, seat, name, name_zh, name_en, sex, time, none)
 * @param {number} n - student class number
 * @param {number|null} from - seat grid index (null if unseated / reserve)
 */
function tileFieldValue(field, n, from) {
  if (!field || field === 'none') return '';
  if (field === 'classno') return String(n);
  if (field === 'seat') return (from !== null) ? '#' + (from + 1) : '';
  if (field === 'sex') {
    var r = studentOf(n);
    return (r && r.sex) ? (r.sex === 'M' ? '男' : '女') : '';
  }
  if (field === 'name') return nameOf(n);
  if (field === 'name_zh') {
    var r2 = studentOf(n);
    return r2 ? (r2.zh || '') : '';
  }
  if (field === 'name_en') {
    var r3 = studentOf(n);
    return r3 ? (r3.en || r3.name || '') : '';
  }
  if (field === 'time') return (S && S.status && S.status[String(n)]) ? S.status[String(n)] : '';
  return '';
}

/**
 * Tile Element - uses tileDesign config for layout.
 */
function tileEl(n, from) {
  var b = document.createElement('button');
  b.type = 'button';
  b.className = 'tile';
  b.dataset.n = n;

  var r = studentOf(n);
  if (r && r.sex && (r.zh || r.name || r.en)) {
    if (r.sex === 'M') b.classList.add('sex-m');
    else if (r.sex === 'F') b.classList.add('sex-f');
  }

  var td = tileDesign;
  var tlVal = tileFieldValue(td.topleft.field, n, from);
  var trVal = tileFieldValue(td.topright.field, n, from);
  var mainVal = tileFieldValue(td.main.field, n, from);
  var btmVal = tileFieldValue(td.bottom.field, n, from);
  var timeVal = tileFieldValue(td.time.field, n, from);
  var nm = nameOf(n);

  var html = '';
  if (tlVal) html += '<span class="t-seat" style="font-size:' + td.topleft.size + 'px;text-align:' + (td.topleft.align || 'left') + '">' + esc(tlVal) + '</span>';
  if (trVal) html += '<span class="t-seat" style="font-size:' + td.topright.size + 'px;left:auto;right:6px;text-align:' + (td.topright.align || 'right') + '">' + esc(trVal) + '</span>';
  html += '<span class="t-num" style="font-size:' + td.main.size + 'px;text-align:' + (td.main.align || 'center') + '">' + esc(mainVal) + '</span>';
  if (btmVal && showNames) html += '<span class="t-name" style="font-size:' + td.bottom.size + 'px;text-align:' + (td.bottom.align || 'center') + '">' + esc(btmVal) + '</span>';
  if (td.time && td.time.field !== 'none') {
    html += '<span class="t-time" style="font-size:' + td.time.size + 'px;text-align:' + (td.time.align || 'center') + '">' + (td.time.field === 'time' ? '' : esc(timeVal)) + '</span>';
  }

  b.innerHTML = html;

  var fullTitle = (nm ? nm + ' (#' + n + ')' : 'Student #' + n) +
    (from !== null ? ' [Seat #' + (from + 1) + ']' : '');
  b.title = fullTitle;

  if (editMode) {
    b.draggable = true;
    b.addEventListener('dragstart', function (e) {
      dragging = { n: n, from: from };
      picked = null;
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', String(n));
      setTimeout(function () { b.classList.add('ghost'); }, 0);
    });
    b.addEventListener('dragend', function () { b.classList.remove('ghost'); dragging = null; });
    if (from === null) b.addEventListener('click', function () { tapReserve(n); });
  } else if (mode === 'record') {
    b.addEventListener('click', function () {
      if (appModule === 'discipline') {
        handleDisciplineClick(n, b);
      } else {
        markStudent(n);
      }
    });
  }

  paintTile(b, n);
  return b;
}

function paintTile(b, n) {
  var key  = String(n);
  var time = S.status[key];
  b.classList.toggle('done', !!time);
  b.classList.toggle('saving', !!pending[key]);
  b.classList.toggle('picked', !!picked && picked.n === n);
  b.setAttribute('aria-pressed', time ? 'true' : 'false');
  var t = b.querySelector('.t-time');
  if (t) {
    var tdTime = (tileDesign && tileDesign.time) ? tileDesign.time.field : 'time';
    if (tdTime === 'time') {
      t.textContent = time || '';
    } else {
      var seatIdx = (b.parentElement && b.parentElement.dataset.idx) ? (parseInt(b.parentElement.dataset.idx, 10) - 1) : null;
      t.textContent = tileFieldValue(tdTime, n, seatIdx);
    }
  }

  // Render discipline event badges
  var badgeWrap = b.querySelector('.t-badges');
  if (!badgeWrap) {
    badgeWrap = document.createElement('span');
    b.appendChild(badgeWrap);
  }
  var bPos = disciplinePrefs.badgePos || 'top-right';
  badgeWrap.className = 't-badges pos-' + bPos;

  var bMode = disciplinePrefs.badgeMode || 'icons';
  if (bMode === 'off') {
    badgeWrap.innerHTML = '';
  } else {
    var studentStat = (S.discipline && S.discipline.studentStats && S.discipline.studentStats[key]) || null;
    var todayBadges = studentStat ? (studentStat.today_badges || []) : [];

    if (!todayBadges.length) {
      badgeWrap.innerHTML = '';
    } else if (bMode === 'count') {
      var infractions = 0;
      var bonus = 0;
      todayBadges.forEach(function (e) {
        if (e.type === 'good_perf') bonus++;
        else infractions++;
      });
      var html = '';
      if (infractions > 0) html += '<span class="t-badge badge-warning">⚠️ ' + infractions + '</span>';
      if (bonus > 0) html += '<span class="t-badge badge-good_perf">⭐ ' + bonus + '</span>';
      badgeWrap.innerHTML = html;
    } else {
      var counts = {};
      todayBadges.forEach(function (e) {
        counts[e.type] = (counts[e.type] || 0) + 1;
      });
      var badgesHtml = '';
      for (var tp in counts) {
        var stamp = STAMPS[tp] || { icon: '📌', class: '' };
        var badgeCls = stamp.class || ('badge-' + tp);
        badgesHtml += '<span class="t-badge ' + badgeCls + '">' + stamp.icon + (counts[tp] > 1 ? ' ' + counts[tp] : '') + '</span>';
      }
      badgeWrap.innerHTML = badgesHtml;
    }
  }
}

function repaint(n) {
  Array.prototype.forEach.call(
    document.querySelectorAll('.tile[data-n="' + n + '"]'),
    function (b) { paintTile(b, n); }
  );
  updateMeter();
}

function renderReserve() {
  if (!editMode) return;
  var box = $('reserveList');
  var seated = {};
  S.seats.forEach(function (v) { if (v) seated[v] = true; });

  box.innerHTML = '';
  var n = 0;
  for (var i = 1; i <= S.total; i++) {
    if (seated[i]) continue;
    n++;
    var seat = document.createElement('div');
    seat.className = 'seat';
    seat.appendChild(tileEl(i, null));
    box.appendChild(seat);
  }
  if (!n) box.innerHTML = '<div class="reserve-empty">Everyone has a desk.</div>';
  $('reserveCount').textContent = n;
}

/* =============================================================== marking */

function markStudent(n) {
  if (mode !== 'record' || editMode) return;

  var key  = String(n);
  var prev = S.status[key];

  if (prev) delete S.status[key];
  else S.status[key] = hhmm(new Date());

  pending[key] = true;
  repaint(n);
  if (!prev) {
    var tile = document.querySelector('.tile[data-n="' + n + '"]');
    if (tile) { tile.classList.add('just'); setTimeout(function () { tile.classList.remove('just'); }, 450); }
  }

  post({ action: 'mark', assignment: S.asgn, no: n, cls: S.cls })
    .then(function (res) {
      if (res.status === 'marked' && res.time) S.status[key] = res.time;
      else if (res.status === 'unmarked') delete S.status[key];
    })
    .catch(function (err) {
      if (prev) S.status[key] = prev; else delete S.status[key];
      if (!(err && err.name === 'AuthError')) toast('Not saved - check the connection', 'err');
    })
    .finally(function () { delete pending[key]; repaint(n); });
}

function startPoll() {
  if (pollTimer) clearInterval(pollTimer);
  pollTimer = setInterval(function () {
    if (editMode || document.hidden) return;
    if (document.querySelector('.backdrop:not([hidden])')) return;
    if (Object.keys(pending).length) return;

    var curDate = S ? (S.date || todayDateStr()) : todayDateStr();
    var q = '/api/status?assignment=' + encodeURIComponent(S.asgn) +
            '&discipline=1&cls=' + encodeURIComponent(S.cls) +
            '&date=' + encodeURIComponent(curDate);

    api(q, { quiet: true })
      .then(function (res) {
        var freshMarks = (res && res.marks) ? res.marks : res;
        var freshEvents = (res && res.events) ? res.events : null;
        var freshDisc = (res && res.discipline) ? res.discipline : null;
        var changed = false, k;
        for (k in freshMarks) {
          if (!pending[k] && S.status[k] !== freshMarks[k]) { S.status[k] = freshMarks[k]; changed = true; }
        }
        for (k in S.status) {
          if (!freshMarks[k] && !pending[k]) { delete S.status[k]; changed = true; }
        }
        if (Array.isArray(freshEvents)) {
          if (JSON.stringify(freshEvents) !== JSON.stringify(S.events || [])) {
            S.events = freshEvents;
            changed = true;
          }
        }
        if (freshDisc) {
          if (JSON.stringify(freshDisc) !== JSON.stringify(S.discipline)) {
            S.discipline = freshDisc;
            changed = true;
          }
        }
        if (changed) {
          renderGrid();
          updateMeter();
        }
      })
      .catch(function () { /* a dropped poll is not worth a toast */ });
  }, 3500);
}

function confirmClear() {
  ask({
    title: '清空作業繳交標記？',
    msg: '此操作將清除目前的所有作業完成勾選記錄。座位佈局與學生紀律表記錄不受影響。',
    ok: '清空標記',
    onOk: function () {
      post({ action: 'clear', assignment: S.asgn })
        .then(function () { S.status = {}; render(); toast('作業標記已清空', 'ok'); })
        .catch(fail);
    }
  });
}

function newAssignment() {
  var d = new Date();
  var code = String(d.getFullYear()).slice(-2) +
             ('0' + (d.getMonth() + 1)).slice(-2) +
             ('0' + d.getDate()).slice(-2);
  ask({
    title: 'New assignment',
    msg: 'Everyone starts unmarked. Today’s assignments stay in the dropdown.',
    input: code,
    ok: 'Create',
    onOk: function (name) {
      if (!name || !name.trim()) return;
      post({ action: 'session', cls: S.cls, name: name.trim() })
        .then(function (r) { return load(S.cls, r.assignment); })
        .catch(fail);
    }
  });
}

/* =========================================================== edit layout */

function startEdit() {
  editMode = true;
  picked = null;
  hist = [];
  seatsSnapshot = S.seats.slice();
  render();
}

function cancelEdit() {
  S.seats = seatsSnapshot.slice();
  editMode = false; picked = null; hist = [];
  render();
}

function saveEdit() {
  var seated = S.seats.filter(function (v) { return v; }).length;
  var finish = function () {
    post({ action: 'layout', cls: S.cls, seats: S.seats })
      .then(function () { toast('Layout saved', 'ok'); })
      .catch(function (err) {
        if (!(err && err.name === 'AuthError')) toast('Layout NOT saved - try again', 'err');
      });

    editMode = false; picked = null; hist = [];
    render();
  };

  if (seated < S.total) {
    ask({
      title: 'Save with empty places?',
      msg: (S.total - seated) + ' of ' + S.total + ' students have no desk. ' +
           'They will not appear on the plan until you seat them.',
      ok: 'Save anyway',
      onOk: finish
    });
  } else {
    finish();
  }
}

function pushHist() {
  hist.push(S.seats.slice());
  if (hist.length > 40) hist.shift();
}

/** Exactly enough desks for the class, rounded up to whole rows - never more. */
function ensureHeadroom() {
  var need = Math.ceil(S.total / S.cols) * S.cols;
  while (S.seats.length > need) S.seats.pop();
  while (S.seats.length < need) S.seats.push(null);
}

/** Move src onto seat gi. An occupied target swaps rather than overwrites. */
function place(src, gi) {
  if (!src) return;
  pushHist();
  var target = S.seats[gi] || null;
  if (src.from !== null) S.seats[src.from] = target;
  S.seats[gi] = src.n;
  picked = null;
  render();
}

function unseat(src) {
  if (!src || src.from === null) return;
  pushHist();
  S.seats[src.from] = null;
  picked = null;
  render();
}

function tapSeat(gi) {
  var occ = S.seats[gi] || null;
  if (!picked) {
    if (occ) { picked = { n: occ, from: gi }; render(); }
    return;
  }
  if (picked.from === gi) { picked = null; render(); return; }
  place(picked, gi);
}

function tapReserve(n) {
  if (picked && picked.n === n) { picked = null; render(); return; }
  picked = { n: n, from: null };
  render();
}

function layoutAction(act) {
  if (act === 'undo') {
    if (!hist.length) return;
    S.seats = hist.pop();
    picked = null;
    render();
    return;
  }

  pushHist();
  var cols = S.cols, rows = rowsNow(), r, k, i;

  if (act === 'fill') {
    var need = Math.ceil(S.total / cols) * cols;
    while (S.seats.length < need) S.seats.push(null);
    for (i = 0; i < S.seats.length; i++) S.seats[i] = (i < S.total) ? i + 1 : null;

  } else if (act === 'altmf') {
    // Alternate Boy/Girl arrangement
    var girls = [];
    var boys = [];
    var others = [];

    for (i = 1; i <= S.total; i++) {
      var rec = studentOf(i);
      var sx = rec ? (rec.sex || '') : '';
      if (sx === 'F') girls.push(i);
      else if (sx === 'M') boys.push(i);
      else others.push(i);
    }

    var interleaved = [];
    var maxLen = Math.max(girls.length, boys.length);
    for (var g = 0; g < maxLen; g++) {
      if (g < girls.length) interleaved.push(girls[g]);
      if (g < boys.length) interleaved.push(boys[g]);
    }
    others.forEach(function (num) { interleaved.push(num); });

    var needAlt = Math.ceil(S.total / cols) * cols;
    while (S.seats.length < needAlt) S.seats.push(null);
    for (i = 0; i < S.seats.length; i++) {
      S.seats[i] = (i < interleaved.length) ? interleaved[i] : null;
    }

  } else if (act === 'empty') {
    for (i = 0; i < S.seats.length; i++) S.seats[i] = null;

  } else if (act === 'mirror') {
    for (r = 0; r < rows; r++) {
      var row = S.seats.slice(r * cols, (r + 1) * cols).reverse();
      for (k = 0; k < cols; k++) S.seats[r * cols + k] = row[k];
    }

  } else if (act === 'rows') {
    var out = [];
    for (r = rows - 1; r >= 0; r--) out = out.concat(S.seats.slice(r * cols, (r + 1) * cols));
    S.seats = out;
  }

  picked = null;
  render();
}

/* ========================================================== class setup */

function openClassSetup(tab) {
  openSettingsModal(tab || 'classes');
}

function populateClsSelectors() {
  var opts = S.classes.map(function (c) {
    return '<option value="' + esc(c) + '"' + (c === rosterEditCls ? ' selected' : '') + '>' + esc(c) + '</option>';
  }).join('');
  $('rosterClsSel').innerHTML = opts;
  if ($('importClsSel')) $('importClsSel').innerHTML = opts;
}

/** Switch roster editing to a different class (fetches that class's students). */
function switchRosterClass(cls) {
  rosterEditCls = cls;
  // Keep both selectors in sync
  $('rosterClsSel').value = cls;
  if ($('importClsSel')) $('importClsSel').value = cls;

  busy(true);
  api('/api/bundle?class=' + encodeURIComponent(cls))
    .then(function (b) {
      rosterDraft = {};
      var names = b.names || {};
      for (var k in names) {
        rosterDraft[k] = Object.assign({}, names[k]);
      }
      // Update total for the roster view to match the target class
      S._rosterTotal = b.total;
      renderRoster();
      toast('Loaded roster for ' + cls);
    })
    .catch(fail)
    .finally(function () { busy(false); });
}

/* ======================================================== tile design tab */

function initTileDesignTab() {
  // Sync select elements with current tileDesign
  $('tdTopLeft').value = tileDesign.topleft.field;
  $('tdTopRight').value = tileDesign.topright.field;
  $('tdMain').value = tileDesign.main.field;
  $('tdBottom').value = tileDesign.bottom.field;
  if ($('tdTime')) $('tdTime').value = tileDesign.time.field;

  updateTileDesignPreview();
  selectTileDesignItem('main');
}

/** Read values from the select controls and apply to tileDesign. */
function applyTileDesignFromControls() {
  tileDesign.topleft.field = $('tdTopLeft').value;
  tileDesign.topright.field = $('tdTopRight').value;
  tileDesign.main.field = $('tdMain').value;
  tileDesign.bottom.field = $('tdBottom').value;
  if ($('tdTime')) tileDesign.time.field = $('tdTime').value;
  saveTileDesign();
  updateTileDesignPreview();
  render();
}

/** Refresh the preview card in the tile design tab. */
function updateTileDesignPreview() {
  // Use sample student #17 for preview
  var sampleN = 17;
  var sampleSeat = 0; // seat index 0 = seat #1
  var td = tileDesign;

  var pvItems = {
    topleft: $('tdPvTopLeft'),
    topright: $('tdPvTopRight'),
    main: $('tdPvMain'),
    bottom: $('tdPvBottom'),
    time: $('tdPvTime')
  };

  // Resolve values for each field
  var vals = {};
  for (var key in td) {
    var f = td[key].field;
    if (f === 'none') { vals[key] = ''; }
    else if (f === 'classno') { vals[key] = String(sampleN); }
    else if (f === 'seat') { vals[key] = '#' + (sampleSeat + 1); }
    else if (f === 'sex') { vals[key] = '男'; }
    else if (f === 'name' || f === 'name_zh') { vals[key] = '陳大文'; }
    else if (f === 'name_en') { vals[key] = 'Chan Tai Man'; }
    else if (f === 'time') { vals[key] = '10:32'; }
    else { vals[key] = ''; }
  }

  for (var k2 in pvItems) {
    var el = pvItems[k2];
    if (!el) continue;
    el.textContent = vals[k2];
    el.style.fontSize = td[k2].size + 'px';
    el.style.textAlign = td[k2].align || 'center';
    el.style.display = vals[k2] ? '' : 'none';
  }
}

/** Select a tile design item and show the slider. */
function selectTileDesignItem(itemKey) {
  var labels = {
    topleft: '左上角 Top-Left',
    topright: '右上角 Top-Right',
    main: '中間大字 Main',
    bottom: '底部文字 Bottom',
    time: '時間 / 補充標籤 Time'
  };

  document.querySelectorAll('.td-item').forEach(function (el) {
    el.classList.toggle('td-selected', el.dataset.item === itemKey);
  });

  // Dual highlight: sync highlight on left field group
  document.querySelectorAll('.td-field-group').forEach(function (fg) {
    fg.classList.toggle('td-field-active', fg.dataset.tditem === itemKey);
  });

  var cfg = tileDesign[itemKey];
  if (!cfg) return;

  $('tdSliderBox').hidden = false;
  $('tdSliderLabel').textContent = (labels[itemKey] || itemKey) + ' 字體大小:';
  $('tdSlider').value = cfg.size;
  $('tdSliderVal').textContent = cfg.size + 'px';

  // Highlight active alignment button
  var align = cfg.align || 'center';
  document.querySelectorAll('.td-align-btn').forEach(function (btn) {
    btn.classList.toggle('is-active', btn.dataset.align === align);
  });
}

/* ============================================================= xClass export */

var XCLASS_COORDS = {
  K3150201: { x: 259, y: 492 }, K3150202: { x: 324, y: 492 },
  K3150203: { x: 450, y: 491 }, K3150204: { x: 511, y: 491 },
  K3150205: { x: 586, y: 491 }, K3150206: { x: 654, y: 492 },
  K3150207: { x: 776, y: 487 }, K3150208: { x: 846, y: 491 },
  K3150209: { x: 267, y: 402 }, K3150210: { x: 324, y: 402 },
  K3150211: { x: 450, y: 401 }, K3150212: { x: 511, y: 401 },
  K3150213: { x: 586, y: 401 }, K3150214: { x: 654, y: 401 },
  K3150215: { x: 773, y: 408 }, K3150216: { x: 851, y: 407 },
  K3150217: { x: 263, y: 334 }, K3150218: { x: 324, y: 334 },
  K3150219: { x: 450, y: 333 }, K3150220: { x: 511, y: 333 },
  K3150221: { x: 586, y: 333 }, K3150222: { x: 654, y: 333 },
  K3150223: { x: 778, y: 328 }, K3150224: { x: 850, y: 327 },
  K3150225: { x: 256, y: 266 }, K3150226: { x: 324, y: 266 },
  K3150227: { x: 450, y: 265 }, K3150228: { x: 511, y: 265 },
  K3150229: { x: 586, y: 265 }, K3150230: { x: 654, y: 265 },
  K3150231: { x: 775, y: 258 }, K3150232: { x: 856, y: 258 },
  K3150233: { x: 257, y: 170 }, K3150234: { x: 318, y: 170 },
  K3150235: { x: 437, y: 169 }, K3150236: { x: 512, y: 169 },
  K3150237: { x: 586, y: 169 }, K3150238: { x: 654, y: 169 },
  K3150239: { x: 776, y: 168 }, K3150240: { x: 846, y: 173 }
};

var XCLASS_ORDER = [
  'K3150238', 'K3150240', 'K3150233', 'K3150228', 'K3150214', 'K3150206',
  'K3150203', 'K3150223', 'K3150224', 'K3150225', 'K3150226', 'K3150222',
  'K3150215', 'K3150217', 'K3150216', 'K3150218', 'K3150219', 'K3150220',
  'K3150221', 'K3150208', 'K3150209', 'K3150210', 'K3150211', 'K3150213',
  'K3150212', 'K3150205', 'K3150204', 'K3150207', 'K3150202', 'K3150201',
  'K3150227', 'K3150237', 'K3150230', 'K3150236', 'K3150231', 'K3150235',
  'K3150234', 'K3150229', 'K3150232', 'K3150239'
];

function generateXClassCsvContent(clsName, seats, namesMap, fmt) {
  fmt = fmt || 'en';
  var lines = [];
  lines.push('Teacher,default,,,');
  lines.push('Class,' + clsName + ',,,');
  lines.push('Computer Name,Student Name,Gender,X,Y');

  var pcStudent = {};
  for (var i = 0; i < 40; i++) {
    var pcNum = (i + 1 < 10 ? '0' : '') + (i + 1);
    var pc = 'K31502' + pcNum;
    var stNo = (seats && seats[i]) ? parseInt(seats[i], 10) : null;
    var st = (stNo && namesMap && namesMap[stNo]) ? namesMap[stNo] : null;
    pcStudent[pc] = st ? { no: stNo, data: st } : null;
  }

  for (var j = 0; j < XCLASS_ORDER.length; j++) {
    var pcName = XCLASS_ORDER[j];
    var coord = XCLASS_COORDS[pcName] || { x: 0, y: 0 };
    var item = pcStudent[pcName];
    var sName = '';
    var gender = 'M';
    if (item && item.data) {
      var d = item.data;
      var noStr = '(' + (item.no < 10 ? '0' : '') + item.no + ')';
      var hasAny = (d.name && d.name.trim()) || (d.zh && d.zh.trim());
      if (hasAny) {
        if (fmt === 'zh') {
          sName = (d.zh || d.name || '').trim() + ' ' + noStr;
        } else if (fmt === 'both') {
          var zhPart = d.zh ? (d.zh.trim() + ' ') : '';
          sName = (zhPart + (d.name || '')).trim() + ' ' + noStr;
        } else {
          sName = (d.name || d.zh || '').trim() + ' ' + noStr;
        }
        gender = d.sex || 'M';
      }
    }
    lines.push(pcName + ',' + sName + ',' + gender + ',' + coord.x + ',' + coord.y);
  }

  return '\uFEFF' + lines.join('\r\n') + '\r\n';
}

function downloadXClassCsv(clsName, seats, namesMap, fmt) {
  var content = generateXClassCsvContent(clsName, seats, namesMap, fmt);
  var blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  var url = URL.createObjectURL(blob);
  var a = document.createElement('a');
  a.href = url;
  a.download = clsName + '_xclass.csv';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  toast('已匯出 ' + clsName + ' xClass CSV', 'ok');
}

function exportXClassForClass(clsName, fmt) {
  if (clsName === S.cls) {
    downloadXClassCsv(S.cls, S.seats, S.names, fmt);
    return;
  }
  toast('載入 ' + clsName + ' 資料中...');
  if (typeof google !== 'undefined' && google.script && google.script.run) {
    google.script.run
      .withSuccessHandler(function (bundle) {
        downloadXClassCsv(bundle.cls, bundle.seats, bundle.names, fmt);
      })
      .withFailureHandler(function (err) {
        toast('載入失敗: ' + (err && err.message ? err.message : err), 'err');
      })
      .getBundle(clsName, '', 'record');
  } else {
    api('/api/bundle?class=' + encodeURIComponent(clsName))
      .then(function (bundle) {
        downloadXClassCsv(bundle.cls, bundle.seats, bundle.names, fmt);
      })
      .catch(fail);
  }
}

function renderClassMgmt() {
  var list = S.classList || (S.classes || []).map(function (c) {
    return { name: c, total: S.total, cols: S.cols };
  });

  var sideList = $('classMgmtList');
  if (sideList) {
    sideList.innerHTML = list.map(function (c) {
      var isCur = (c.name === S.cls);
      return '<div class="class-item-chip ' + (isCur ? 'is-current' : '') + '" data-switch-cls="' + esc(c.name) + '">' +
        '<span class="class-item-name">' + esc(c.name) + '</span>' +
        (isCur ? '<span class="class-item-badge">目前班級</span>' : '') +
      '</div>';
    }).join('');

    sideList.querySelectorAll('[data-switch-cls]').forEach(function (chip) {
      chip.addEventListener('click', function () {
        var targetCls = chip.dataset.switchCls;
        if (targetCls && targetCls !== S.cls) {
          load(targetCls, '').then(function () {
            openSettingsModal('classes');
            toast('已切換至 ' + targetCls + ' 班', 'ok');
          }).catch(fail);
        }
      });
    });
  }

  if ($('setupCurCls')) $('setupCurCls').textContent = S.cls;
  if ($('clsTotalInput')) $('clsTotalInput').value = S.total;
  if ($('clsColsInput')) $('clsColsInput').value = S.cols;

  var currentCols = S.cols || 8;
  var currentTotal = S.total || 40;
  var rows = Math.ceil(currentTotal / currentCols);
  if ($('clsRowsInput')) $('clsRowsInput').value = rows;
  if ($('clsCapacityVal')) $('clsCapacityVal').textContent = rows * currentCols;

  if ($('deleteCurClsBtn')) {
    $('deleteCurClsBtn').disabled = (list.length <= 1);
    $('deleteCurClsBtn').title = (list.length <= 1) ? '唯一班級不可刪除' : '刪除此班級';
  }
}

function renderClassListTable() {
  renderClassMgmt();
}

function showTab(name) {
  showSettingsTab(name);
}

function renderRoster() {
  var box = $('rosterList');
  if (!box || !S) return;
  box.innerHTML = '';
  var rosterTotal = S._rosterTotal || S.total || 40;

  if (!rosterDraft) {
    rosterDraft = {};
    for (var k in (S.names || {})) rosterDraft[k] = Object.assign({}, S.names[k]);
  }

  for (var n = 1; n <= rosterTotal; n++) {
    var rec = rosterDraft[n] || {};
    var row = document.createElement('div');
    row.className = 'rrow';
    row.draggable = false;
    row.dataset.no = n;
    row.innerHTML =
      '<span class="rgrip" aria-hidden="true" title="按住拖曳可調整學號順序">&#8942;&#8942;</span>' +
      '<span class="rno">' + n + '</span>' +
      '<input class="rname" data-f="zh" type="text" value="' + esc(rec.zh || '') + '" placeholder="中文姓名">' +
      '<input class="rname" data-f="en" type="text" value="' + esc(rec.en || rec.name || '') + '" placeholder="English Name">' +
      '<select class="rsex" data-f="sex">' +
        '<option value=""' + (rec.sex ? '' : ' selected') + '>—</option>' +
        '<option value="M"' + (rec.sex === 'M' ? ' selected' : '') + '>M (男)</option>' +
        '<option value="F"' + (rec.sex === 'F' ? ' selected' : '') + '>F (女)</option>' +
      '</select>';
    box.appendChild(row);

    // Only allow drag when grabbing the grip handle
    var grip = row.querySelector('.rgrip');
    if (grip) {
      grip.addEventListener('mousedown', function () {
        row.draggable = true;
      });
      grip.addEventListener('mouseup', function () {
        row.draggable = false;
      });
      grip.addEventListener('touchstart', function () {
        row.draggable = true;
      }, { passive: true });
      grip.addEventListener('touchend', function () {
        row.draggable = false;
      });
    }

    // Never trigger drag when clicking/highlighting inside text inputs or select
    row.querySelectorAll('input, select').forEach(function (inp) {
      inp.addEventListener('mousedown', function (e) {
        row.draggable = false;
        e.stopPropagation();
      });
    });
  }

  box.querySelectorAll('[data-f]').forEach(function (el) {
    var onFieldInput = function () {
      var row = el.closest('.rrow');
      if (!row) return;
      var no = row.dataset.no;
      var v = el.value.trim();
      var rec = rosterDraft[no] || (rosterDraft[no] = {});
      rec[el.dataset.f] = v;
      if (el.dataset.f === 'en') rec.name = v;
      if (!hasAnyName(rec)) delete rosterDraft[no];
    };
    el.addEventListener('input', onFieldInput);
    el.addEventListener('change', onFieldInput);
  });

  var dragRow = null;
  box.querySelectorAll('.rrow').forEach(function (row) {
    row.addEventListener('dragstart', function (e) {
      dragRow = Number(row.dataset.no);
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', String(dragRow));
      setTimeout(function () { row.classList.add('ghost'); }, 0);
    });
    row.addEventListener('dragend', function () {
      row.classList.remove('ghost');
      row.draggable = false;
      dragRow = null;
    });
    row.addEventListener('dragover', function (e) { e.preventDefault(); row.classList.add('over'); });
    row.addEventListener('dragleave', function () { row.classList.remove('over'); });
    row.addEventListener('drop', function (e) {
      e.preventDefault();
      row.classList.remove('over');
      row.draggable = false;
      if (dragRow) { moveRecord(dragRow, Number(row.dataset.no)); renderRoster(); }
      dragRow = null;
    });
  });
}

/** Pull the record out of slot `from` and drop it in at `to`; the rest shuffle up. */
function moveRecord(from, to) {
  var arr = [];
  for (var i = 1; i <= S.total; i++) arr.push(rosterDraft[i] || null);
  var v = arr.splice(from - 1, 1)[0];
  arr.splice(to - 1, 0, v);
  rosterDraft = {};
  arr.forEach(function (rec, i) { if (hasAnyName(rec)) rosterDraft[i + 1] = rec; });
}

/** Smart multi-format roster parser (TSV, CSV, space-separated, Chinese + English). */
function parseRoster(text) {
  var lines = String(text || '').split(/\r?\n/);
  var parsed = [];

  lines.forEach(function (rawLine) {
    var line = rawLine.trim();
    if (!line) return;

    var parts = [];
    if (line.indexOf('\t') >= 0) {
      parts = line.split('\t').map(function (s) { return s.trim(); }).filter(Boolean);
    } else if (line.indexOf(',') >= 0) {
      parts = line.split(',').map(function (s) { return s.trim(); }).filter(Boolean);
    } else {
      var m = line.match(/^(\d{1,3})[\s.,、)\]:\-]+(.*)$/);
      if (m) {
        var rest = m[2].trim();
        var tokens = rest.split(/\s{2,}|\t/).filter(Boolean);
        if (tokens.length > 1) {
          parts = [m[1]].concat(tokens);
        } else {
          parts = [m[1], rest];
        }
      } else {
        parts = [line];
      }
    }

    var no = null;
    var zh = '';
    var en = '';
    var sex = '';
    var name = '';

    // Check leading number
    var firstNum = parseInt(parts[0], 10);
    if (!isNaN(firstNum) && /^\d{1,3}$/.test(parts[0])) {
      no = firstNum;
      parts.shift();
    }

    if (parts.length === 1 && !/\t|,/.test(line)) {
      var combined = parts[0];
      var sexM = combined.match(/[\s(（]([MF男女]|[Bb]oy|[Gg]irl)[)）]?$/i) ||
                 combined.match(/\s+([MF男女]|[Bb]oy|[Gg]irl)\s*$/i);
      if (sexM) {
        var sVal = sexM[1].toUpperCase();
        if (sVal === 'M' || sVal === '男' || sVal === 'BOY') sex = 'M';
        if (sVal === 'F' || sVal === '女' || sVal === 'GIRL') sex = 'F';
        combined = combined.slice(0, combined.length - sexM[0].length).trim();
      }

      var zhMatch = combined.match(/[\u4e00-\u9fff\u3400-\u4dbf]+/g);
      if (zhMatch) {
        zh = zhMatch.join('');
        en = combined.replace(/[\u4e00-\u9fff\u3400-\u4dbf]/g, '').trim().replace(/\s+/g, ' ');
      } else {
        en = combined;
      }
    } else {
      parts.forEach(function (token) {
        var clean = token.trim();
        if (!clean) return;

        var upper = clean.toUpperCase();
        if (upper === 'M' || upper === '男' || upper === 'BOY') {
          sex = 'M';
          return;
        }
        if (upper === 'F' || upper === '女' || upper === 'GIRL') {
          sex = 'F';
          return;
        }

        var zhChars = clean.match(/[\u4e00-\u9fff\u3400-\u4dbf]+/g);
        var enChars = clean.replace(/[\u4e00-\u9fff\u3400-\u4dbf]/g, '').trim();

        if (zhChars && !enChars) {
          zh = zh ? (zh + ' ' + clean) : clean;
        } else if (enChars && !zhChars) {
          en = en ? (en + ' ' + clean) : clean;
        } else if (zhChars && enChars) {
          zh = zh ? (zh + ' ' + zhChars.join('')) : zhChars.join('');
          en = en ? (en + ' ' + enChars) : enChars;
        } else {
          if (!name) name = clean;
        }
      });
    }

    name = en || zh || name;

    parsed.push({
      no: no,
      zh: zh,
      en: en,
      name: name,
      sex: sex,
      raw: line
    });
  });

  // Assign numbers to unnumbered entries
  var numberedMap = {};
  var unnumbered = [];
  var nextNo = 1;

  parsed.forEach(function (item) {
    if (item.no && item.no >= 1 && item.no <= (S ? S.total : 100)) {
      numberedMap[item.no] = item;
    } else {
      unnumbered.push(item);
    }
  });

  unnumbered.forEach(function (item) {
    while (numberedMap[nextNo] && nextNo <= (S ? S.total : 100)) nextNo++;
    if (nextNo <= (S ? S.total : 100)) {
      item.no = nextNo;
      numberedMap[nextNo] = item;
      nextNo++;
    }
  });

  return numberedMap;
}

function previewImport() {
  var parsed = parseRoster($('importBox').value);
  var keys = Object.keys(parsed).map(Number).sort(function (a, b) { return a - b; });

  if (!keys.length) {
    $('importInfo').textContent = 'No records recognised yet.';
    $('importPreview').hidden = true;
    return;
  }

  $('importPreview').hidden = false;
  var html = '<table class="preview-table"><thead><tr>' +
    '<th>No.</th><th>中文姓名 (zh)</th><th>English Name (en)</th><th>Sex</th>' +
    '</tr></thead><tbody>';

  keys.forEach(function (n) {
    var r = parsed[n];
    html += '<tr>' +
      '<td><b>' + n + '</b></td>' +
      '<td>' + esc(r.zh || '—') + '</td>' +
      '<td>' + esc(r.en || r.name || '—') + '</td>' +
      '<td>' + esc(r.sex || '—') + '</td>' +
    '</tr>';
  });
  html += '</tbody></table>';

  $('importPreview').innerHTML = html;
  $('importInfo').innerHTML = keys.length + ' students recognised. ' +
    '<button class="tool primary" id="applyImport" style="height:26px;margin-left:8px">Use these names / 套用名單</button>';

  $('applyImport').addEventListener('click', function () {
    applyParsedRoster(parsed);
  });
}

function applyParsedRoster(parsed) {
  var keys = Object.keys(parsed || {}).map(Number).sort(function (a, b) { return a - b; });
  if (!keys.length) {
    toast('未辨識出任何學生名單 / No records recognised', 'err');
    return;
  }
  keys.forEach(function (n) {
    var item = parsed[n];
    var rec = rosterDraft[n] || (rosterDraft[n] = {});
    if (item.zh) rec.zh = item.zh;
    if (item.en) rec.en = item.en;
    if (item.name) rec.name = item.name;
    if (item.sex) rec.sex = item.sex;
  });
  renderRoster();
  closeModal('importModal');
  toast(keys.length + ' 位學生名單已套用 — 請按「儲存名單」確認', 'ok');
}

function saveRoster() {
  var saveCls = rosterEditCls || S.cls;
  var rosterTotal = S._rosterTotal || S.total;

  // Read latest input values directly from DOM to ensure any unsynced keystrokes/pastes are captured
  var box = $('rosterList');
  if (box) {
    var rows = box.querySelectorAll('.rrow');
    rows.forEach(function (row) {
      var no = row.dataset.no;
      var zhEl = row.querySelector('[data-f="zh"]');
      var enEl = row.querySelector('[data-f="en"]');
      var sexEl = row.querySelector('[data-f="sex"]');
      var zh = zhEl ? zhEl.value.trim() : '';
      var en = enEl ? enEl.value.trim() : '';
      var sex = sexEl ? sexEl.value.trim() : '';
      if (zh || en || sex) {
        rosterDraft[no] = {
          zh: zh,
          en: en,
          name: en || zh,
          sex: sex
        };
      } else {
        delete rosterDraft[no];
      }
    });
  }

  var allNos = Object.keys(rosterDraft).map(Number).filter(Boolean);
  var maxLimit = Math.max(rosterTotal, allNos.length ? Math.max.apply(null, allNos) : 0);

  var list = [];
  for (var n = 1; n <= maxLimit; n++) {
    var rec = rosterDraft[n];
    if (rec && (rec.zh || rec.name || rec.en || rec.sex)) {
      list.push({
        no: n,
        zh: rec.zh || '',
        name: rec.name || rec.en || rec.zh || '',
        en: rec.en || '',
        sex: rec.sex || ''
      });
    }
  }

  post({ action: 'students', cls: saveCls, students: list })
    .then(function (names) {
      // If we saved to the current class, update in-memory names
      if (saveCls === S.cls) {
        S.names = names || {};
      }
      closeModal('settingsModal');
      closeModal('classSetupModal');
      render();
      toast(list.length + ' 位學生名單已成功儲存至 ' + saveCls + ' 班', 'ok');
    })
    .catch(fail);
}

/* =================================================== module switcher */

function switchModule(targetMod) {
  appModule = targetMod;
  var cwBtn = $('modClassworkBtn');
  var dpBtn = $('modDisciplineBtn');
  if (cwBtn) cwBtn.classList.toggle('is-active', targetMod === 'classwork');
  if (dpBtn) dpBtn.classList.toggle('is-active', targetMod === 'discipline');

  document.body.classList.toggle('module-discipline', targetMod === 'discipline');
  updateMeter();
  renderFloatingStampBar();
  toast(targetMod === 'discipline' ? '已切換至「學生紀律」模式（點擊座位查看學生檔案）' : '已切換至「課堂作業」模式（點擊座位標記完成）');
}

/* ======================================= performance & discipline */

function handleDisciplineClick(n, tileEl) {
  if (activeStamp !== 'none' && STAMPS[activeStamp]) {
    recordDisciplineForStudent(n, activeStamp, STAMPS[activeStamp].label, '', tileEl);
  } else {
    openStudentHistoryModal(n);
  }
}

function recordDisciplineForStudent(n, type, label, note, tileEl) {
  if (!S || !n) return;
  var stampInfo = STAMPS[type] || { icon: '📌', label: label || type };
  var displayLabel = label || stampInfo.label;
  var r = studentOf(n);
  var stName = (r && (r.zh || r.name || r.en)) ? (r.zh || r.name || r.en) : ('#' + n);
  var targetTile = tileEl || document.querySelector('.tile[data-n="' + n + '"]');

  // 1. Play visual feedback animation on desk tile
  if (targetTile) {
    var fl = document.createElement('span');
    fl.className = 'float-badge';
    fl.textContent = '+1 ' + stampInfo.icon;
    targetTile.appendChild(fl);
    setTimeout(function () { fl.remove(); }, 850);
  }

  // 2. Synchronously & optimistically update local S.discipline
  var tempId = 'temp_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6);
  var curTime = hhmm(new Date());
  var key = String(n);
  if (!S.discipline) S.discipline = { studentStats: {}, totalRecords: 0 };
  if (!S.discipline.studentStats) S.discipline.studentStats = {};
  if (!S.discipline.studentStats[key]) {
    S.discipline.studentStats[key] = {
      totals: { no_hw: 0, no_book: 0, sleeping: 0, talking: 0, good_perf: 0, warning: 0, total_infractions: 0 },
      today_badges: []
    };
  }

  var stat = S.discipline.studentStats[key];
  var optimisticBadge = { id: tempId, type: type, label: displayLabel, time: curTime };
  stat.today_badges.push(optimisticBadge);
  if (type === 'good_perf') {
    stat.totals.good_perf++;
  } else {
    if (stat.totals[type] !== undefined) stat.totals[type]++;
    stat.totals.total_infractions++;
  }
  S.discipline.totalRecords++;

  // 3. Immediately repaint the tile in the DOM so icon appears instantly!
  repaint(n);

  // 4. If studentHistoryModal is open for this student, update its UI immediately
  if ($('studentHistoryModal') && !$('studentHistoryModal').hidden && currentShStudent === n) {
    var newRec = {
      id: tempId,
      date: S.date || todayDateStr(),
      time: curTime,
      type: type,
      label: displayLabel,
      note: note || ''
    };
    currentShHistory.unshift(newRec);
    renderStudentHistoryStats(n);
    renderTimelineList(currentShHistory, n);
  }

  var prevAlerts = stat.previous_alerts || {};
  var prevDate = (S.discipline && S.discipline.previousLessonDate) || S.previousLessonDate || '';
  if (prevAlerts[type] && prevDate) {
    toast('已登記 #' + n + ' ' + stName + '：' + stampInfo.icon + ' ' + displayLabel + '（⚠️ 注意：上一堂 ' + prevDate + ' 亦有此記錄！）', 'warn');
  } else {
    toast('已登記 #' + n + ' ' + stName + '：' + stampInfo.icon + ' ' + displayLabel, 'ok');
  }

  // 5. Send POST to server
  post({
    action: 'recordDiscipline',
    cls: S.cls,
    no: n,
    date: S.date,
    time: curTime,
    type: type,
    label: displayLabel,
    note: note || ''
  }).then(function (res) {
    if (res && res.record && res.record.id) {
      optimisticBadge.id = res.record.id;
      if (currentShHistory) {
        var hRec = currentShHistory.find(function (r) { return r.id === tempId; });
        if (hRec) hRec.id = res.record.id;
      }
      var delBtn = document.querySelector('[data-sh-del="' + tempId + '"]');
      if (delBtn) delBtn.dataset.shDel = res.record.id;
    }
  }).catch(function (err) {
    // Rollback on error
    var idx = stat.today_badges.findIndex(function (b) { return b.id === tempId; });
    if (idx >= 0) stat.today_badges.splice(idx, 1);
    if (type === 'good_perf') stat.totals.good_perf = Math.max(0, stat.totals.good_perf - 1);
    else {
      if (stat.totals[type] !== undefined) stat.totals[type] = Math.max(0, stat.totals[type] - 1);
      stat.totals.total_infractions = Math.max(0, stat.totals.total_infractions - 1);
    }
    if (currentShStudent === n && currentShHistory) {
      currentShHistory = currentShHistory.filter(function (r) { return r.id !== tempId; });
      renderStudentHistoryStats(n);
      renderTimelineList(currentShHistory, n);
    }
    repaint(n);
    fail(err);
  });
}

function deleteDisciplineItem(recId, n) {
  if (!S || !recId) return;
  var key = String(n);
  var stat = (S.discipline && S.discipline.studentStats && S.discipline.studentStats[key]) || null;
  var removedBadge = null;

  if (stat && stat.today_badges) {
    var idx = stat.today_badges.findIndex(function (b) { return String(b.id) === String(recId); });
    if (idx >= 0) {
      removedBadge = stat.today_badges.splice(idx, 1)[0];
      if (removedBadge.type === 'good_perf') {
        stat.totals.good_perf = Math.max(0, stat.totals.good_perf - 1);
      } else {
        if (stat.totals[removedBadge.type] !== undefined) stat.totals[removedBadge.type] = Math.max(0, stat.totals[removedBadge.type] - 1);
        stat.totals.total_infractions = Math.max(0, stat.totals.total_infractions - 1);
      }
    }
  }

  repaint(n);

  if (currentShHistory) {
    currentShHistory = currentShHistory.filter(function (r) { return String(r.id) !== String(recId); });
  }
  if (currentShStudent === n) {
    renderStudentHistoryStats(n);
    renderTimelineList(currentShHistory, n);
  }

  post({ action: 'deleteDiscipline', id: recId })
    .then(function () {
      toast('已刪除記錄', 'ok');
    })
    .catch(function (err) {
      if (removedBadge && stat) {
        stat.today_badges.push(removedBadge);
        repaint(n);
      }
      fail(err);
    });
}

/* ================================================= student history modal */

function openStudentHistoryModal(n) {
  currentShStudent = n;
  currentShFilter = 'all';
  currentShHistory = [];

  var r = studentOf(n);
  var nameZh = (r && r.zh) || '';
  var nameEn = (r && (r.en || r.name)) || '';
  var sex = (r && r.sex) ? (r.sex === 'M' ? '男' : '女') : '';

  $('shAvatar').textContent = '#' + n;
  $('shTitle').innerHTML = esc(nameZh || ('學生 #' + n)) +
    (nameEn ? ' <span class="sh-name-en" id="shNameEn">' + esc(nameEn) + '</span>' : '');
  $('shClass').textContent = S.cls + ' 班';
  $('shStudentNo').textContent = '學號 ' + n;
  $('shSeat').textContent = '座位 ' + (seatOf(n) || '未排座');
  $('shSex').textContent = sex || '未設性別';
  $('shSex').style.display = sex ? 'inline-block' : 'none';

  $('shTodayDate').textContent = S.date || todayDateStr();
  $('shNoteInput').value = '';
  if ($('shEditNameForm')) $('shEditNameForm').hidden = true;

  var isDone = !!(S.status && S.status[String(n)]);
  updateShClassworkBtn(isDone);

  // Consecutive Infraction Alert Banner (6-Day Cycle Previous Lesson)
  var banner = $('shConsecutiveBanner');
  if (banner) {
    var stat = (S.discipline && S.discipline.studentStats && S.discipline.studentStats[String(n)]) || null;
    var prevAlerts = (stat && stat.previous_alerts) || {};
    var prevDate = (S.discipline && S.discipline.previousLessonDate) || S.previousLessonDate || '';
    var alertItems = [];

    ['no_hw', 'no_book', 'sleeping', 'talking', 'warning'].forEach(function (type) {
      if (prevAlerts[type] && STAMPS[type]) {
        var streak = (stat.consecutive_streaks && stat.consecutive_streaks[type]) ? '（已連續 ' + stat.consecutive_streaks[type] + ' 堂）' : '';
        alertItems.push('【' + STAMPS[type].icon + ' ' + STAMPS[type].label + streak + '】');
      }
    });

    if (alertItems.length > 0 && prevDate) {
      banner.hidden = false;
      banner.innerHTML = '<span>⚠️</span> <div style="flex:1"><b>連續違規提醒：</b>該生上一堂（' + esc(prevDate) + '）亦有 ' + alertItems.join('、') + ' 記錄！請留意跟進。</div>' +
        '<button type="button" class="tool text-btn" id="shChangePrevDateBtn" style="font-size:11px;white-space:nowrap;padding:2px 6px" title="更換上一堂參考日期（例如某日忘帶 iPad 或全班零違規）">校對上一堂</button>';
      var changeBtn = banner.querySelector('#shChangePrevDateBtn');
      if (changeBtn) {
        changeBtn.addEventListener('click', function () {
          closeModal('studentHistoryModal');
          openSettingsModal('overview');
        });
      }
    } else {
      banner.hidden = true;
      banner.innerHTML = '';
    }
  }

  renderStudentHistoryStats(n);

  var timelineEl = $('shTimelineList');
  timelineEl.innerHTML = '<div class="muted small" style="padding:10px 0;text-align:center">載入歷史記錄中...</div>';

  post({ action: 'getStudentHistory', cls: S.cls, no: n })
    .then(function (res) {
      currentShHistory = (res && res.history) ? res.history : [];
      renderStudentHistoryStats(n);
      renderTimelineList(currentShHistory, n);
    })
    .catch(function (err) {
      timelineEl.innerHTML = '<div class="muted small" style="color:var(--danger)">載入歷史記錄失敗：' + esc(err.message || err) + '</div>';
    });

  openModal('studentHistoryModal');
}

function updateShClassworkBtn(isDone) {
  var btn = $('shToggleClassworkBtn');
  if (!btn) return;
  if (isDone) {
    btn.innerHTML = '✓ 作業已完成（點擊取消）';
    btn.style.color = 'var(--done)';
    btn.style.borderColor = 'var(--done)';
  } else {
    btn.innerHTML = '📝 標記作業完成';
    btn.style.color = '';
    btn.style.borderColor = '';
  }
}

function renderTimelineList(records, n) {
  var timelineEl = $('shTimelineList');
  if (!timelineEl) return;
  var countEl = $('shHistoryCount');
  var filterIndEl = $('shFilterIndicator');

  records = records || currentShHistory || [];

  // Filter records by currentShFilter
  var filtered = records;
  if (currentShFilter !== 'all') {
    filtered = records.filter(function (r) { return r.type === currentShFilter; });
  }

  if (countEl) countEl.textContent = filtered.length;

  if (filterIndEl) {
    if (currentShFilter === 'all') {
      filterIndEl.textContent = '';
    } else {
      var st = STAMPS[currentShFilter];
      filterIndEl.textContent = '（已篩選：' + (st ? st.icon + ' ' + st.label : currentShFilter) + '）';
    }
  }

  if (!filtered.length) {
    if (!records.length) {
      timelineEl.innerHTML = '<div class="muted small" style="padding:12px 0;text-align:center">此學生目前尚無任何紀律或表現記錄。</div>';
    } else {
      var stampLabel = STAMPS[currentShFilter] ? STAMPS[currentShFilter].label : currentShFilter;
      timelineEl.innerHTML = '<div class="muted small" style="padding:14px 0;text-align:center">此學生目前在【' + esc(stampLabel) + '】無任何記錄。<br><button type="button" class="tool text-btn" style="margin-top:6px;font-size:11px" id="shResetFilterLink">顯示全部記錄</button></div>';
      var resetLink = $('shResetFilterLink');
      if (resetLink) {
        resetLink.addEventListener('click', function () {
          currentShFilter = 'all';
          renderStudentHistoryStats(n);
          renderTimelineList(records, n);
        });
      }
    }
    return;
  }

  var byDate = {};
  var today = S.date || todayDateStr();
  filtered.forEach(function (r) {
    var d = r.date || today;
    if (!byDate[d]) byDate[d] = [];
    byDate[d].push(r);
  });

  var html = '';
  var dates = Object.keys(byDate).sort().reverse();
  dates.forEach(function (d) {
    var isToday = (d === today);
    var dateLabel = isToday ? '📅 今日 (' + d + ')' : '📅 ' + d;
    html += '<div class="sh-timeline-date-group">';
    html += '<div class="sh-timeline-date-label">' + esc(dateLabel) + '</div>';
    byDate[d].forEach(function (r) {
      var stamp = STAMPS[r.type] || { icon: '📌', class: '' };
      var badgeCls = stamp.class || ('badge-' + r.type);
      html += '<div class="sh-timeline-item" data-item-id="' + esc(r.id) + '">' +
        '<span class="sh-timeline-time">' + esc(r.time || '') + '</span>' +
        '<span class="t-badge ' + badgeCls + '">' + stamp.icon + ' ' + esc(r.label) + '</span>' +
        '<span class="sh-timeline-note">' + (r.note ? '「' + esc(r.note) + '」' : '') + '</span>' +
        '<button type="button" class="sh-timeline-del icon-btn ghost" data-sh-del="' + esc(r.id) + '" title="刪除此記錄">🗑️</button>' +
      '</div>';
    });
    html += '</div>';
  });

  timelineEl.innerHTML = html;

  Array.prototype.forEach.call(timelineEl.querySelectorAll('[data-sh-del]'), function (btn) {
    btn.addEventListener('click', function () {
      deleteDisciplineItem(btn.dataset.shDel, n);
    });
  });
}

function renderStudentHistoryStats(n) {
  var key = String(n);
  var stat = (S.discipline && S.discipline.studentStats && S.discipline.studentStats[key]) || null;
  var totals = stat ? (stat.totals || {}) : {};
  var row = $('shStatsRow');
  if (!row) return;

  var totalAll = currentShHistory.length || (totals.total_infractions || 0) + (totals.good_perf || 0);

  var items = [
    { key: 'all', label: '全部', count: totalAll, icon: '📋', cls: '' },
    { key: 'no_hw', label: '欠交功課', count: totals.no_hw || 0, icon: '❌', cls: 'badge-no_hw' },
    { key: 'no_book', label: '欠帶課本', count: totals.no_book || 0, icon: '📖', cls: 'badge-no_book' },
    { key: 'sleeping', label: '課堂睡覺', count: totals.sleeping || 0, icon: '😴', cls: 'badge-sleeping' },
    { key: 'talking', label: '說話分心', count: totals.talking || 0, icon: '🗣️', cls: 'badge-talking' },
    { key: 'good_perf', label: '積極答問', count: totals.good_perf || 0, icon: '⭐', cls: 'badge-good_perf' },
    { key: 'warning', label: '違規警告', count: totals.warning || 0, icon: '⚠️', cls: 'badge-warning' }
  ];

  row.innerHTML = items.map(function (it) {
    var isActive = (currentShFilter === it.key);
    var badgeHtml = it.cls ? ('<span class="t-badge ' + it.cls + '" style="padding:1px 5px;font-size:11px">' + it.icon + '</span> ') : (it.icon + ' ');
    return '<button type="button" class="sh-filter-pill ' + (isActive ? 'is-active' : '') + '" data-sh-filter="' + it.key + '" title="點擊篩選此類記錄">' +
      badgeHtml + esc(it.label) + ' <b>' + it.count + '</b>' +
    '</button>';
  }).join('');

  Array.prototype.forEach.call(row.querySelectorAll('[data-sh-filter]'), function (btn) {
    btn.addEventListener('click', function () {
      currentShFilter = btn.dataset.shFilter;
      renderStudentHistoryStats(n);
      renderTimelineList(currentShHistory, n);
    });
  });
}

/* ============================================== unified settings modal */

var overviewCurrentView = 'daily'; // 'daily' | 'cumulative' | 'history'

function openSettingsModal(tab) {
  if (!S) return;
  tab = tab || 'overview';
  showSettingsTab(tab);

  // Tab 1: Overview
  renderOverviewTab();

  // Tab 2: Classes
  renderClassMgmt();

  // Tab 3: Roster
  rosterEditCls = S.cls;
  S._rosterTotal = S.total;
  rosterDraft = {};
  for (var k in (S.names || {})) rosterDraft[k] = Object.assign({}, S.names[k]);
  populateClsSelectors();
  renderRoster();

  // Tab 4: Discipline preferences
  // Tab 4: Schedule & Calendar
  initScheduleTab();

  // Tab 5: Discipline preferences
  initDisciplinePrefsTab();

  // Tab 6: Tile design
  initTileDesignTab();

  // Tab 7: API
  initApiTab();

  // Render bottom-left version info
  renderSettingsVersion();

  openModal('settingsModal');
}

function showSettingsTab(tab) {
  Array.prototype.forEach.call(document.querySelectorAll('[data-settab]'), function (b) {
    b.classList.toggle('is-on', b.dataset.settab === tab);
  });
  Array.prototype.forEach.call(document.querySelectorAll('[data-setpane]'), function (p) {
    p.hidden = (p.dataset.setpane !== tab);
  });
  if (tab === 'roster') {
    if ($('rosterSave')) $('rosterSave').hidden = false;
    if ($('rosterWipe')) $('rosterWipe').hidden = false;
    renderRoster();
  } else if (tab === 'schedule') {
    renderScheduleSettingsTab();
  }
}

function renderOverviewTab() {
  if (!S) return;

  // Sync class selector
  var clsSel = $('overviewClsSel');
  if (clsSel && S.classes) {
    clsSel.innerHTML = S.classes.map(function (c) {
      return '<option value="' + esc(c) + '"' + (c === S.cls ? ' selected' : '') + '>' + esc(c) + ' 班' + (c === S.cls ? ' (目前)' : '') + '</option>';
    }).join('');
  }

  // Sync view pills
  Array.prototype.forEach.call(document.querySelectorAll('.overview-view-pill'), function (pill) {
    pill.classList.toggle('is-active', pill.dataset.view === overviewCurrentView);
  });

  var dateWrap = $('overviewDateWrap');
  var dateSel = $('overviewDateSel');
  var calibCard = $('overviewCalibrationCard');
  var tableTitle = $('overviewTableTitle');
  var thead = $('logSummaryThead');
  var tbody = $('logSummaryTbody');
  var statsGrid = $('overviewStatsGrid');

  var stats = (S.discipline && S.discipline.studentStats) ? S.discipline.studentStats : {};
  var totalStudents = S.total;
  var curD = S.date || todayDateStr();

  // 1. Daily View (當日課堂日誌)
  if (overviewCurrentView === 'daily') {
    if (dateWrap) dateWrap.style.display = 'flex';
    if (calibCard) calibCard.style.display = 'flex';

    if (dateSel) {
      var datesSet = {};
      datesSet[todayDateStr()] = true;
      if (S.date) datesSet[S.date] = true;
      if (S.scheduledPreviousDate) datesSet[S.scheduledPreviousDate] = true;
      if (Array.isArray(S.distinctLessonDates)) {
        S.distinctLessonDates.forEach(function (d) { if (d) datesSet[d] = true; });
      }
      var sortedDates = Object.keys(datesSet).sort().reverse();
      dateSel.innerHTML = sortedDates.map(function (d) {
        var label = d + (d === todayDateStr() ? '（今日）' : '');
        return '<option value="' + esc(d) + '"' + (d === curD ? ' selected' : '') + '>' + esc(label) + '</option>';
      }).join('');
    }

    if (tableTitle) tableTitle.textContent = S.cls + ' 班 · ' + curD + ' 學生堂班紀錄一覽';

    var counts = {
      no_hw: 0,
      no_book: 0,
      sleeping: 0,
      talking: 0,
      good_perf: 0,
      warning: 0,
      classworkDone: doneCount()
    };

    var totalDateRecords = 0;
    for (var n = 1; n <= totalStudents; n++) {
      var st = stats[String(n)];
      if (st && st.today_badges) {
        st.today_badges.forEach(function (b) {
          totalDateRecords++;
          if (counts[b.type] !== undefined) counts[b.type]++;
        });
      }
    }

    statsGrid.innerHTML =
      '<div class="overview-stat-card">' +
        '<span class="overview-stat-label">當日總記錄</span>' +
        '<span class="overview-stat-val" style="color:var(--brand)">' + totalDateRecords + '</span>' +
      '</div>' +
      '<div class="overview-stat-card">' +
        '<span class="overview-stat-label">❌ 欠交功課</span>' +
        '<span class="overview-stat-val" style="color:#991b1b">' + counts.no_hw + '</span>' +
      '</div>' +
      '<div class="overview-stat-card">' +
        '<span class="overview-stat-label">📖 欠帶課本</span>' +
        '<span class="overview-stat-val" style="color:#9a3412">' + counts.no_book + '</span>' +
      '</div>' +
      '<div class="overview-stat-card">' +
        '<span class="overview-stat-label">😴 課堂睡覺</span>' +
        '<span class="overview-stat-val" style="color:#6b21a8">' + counts.sleeping + '</span>' +
      '</div>' +
      '<div class="overview-stat-card">' +
        '<span class="overview-stat-label">🗣️ 說話分心</span>' +
        '<span class="overview-stat-val" style="color:#854d0e">' + counts.talking + '</span>' +
      '</div>' +
      '<div class="overview-stat-card">' +
        '<span class="overview-stat-label">⭐ 積極答問</span>' +
        '<span class="overview-stat-val" style="color:#166534">' + counts.good_perf + '</span>' +
      '</div>' +
      '<div class="overview-stat-card">' +
        '<span class="overview-stat-label">⚠️ 違規警告</span>' +
        '<span class="overview-stat-val" style="color:#9f1239">' + counts.warning + '</span>' +
      '</div>' +
      '<div class="overview-stat-card">' +
        '<span class="overview-stat-label">📝 課堂作業完成</span>' +
        '<span class="overview-stat-val" style="color:var(--done)">' + counts.classworkDone + ' / ' + totalStudents + '</span>' +
      '</div>';

    if (thead) {
      thead.innerHTML = '<tr>' +
        '<th style="width:48px">學號</th>' +
        '<th>姓名</th>' +
        '<th style="width:75px">欠交功課</th>' +
        '<th style="width:75px">欠帶課本</th>' +
        '<th style="width:75px">課堂睡覺</th>' +
        '<th style="width:75px">說話分心</th>' +
        '<th style="width:75px">積極答問</th>' +
        '<th style="width:75px">違規警告</th>' +
        '<th style="width:140px">課堂作業完成</th>' +
      '</tr>';
    }

    var rowsHtml = '';
    for (var i = 1; i <= totalStudents; i++) {
      var st2 = stats[String(i)];
      var badges = st2 ? (st2.today_badges || []) : [];
      var c = { no_hw: 0, no_book: 0, sleeping: 0, talking: 0, good_perf: 0, warning: 0 };
      badges.forEach(function (b) { if (c[b.type] !== undefined) c[b.type]++; });

      var isDone = !!(S.status && S.status[String(i)]);
      var r = studentOf(i);
      var zh = (r && r.zh) || '';
      var en = (r && (r.en || r.name)) || '';
      var nameDisp = zh ? (zh + (en ? ' ' + en : '')) : (en || ('學生 #' + i));

      rowsHtml += '<tr>' +
        '<td><b>' + i + '</b></td>' +
        '<td>' + esc(nameDisp) + '</td>' +
        '<td>' + (c.no_hw ? '<span class="t-badge badge-no_hw">' + c.no_hw + '</span>' : '-') + '</td>' +
        '<td>' + (c.no_book ? '<span class="t-badge badge-no_book">' + c.no_book + '</span>' : '-') + '</td>' +
        '<td>' + (c.sleeping ? '<span class="t-badge badge-sleeping">' + c.sleeping + '</span>' : '-') + '</td>' +
        '<td>' + (c.talking ? '<span class="t-badge badge-talking">' + c.talking + '</span>' : '-') + '</td>' +
        '<td>' + (c.good_perf ? '<span class="t-badge badge-good_perf">+' + c.good_perf + '</span>' : '-') + '</td>' +
        '<td>' + (c.warning ? '<span class="t-badge badge-warning">' + c.warning + '</span>' : '-') + '</td>' +
        '<td>' + (isDone ? '<span style="color:var(--done);font-weight:700">✓ 已完成 (' + esc(S.status[String(i)]) + ')</span>' : '<span class="muted">未繳交</span>') + '</td>' +
      '</tr>';
    }
    tbody.innerHTML = rowsHtml;

    var prevSel = $('overviewPrevDateSel');
    if (prevSel) {
      var curPrev = S.previousLessonDate || '';
      var distinct = (S.distinctLessonDates || []).filter(function (d) { return d < curD; });
      var phtml = '<option value="">' + (curPrev ? ('自動推算: ' + curPrev) : '（無更早課堂記錄）') + '</option>';
      if (S.scheduledPreviousDate && !distinct.includes(S.scheduledPreviousDate)) {
        phtml += '<option value="' + esc(S.scheduledPreviousDate) + '"' + (S.scheduledPreviousDate === curPrev ? ' selected' : '') + '>曆法排程上一堂: ' + esc(S.scheduledPreviousDate) + '</option>';
      }
      distinct.forEach(function (d) {
        var isSched = (d === S.scheduledPreviousDate);
        phtml += '<option value="' + esc(d) + '"' + (d === curPrev ? ' selected' : '') + '>' + esc(d) + (isSched ? ' (曆法排程上一堂)' : '') + '</option>';
      });
      prevSel.innerHTML = phtml;
    }
  }
  // 2. Cumulative View (學期全期累計)
  else if (overviewCurrentView === 'cumulative') {
    if (dateWrap) dateWrap.style.display = 'none';
    if (calibCard) calibCard.style.display = 'none';

    if (tableTitle) tableTitle.textContent = S.cls + ' 班 · 學期全期學生紀律表現累計統計';

    var cumCounts = {
      no_hw: 0,
      no_book: 0,
      sleeping: 0,
      talking: 0,
      good_perf: 0,
      warning: 0,
      total_infractions: 0
    };

    for (var sn = 1; sn <= totalStudents; sn++) {
      var sst = stats[String(sn)];
      var tot = (sst && sst.totals) || {};
      cumCounts.no_hw += (tot.no_hw || 0);
      cumCounts.no_book += (tot.no_book || 0);
      cumCounts.sleeping += (tot.sleeping || 0);
      cumCounts.talking += (tot.talking || 0);
      cumCounts.good_perf += (tot.good_perf || 0);
      cumCounts.warning += (tot.warning || 0);
      cumCounts.total_infractions += (tot.total_infractions || 0);
    }

    var numLessons = (S.distinctLessonDates || []).length;

    statsGrid.innerHTML =
      '<div class="overview-stat-card">' +
        '<span class="overview-stat-label">全期總違規人次</span>' +
        '<span class="overview-stat-val" style="color:var(--danger)">' + cumCounts.total_infractions + '</span>' +
      '</div>' +
      '<div class="overview-stat-card">' +
        '<span class="overview-stat-label">❌ 欠交功課累計</span>' +
        '<span class="overview-stat-val" style="color:#991b1b">' + cumCounts.no_hw + '</span>' +
      '</div>' +
      '<div class="overview-stat-card">' +
        '<span class="overview-stat-label">📖 欠帶課本累計</span>' +
        '<span class="overview-stat-val" style="color:#9a3412">' + cumCounts.no_book + '</span>' +
      '</div>' +
      '<div class="overview-stat-card">' +
        '<span class="overview-stat-label">😴 課堂睡覺累計</span>' +
        '<span class="overview-stat-val" style="color:#6b21a8">' + cumCounts.sleeping + '</span>' +
      '</div>' +
      '<div class="overview-stat-card">' +
        '<span class="overview-stat-label">🗣️ 說話分心累計</span>' +
        '<span class="overview-stat-val" style="color:#854d0e">' + cumCounts.talking + '</span>' +
      '</div>' +
      '<div class="overview-stat-card">' +
        '<span class="overview-stat-label">⭐ 積極答問累計</span>' +
        '<span class="overview-stat-val" style="color:#166534">' + cumCounts.good_perf + '</span>' +
      '</div>' +
      '<div class="overview-stat-card">' +
        '<span class="overview-stat-label">⚠️ 違規警告累計</span>' +
        '<span class="overview-stat-val" style="color:#9f1239">' + cumCounts.warning + '</span>' +
      '</div>' +
      '<div class="overview-stat-card">' +
        '<span class="overview-stat-label">📅 累計開課堂數</span>' +
        '<span class="overview-stat-val" style="color:var(--brand)">' + numLessons + ' 堂</span>' +
      '</div>';

    if (thead) {
      thead.innerHTML = '<tr>' +
        '<th style="width:48px">學號</th>' +
        '<th>姓名</th>' +
        '<th style="width:80px">欠交累計</th>' +
        '<th style="width:80px">欠帶累計</th>' +
        '<th style="width:80px">睡覺累計</th>' +
        '<th style="width:80px">說話累計</th>' +
        '<th style="width:80px">積極累計</th>' +
        '<th style="width:80px">違規警告</th>' +
        '<th style="width:90px">總違規次數</th>' +
      '</tr>';
    }

    var cumRows = '';
    for (var j = 1; j <= totalStudents; j++) {
      var sst2 = stats[String(j)];
      var t = (sst2 && sst2.totals) || { no_hw: 0, no_book: 0, sleeping: 0, talking: 0, good_perf: 0, warning: 0, total_infractions: 0 };
      var r2 = studentOf(j);
      var zh2 = (r2 && r2.zh) || '';
      var en2 = (r2 && (r2.en || r2.name)) || '';
      var nameDisp2 = zh2 ? (zh2 + (en2 ? ' ' + en2 : '')) : (en2 || ('學生 #' + j));

      cumRows += '<tr>' +
        '<td><b>' + j + '</b></td>' +
        '<td>' + esc(nameDisp2) + '</td>' +
        '<td>' + (t.no_hw ? '<span class="t-badge badge-no_hw">' + t.no_hw + '</span>' : '-') + '</td>' +
        '<td>' + (t.no_book ? '<span class="t-badge badge-no_book">' + t.no_book + '</span>' : '-') + '</td>' +
        '<td>' + (t.sleeping ? '<span class="t-badge badge-sleeping">' + t.sleeping + '</span>' : '-') + '</td>' +
        '<td>' + (t.talking ? '<span class="t-badge badge-talking">' + t.talking + '</span>' : '-') + '</td>' +
        '<td>' + (t.good_perf ? '<span class="t-badge badge-good_perf">+' + t.good_perf + '</span>' : '-') + '</td>' +
        '<td>' + (t.warning ? '<span class="t-badge badge-warning">' + t.warning + '</span>' : '-') + '</td>' +
        '<td>' + (t.total_infractions ? '<b style="color:#dc2626">' + t.total_infractions + ' 次</b>' : '<span class="muted">0</span>') + '</td>' +
      '</tr>';
    }
    tbody.innerHTML = cumRows;
  }
  // 3. History View (歷次開課日誌)
  else if (overviewCurrentView === 'history') {
    if (dateWrap) dateWrap.style.display = 'none';
    if (calibCard) calibCard.style.display = 'none';

    if (tableTitle) tableTitle.textContent = S.cls + ' 班 · 歷次開課日誌時序清單';

    var lessonDates = S.distinctLessonDates || [];
    var totalRecs = (S.discipline && S.discipline.totalRecords) || 0;

    statsGrid.innerHTML =
      '<div class="overview-stat-card">' +
        '<span class="overview-stat-label">累計開課堂數</span>' +
        '<span class="overview-stat-val" style="color:var(--brand)">' + lessonDates.length + ' 堂</span>' +
      '</div>' +
      '<div class="overview-stat-card">' +
        '<span class="overview-stat-label">紀律表記錄總數</span>' +
        '<span class="overview-stat-val" style="color:var(--text)">' + totalRecs + ' 則</span>' +
      '</div>' +
      '<div class="overview-stat-card">' +
        '<span class="overview-stat-label">最近一次開課</span>' +
        '<span class="overview-stat-val" style="color:#166534;font-size:16px">' + (lessonDates[0] || '無') + '</span>' +
      '</div>' +
      '<div class="overview-stat-card">' +
        '<span class="overview-stat-label">曆法排程上一堂</span>' +
        '<span class="overview-stat-val" style="color:#2563eb;font-size:16px">' + (S.scheduledPreviousDate || '無') + '</span>' +
      '</div>';

    if (thead) {
      thead.innerHTML = '<tr>' +
        '<th style="width:130px">開課日期</th>' +
        '<th>週期與課堂資訊</th>' +
        '<th style="width:100px">狀態</th>' +
        '<th style="width:100px">操作</th>' +
      '</tr>';
    }

    if (!lessonDates.length) {
      tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;padding:16px" class="muted">目前尚無歷次開課紀錄</td></tr>';
    } else {
      var histRows = '';
      lessonDates.forEach(function (ld) {
        var cycleInfo = window.ScheduleEngine ? ScheduleEngine.getCycleDayInfo(ld) : null;
        var cycleText = (cycleInfo && cycleInfo.isSchoolCycleDay)
          ? ('Day ' + cycleInfo.cycleDay + (cycleInfo.tt !== 'Normal' ? ' · ' + cycleInfo.tt : ''))
          : '課堂紀錄';
        var isCurrent = (ld === curD);

        histRows += '<tr>' +
          '<td><b>' + esc(ld) + '</b>' + (isCurrent ? ' <span class="cls-tag" style="background:#22c55e;color:#fff;font-size:10px;padding:1px 4px;border-radius:4px">目前檢視</span>' : '') + '</td>' +
          '<td>' + esc(cycleText) + '</td>' +
          '<td><span style="color:var(--done);font-weight:600">✓ 有紀錄</span></td>' +
          '<td><button type="button" class="tool small-tool" data-hist-view-date="' + esc(ld) + '">🔍 檢視當日</button></td>' +
        '</tr>';
      });
      tbody.innerHTML = histRows;

      tbody.querySelectorAll('[data-hist-view-date]').forEach(function (btn) {
        btn.addEventListener('click', function () {
          var targetDate = btn.dataset.histViewDate;
          overviewCurrentView = 'daily';
          load(S.cls, '', targetDate).then(function () {
            renderOverviewTab();
          }).catch(fail);
        });
      });
    }
  }

  // If search query is already entered, apply filter
  if ($('overviewSearchInput') && ($('overviewSearchInput').value || '').trim()) {
    filterOverviewTable($('overviewSearchInput').value);
  }

  renderConfirmLessonBtns();
}

function filterOverviewTable(query) {
  var q = (query || '').trim().toLowerCase();
  var tbody = $('logSummaryTbody');
  if (!tbody) return;
  var rows = tbody.querySelectorAll('tr');
  rows.forEach(function (tr) {
    if (tr.querySelector('td[colspan]')) return;
    var text = tr.textContent.toLowerCase();
    tr.style.display = (!q || text.indexOf(q) >= 0) ? '' : 'none';
  });
}

function copyLogSummary() {
  if (!S) return;
  var curDate = S.date || todayDateStr();
  var stats = (S.discipline && S.discipline.studentStats) ? S.discipline.studentStats : {};
  var totalStudents = S.total;

  var text = '【' + S.cls + ' 班堂班概況日誌】\n' +
    '日期：' + curDate + '\n' +
    '課堂作業完成：' + doneCount() + ' / ' + totalStudents + ' 人\n' +
    '---------------------------------\n' +
    '學生紀律與常規表現記錄：\n';

  var hasAny = false;
  for (var n = 1; n <= totalStudents; n++) {
    var st = stats[String(n)];
    var badges = st ? (st.today_badges || []) : [];
    if (badges.length > 0) {
      hasAny = true;
      var r = studentOf(n);
      var name = (r && (r.zh || r.name)) ? (r.zh || r.name) : ('學生 #' + n);
      var badgeStr = badges.map(function (b) {
        var s = STAMPS[b.type] || { icon: '' };
        return s.icon + ' ' + b.label + (b.time ? ' (' + b.time + ')' : '');
      }).join('、');
      text += '#' + n + ' ' + name + '：' + badgeStr + '\n';
    }
  }

  if (!hasAny) {
    text += '（全班當日表現良好，無違規記錄）\n';
  }

  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).then(function () {
      toast('堂班概況摘要已複製到剪貼簿', 'ok');
    }).catch(function () {
      prompt('請手動複製摘要：', text);
    });
  } else {
    prompt('請手動複製摘要：', text);
  }
}

var DISCIPLINE_TYPE_LABELS = {
  no_hw: '欠交功課',
  no_book: '欠帶課本',
  sleeping: '課堂睡覺',
  talking: '說話分心',
  good_perf: '積極答問',
  warning: '違規警告'
};

function openExportModal() {
  if (!S) return;
  var curDate = S.date || todayDateStr();
  if ($('exportClsBadge')) $('exportClsBadge').textContent = S.cls;
  if ($('exportDateBadge')) $('exportDateBadge').textContent = curDate;
  openModal('exportModal');
}

function performExport() {
  if (!S) return;
  var scopeEl = document.querySelector('input[name="exportScope"]:checked');
  var formatEl = document.querySelector('input[name="exportFormat"]:checked');
  var scope = scopeEl ? scopeEl.value : 'daily';
  var format = formatEl ? formatEl.value : 'xls';

  closeModal('exportModal');

  if (scope === 'daily') {
    exportDailyReport(format);
  } else if (scope === 'cumulative') {
    exportCumulativeReport(format);
  } else if (scope === 'detailed') {
    exportDetailedRecords(format);
  }
}

function downloadCsv(lines, filename) {
  var csvContent = '\uFEFF' + lines.join('\r\n');
  var blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  var url = URL.createObjectURL(blob);
  var a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  toast('已匯出：' + filename, 'ok');
}

function downloadXls(tableHtml, title, filename) {
  var template = '<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">' +
    '<head><meta charset="utf-8"><!--[if gte mso 9]><xml><x:ExcelWorkbook><x:ExcelWorksheets><x:ExcelWorksheet>' +
    '<x:Name>' + esc(title || '工作表') + '</x:Name>' +
    '<x:WorksheetOptions><x:DisplayGridlines/></x:WorksheetOptions></x:ExcelWorksheet></x:ExcelWorksheets></x:ExcelWorkbook></xml><![endif]-->' +
    '<style>' +
    'body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Microsoft JhengHei", "PingFang TC", sans-serif; font-size: 11pt; padding: 12px; }' +
    'table { border-collapse: collapse; width: 100%; margin-top: 10px; }' +
    'th { background-color: #2563eb; color: #ffffff; font-weight: bold; border: 1px solid #1d4ed8; padding: 7px 10px; text-align: center; }' +
    'td { border: 1px solid #cbd5e1; padding: 6px 9px; font-size: 11pt; }' +
    'tr:nth-child(even) td { background-color: #f8fafc; }' +
    '.center { text-align: center; }' +
    '.num { text-align: center; mso-number-format: "\\@"; }' +
    '.alert-text { color: #dc2626; font-weight: bold; }' +
    '.good-text { color: #16a34a; font-weight: bold; }' +
    '</style></head>' +
    '<body>' +
    '<h2 style="margin:0 0 6px;font-size:15pt;color:#1e293b">' + esc(title) + '</h2>' +
    '<div style="margin-bottom:12px;color:#64748b;font-size:10pt">班別：' + esc(S.cls) + ' ｜ 匯出時間：' + new Date().toLocaleString() + '</div>' +
    tableHtml +
    '</body></html>';

  var blob = new Blob([template], { type: 'application/vnd.ms-excel;charset=utf-8;' });
  var url = URL.createObjectURL(blob);
  var a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  toast('已匯出：' + filename, 'ok');
}

function exportDailyReport(format) {
  if (!S) return;
  var curDate = S.date || todayDateStr();
  var stats = (S.discipline && S.discipline.studentStats) ? S.discipline.studentStats : {};
  var totalStudents = S.total;
  var filename = '課堂日誌_' + S.cls + '_' + curDate + '.' + format;
  var title = S.cls + ' 班課堂日誌報表（' + curDate + '）';

  if (format === 'csv') {
    var lines = [];
    lines.push('班別,學號,中文姓名,英文姓名,性別,欠交功課,欠帶課本,課堂睡覺,說話分心,積極答問,違規警告,今日違規小計,課堂作業狀態,上堂欠交提示,上堂欠帶提示,記錄日期');
    for (var i = 1; i <= totalStudents; i++) {
      var st = stats[String(i)];
      var badges = st ? (st.today_badges || []) : [];
      var c = { no_hw: 0, no_book: 0, sleeping: 0, talking: 0, good_perf: 0, warning: 0 };
      badges.forEach(function (b) { if (c[b.type] !== undefined) c[b.type]++; });
      var totalInfractions = c.no_hw + c.no_book + c.sleeping + c.talking + c.warning;
      var isDone = !!(S.status && S.status[String(i)]);
      var r = studentOf(i);
      var zh = (r && r.zh) || '';
      var en = (r && (r.en || r.name)) || '';
      var sex = (r && r.sex) || '';
      var prevHw = (st && st.previous_alerts && st.previous_alerts.no_hw) ? '上一堂亦欠交' : '';
      var prevBook = (st && st.previous_alerts && st.previous_alerts.no_book) ? '上一堂亦欠帶' : '';

      lines.push([
        csvCell(S.cls),
        csvCell(i),
        csvCell(zh),
        csvCell(en),
        csvCell(sex),
        csvCell(c.no_hw),
        csvCell(c.no_book),
        csvCell(c.sleeping),
        csvCell(c.talking),
        csvCell(c.good_perf),
        csvCell(c.warning),
        csvCell(totalInfractions),
        csvCell(isDone ? ('已繳交 (' + S.status[String(i)] + ')') : '未繳交'),
        csvCell(prevHw),
        csvCell(prevBook),
        csvCell(curDate)
      ].join(','));
    }
    downloadCsv(lines, filename);
  } else {
    var html = '<table><thead><tr>' +
      '<th>班別</th><th>學號</th><th>中文姓名</th><th>英文姓名</th><th>性別</th>' +
      '<th>欠交功課</th><th>欠帶課本</th><th>課堂睡覺</th><th>說話分心</th><th>積極答問</th><th>違規警告</th>' +
      '<th>今日違規小計</th><th>課堂作業狀態</th><th>上堂欠交提示</th><th>上堂欠帶提示</th><th>記錄日期</th>' +
      '</tr></thead><tbody>';

    for (var i = 1; i <= totalStudents; i++) {
      var st = stats[String(i)];
      var badges = st ? (st.today_badges || []) : [];
      var c = { no_hw: 0, no_book: 0, sleeping: 0, talking: 0, good_perf: 0, warning: 0 };
      badges.forEach(function (b) { if (c[b.type] !== undefined) c[b.type]++; });
      var totalInfractions = c.no_hw + c.no_book + c.sleeping + c.talking + c.warning;
      var isDone = !!(S.status && S.status[String(i)]);
      var r = studentOf(i);
      var zh = (r && r.zh) || '';
      var en = (r && (r.en || r.name)) || '';
      var sex = (r && r.sex) || '';
      var prevHw = (st && st.previous_alerts && st.previous_alerts.no_hw) ? '上一堂亦欠交' : '';
      var prevBook = (st && st.previous_alerts && st.previous_alerts.no_book) ? '上一堂亦欠帶' : '';

      html += '<tr>' +
        '<td class="center">' + esc(S.cls) + '</td>' +
        '<td class="num">' + i + '</td>' +
        '<td>' + esc(zh) + '</td>' +
        '<td>' + esc(en) + '</td>' +
        '<td class="center">' + esc(sex) + '</td>' +
        '<td class="center' + (c.no_hw > 0 ? ' alert-text' : '') + '">' + c.no_hw + '</td>' +
        '<td class="center' + (c.no_book > 0 ? ' alert-text' : '') + '">' + c.no_book + '</td>' +
        '<td class="center' + (c.sleeping > 0 ? ' alert-text' : '') + '">' + c.sleeping + '</td>' +
        '<td class="center' + (c.talking > 0 ? ' alert-text' : '') + '">' + c.talking + '</td>' +
        '<td class="center' + (c.good_perf > 0 ? ' good-text' : '') + '">' + c.good_perf + '</td>' +
        '<td class="center' + (c.warning > 0 ? ' alert-text' : '') + '">' + c.warning + '</td>' +
        '<td class="center' + (totalInfractions > 0 ? ' alert-text' : '') + '">' + totalInfractions + '</td>' +
        '<td class="center">' + esc(isDone ? ('已繳交 (' + S.status[String(i)] + ')') : '未繳交') + '</td>' +
        '<td class="center' + (prevHw ? ' alert-text' : '') + '">' + esc(prevHw) + '</td>' +
        '<td class="center' + (prevBook ? ' alert-text' : '') + '">' + esc(prevBook) + '</td>' +
        '<td class="center">' + esc(curDate) + '</td>' +
        '</tr>';
    }
    html += '</tbody></table>';
    downloadXls(html, title, filename);
  }
}

function exportCumulativeReport(format) {
  if (!S) return;
  var curDate = S.date || todayDateStr();
  var stats = (S.discipline && S.discipline.studentStats) ? S.discipline.studentStats : {};
  var totalStudents = S.total;
  var filename = '學期紀律累計總表_' + S.cls + '_' + curDate + '.' + format;
  var title = S.cls + ' 班學期紀律累計總表（截至 ' + curDate + '）';

  if (format === 'csv') {
    var lines = [];
    lines.push('班別,學號,中文姓名,英文姓名,性別,累計欠交功課,累計欠帶課本,累計課堂睡覺,累計說話分心,累計違規警告,累計違規總數,累計積極答問,統計截至日期');
    for (var i = 1; i <= totalStudents; i++) {
      var st = stats[String(i)];
      var tot = (st && st.totals) ? st.totals : { no_hw: 0, no_book: 0, sleeping: 0, talking: 0, good_perf: 0, warning: 0, total_infractions: 0 };
      var r = studentOf(i);
      var zh = (r && r.zh) || '';
      var en = (r && (r.en || r.name)) || '';
      var sex = (r && r.sex) || '';

      lines.push([
        csvCell(S.cls),
        csvCell(i),
        csvCell(zh),
        csvCell(en),
        csvCell(sex),
        csvCell(tot.no_hw || 0),
        csvCell(tot.no_book || 0),
        csvCell(tot.sleeping || 0),
        csvCell(tot.talking || 0),
        csvCell(tot.warning || 0),
        csvCell(tot.total_infractions || 0),
        csvCell(tot.good_perf || 0),
        csvCell(curDate)
      ].join(','));
    }
    downloadCsv(lines, filename);
  } else {
    var html = '<table><thead><tr>' +
      '<th>班別</th><th>學號</th><th>中文姓名</th><th>英文姓名</th><th>性別</th>' +
      '<th>累計欠交功課</th><th>累計欠帶課本</th><th>累計課堂睡覺</th><th>累計說話分心</th><th>累計違規警告</th><th>累計違規總數</th>' +
      '<th>累計積極答問</th><th>統計截至日期</th>' +
      '</tr></thead><tbody>';

    for (var i = 1; i <= totalStudents; i++) {
      var st = stats[String(i)];
      var tot = (st && st.totals) ? st.totals : { no_hw: 0, no_book: 0, sleeping: 0, talking: 0, good_perf: 0, warning: 0, total_infractions: 0 };
      var r = studentOf(i);
      var zh = (r && r.zh) || '';
      var en = (r && (r.en || r.name)) || '';
      var sex = (r && r.sex) || '';

      html += '<tr>' +
        '<td class="center">' + esc(S.cls) + '</td>' +
        '<td class="num">' + i + '</td>' +
        '<td>' + esc(zh) + '</td>' +
        '<td>' + esc(en) + '</td>' +
        '<td class="center">' + esc(sex) + '</td>' +
        '<td class="center' + ((tot.no_hw || 0) > 0 ? ' alert-text' : '') + '">' + (tot.no_hw || 0) + '</td>' +
        '<td class="center' + ((tot.no_book || 0) > 0 ? ' alert-text' : '') + '">' + (tot.no_book || 0) + '</td>' +
        '<td class="center' + ((tot.sleeping || 0) > 0 ? ' alert-text' : '') + '">' + (tot.sleeping || 0) + '</td>' +
        '<td class="center' + ((tot.talking || 0) > 0 ? ' alert-text' : '') + '">' + (tot.talking || 0) + '</td>' +
        '<td class="center' + ((tot.warning || 0) > 0 ? ' alert-text' : '') + '">' + (tot.warning || 0) + '</td>' +
        '<td class="center' + ((tot.total_infractions || 0) > 0 ? ' alert-text' : '') + '">' + (tot.total_infractions || 0) + '</td>' +
        '<td class="center' + ((tot.good_perf || 0) > 0 ? ' good-text' : '') + '">' + (tot.good_perf || 0) + '</td>' +
        '<td class="center">' + esc(curDate) + '</td>' +
        '</tr>';
    }
    html += '</tbody></table>';
    downloadXls(html, title, filename);
  }
}

function exportDetailedRecords(format) {
  if (!S) return;
  var curDate = S.date || todayDateStr();
  var records = (S.discipline && S.discipline.allRecords) ? S.discipline.allRecords : null;

  if (!records) {
    busy(true);
    post({ action: 'getClassHistory', cls: S.cls }).then(function (res) {
      busy(false);
      var recs = (res && res.records) || [];
      if (S.discipline) S.discipline.allRecords = recs;
      doDetailedExport(recs, format, curDate);
    }).catch(function () {
      busy(false);
      doDetailedExport(S.dateEvents || [], format, curDate);
    });
  } else {
    doDetailedExport(records, format, curDate);
  }
}

function doDetailedExport(records, format, curDate) {
  var filename = '全班歷次紀律詳細流水帳_' + S.cls + '_' + curDate + '.' + format;
  var title = S.cls + ' 班全班歷次紀律詳細流水帳';

  if (!records || records.length === 0) {
    toast('目前尚無全班歷次紀律明細記錄可供匯出', 'bad');
    return;
  }

  if (format === 'csv') {
    var lines = [];
    lines.push('記錄日期,記錄時間,班別,學號,中文姓名,英文姓名,性別,紀律項目類別,項目標籤,備註說明');
    records.forEach(function (rec) {
      var r = studentOf(rec.student_no);
      var zh = (r && r.zh) || '';
      var en = (r && (r.en || r.name)) || '';
      var sex = (r && r.sex) || '';
      var typeName = DISCIPLINE_TYPE_LABELS[rec.type] || rec.type || '';

      lines.push([
        csvCell(rec.date),
        csvCell(rec.time || ''),
        csvCell(rec.class || S.cls),
        csvCell(rec.student_no),
        csvCell(zh),
        csvCell(en),
        csvCell(sex),
        csvCell(typeName),
        csvCell(rec.label || ''),
        csvCell(rec.note || '')
      ].join(','));
    });
    downloadCsv(lines, filename);
  } else {
    var html = '<table><thead><tr>' +
      '<th>記錄日期</th><th>記錄時間</th><th>班別</th><th>學號</th><th>中文姓名</th><th>英文姓名</th><th>性別</th>' +
      '<th>紀律項目類別</th><th>項目標籤</th><th>備註說明</th>' +
      '</tr></thead><tbody>';

    records.forEach(function (rec) {
      var r = studentOf(rec.student_no);
      var zh = (r && r.zh) || '';
      var en = (r && (r.en || r.name)) || '';
      var sex = (r && r.sex) || '';
      var typeName = DISCIPLINE_TYPE_LABELS[rec.type] || rec.type || '';
      var isGood = rec.type === 'good_perf';

      html += '<tr>' +
        '<td class="center">' + esc(rec.date) + '</td>' +
        '<td class="center">' + esc(rec.time || '') + '</td>' +
        '<td class="center">' + esc(rec.class || S.cls) + '</td>' +
        '<td class="num">' + esc(rec.student_no) + '</td>' +
        '<td>' + esc(zh) + '</td>' +
        '<td>' + esc(en) + '</td>' +
        '<td class="center">' + esc(sex) + '</td>' +
        '<td class="center' + (isGood ? ' good-text' : ' alert-text') + '">' + esc(typeName) + '</td>' +
        '<td>' + esc(rec.label || '') + '</td>' +
        '<td>' + esc(rec.note || '') + '</td>' +
        '</tr>';
    });
    html += '</tbody></table>';
    downloadXls(html, title, filename);
  }
}

function exportLogCsv() {
  openExportModal();
}

function clearDateDiscipline() {
  var curDate = S.date || todayDateStr();
  ask({
    title: '清空當日紀律記錄？',
    msg: '確定要清空 ' + S.cls + ' 班於 ' + curDate + ' 的所有學生紀律表記錄嗎？（作業完成狀態不受影響）',
    ok: '確定清空',
    onOk: function () {
      post({ action: 'clearDisciplineDate', cls: S.cls, date: curDate })
        .then(function () {
          if (S.discipline && S.discipline.studentStats) {
            for (var k in S.discipline.studentStats) {
              S.discipline.studentStats[k].today_badges = [];
            }
          }
          render();
          renderOverviewTab();
          toast(curDate + ' 紀律表記錄已清空', 'ok');
        })
        .catch(fail);
    }
  });
}

function initDisciplinePrefsTab() {
  var chk = $('prefEnableFloatingBar');
  if (chk) chk.checked = !!disciplinePrefs.enableFloatingBar;

  var wrap = $('prefFloatingChipsWrap');
  if (wrap) wrap.style.display = chk.checked ? 'block' : 'none';

  Array.prototype.forEach.call(document.querySelectorAll('.pref-chip-choice input'), function (inp) {
    inp.checked = (disciplinePrefs.floatingChips || []).indexOf(inp.value) >= 0;
  });

  Array.prototype.forEach.call(document.querySelectorAll('input[name="badgeMode"]'), function (inp) {
    inp.checked = (inp.value === disciplinePrefs.badgeMode);
  });

  Array.prototype.forEach.call(document.querySelectorAll('input[name="badgePos"]'), function (inp) {
    inp.checked = (inp.value === (disciplinePrefs.badgePos || 'top-right'));
  });
}

function initFloatingToolbox() {
  var bar = $('floatingStampBar');
  var header = $('fsHeader');
  var toggleBtn = $('fsToggleBtn');
  if (!bar || !header) return;

  // Restore saved position if any
  try {
    var savedPos = localStorage.getItem('cm_fs_pos');
    if (savedPos) {
      var pos = JSON.parse(savedPos);
      if (typeof pos.left === 'number' && typeof pos.top === 'number') {
        var maxL = Math.max(0, window.innerWidth - 80);
        var maxT = Math.max(0, window.innerHeight - 50);
        var clLeft = Math.max(8, Math.min(maxL, pos.left));
        var clTop = Math.max(8, Math.min(maxT, pos.top));
        bar.style.bottom = 'auto';
        bar.style.left = clLeft + 'px';
        bar.style.top = clTop + 'px';
      }
    }
  } catch (e) {}

  function toggleCollapsed(e) {
    if (e) {
      e.stopPropagation();
      e.preventDefault();
    }
    disciplinePrefs.floatingCollapsed = !disciplinePrefs.floatingCollapsed;
    saveDisciplinePrefs();
    renderFloatingStampBar();
  }

  if (toggleBtn) {
    toggleBtn.addEventListener('click', toggleCollapsed);
  }

  // Draggable logic with mouse and touch
  var isDragging = false;
  var startX = 0;
  var startY = 0;
  var initialLeft = 0;
  var initialTop = 0;
  var hasMoved = false;

  function onPointerDown(e) {
    if (e.target === toggleBtn || (toggleBtn && toggleBtn.contains(e.target))) return;

    isDragging = true;
    hasMoved = false;
    var clientX = (e.touches && e.touches.length) ? e.touches[0].clientX : e.clientX;
    var clientY = (e.touches && e.touches.length) ? e.touches[0].clientY : e.clientY;
    startX = clientX;
    startY = clientY;

    var rect = bar.getBoundingClientRect();
    initialLeft = rect.left;
    initialTop = rect.top;

    bar.style.bottom = 'auto';
    bar.style.left = initialLeft + 'px';
    bar.style.top = initialTop + 'px';

    document.addEventListener('mousemove', onPointerMove, { passive: false });
    document.addEventListener('mouseup', onPointerUp);
    document.addEventListener('touchmove', onPointerMove, { passive: false });
    document.addEventListener('touchend', onPointerUp);
  }

  function onPointerMove(e) {
    if (!isDragging) return;
    var clientX = (e.touches && e.touches.length) ? e.touches[0].clientX : e.clientX;
    var clientY = (e.touches && e.touches.length) ? e.touches[0].clientY : e.clientY;
    var dx = clientX - startX;
    var dy = clientY - startY;

    if (!hasMoved && (Math.abs(dx) > 4 || Math.abs(dy) > 4)) {
      hasMoved = true;
    }

    if (hasMoved) {
      if (e.cancelable) e.preventDefault();
      var newLeft = initialLeft + dx;
      var newTop = initialTop + dy;

      var maxL = Math.max(0, window.innerWidth - bar.offsetWidth - 8);
      var maxT = Math.max(0, window.innerHeight - bar.offsetHeight - 8);
      newLeft = Math.max(8, Math.min(maxL, newLeft));
      newTop = Math.max(8, Math.min(maxT, newTop));

      bar.style.left = newLeft + 'px';
      bar.style.top = newTop + 'px';
    }
  }

  function onPointerUp() {
    if (!isDragging) return;
    isDragging = false;
    document.removeEventListener('mousemove', onPointerMove);
    document.removeEventListener('mouseup', onPointerUp);
    document.removeEventListener('touchmove', onPointerMove);
    document.removeEventListener('touchend', onPointerUp);

    if (hasMoved) {
      var rect = bar.getBoundingClientRect();
      try {
        localStorage.setItem('cm_fs_pos', JSON.stringify({
          left: Math.round(rect.left),
          top: Math.round(rect.top)
        }));
      } catch (e) {}
    } else {
      toggleCollapsed();
    }
  }

  header.addEventListener('mousedown', onPointerDown);
  header.addEventListener('touchstart', onPointerDown, { passive: true });
}

function renderFloatingStampBar() {
  var bar = $('floatingStampBar');
  if (!bar) return;

  if (!disciplinePrefs.enableFloatingBar || appModule !== 'discipline') {
    bar.hidden = true;
    bar.style.display = 'none';
    return;
  }

  bar.hidden = false;
  bar.style.display = 'flex';

  if (disciplinePrefs.floatingCollapsed) {
    bar.classList.add('is-collapsed');
    var toggleBtn = $('fsToggleBtn');
    if (toggleBtn) toggleBtn.title = '展開工具箱';
  } else {
    bar.classList.remove('is-collapsed');
    var toggleBtn2 = $('fsToggleBtn');
    if (toggleBtn2) toggleBtn2.title = '收起工具箱';
  }

  var chipsBox = $('floatingStampChips');
  if (!chipsBox) return;
  var chips = disciplinePrefs.floatingChips || ['no_hw', 'no_book', 'sleeping', 'talking', 'good_perf', 'warning'];

  var html = '<button type="button" class="fs-chip ' + (activeStamp === 'none' ? 'is-active' : '') + '" data-fs-stamp="none">👆 自選</button>';
  chips.forEach(function (tp) {
    var st = STAMPS[tp];
    if (!st) return;
    html += '<button type="button" class="fs-chip ' + (activeStamp === tp ? 'is-active' : '') + '" data-fs-stamp="' + tp + '">' +
      st.icon + ' ' + esc(st.label) +
    '</button>';
  });
  chipsBox.innerHTML = html;

  Array.prototype.forEach.call(chipsBox.querySelectorAll('[data-fs-stamp]'), function (b) {
    b.addEventListener('click', function () {
      activeStamp = b.dataset.fsStamp;
      renderFloatingStampBar();
      if (activeStamp === 'none') toast('模式：點擊學生開啟個人檔案');
      else toast('一鍵蓋印模式：' + STAMPS[activeStamp].icon + ' ' + STAMPS[activeStamp].label);
    });
  });
}

function initApiTab() {
  var host = window.location.origin;
  var endpoint = host + '/api/external';
  $('apiEndpointUrl').textContent = endpoint;

  var sel = $('apiTestCls');
  if (S && S.classes) {
    sel.innerHTML = S.classes.map(function (c) {
      return '<option value="' + esc(c) + '"' + (c === S.cls ? ' selected' : '') + '>' + esc(c) + '</option>';
    }).join('');
  }

  $('apiTestResult').hidden = true;
  showApiCode('python');
}

function showApiCode(lang) {
  var host = window.location.origin;
  var endpoint = host + '/api/external';
  var cls = S ? S.cls : '1A';
  var code = '';

  if (lang === 'python') {
    code =
      "# Python 3 範例 (供學生電腦、自動批改程式、監考腳本調用)\n" +
      "import requests\n\n" +
      "url = '" + endpoint + "'\n" +
      "# 當學生在電腦端完成課堂作業時發送：\n" +
      "response = requests.post(url, headers={\n" +
      "    'Content-Type': 'application/json',\n" +
      "    'x-api-key': 'your_passcode'  # 或伺服器設置的 API_KEY / APP_PASSCODE\n" +
      "}, json={\n" +
      "    'class': '" + cls + "',\n" +
      "    'student_no': 12,\n" +
      "    'status': 'marked'  # marked (完成) 或 unmarked (取消)\n" +
      "})\n\n" +
      "print(response.status_code, response.json())";
  } else if (lang === 'curl') {
    code =
      "# cURL 終端命令範例\n" +
      "curl -X POST " + endpoint + " \\\n" +
      "  -H \"Content-Type: application/json\" \\\n" +
      "  -H \"x-api-key: your_passcode\" \\\n" +
      "  -d '{\"class\":\"" + cls + "\",\"student_no\":12,\"status\":\"marked\"}'";
  } else if (lang === 'js') {
    code =
      "// JavaScript / Node.js 範例\n" +
      "const res = await fetch('" + endpoint + "', {\n" +
      "  method: 'POST',\n" +
      "  headers: {\n" +
      "    'Content-Type': 'application/json',\n" +
      "    'x-api-key': 'your_passcode'\n" +
      "  },\n" +
      "  body: JSON.stringify({\n" +
      "    class: '" + cls + "',\n" +
      "    student_no: 12,\n" +
      "    status: 'marked'\n" +
      "  })\n" +
      "});\n" +
      "const data = await res.json();\n" +
      "console.log(data);";
  }

  $('apiCodeBox').textContent = code;
}

function sendApiTestSignal() {
  var cls = $('apiTestCls').value;
  var no = parseInt($('apiTestNo').value, 10);
  var status = $('apiTestStatus').value;
  var resultBox = $('apiTestResult');

  if (!no || no < 1) {
    toast('請輸入正確學號', 'err');
    return;
  }

  resultBox.hidden = false;
  resultBox.className = 'api-test-result';
  resultBox.textContent = '發送信號中... (Sending signal...)';

  fetch('/api/external', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      class: cls,
      student_no: no,
      status: status
    }),
    credentials: 'same-origin'
  })
  .then(function (res) {
    return res.json().then(function (data) {
      if (!res.ok) throw new Error(data.error || ('HTTP ' + res.status));
      return data;
    });
  })
  .then(function (data) {
    resultBox.className = 'api-test-result success';
    resultBox.textContent = '✓ 成功同步！伺服器回應：\n' + JSON.stringify(data, null, 2);
    toast('信號已成功同步至伺服器！', 'ok');
    if (S && S.cls === cls) {
      if (status === 'marked') S.status[String(no)] = data.time || hhmm(new Date());
      else delete S.status[String(no)];
      repaint(no);
    }
  })
  .catch(function (err) {
    resultBox.className = 'api-test-result error';
    resultBox.textContent = '✕ 發送失敗：' + (err.message || err);
  });
}

/* =============================================================== Schedule & Calendar Tab */

var schedSelectedClass = null;
var schedEditingSlotKey = null; // null or { day: 'A', idx: 0 }
var schedCurrentSubtab = 'timetable'; // 'timetable' | 'calendar'
var schedParsedCalendar = null;
var schedMatrixViewActive = false;
var schedTabInitialized = false;

function renderSettingsVersion() {
  var tag = $('settingsVersionTag');
  if (tag) {
    tag.innerHTML = 'ver. ' + esc(APP_VERSION) + ' · <span id="settingsCommitHash">' + esc(APP_COMMIT) + '</span>';
  }
}

function initScheduleTab() {
  if (!schedSelectedClass && S) {
    schedSelectedClass = S.cls;
  }

  if (!schedTabInitialized) {
    schedTabInitialized = true;

    // Sub-tab switching
    Array.prototype.forEach.call(document.querySelectorAll('[data-schedsub]'), function (btn) {
      btn.addEventListener('click', function () {
        schedCurrentSubtab = btn.dataset.schedsub;
        Array.prototype.forEach.call(document.querySelectorAll('[data-schedsub]'), function (b) {
          b.classList.toggle('is-active', b.dataset.schedsub === schedCurrentSubtab);
        });
        var ttPane = $('schedTimetablePane');
        var calPane = $('schedCalendarPane');
        if (ttPane) ttPane.hidden = (schedCurrentSubtab !== 'timetable');
        if (calPane) calPane.hidden = (schedCurrentSubtab !== 'calendar');
        if (schedCurrentSubtab === 'timetable') renderSchedTimetable();
        else renderSchedCalendarStats();
      });
    });

    // Timetable class selector
    var clsSel = $('schedClassSel');
    if (clsSel) {
      clsSel.addEventListener('change', function () {
        schedSelectedClass = clsSel.value;
        schedEditingSlotKey = null;
        renderSchedClassTable();
        renderSchedClassSummary();
        resetSchedForm();
      });
    }

    // Toggle Matrix view
    var toggleMatrixBtn = $('schedToggleMatrixBtn');
    if (toggleMatrixBtn) {
      toggleMatrixBtn.addEventListener('click', function () {
        schedMatrixViewActive = !schedMatrixViewActive;
        var singleWrap = $('schedClassSingleWrap');
        var matrixWrap = $('schedMatrixWrap');
        if (singleWrap) singleWrap.hidden = schedMatrixViewActive;
        if (matrixWrap) matrixWrap.hidden = !schedMatrixViewActive;
        toggleMatrixBtn.textContent = schedMatrixViewActive ? '📋 切換班別清單視圖' : '📊 切換 6-Day 全課表矩陣';
        if (schedMatrixViewActive) renderSchedMatrix();
      });
    }

    // Reset Timetable button
    var resetTimetableBtn = $('schedResetTimetableBtn');
    if (resetTimetableBtn) {
      resetTimetableBtn.addEventListener('click', function () {
        ask({
          title: '還原預設課堂排程？',
          msg: '確定要將所有班別的 6-Day 課堂排程還原為學校官方預設值嗎？所有自訂更動將被清除。',
          ok: '確認還原',
          onOk: function () {
            if (window.ScheduleEngine && ScheduleEngine.resetSchedule) {
              ScheduleEngine.resetSchedule();
            }
            schedEditingSlotKey = null;
            renderSchedTimetable();
            checkScheduleForToday();
            toast('已還原為官方預設課堂排程', 'ok');
          }
        });
      });
    }

    // Slot form cancel
    var cancelBtn = $('schedFormCancelBtn');
    if (cancelBtn) {
      cancelBtn.addEventListener('click', function () {
        resetSchedForm();
      });
    }

    // Slot form submit
    var submitBtn = $('schedFormSubmitBtn');
    if (submitBtn) {
      submitBtn.addEventListener('click', function () {
        handleSchedFormSubmit();
      });
    }

    // Single class table clicks (edit / delete)
    var tbody = $('schedClassTbody');
    if (tbody) {
      tbody.addEventListener('click', function (e) {
        var editBtn = e.target.closest('.sched-edit-slot-btn');
        var delBtn = e.target.closest('.sched-del-slot-btn');
        if (editBtn) {
          var day = editBtn.dataset.day;
          var idx = parseInt(editBtn.dataset.idx, 10);
          startEditSlot(day, idx);
        } else if (delBtn) {
          var dayDel = delBtn.dataset.day;
          var idxDel = parseInt(delBtn.dataset.idx, 10);
          deleteSlot(dayDel, idxDel);
        }
      });
    }

    // Matrix cell click
    var matrixTbody = $('schedMatrixTbody');
    if (matrixTbody) {
      matrixTbody.addEventListener('click', function (e) {
        var cellClass = e.target.closest('.sched-matrix-cell-class');
        if (cellClass && cellClass.dataset.cls) {
          schedSelectedClass = cellClass.dataset.cls;
          schedMatrixViewActive = false;
          var singleWrap = $('schedClassSingleWrap');
          var matrixWrap = $('schedMatrixWrap');
          if (singleWrap) singleWrap.hidden = false;
          if (matrixWrap) matrixWrap.hidden = true;
          if ($('schedToggleMatrixBtn')) $('schedToggleMatrixBtn').textContent = '📊 切換 6-Day 全課表矩陣';
          renderSchedTimetable();
        }
      });
    }

    // Calendar file input
    var calFileInput = $('calFileInput');
    if (calFileInput) {
      calFileInput.addEventListener('change', function (e) {
        var file = e.target.files && e.target.files[0];
        if (!file) return;
        var nameSpan = $('calSelectedFileName');
        if (nameSpan) nameSpan.textContent = file.name;
        var reader = new FileReader();
        reader.onload = function (evt) {
          var text = evt.target.result;
          var pasteArea = $('calPasteArea');
          if (pasteArea) pasteArea.value = text;
          doCalendarPreview(text);
        };
        reader.readAsText(file);
      });
    }

    // Calendar preview button
    var calPreviewBtn = $('calPreviewBtn');
    if (calPreviewBtn) {
      calPreviewBtn.addEventListener('click', function () {
        var pasteArea = $('calPasteArea');
        var text = (pasteArea ? pasteArea.value : '').trim();
        if (!text) {
          toast('請先選擇 CSV 檔案或貼上校曆文字', 'bad');
          return;
        }
        doCalendarPreview(text);
      });
    }

    // Calendar apply button
    var calApplyBtn = $('calApplyBtn');
    if (calApplyBtn) {
      calApplyBtn.addEventListener('click', function () {
        var pasteArea = $('calPasteArea');
        var text = (pasteArea ? pasteArea.value : '').trim();
        if (!text) {
          toast('請先輸入或貼上校曆資料', 'bad');
          return;
        }
        if (!window.ScheduleEngine || !ScheduleEngine.parseCalendarCsv) {
          toast('系統排程引擎尚未就緒', 'bad');
          return;
        }
        var parsed = ScheduleEngine.parseCalendarCsv(text);
        if (parsed.error || parsed.cycleDaysCount === 0) {
          toast(parsed.error || '校曆中未發現任何有效循環日 (A-F)', 'bad');
          return;
        }

        ask({
          title: '確認匯入並套用新校曆？',
          msg: '即將套用包含 ' + parsed.cycleDaysCount + ' 個循環日及 ' + parsed.eventsCount + ' 項假期的新校曆。確定要儲存嗎？',
          ok: '確認套用',
          onOk: function () {
            try {
              ScheduleEngine.setCalendar(parsed.cycleDays, parsed.nonCycleEvents);
              schedParsedCalendar = parsed;
              renderSchedCalendarStats();
              checkScheduleForToday();
              toast('已成功儲存並套用新校曆！', 'ok');
            } catch (err) {
              toast('套用失敗：' + err.message, 'bad');
            }
          }
        });
      });
    }

    // Calendar export button
    var calExportBtn = $('calExportBtn');
    if (calExportBtn) {
      calExportBtn.addEventListener('click', function () {
        if (!window.ScheduleEngine || !ScheduleEngine.exportCalendarCsv) return;
        var csv = ScheduleEngine.exportCalendarCsv();
        var blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
        var url = URL.createObjectURL(blob);
        var a = document.createElement('a');
        a.href = url;
        a.download = 'school_calendar_2026_2027.csv';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        toast('已匯出目前校曆 CSV 檔案', 'ok');
      });
    }

    // Calendar reset button
    var calResetBtn = $('calResetBtn');
    if (calResetBtn) {
      calResetBtn.addEventListener('click', function () {
        ask({
          title: '還原官方預設校曆？',
          msg: '確定要清除自訂校曆並還原為官方預設 2026-2027 校曆（150天）嗎？',
          ok: '確認還原',
          onOk: function () {
            if (window.ScheduleEngine && ScheduleEngine.resetCalendar) {
              ScheduleEngine.resetCalendar();
            }
            schedParsedCalendar = null;
            var pasteArea = $('calPasteArea');
            if (pasteArea) pasteArea.value = '';
            var fileSpan = $('calSelectedFileName');
            if (fileSpan) fileSpan.textContent = '未選擇檔案';
            var pWrap = $('calPreviewWrap');
            if (pWrap) pWrap.hidden = true;
            var pMsg = $('calParseMsg');
            if (pMsg) pMsg.textContent = '';
            renderSchedCalendarStats();
            checkScheduleForToday();
            toast('已還原為官方預設校曆', 'ok');
          }
        });
      });
    }
  }

  renderScheduleSettingsTab();
}

function renderScheduleSettingsTab() {
  var ttPane = $('schedTimetablePane');
  var calPane = $('schedCalendarPane');
  if (ttPane) ttPane.hidden = (schedCurrentSubtab !== 'timetable');
  if (calPane) calPane.hidden = (schedCurrentSubtab !== 'calendar');

  if (schedCurrentSubtab === 'timetable') {
    renderSchedTimetable();
  } else {
    renderSchedCalendarStats();
  }
}

function renderSchedTimetable() {
  if (!S) return;
  if (!schedSelectedClass) {
    schedSelectedClass = S.cls || '4C';
  }

  // Populate class dropdown
  var clsSel = $('schedClassSel');
  if (clsSel) {
    var availableClasses = (S.classes && S.classes.length > 0) ? S.classes.slice() : ['1A', '1D', '2A', '2B', '2C', '2D', '4C'];
    if (availableClasses.indexOf(schedSelectedClass) === -1) {
      availableClasses.unshift(schedSelectedClass);
    }
    clsSel.innerHTML = availableClasses.map(function (c) {
      return '<option value="' + esc(c) + '"' + (c === schedSelectedClass ? ' selected' : '') + '>' + esc(c) + ' 班' + (c === S.cls ? ' (目前)' : '') + '</option>';
    }).join('');
  }

  renderSchedClassTable();
  renderSchedClassSummary();
  if (schedMatrixViewActive) {
    renderSchedMatrix();
  }
}

function renderSchedClassTable() {
  var tbody = $('schedClassTbody');
  if (!tbody || !window.ScheduleEngine) return;

  var sched = ScheduleEngine.getSchedule();
  var days = ['A', 'B', 'C', 'D', 'E', 'F'];
  var rowsHtml = '';
  var count = 0;

  days.forEach(function (d) {
    var daySlots = sched[d] || [];
    daySlots.forEach(function (slot, idx) {
      if (ScheduleEngine.matchClass(schedSelectedClass, slot.class)) {
        count++;
        var timing = ScheduleEngine.getPeriodTiming(slot.period, 'Normal');
        var timeStr = timing ? (timing.start + ' - ' + timing.end) : '—';
        rowsHtml += '<tr>' +
          '<td><span class="sched-day-badge">Day ' + esc(d) + '</span></td>' +
          '<td><b>第 ' + esc(slot.period) + ' 堂</b></td>' +
          '<td class="muted" style="font-family:monospace;font-size:12px">' + esc(timeStr) + '</td>' +
          '<td>' + esc(slot.room || '—') + ' 室</td>' +
          '<td>' + esc(slot.subject || '—') + '</td>' +
          '<td style="text-align:center">' +
            '<div style="display:inline-flex;gap:4px">' +
              '<button type="button" class="tool small-tool sched-edit-slot-btn" data-day="' + esc(d) + '" data-idx="' + idx + '">✏️ 編輯</button>' +
              '<button type="button" class="tool small-tool quiet-danger sched-del-slot-btn" data-day="' + esc(d) + '" data-idx="' + idx + '">🗑️ 刪除</button>' +
            '</div>' +
          '</td>' +
        '</tr>';
      }
    });
  });

  if (count === 0) {
    rowsHtml = '<tr><td colspan="6" class="muted" style="text-align:center;padding:18px">' +
      '班別 ' + esc(schedSelectedClass) + ' 目前尚未設定任何循環課堂排程。請於下方表單新增課堂時段。</td></tr>';
  }

  tbody.innerHTML = rowsHtml;
}

function renderSchedClassSummary() {
  var sumEl = $('schedClassSummary');
  if (!sumEl || !window.ScheduleEngine) return;

  var prof = ScheduleEngine.getClassProfile(schedSelectedClass);
  var sched = ScheduleEngine.getSchedule();
  var days = ['A', 'B', 'C', 'D', 'E', 'F'];
  var totalSlots = 0;
  var daySlots = [];

  days.forEach(function (d) {
    var matches = (sched[d] || []).filter(function (s) { return ScheduleEngine.matchClass(schedSelectedClass, s.class); });
    if (matches.length > 0) {
      totalSlots += matches.length;
      var pStr = matches.map(function (m) { return m.period; }).sort(function (a, b) { return a - b; }).join(', ');
      daySlots.push('Day ' + d + ' (第 ' + pStr + ' 堂)');
    }
  });

  if (totalSlots === 0) {
    sumEl.textContent = '此班每循環：尚未排課';
  } else {
    sumEl.textContent = '每循環共 ' + totalSlots + ' 節：' + daySlots.join('； ');
  }
}

function resetSchedForm() {
  schedEditingSlotKey = null;
  var title = $('schedFormTitle');
  if (title) title.textContent = '➕ 新增課堂時段';
  var submitBtn = $('schedFormSubmitBtn');
  if (submitBtn) submitBtn.textContent = '➕ 加入排程';
  var cancelBtn = $('schedFormCancelBtn');
  if (cancelBtn) cancelBtn.hidden = true;
  var doubleChk = $('schedFormDoublePeriod');
  if (doubleChk) {
    doubleChk.checked = false;
    doubleChk.disabled = false;
  }

  if (window.ScheduleEngine) {
    var prof = ScheduleEngine.getClassProfile(schedSelectedClass);
    if (prof) {
      if ($('schedFormRoom')) $('schedFormRoom').value = (prof.defaultRoom || '').split('/')[0].trim();
      if ($('schedFormSubject')) $('schedFormSubject').value = prof.subject || '';
    }
  }
}

function startEditSlot(day, idx) {
  if (!window.ScheduleEngine) return;
  var sched = ScheduleEngine.getSchedule();
  var slot = (sched[day] || [])[idx];
  if (!slot) return;

  schedEditingSlotKey = { day: day, idx: idx };

  var title = $('schedFormTitle');
  if (title) title.textContent = '✏️ 編輯課堂時段 (Day ' + day + ' 第 ' + slot.period + ' 堂)';
  var submitBtn = $('schedFormSubmitBtn');
  if (submitBtn) submitBtn.textContent = '💾 儲存修改';
  var cancelBtn = $('schedFormCancelBtn');
  if (cancelBtn) cancelBtn.hidden = false;

  if ($('schedFormDay')) $('schedFormDay').value = day;
  if ($('schedFormPeriod')) $('schedFormPeriod').value = String(slot.period);
  if ($('schedFormRoom')) $('schedFormRoom').value = slot.room || '';
  if ($('schedFormSubject')) $('schedFormSubject').value = slot.subject || '';
  var doubleChk = $('schedFormDoublePeriod');
  if (doubleChk) {
    doubleChk.checked = false;
    doubleChk.disabled = true;
  }

  var card = $('schedFormCard');
  if (card && card.scrollIntoView) {
    card.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }
}

function deleteSlot(day, idx) {
  if (!window.ScheduleEngine) return;
  var sched = ScheduleEngine.getSchedule();
  var slot = (sched[day] || [])[idx];
  if (!slot) return;

  ask({
    title: '確認刪除課堂？',
    msg: '確定要刪除 ' + slot.class + ' 於 Day ' + day + ' 第 ' + slot.period + ' 堂的排程嗎？',
    ok: '確定刪除',
    onOk: function () {
      sched[day].splice(idx, 1);
      ScheduleEngine.setSchedule(sched);
      renderSchedTimetable();
      checkScheduleForToday();
      toast('已刪除課堂時段', 'ok');
    }
  });
}

function handleSchedFormSubmit() {
  if (!window.ScheduleEngine) return;
  var day = $('schedFormDay').value;
  var period = parseInt($('schedFormPeriod').value, 10);
  var isDouble = $('schedFormDoublePeriod') ? $('schedFormDoublePeriod').checked : false;
  var room = ($('schedFormRoom').value || '').trim();
  var subject = ($('schedFormSubject').value || '').trim();

  if (isNaN(period) || period < 1 || period > 8) {
    toast('請選擇有效節數 (1-8)', 'bad');
    return;
  }

  var sched = ScheduleEngine.getSchedule();
  if (!sched[day]) sched[day] = [];

  if (schedEditingSlotKey) {
    // Edit existing slot
    var oldDay = schedEditingSlotKey.day;
    var oldIdx = schedEditingSlotKey.idx;

    if (oldDay === day) {
      sched[day][oldIdx] = {
        period: period,
        class: schedSelectedClass,
        rawClass: schedSelectedClass,
        subject: subject,
        room: room
      };
    } else {
      sched[oldDay].splice(oldIdx, 1);
      sched[day].push({
        period: period,
        class: schedSelectedClass,
        rawClass: schedSelectedClass,
        subject: subject,
        room: room
      });
    }
  } else {
    // Add new slot(s)
    sched[day].push({
      period: period,
      class: schedSelectedClass,
      rawClass: schedSelectedClass,
      subject: subject,
      room: room
    });

    if (isDouble && period < 8) {
      sched[day].push({
        period: period + 1,
        class: schedSelectedClass,
        rawClass: schedSelectedClass,
        subject: subject,
        room: room
      });
    }
  }

  // Sort by period ascending
  sched[day].sort(function (a, b) { return a.period - b.period; });

  ScheduleEngine.setSchedule(sched);
  resetSchedForm();
  renderSchedTimetable();
  checkScheduleForToday();
  toast('已成功儲存課堂排程！', 'ok');
}

function renderSchedMatrix() {
  var tbody = $('schedMatrixTbody');
  if (!tbody || !window.ScheduleEngine) return;

  var sched = ScheduleEngine.getSchedule();
  var days = ['A', 'B', 'C', 'D', 'E', 'F'];
  var html = '';

  for (var p = 1; p <= 8; p++) {
    var timing = ScheduleEngine.getPeriodTiming(p, 'Normal');
    var timeStr = timing ? (timing.start + ' - ' + timing.end) : '';
    html += '<tr>';
    html += '<td style="font-weight:700;background:var(--surface-2)">第 ' + p + ' 堂<br><span class="muted" style="font-size:11px;font-family:monospace">' + esc(timeStr) + '</span></td>';

    for (var dIdx = 0; dIdx < days.length; dIdx++) {
      var d = days[dIdx];
      var matches = (sched[d] || []).filter(function (s) { return s.period === p; });
      html += '<td>';
      if (matches.length === 0) {
        html += '<span class="muted" style="font-size:11px">—</span>';
      } else {
        matches.forEach(function (m) {
          var isCur = ScheduleEngine.matchClass(schedSelectedClass, m.class);
          var st = isCur ? 'background:var(--brand);color:#fff;border-color:var(--brand)' : '';
          html += '<span class="sched-matrix-cell-class" data-cls="' + esc(m.class) + '" style="cursor:pointer;' + st + '" title="點擊切換維護 ' + esc(m.class) + '">' +
            esc(m.class) + (m.room ? ' (' + esc(m.room) + ')' : '') +
          '</span>';
        });
      }
      html += '</td>';
    }
    html += '</tr>';
  }

  tbody.innerHTML = html;
}

function renderSchedCalendarStats() {
  if (!window.ScheduleEngine) return;

  var cDays = ScheduleEngine.getCalendarDays();
  var events = ScheduleEngine.getNonCycleEvents();
  var isCustom = ScheduleEngine.isCustomCalendar();

  if ($('calStatTotalDays')) $('calStatTotalDays').textContent = String(cDays.length);

  // Calc cycles
  var maxCycle = 0;
  cDays.forEach(function (d) { if (d.cycle && d.cycle > maxCycle) maxCycle = d.cycle; });
  if ($('calStatCycles')) $('calStatCycles').textContent = String(maxCycle || 25);

  if ($('calStatRange')) {
    if (cDays.length > 0) {
      $('calStatRange').textContent = cDays[0].date + ' ~ ' + cDays[cDays.length - 1].date;
    } else {
      $('calStatRange').textContent = '—';
    }
  }

  if ($('calStatEvents')) $('calStatEvents').textContent = String(Object.keys(events).length);

  var tag = $('calSourceTag');
  if (tag) {
    tag.textContent = isCustom ? '自訂已上載校曆' : '系統預設官方校曆 (2026-2027)';
    tag.style.background = isCustom ? 'var(--brand)' : 'var(--surface-2)';
    tag.style.color = isCustom ? '#fff' : 'var(--text)';
  }
}

function doCalendarPreview(text) {
  if (!window.ScheduleEngine || !ScheduleEngine.parseCalendarCsv) return;
  var res = ScheduleEngine.parseCalendarCsv(text);
  var msgEl = $('calParseMsg');
  var wrap = $('calPreviewWrap');
  var tbody = $('calPreviewTbody');

  if (res.error) {
    if (msgEl) {
      msgEl.className = 'small text-danger';
      msgEl.textContent = '✕ ' + res.error;
    }
    if (wrap) wrap.hidden = true;
    return;
  }

  schedParsedCalendar = res;

  if (msgEl) {
    msgEl.className = 'small text-success';
    msgEl.textContent = '✓ 辨識到 ' + res.cycleDaysCount + ' 個循環日，' + res.eventsCount + ' 項假期/活動。' + (res.errors.length > 0 ? ' (' + res.errors.length + ' 行格式異常)' : '');
  }

  if (wrap && tbody) {
    wrap.hidden = false;
    var rowsHtml = '';
    (res.previewRows || []).forEach(function (r) {
      rowsHtml += '<tr>' +
        '<td style="font-family:monospace">' + esc(r.date) + '</td>' +
        '<td>' + esc(r.dayName) + '</td>' +
        '<td class="num">' + esc(r.cycle) + '</td>' +
        '<td><b>' + esc(r.cycleDay) + '</b></td>' +
        '<td>' + esc(r.tt) + '</td>' +
        '<td>' + esc(r.event) + '</td>' +
      '</tr>';
    });
    tbody.innerHTML = rowsHtml;
  }
}

/* =============================================================== dialogs */

function openModal(id) {
  if (id === 'classSetupModal') id = 'settingsModal';
  var el = $(id);
  if (el) el.hidden = false;
}

function closeModal(id) {
  if (id === 'classSetupModal') id = 'settingsModal';
  var el = $(id);
  if (el) el.hidden = true;
  if (id === 'askModal') askHandler = null;
}

function ask(o) {
  $('askTitle').textContent = o.title;
  $('askMsg').textContent = o.msg || '';
  $('askMsg').hidden = !o.msg;
  $('askOk').textContent = o.ok || 'OK';

  var inp = $('askInput');
  inp.hidden = (o.input === undefined);
  inp.value = o.input || '';

  askHandler = o.onOk;
  openModal('askModal');
  if (!inp.hidden) setTimeout(function () { inp.focus(); inp.select(); }, 30);
}

boot();
})();
