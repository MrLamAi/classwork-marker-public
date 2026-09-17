/**
 * In-memory stand-in for `pg`, covering exactly the statements lib/db.js issues.
 *
 * Used by dev/server.mjs when DATABASE_URL is not set, so the interface can be
 * worked on with no database and no network. It is a development aid only -
 * nothing here ships to Vercel.
 */

const db = { classes: [], students: [], sessions: [], marks: [], events: [], discipline: [] };

const norm = (s) => s.replace(/\s+/g, ' ').trim().toLowerCase();
const hhmm = (d) => String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');

/** Enough of a class to look real while designing: names on, a few handed in. */
export function seed() {
  db.classes = [
    { name: '1A', total: 32, cols: 8, seats: '' },
    { name: '1D', total: 32, cols: 8, seats: '' },
    { name: '2A', total: 30, cols: 6, seats: '' },
    { name: '2B', total: 32, cols: 8, seats: '' },
    { name: '2C', total: 32, cols: 8, seats: '' },
    { name: '2D', total: 32, cols: 8, seats: '' },
    { name: '4C', total: 38, cols: 6, seats: '' }
  ];

  const roster = [
    ['陳大文', 'Chan Tai Man', '', 'M'], ['黃小明', 'Wong Siu Ming', 'Michael', 'M'],
    ['李嘉欣', 'Lee Ka Yan', '', 'F'], ['何俊傑', 'Ho Chun Kit', '', 'M'],
    ['吳偉霖', 'Ng Wai Lam', '', 'M'], ['張浩然', 'Cheung Ho Yin', '', 'M'],
    ['林嘉盈', 'Lam Ka Ying', '', 'F'], ['曾志恒', 'Tsang Chi Hang', '', 'M'],
    ['楊美玲', 'Yeung Mei Ling', 'Amy', 'F'], ['郭子晴', 'Kwok Tsz Ching', '', 'F'],
    ['歐陽建', 'Au Yeung Kin', '', 'M'], ['潘思慧', 'Poon Sze Wai', '', 'F'],
    ['周家豪', 'Chow Ka Ho', '', 'M'], ['譚婉婷', 'Tam Yuen Ting', '', 'F'],
    ['馮志偉', 'Fung Chi Wai', '', 'M'], ['蘇文杰', 'So Man Kit', '', 'M'],
    ['劉凱靖', 'Lau Hoi Ching', '', 'F'], ['葉家文', 'Yip Ka Man', '', 'M'],
    ['麥子翹', 'Mak Tsz Kiu', '', 'F'], ['沈穎恩', 'Shum Wing Yan', 'Grace', 'F']
  ];
  db.students = roster.map(([zh, name, en, sex], i) =>
    ({ class: '1A', no: i + 1, name, name_zh: zh, name_en: en, sex }));

  const id = 'DEMO';
  db.sessions = [{ id, class: '1A', name: 'Worksheet 5', created_at: new Date() }];
  db.marks = [3, 5, 8, 12, 19, 21, 26, 33].map((no, i) => ({
    session_id: id,
    student_no: no,
    marked_at: new Date(Date.now() - (40 - i * 4) * 60_000)
  }));
  db.events = [
    { id: '1', session_id: id, class: '1A', student_no: 3, type: 'good_perf', label: '積極答問', note: '主動回答問題', created_at: new Date(Date.now() - 25 * 60_000) },
    { id: '2', session_id: id, class: '1A', student_no: 8, type: 'talking', label: '說話分心', note: '與鄰座交談', created_at: new Date(Date.now() - 15 * 60_000) }
  ];

  const todayStr = (() => {
    const d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  })();

  db.discipline = [
    { id: '1', class: '1A', student_no: 8, record_date: todayStr, record_time: '09:15', type: 'no_book', label: '欠帶課本', note: '未帶課本', created_at: new Date(Date.now() - 60 * 60_000) },
    { id: '2', class: '1A', student_no: 8, record_date: todayStr, record_time: '09:35', type: 'talking', label: '說話分心', note: '與同桌交頭接耳', created_at: new Date(Date.now() - 40 * 60_000) },
    { id: '3', class: '1A', student_no: 8, record_date: '2026-09-12', record_time: '14:20', type: 'no_hw', label: '欠交功課', note: '工作紙第3課未交', created_at: new Date(Date.now() - 2 * 86400_000) },
    { id: '4', class: '1A', student_no: 8, record_date: '2026-09-12', record_time: '14:25', type: 'no_book', label: '欠帶課本', note: '上一堂未帶課本', created_at: new Date(Date.now() - 2 * 86400_000) },
    { id: '5', class: '1A', student_no: 8, record_date: '2026-09-08', record_time: '10:05', type: 'no_book', label: '欠帶課本', note: '欠帶作業本', created_at: new Date(Date.now() - 6 * 86400_000) },
    { id: '6', class: '1A', student_no: 8, record_date: '2026-09-08', record_time: '10:30', type: 'sleeping', label: '課堂睡覺', note: '伏在課桌上', created_at: new Date(Date.now() - 6 * 86400_000) },
    { id: '7', class: '1A', student_no: 3, record_date: todayStr, record_time: '09:20', type: 'good_perf', label: '積極答問', note: '回答題目正確且詳盡', created_at: new Date(Date.now() - 55 * 60_000) },
    { id: '8', class: '1A', student_no: 3, record_date: '2026-09-10', record_time: '11:15', type: 'good_perf', label: '積極答問', note: '主動上台板書解題', created_at: new Date(Date.now() - 4 * 86400_000) }
  ];

  db.lessons = [
    { class: '1A', lesson_date: '2026-09-12', note: '正常開課', created_at: new Date(Date.now() - 2 * 86400_000) },
    { class: '1A', lesson_date: '2026-09-08', note: '正常開課', created_at: new Date(Date.now() - 6 * 86400_000) }
  ];
}

function exec(text, params = []) {
  const q = norm(text);
  const p = params;

  if (/^(begin|commit|rollback)$/.test(q)) return [];
  if (q.startsWith('create table') || q.startsWith('alter table') || q.startsWith('create index')) return [];

  if (q.includes('select class, count(*)') && q.includes('from students')) {
    const counts = {};
    for (const s of db.students) counts[s.class] = (counts[s.class] || 0) + 1;
    return Object.entries(counts).map(([cls, n]) => ({ class: cls, n }));
  }
  if (q.includes('select class, count(*)') && q.includes('from discipline_records')) {
    const counts = {};
    for (const d of (db.discipline || [])) counts[d.class] = (counts[d.class] || 0) + 1;
    return Object.entries(counts).map(([cls, n]) => ({ class: cls, n }));
  }
  if (q.includes('count(*)') && q.includes('from classes')) return [{ n: db.classes.length }];
  if (q.includes('count(*)') && q.includes('from students')) {
    if (q.includes('where class = $1')) return [{ n: db.students.filter((s) => s.class === p[0]).length }];
    return [{ n: db.students.length }];
  }
  if (q.includes('count(*)') && q.includes('from discipline_records')) {
    if (q.includes('where class = $1')) return [{ n: (db.discipline || []).filter((d) => d.class === p[0]).length }];
    return [{ n: (db.discipline || []).length }];
  }

  if (q.startsWith('insert into classes')) {
    const existing = db.classes.find((c) => c.name === p[0]);
    if (!existing) {
      db.classes.push({ name: p[0], total: p[1], cols: p[2], seats: p[3] || '' });
    }
    return [];
  }

  if (q.startsWith('select name, total, cols from classes'))
    return db.classes
      .map((c) => ({ name: c.name, total: c.total, cols: c.cols }))
      .sort((a, b) => a.name.localeCompare(b.name));

  if (q.startsWith('select name, total, cols, seats from classes where name')) {
    const c = db.classes.find((x) => x.name === p[0]);
    return c ? [{ ...c }] : [];
  }

  if (q.startsWith('select name, total, cols, seats from classes order by name limit 1')) {
    const c = [...db.classes].sort((a, b) => a.name.localeCompare(b.name))[0];
    return c ? [{ ...c }] : [];
  }

  if (q.startsWith('update classes set seats')) {
    if (q.includes('where name = $4')) {
      const c = db.classes.find((x) => x.name === p[3]);
      if (c) {
        c.seats = p[0];
        c.total = p[1];
        c.cols = p[2];
      }
      return [];
    }
    if (q.includes('where name = $2')) {
      const c = db.classes.find((x) => x.name === p[1]);
      if (c) {
        c.seats = p[0];
        if (q.includes('total = 32')) { c.total = 32; c.cols = 8; }
        else if (q.includes('total = 30')) { c.total = 30; c.cols = 6; }
      }
      return [];
    }
    const c = db.classes.find((x) => x.name === p[0]);
    if (c) c.seats = p[1];
    return [];
  }

  if (q.startsWith('select no, name, name_zh, name_en, sex from students'))
    return db.students
      .filter((s) => s.class === p[0])
      .sort((a, b) => a.no - b.no)
      .map((s) => ({ no: s.no, name: s.name, name_zh: s.name_zh, name_en: s.name_en, sex: s.sex }));

  if (q.startsWith('delete from students')) {
    if (q.includes('and no = $2')) {
      db.students = db.students.filter((s) => !(s.class === p[0] && s.no === p[1]));
    } else {
      db.students = db.students.filter((s) => s.class !== p[0]);
    }
    return [];
  }

  if (q.startsWith('insert into students')) {
    if (q.includes('on conflict (class, no)')) {
      for (let i = 0; i < p.length; i += 6) {
        const cls = p[i];
        const no = p[i + 1];
        const name = p[i + 2];
        const name_zh = p[i + 3];
        const name_en = p[i + 4];
        const sex = p[i + 5];
        const existing = db.students.find((s) => s.class === cls && s.no === no);
        if (existing) {
          if (q.includes('do update')) {
            existing.name = name;
            existing.name_zh = name_zh;
            existing.name_en = name_en;
            existing.sex = sex;
          }
        } else {
          db.students.push({ class: cls, no, name, name_zh, name_en, sex });
        }
      }
      return [];
    }
    const cls = p[0];
    for (let i = 1; i < p.length; i += 5) {
      db.students.push({
        class: cls, no: p[i], name: p[i + 1], name_zh: p[i + 2], name_en: p[i + 3], sex: p[i + 4]
      });
    }
    return [];
  }

  if (q.startsWith('select id, name from sessions')) {
    const today = new Date().toDateString();
    return db.sessions
      .filter((s) => s.class === p[0] && s.created_at.toDateString() === today)
      .sort((a, b) => b.created_at - a.created_at)
      .map((s) => ({ id: s.id, name: s.name }));
  }

  if (q.startsWith('insert into sessions')) {
    for (let i = 0; i < p.length; i += 3) {
      if (!db.sessions.some((s) => s.id === p[i])) {
        db.sessions.push({ id: p[i], class: p[i + 1], name: p[i + 2], created_at: new Date() });
      }
    }
    return [{ id: p[0] }];
  }

  if (q.startsWith('select student_no'))
    return db.marks
      .filter((m) => m.session_id === p[0])
      .map((m) => ({ student_no: m.student_no, t: hhmm(m.marked_at) }));

  if (q.startsWith('delete from marks where session_id = $1 and student_no')) {
    const i = db.marks.findIndex((m) => m.session_id === p[0] && m.student_no === p[1]);
    if (i < 0) return [];
    db.marks.splice(i, 1);
    return [{ student_no: p[1] }];
  }

  if (q.startsWith('insert into marks')) {
    for (let i = 0; i < p.length; i += 2) {
      let m = db.marks.find((x) => x.session_id === p[i] && x.student_no === p[i + 1]);
      if (!m) {
        m = { session_id: p[i], student_no: p[i + 1], marked_at: new Date() };
        db.marks.push(m);
      }
    }
    return [{ t: hhmm(new Date()) }];
  }

  if (q.startsWith('delete from marks where session_id')) {
    db.marks = db.marks.filter((m) => m.session_id !== p[0]);
    return [];
  }

  if (q.startsWith('select id::text, session_id, class, student_no, type, label, note, to_char(created_at')) {
    return (db.events || [])
      .filter((e) => e.session_id === p[0])
      .sort((a, b) => b.created_at - a.created_at)
      .map((e) => ({
        id: String(e.id),
        session_id: e.session_id,
        class: e.class,
        student_no: e.student_no,
        type: e.type,
        label: e.label,
        note: e.note || '',
        t: hhmm(e.created_at),
        created_at: e.created_at
      }));
  }

  if (q.startsWith('insert into lesson_events')) {
    const newEvent = {
      id: String((db.events || []).length + 1),
      session_id: p[0],
      class: p[1],
      student_no: p[2],
      type: p[3],
      label: p[4],
      note: p[5] || '',
      created_at: new Date()
    };
    db.events = db.events || [];
    db.events.unshift(newEvent);
    return [{
      id: newEvent.id,
      session_id: newEvent.session_id,
      class: newEvent.class,
      student_no: newEvent.student_no,
      type: newEvent.type,
      label: newEvent.label,
      note: newEvent.note,
      t: hhmm(newEvent.created_at),
      created_at: newEvent.created_at
    }];
  }

  if (q.startsWith('delete from lesson_events where id = $1')) {
    db.events = db.events || [];
    const idx = db.events.findIndex((e) => String(e.id) === String(p[0]));
    if (idx < 0) return [];
    const [deleted] = db.events.splice(idx, 1);
    return [{ id: String(deleted.id), session_id: deleted.session_id, student_no: deleted.student_no }];
  }

  if (q.startsWith('delete from lesson_events where session_id = $1')) {
    db.events = (db.events || []).filter((e) => e.session_id !== p[0]);
    return [];
  }

  if (q.startsWith('insert into discipline_records')) {
    db.discipline = db.discipline || [];
    const inserted = [];
    for (let i = 0; i < p.length; i += 7) {
      const newRec = {
        id: String(db.discipline.length + 1),
        class: p[i],
        student_no: p[i + 1],
        record_date: p[i + 2],
        record_time: p[i + 3] || '',
        type: p[i + 4],
        label: p[i + 5],
        note: p[i + 6] || '',
        created_at: new Date()
      };
      db.discipline.unshift(newRec);
      inserted.push({
        id: newRec.id,
        class: newRec.class,
        student_no: newRec.student_no,
        date: newRec.record_date,
        time: newRec.record_time,
        type: newRec.type,
        label: newRec.label,
        note: newRec.note,
        created_at: newRec.created_at
      });
    }
    return inserted;
  }

  if (q.startsWith('delete from discipline_records where id = $1')) {
    db.discipline = db.discipline || [];
    const idx = db.discipline.findIndex((r) => String(r.id) === String(p[0]));
    if (idx < 0) return [];
    const [deleted] = db.discipline.splice(idx, 1);
    return [{ id: String(deleted.id), class: deleted.class, student_no: deleted.student_no }];
  }

  if (q.startsWith('delete from discipline_records where class = $1 and record_date')) {
    db.discipline = (db.discipline || []).filter((r) => !(r.class === p[0] && r.record_date === p[1]));
    return [];
  }

  if (q.includes('from discipline_records')) {
    let rows = [...(db.discipline || [])];
    if (q.includes('where class = $1 and student_no = $2')) {
      rows = rows.filter((r) => r.class === p[0] && Number(r.student_no) === Number(p[1]));
    } else if (q.includes('where class = $1 and record_date = $2')) {
      rows = rows.filter((r) => r.class === p[0] && r.record_date === p[1]);
    } else if (q.includes('where class = $1')) {
      rows = rows.filter((r) => r.class === p[0]);
    }
    return rows.map((r) => ({
      id: String(r.id),
      class: r.class,
      student_no: r.student_no,
      date: r.record_date,
      time: r.record_time || '',
      type: r.type,
      label: r.label,
      note: r.note || '',
      created_at: r.created_at
    }));
  }

  if (q.startsWith('insert into class_lessons')) {
    db.lessons = db.lessons || [];
    for (let i = 0; i < p.length; i += 3) {
      const cls = p[i], date = p[i + 1], note = p[i + 2] || '';
      const existing = db.lessons.find((l) => l.class === cls && l.lesson_date === date);
      if (existing) {
        existing.note = note;
      } else {
        db.lessons.push({ class: cls, lesson_date: date, note: note, created_at: new Date() });
      }
    }
    return [];
  }

  if (q.startsWith('delete from class_lessons where class = $1 and lesson_date')) {
    db.lessons = (db.lessons || []).filter((l) => !(l.class === p[0] && l.lesson_date === p[1]));
    return [];
  }

  if (q.includes('from class_lessons')) {
    db.lessons = db.lessons || [];
    let rows = db.lessons;
    if (q.includes('where class = $1')) {
      rows = rows.filter((l) => l.class === p[0]);
    }
    return rows.map((l) => ({
      date: l.lesson_date,
      note: l.note || ''
    }));
  }

  throw new Error('memory-pg: unhandled SQL -> ' + q.slice(0, 140));
}

class Client {
  async query(text, params) { return { rows: exec(text, params) }; }
  release() {}
}

class Pool {
  async query(text, params) { return { rows: exec(text, params) }; }
  async connect() { return new Client(); }
}

export default { Pool, Client, types: { setTypeParser() {} } };
