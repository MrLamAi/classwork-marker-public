import { guard } from '../lib/auth.js';
import {
  ensureSchema, sessionId, toggleMark, clearSession,
  saveLayout, saveStudents, createSession,
  createClass, deleteClass, updateClass,
  recordLessonEvent, deleteLessonEvent, clearLessonEvents,
  recordDiscipline, deleteDisciplineRecord, getStudentDisciplineHistory,
  clearClassDisciplineForDate, confirmLesson, deleteLessonDate
} from '../lib/db.js';

/**
 * One POST endpoint for every write, dispatched on `action`. Keeps the project
 * comfortably under Vercel's function count and means one warm container serves
 * all of them.
 */
export default guard(async (req, res) => {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'method not allowed' });
  }

  await ensureSchema();
  const body = req.body || {};
  const action = body.action;
  const cls = body.cls || body.class;
  const no = body.no !== undefined ? body.no : body.student_no;
  const assignment = body.assignment;
  const seats = body.seats;
  const students = body.students;
  const name = body.name;
  const total = body.total;
  const cols = body.cols;
  const type = body.type || body.stamp_key;
  const label = body.label || body.category;
  const note = body.note;
  const date = body.date;
  const time = body.time;

  switch (action) {
    case 'mark': {
      const sid = sessionId(assignment);
      if (!sid) return res.status(400).json({ error: 'unknown assignment' });
      const n = parseInt(no, 10);
      if (!n) return res.status(400).json({ error: 'bad student number' });
      return res.status(200).json(await toggleMark(sid, n));
    }

    case 'clear': {
      const sid = sessionId(assignment);
      if (!sid) return res.status(400).json({ error: 'unknown assignment' });
      await clearSession(sid);
      return res.status(200).json({ ok: true });
    }

    case 'layout': {
      if (!cls || !Array.isArray(seats)) return res.status(400).json({ error: 'bad layout' });
      await saveLayout(cls, seats);
      return res.status(200).json({ ok: true });
    }

    case 'students': {
      if (!cls || !Array.isArray(students)) return res.status(400).json({ error: 'bad list' });
      return res.status(200).json(await saveStudents(cls, students));
    }

    case 'session': {
      if (!cls) return res.status(400).json({ error: 'no class' });
      return res.status(200).json({ assignment: await createSession(cls, name) });
    }

    case 'createClass': {
      if (!name) return res.status(400).json({ error: 'class name required' });
      return res.status(200).json(await createClass(name, total, cols));
    }

    case 'updateClass': {
      if (!cls) return res.status(400).json({ error: 'class name required' });
      return res.status(200).json(await updateClass(cls, total, cols));
    }

    case 'deleteClass': {
      if (!cls) return res.status(400).json({ error: 'class name required' });
      return res.status(200).json(await deleteClass(cls));
    }

    case 'recordEvent': {
      const sid = sessionId(assignment);
      if (!sid) return res.status(400).json({ error: 'unknown assignment' });
      const n = parseInt(no, 10);
      if (!n) return res.status(400).json({ error: 'bad student number' });
      const ev = await recordLessonEvent(sid, cls, n, req.body.type, req.body.label, req.body.note);
      return res.status(200).json({ ok: true, event: ev });
    }

    case 'deleteEvent': {
      if (!req.body.id) return res.status(400).json({ error: 'event id required' });
      const deleted = await deleteLessonEvent(req.body.id);
      return res.status(200).json({ ok: true, deleted });
    }

    case 'clearEvents': {
      const sid = sessionId(assignment);
      if (!sid) return res.status(400).json({ error: 'unknown assignment' });
      await clearLessonEvents(sid);
      return res.status(200).json({ ok: true });
    }

    case 'recordDiscipline': {
      if (!cls) return res.status(400).json({ error: 'class required' });
      const n = parseInt(no, 10);
      if (!n) return res.status(400).json({ error: 'bad student number' });
      const record = await recordDiscipline(cls, n, date, time, type, label, note);
      return res.status(200).json({ ok: true, record });
    }

    case 'deleteDiscipline': {
      if (!req.body.id) return res.status(400).json({ error: 'record id required' });
      const deleted = await deleteDisciplineRecord(req.body.id);
      return res.status(200).json({ ok: true, deleted });
    }

    case 'getStudentHistory': {
      if (!cls) return res.status(400).json({ error: 'class required' });
      const n = parseInt(no, 10);
      if (!n) return res.status(400).json({ error: 'bad student number' });
      const history = await getStudentDisciplineHistory(cls, n);
      return res.status(200).json({ ok: true, history });
    }

    case 'clearDisciplineDate': {
      if (!cls) return res.status(400).json({ error: 'class required' });
      await clearClassDisciplineForDate(cls, req.body.date);
      return res.status(200).json({ ok: true });
    }

    case 'confirmLesson': {
      if (!cls) return res.status(400).json({ error: 'class required' });
      return res.status(200).json(await confirmLesson(cls, date, note));
    }

    case 'deleteLessonDate': {
      if (!cls) return res.status(400).json({ error: 'class required' });
      return res.status(200).json(await deleteLessonDate(cls, date));
    }

    default:
      return res.status(400).json({ error: `unknown action: ${action}` });
  }
});
