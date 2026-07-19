// GET /api/auth/me -> { username } atau { username: null }
import { currentUser } from '../../lib/auth.js';

export default async function handler(req, res) {
  const username = await currentUser(req);
  res.setHeader('Cache-Control', 'no-store');
  return res.status(200).json({ username });
}
