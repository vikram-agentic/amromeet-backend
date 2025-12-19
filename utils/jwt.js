import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
const JWT_EXPIRES_IN = '7d';
const REFRESH_TOKEN_EXPIRES_IN = '30d';

export function generateToken(userId, email) {
  return jwt.sign(
    { userId, email },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN }
  );
}

export function generateRefreshToken(userId) {
  return jwt.sign(
    { userId },
    JWT_SECRET,
    { expiresIn: REFRESH_TOKEN_EXPIRES_IN }
  );
}

export function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (error) {
    return null;
  }
}

export function generateResetToken() {
  return require('crypto').randomBytes(32).toString('hex');
}

export function generateVerificationToken() {
  return require('crypto').randomBytes(32).toString('hex');
}
