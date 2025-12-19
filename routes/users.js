import express from 'express';
import { pool } from '../config/database.js';
import { validate, userSettingsSchema } from '../utils/validators.js';

const router = express.Router();

// Get user profile
router.get('/profile', async (req, res, next) => {
  try {
    const result = await pool.query(
      `SELECT id, email, first_name, last_name, company_name, avatar_url, timezone, phone, bio, website, created_at, updated_at
       FROM users WHERE id = $1 AND deleted_at IS NULL`,
      [req.userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const user = result.rows[0];
    res.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name,
        companyName: user.company_name,
        avatarUrl: user.avatar_url,
        timezone: user.timezone,
        phone: user.phone,
        bio: user.bio,
        website: user.website,
        createdAt: user.created_at,
        updatedAt: user.updated_at
      }
    });
  } catch (error) {
    next(error);
  }
});

// Update user profile
router.put('/profile', async (req, res, next) => {
  try {
    const { firstName, lastName, companyName, phone, bio, website, timezone, avatarUrl } = req.body;

    const result = await pool.query(
      `UPDATE users
       SET first_name = COALESCE($1, first_name),
           last_name = COALESCE($2, last_name),
           company_name = COALESCE($3, company_name),
           phone = COALESCE($4, phone),
           bio = COALESCE($5, bio),
           website = COALESCE($6, website),
           timezone = COALESCE($7, timezone),
           avatar_url = COALESCE($8, avatar_url),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $9 AND deleted_at IS NULL
       RETURNING id, email, first_name, last_name, company_name, avatar_url, timezone, phone, bio, website`,
      [firstName, lastName, companyName, phone, bio, website, timezone, avatarUrl, req.userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const user = result.rows[0];
    res.json({
      success: true,
      message: 'Profile updated successfully',
      user: {
        id: user.id,
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name,
        companyName: user.company_name,
        avatarUrl: user.avatar_url,
        timezone: user.timezone,
        phone: user.phone,
        bio: user.bio,
        website: user.website
      }
    });
  } catch (error) {
    next(error);
  }
});

// Get user settings
router.get('/settings', async (req, res, next) => {
  try {
    const result = await pool.query(
      `SELECT id, theme, language, notification_email, notification_sms, notification_push,
              auto_reschedule, default_meeting_duration, buffer_time_before, buffer_time_after,
              max_bookings_per_day, enable_cancellations, cancellation_notice_hours
       FROM user_settings WHERE user_id = $1`,
      [req.userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Settings not found' });
    }

    const settings = result.rows[0];
    res.json({
      success: true,
      settings: {
        id: settings.id,
        theme: settings.theme,
        language: settings.language,
        notificationEmail: settings.notification_email,
        notificationSms: settings.notification_sms,
        notificationPush: settings.notification_push,
        autoReschedule: settings.auto_reschedule,
        defaultMeetingDuration: settings.default_meeting_duration,
        bufferTimeBefore: settings.buffer_time_before,
        bufferTimeAfter: settings.buffer_time_after,
        maxBookingsPerDay: settings.max_bookings_per_day,
        enableCancellations: settings.enable_cancellations,
        cancellationNoticeHours: settings.cancellation_notice_hours
      }
    });
  } catch (error) {
    next(error);
  }
});

// Update user settings
router.put('/settings', async (req, res, next) => {
  try {
    const validation = await validate(userSettingsSchema, req.body);
    if (!validation.valid) {
      return res.status(400).json({ errors: validation.errors });
    }

    const {
      theme, language, notification_email, notification_sms, notification_push,
      default_meeting_duration, buffer_time_before, buffer_time_after,
      max_bookings_per_day, enable_cancellations, cancellation_notice_hours, timezone
    } = validation.data;

    // Update timezone in users table if provided
    if (timezone) {
      await pool.query(
        'UPDATE users SET timezone = $1 WHERE id = $2',
        [timezone, req.userId]
      );
    }

    const result = await pool.query(
      `UPDATE user_settings
       SET theme = COALESCE($1, theme),
           language = COALESCE($2, language),
           notification_email = COALESCE($3, notification_email),
           notification_sms = COALESCE($4, notification_sms),
           notification_push = COALESCE($5, notification_push),
           default_meeting_duration = COALESCE($6, default_meeting_duration),
           buffer_time_before = COALESCE($7, buffer_time_before),
           buffer_time_after = COALESCE($8, buffer_time_after),
           max_bookings_per_day = COALESCE($9, max_bookings_per_day),
           enable_cancellations = COALESCE($10, enable_cancellations),
           cancellation_notice_hours = COALESCE($11, cancellation_notice_hours),
           updated_at = CURRENT_TIMESTAMP
       WHERE user_id = $12
       RETURNING *`,
      [theme, language, notification_email, notification_sms, notification_push,
       default_meeting_duration, buffer_time_before, buffer_time_after,
       max_bookings_per_day, enable_cancellations, cancellation_notice_hours, req.userId]
    );

    const settings = result.rows[0];
    res.json({
      success: true,
      message: 'Settings updated successfully',
      settings: {
        id: settings.id,
        theme: settings.theme,
        language: settings.language,
        notificationEmail: settings.notification_email,
        notificationSms: settings.notification_sms,
        notificationPush: settings.notification_push,
        defaultMeetingDuration: settings.default_meeting_duration,
        bufferTimeBefore: settings.buffer_time_before,
        bufferTimeAfter: settings.buffer_time_after,
        maxBookingsPerDay: settings.max_bookings_per_day,
        enableCancellations: settings.enable_cancellations,
        cancellationNoticeHours: settings.cancellation_notice_hours
      }
    });
  } catch (error) {
    next(error);
  }
});

// Delete account
router.delete('/account', async (req, res, next) => {
  try {
    const { password } = req.body;

    if (!password) {
      return res.status(400).json({ error: 'Password required for account deletion' });
    }

    // Verify password before deletion
    const userResult = await pool.query(
      'SELECT password_hash FROM users WHERE id = $1',
      [req.userId]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Soft delete
    await pool.query(
      'UPDATE users SET deleted_at = CURRENT_TIMESTAMP WHERE id = $1',
      [req.userId]
    );

    res.json({
      success: true,
      message: 'Account deleted successfully'
    });
  } catch (error) {
    next(error);
  }
});

export default router;
