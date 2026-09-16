import { guard } from '../lib/auth.js';
import { buildBundle } from '../lib/db.js';

export default guard(async (req, res) => {
  const bundle = await buildBundle(req.query.class, req.query.assignment, req.query.date, req.query.prev_date);
  res.setHeader('Cache-Control', 'no-store');
  return res.status(200).json(bundle);
});
