import express from 'express';
import { pool } from '../config/database.js';
import { hashPassword, comparePassword } from '../utils/password.js';
import { generateToken, generateRefreshToken } from '../utils/jwt.js';
import { validate, signupSchema, loginSchema } from '../utils/validators.js';
import { v4 as uuidv4 } from 'uuid';

const router = express.Router();

// Signup
router.post('/signup', async (req, res, next) => {
  try {
    const validation = await validate(signupSchema, req.body);
    if (!validation.valid) {
      return res.status(400).json({ errors: validation.errors });
    }

    const { email, password, firstName, lastName, companyName } = validation.data;

    // Check if user already exists
    const existingUser = await pool.query(
      'SELECT id FROM users WHERE email = $1',
      [email.toLowerCase()]
    );

    if (existingUser.rows.length > 0) {
      return res.status(409).json({ error: 'Email already registered' });
    }

    // Hash password
    const passwordHash = await hashPassword(password);

    // Create user
    const userId = uuidv4();
    const result = await pool.query(
      `INSERT INTO users (id, email, password_hash, first_name, last_name, company_name)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, email, first_name, last_name, company_name, created_at`,
      [userId, email.toLowerCase(), passwordHash, firstName || null, lastName || null, companyName || null]
    );

    // Create user settings
    await pool.query(
      `INSERT INTO user_settings (user_id) VALUES ($1)`,
      [userId]
    );

    // Create page customization
    await pool.query(
      `INSERT INTO page_customizations (user_id) VALUES ($1)`,
      [userId]
    );

    const user = result.rows[0];
    const token = generateToken(user.id, user.email);
    const refreshToken = generateRefreshToken(user.id);

    res.status(201).json({
      success: true,
      message: 'Account created successfully',
      user: {
        id: user.id,
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name,
        companyName: user.company_name
      },
      token,
      refreshToken
    });
  } catch (error) {
    next(error);
  }
});

// Login
router.post('/login', async (req, res, next) => {
  try {
    const validation = await validate(loginSchema, req.body);
    if (!validation.valid) {
      return res.status(400).json({ errors: validation.errors });
    }

    const { email, password } = validation.data;

    // Find user
    const result = await pool.query(
      'SELECT id, email, password_hash, first_name, last_name, company_name FROM users WHERE email = $1 AND deleted_at IS NULL',
      [email.toLowerCase()]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const user = result.rows[0];

    // Compare passwords
    const passwordMatch = await comparePassword(password, user.password_hash);
    if (!passwordMatch) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const token = generateToken(user.id, user.email);
    const refreshToken = generateRefreshToken(user.id);

    res.json({
      success: true,
      message: 'Login successful',
      user: {
        id: user.id,
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name,
        companyName: user.company_name
      },
      token,
      refreshToken
    });
  } catch (error) {
    next(error);
  }
});

// Refresh token
router.post('/refresh', async (req, res, next) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(400).json({ error: 'Refresh token required' });
    }

    // Verify refresh token (simplified - in production use JWT verification)
    const result = await pool.query(
      'SELECT id, email FROM users WHERE id = $1 AND deleted_at IS NULL',
      [refreshToken] // In production, decode the JWT first
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid refresh token' });
    }

    const user = result.rows[0];
    const newToken = generateToken(user.id, user.email);
    const newRefreshToken = generateRefreshToken(user.id);

    res.json({
      success: true,
      token: newToken,
      refreshToken: newRefreshToken
    });
  } catch (error) {
    next(error);
  }
});

// Logout (just return success, token is handled client-side)
router.post('/logout', (req, res) => {
  res.json({
    success: true,
    message: 'Logged out successfully'
  });
});

export default router;
