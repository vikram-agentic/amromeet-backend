import express from 'express';
import { pool } from '../config/database.js';

const router = express.Router();

// Generate embed code
router.get('/:username/embed-code', async (req, res, next) => {
  try {
    const { username } = req.params;

    // Get user by username (slug)
    const userResult = await pool.query(
      `SELECT u.id FROM users u
       WHERE u.id IN (
         SELECT DISTINCT user_id FROM event_types WHERE slug = $1
       ) LIMIT 1`,
      [username]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const userId = userResult.rows[0].id;

    // Get user's page customization
    const customizationResult = await pool.query(
      `SELECT * FROM page_customizations WHERE user_id = $1`,
      [userId]
    );

    const customization = customizationResult.rows[0] || {};

    // Generate embed code
    const embedCode = `
<!-- Amromeet Booking Widget -->
<div id="amromeet-booking" data-username="${username}"></div>
<script src="${process.env.EMBED_SCRIPT_URL || 'https://amromeet.com/embed.js'}" async></script>
<style>
  #amromeet-booking {
    max-width: 600px;
    margin: 0 auto;
  }
</style>
    `.trim();

    res.json({
      success: true,
      embedCode,
      customization: {
        primaryColor: customization.primary_color,
        secondaryColor: customization.secondary_color,
        showPoweredBy: customization.show_powered_by
      }
    });
  } catch (error) {
    next(error);
  }
});

// Public booking page
router.get('/:username', async (req, res, next) => {
  try {
    const { username } = req.params;
    console.log('Embed request for username:', username);

    if (!username) {
      return res.status(400).json({ error: 'Username is required' });
    }

    // Try exact slug match first, then try matching with UUID suffix
    let eventResult = await pool.query(
      `SELECT et.id, et.user_id, et.name, et.description, et.duration_minutes,
              et.color, u.first_name, u.last_name, u.company_name, u.avatar_url
       FROM event_types et
       JOIN users u ON et.user_id = u.id
       WHERE et.slug = $1 AND et.is_active = TRUE AND et.deleted_at IS NULL
       LIMIT 1`,
      [username]
    );

    console.log('Exact slug match found:', eventResult.rows.length);

    // If not found and username looks like it might have a UUID suffix, try base slug
    if (eventResult.rows.length === 0 && username.match(/-[a-f0-9]{8}$/)) {
      const baseSlug = username.replace(/-[a-f0-9]{8}$/, '');
      console.log('Trying base slug:', baseSlug);
      eventResult = await pool.query(
        `SELECT et.id, et.user_id, et.name, et.description, et.duration_minutes,
                et.color, u.first_name, u.last_name, u.company_name, u.avatar_url
         FROM event_types et
         JOIN users u ON et.user_id = u.id
         WHERE et.slug LIKE $1 AND et.is_active = TRUE AND et.deleted_at IS NULL
         ORDER BY et.created_at DESC
         LIMIT 1`,
        [`${baseSlug}-%`]
      );
      console.log('Base slug match found:', eventResult.rows.length);
    }

    if (eventResult.rows.length === 0) {
      console.log('No event found for:', username);
      return res.status(404).json({ error: 'Event not found' });
    }

    console.log('Event found:', eventResult.rows[0].name);

    const event = eventResult.rows[0];

    // Get availability slots
    const slotsResult = await pool.query(
      `SELECT day_of_week, start_time, end_time FROM availability_slots
       WHERE event_type_id = $1 AND is_active = TRUE`,
      [event.id]
    );

    // Get customization
    const customResult = await pool.query(
      `SELECT * FROM page_customizations WHERE user_id = $1`,
      [event.user_id]
    );

    const customization = customResult.rows[0] || {};

    res.json({
      success: true,
      event: {
        id: event.id,
        name: event.name,
        description: event.description,
        durationMinutes: event.duration_minutes,
        color: event.color,
        organizer: {
          firstName: event.first_name,
          lastName: event.last_name,
          companyName: event.company_name,
          avatarUrl: event.avatar_url
        },
        availabilitySlots: slotsResult.rows.map(s => ({
          dayOfWeek: s.day_of_week,
          startTime: s.start_time,
          endTime: s.end_time
        })),
        customization: {
          title: customization.title,
          description: customization.description,
          heroImage: customization.hero_image,
          logoUrl: customization.logo_url,
          primaryColor: customization.primary_color,
          secondaryColor: customization.secondary_color,
          backgroundColor: customization.background_image
        }
      }
    });
  } catch (error) {
    next(error);
  }
});

// Get public user profile for embed
router.get('/user/:username/profile', async (req, res, next) => {
  try {
    const { username } = req.params;

    // Get user by event type slug
    const userResult = await pool.query(
      `SELECT DISTINCT u.id, u.first_name, u.last_name, u.company_name, u.avatar_url, u.bio, u.website
       FROM users u
       JOIN event_types et ON u.id = et.user_id
       WHERE et.slug = $1`,
      [username]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const user = userResult.rows[0];

    res.json({
      success: true,
      profile: {
        firstName: user.first_name,
        lastName: user.last_name,
        companyName: user.company_name,
        avatarUrl: user.avatar_url,
        bio: user.bio,
        website: user.website
      }
    });
  } catch (error) {
    next(error);
  }
});

// Save page customization (requires auth)
router.post('/customization', async (req, res, next) => {
  try {
    const { title, description, heroImage, logoUrl, primaryColor, secondaryColor, backgroundColor, showPoweredBy } = req.body;

    const result = await pool.query(
      `UPDATE page_customizations
       SET title = COALESCE($1, title),
           description = COALESCE($2, description),
           hero_image = COALESCE($3, hero_image),
           logo_url = COALESCE($4, logo_url),
           primary_color = COALESCE($5, primary_color),
           secondary_color = COALESCE($6, secondary_color),
           background_image = COALESCE($7, background_image),
           show_powered_by = COALESCE($8, show_powered_by),
           updated_at = CURRENT_TIMESTAMP
       WHERE user_id = $9
       RETURNING *`,
      [title, description, heroImage, logoUrl, primaryColor, secondaryColor, backgroundColor, showPoweredBy, req.userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Customization not found' });
    }

    const custom = result.rows[0];
    res.json({
      success: true,
      message: 'Page customization updated',
      customization: {
        title: custom.title,
        description: custom.description,
        heroImage: custom.hero_image,
        logoUrl: custom.logo_url,
        primaryColor: custom.primary_color,
        secondaryColor: custom.secondary_color,
        backgroundColor: custom.background_image,
        showPoweredBy: custom.show_powered_by
      }
    });
  } catch (error) {
    next(error);
  }
});

export default router;
