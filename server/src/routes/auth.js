const express = require('express');
const { z } = require('zod');
const User = require('../models/User');
const HttpError = require('../utils/HttpError');
const validate = require('../middleware/validate');
const requireAuth = require('../middleware/auth');
const { signToken } = require('../utils/tokens');

const router = express.Router();

const registerSchema = z.object({
  name: z.string().trim().min(1).max(60),
  email: z.email().trim().toLowerCase(),
  password: z.string().min(8, 'must be at least 8 characters').max(100),
});

const loginSchema = z.object({
  email: z.email().trim().toLowerCase(),
  password: z.string().min(1),
});

router.post('/register', validate(registerSchema), async (req, res) => {
  const { name, email, password } = req.body;
  if (await User.exists({ email })) throw new HttpError(409, 'Email is already registered');

  const user = await User.create({ name, email, passwordHash: await User.hashPassword(password) });
  res.status(201).json({ token: signToken(user), user: user.toPublic() });
});

router.post('/login', validate(loginSchema), async (req, res) => {
  const { email, password } = req.body;
  const user = await User.findOne({ email }).select('+passwordHash');
  // Same message for "no user" and "wrong password" so attackers can't probe emails.
  if (!user || !(await user.checkPassword(password))) {
    throw new HttpError(401, 'Invalid email or password');
  }
  res.json({ token: signToken(user), user: user.toPublic() });
});

router.get('/me', requireAuth, (req, res) => {
  res.json({ user: req.user.toPublic() });
});

module.exports = router;
