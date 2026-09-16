import { checkApiKey, isAuthed } from '../lib/auth.js';
import {
  ensureSchema, sessionId, setMark,
  getOrCreateActiveSession, recordLessonEvent, recordDiscipline
} from '../lib/db.js';

/**
 * External Integration API for lab PCs, client software, or automated scripts.
 * Authentication:
 *   - Header: `x-api-key: <API_KEY or APP_PASSCODE>`
 *   - Or: `Authorization: Bearer <API_KEY or APP_PASSCODE>`
 *   - Or JSON body / query: `api_key: <API_KEY or APP_PASSCODE>`
 *
 * Actions:
 *   - POST (default: mark classwork completion):
 *       { "class": "1A", "student_no": 12, "assignment": "Worksheet 5 (ABC4)" [optional], "status": "marked" }
 *   - POST (batch mark):
 *       { "class": "1A", "students": [12, 14, 15] }
 *   - POST (event logging):
 *       { "class": "1A", "student_no": 12, "action": "event", "type": "sleeping", "label": "睡覺" }
 */
export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-api-key');
    return res.status(204).end();
  }

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 'no-store');

  if (!checkApiKey(req) && !isAuthed(req)) {
    return res.status(401).json({
      error: 'unauthorized',
      message: 'Provide valid API key or passcode via x-api-key header or api_key parameter'
    });
  }

  await ensureSchema();

  if (req.method === 'GET') {
    return res.status(200).json({
      ok: true,
      service: 'LessonPro Computer Software Sync API',
      status: 'ready',
      timestamp: new Date().toISOString()
    });
  }

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST, OPTIONS');
    return res.status(405).json({ error: 'method not allowed' });
  }

  const {
    action = 'mark',
    class: cls,
    assignment,
    student_no,
    no,
    students,
    status = 'marked',
    type,
    label,
    note
  } = req.body || {};

  const targetClass = String(cls || req.body.class_name || '').trim();
  if (!targetClass) {
    return res.status(400).json({ error: 'Class name is required (e.g. "1A")' });
  }

  let activeSession;
  try {
    activeSession = await getOrCreateActiveSession(targetClass, assignment);
  } catch (err) {
    return res.status(404).json({ error: err.message || 'Failed to locate or create session' });
  }

  const sid = sessionId(activeSession);
  if (!sid) {
    return res.status(500).json({ error: 'Could not resolve session id' });
  }

  // Action 1: Record discipline / performance event
  if (action === 'event' || action === 'discipline') {
    const studentNum = parseInt(student_no || no, 10);
    if (!studentNum) return res.status(400).json({ error: 'Valid student_no is required' });
    const evType = type || req.body.stamp_key || 'general';
    const evLabel = label || req.body.category || evType;
    const [ev, disc] = await Promise.all([
      recordLessonEvent(sid, targetClass, studentNum, evType, evLabel, note),
      recordDiscipline(targetClass, studentNum, req.body.date, req.body.time, evType, evLabel, note).catch(() => null)
    ]);
    const resData = disc || ev;
    return res.status(200).json({
      ok: true,
      action: 'event',
      class: targetClass,
      assignment: activeSession,
      student_no: studentNum,
      event: resData,
      record: resData
    });
  }

  // Action 2: Mark classwork completion (single or batch)
  const isMarked = (status !== 'unmarked' && status !== false);

  if (Array.isArray(students)) {
    const results = [];
    for (const s of students) {
      const n = parseInt(s, 10);
      if (n > 0) {
        const r = await setMark(sid, n, isMarked);
        results.push({ student_no: n, status: r.status, time: r.time });
      }
    }
    return res.status(200).json({
      ok: true,
      class: targetClass,
      assignment: activeSession,
      status: isMarked ? 'marked' : 'unmarked',
      total_updated: results.length,
      students: results
    });
  }

  const studentNum = parseInt(student_no || no, 10);
  if (!studentNum) {
    return res.status(400).json({ error: 'Valid student_no or students array is required' });
  }

  const r = await setMark(sid, studentNum, isMarked);
  return res.status(200).json({
    ok: true,
    class: targetClass,
    assignment: activeSession,
    student_no: studentNum,
    status: r.status,
    time: r.time
  });
}
