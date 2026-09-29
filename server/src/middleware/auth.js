const User = require('../models/User');
const HttpError = require('../utils/HttpError');
const { verifyToken } = require('../utils/tokens');

// Reads "Authorization: Bearer <token>" and attaches req.user.
async function requireAuth(req, _res, next) {
  const header = req.headers.authorization || '';
  const [scheme, token] = header.split(' ');
  if (scheme !== 'Bearer' || !token) throw new HttpError(401, 'Missing auth token');

  let payload;
  try {
    payload = verifyToken(token);
  } catch {
    throw new HttpError(401, 'Invalid or expired token');
  }

  const user = await User.findById(payload.sub);
  if (!user) throw new HttpError(401, 'User no longer exists');
  req.user = user;
  next();
}

module.exports = requireAuth;
