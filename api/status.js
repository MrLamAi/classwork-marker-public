import { guard } from '../lib/auth.js';
import { ensureSchema, getStatus, getLessonEvents, getClassDisciplineSummary, sessionId } from '../lib/db.js';

/** Polled every few seconds by every open client - keep it fast. */
export default guard(async (req, res) => {
  await ensureSchema();
  const sid = sessionId(req.query.assignment);
  const status = await getStatus(sid);
  res.setHeader('Cache-Control', 'no-store');

  if (req.query.events === '1' || req.query.full === '1' || req.query.discipline === '1') {
    const [events, discipline] = await Promise.all([
      getLessonEvents(sid),
      req.query.cls ? getClassDisciplineSummary(req.query.cls, req.query.date) : Promise.resolve(null)
    ]);
    return res.status(200).json({ marks: status, events, discipline });
  }

  return res.status(200).json(status);
});
