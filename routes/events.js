import express from 'express';
import { pool } from '../config/database.js';
import { validate, eventTypeSchema, availabilitySlotSchema } from '../utils/validators.js';
import { v4 as uuidv4 } from 'uuid';
import slug from 'slug';

const router = express.Router();

// Create event type
router.post('/', async (req, res, next) => {
  try {
    const validation = await validate(eventTypeSchema, req.body);
    if (!validation.valid) {
      return res.status(400).json({ errors: validation.errors });
    }

    const { name, description, duration_minutes, color, location_type, custom_location, buffer_time_before, buffer_time_after, min_advance_notice_minutes, max_advance_booking_days } = validation.data;

    // Generate slug from name
    const eventSlug = slug(name).toLowerCase();

    // Check if slug already exists for this user
    const slugCheck = await pool.query(
      'SELECT id FROM event_types WHERE user_id = $1 AND slug = $2 AND deleted_at IS NULL',
      [req.userId, eventSlug]
    );

    let finalSlug = eventSlug;
    if (slugCheck.rows.length > 0) {
      finalSlug = `${eventSlug}-${uuidv4().split('-')[0]}`;
    }

    const eventId = uuidv4();
    const result = await pool.query(
      `INSERT INTO event_types (id, user_id, name, description, slug, duration_minutes, color, location_type, custom_location, buffer_time_before, buffer_time_after, min_advance_notice_minutes, max_advance_booking_days)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
       RETURNING id, user_id, name, description, slug, duration_minutes, color, location_type, custom_location, is_active, created_at`,
      [eventId, req.userId, name, description, finalSlug, duration_minutes, color, location_type, custom_location, buffer_time_before, buffer_time_after, min_advance_notice_minutes, max_advance_booking_days]
    );

    const event = result.rows[0];
    res.status(201).json({
      success: true,
      message: 'Event type created successfully',
      event: {
        id: event.id,
        name: event.name,
        description: event.description,
        slug: event.slug,
        durationMinutes: event.duration_minutes,
        color: event.color,
        locationType: event.location_type,
        customLocation: event.custom_location,
        isActive: event.is_active,
        createdAt: event.created_at
      }
    });
  } catch (error) {
    next(error);
  }
});

// Get all event types for user
router.get('/', async (req, res, next) => {
  try {
    const result = await pool.query(
      `SELECT id, name, description, slug, duration_minutes, color, location_type, custom_location, is_active, created_at, updated_at
       FROM event_types WHERE user_id = $1 AND deleted_at IS NULL
       ORDER BY created_at DESC`,
      [req.userId]
    );

    const events = result.rows.map(e => ({
      id: e.id,
      name: e.name,
      description: e.description,
      slug: e.slug,
      durationMinutes: e.duration_minutes,
      color: e.color,
      locationType: e.location_type,
      customLocation: e.custom_location,
      isActive: e.is_active,
      createdAt: e.created_at,
      updatedAt: e.updated_at
    }));

    res.json({
      success: true,
      events,
      total: events.length
    });
  } catch (error) {
    next(error);
  }
});

// Get event type by ID
router.get('/:eventId', async (req, res, next) => {
  try {
    const result = await pool.query(
      `SELECT id, user_id, name, description, slug, duration_minutes, color, location_type, custom_location, is_active, buffer_time_before, buffer_time_after, min_advance_notice_minutes, max_advance_booking_days, created_at, updated_at
       FROM event_types WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL`,
      [req.params.eventId, req.userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Event type not found' });
    }

    const e = result.rows[0];
    const event = {
      id: e.id,
      name: e.name,
      description: e.description,
      slug: e.slug,
      durationMinutes: e.duration_minutes,
      color: e.color,
      locationType: e.location_type,
      customLocation: e.custom_location,
      isActive: e.is_active,
      bufferTimeBefore: e.buffer_time_before,
      bufferTimeAfter: e.buffer_time_after,
      minAdvanceNoticeMinutes: e.min_advance_notice_minutes,
      maxAdvanceBookingDays: e.max_advance_booking_days,
      createdAt: e.created_at,
      updatedAt: e.updated_at
    };

    res.json({
      success: true,
      event
    });
  } catch (error) {
    next(error);
  }
});

// Update event type
router.put('/:eventId', async (req, res, next) => {
  try {
    const validation = await validate(eventTypeSchema, req.body);
    if (!validation.valid) {
      return res.status(400).json({ errors: validation.errors });
    }

    const { name, description, duration_minutes, color, location_type, custom_location, buffer_time_before, buffer_time_after } = validation.data;

    const result = await pool.query(
      `UPDATE event_types
       SET name = COALESCE($1, name),
           description = COALESCE($2, description),
           duration_minutes = COALESCE($3, duration_minutes),
           color = COALESCE($4, color),
           location_type = COALESCE($5, location_type),
           custom_location = COALESCE($6, custom_location),
           buffer_time_before = COALESCE($7, buffer_time_before),
           buffer_time_after = COALESCE($8, buffer_time_after),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $9 AND user_id = $10 AND deleted_at IS NULL
       RETURNING id, name, description, slug, duration_minutes, color, location_type, custom_location, is_active`,
      [name, description, duration_minutes, color, location_type, custom_location, buffer_time_before, buffer_time_after, req.params.eventId, req.userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Event type not found' });
    }

    const event = result.rows[0];
    res.json({
      success: true,
      message: 'Event type updated successfully',
      event: {
        id: event.id,
        name: event.name,
        description: event.description,
        slug: event.slug,
        durationMinutes: event.duration_minutes,
        color: event.color,
        locationType: event.location_type,
        customLocation: event.custom_location,
        isActive: event.is_active
      }
    });
  } catch (error) {
    next(error);
  }
});

// Delete event type
router.delete('/:eventId', async (req, res, next) => {
  try {
    const result = await pool.query(
      'UPDATE event_types SET deleted_at = CURRENT_TIMESTAMP WHERE id = $1 AND user_id = $2 RETURNING id',
      [req.params.eventId, req.userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Event type not found' });
    }

    res.json({
      success: true,
      message: 'Event type deleted successfully'
    });
  } catch (error) {
    next(error);
  }
});

// Add availability slot
router.post('/:eventId/availability', async (req, res, next) => {
  try {
    const validation = await validate(availabilitySlotSchema, req.body);
    if (!validation.valid) {
      return res.status(400).json({ errors: validation.errors });
    }

    const { day_of_week, start_time, end_time } = validation.data;

    // Verify event belongs to user
    const eventCheck = await pool.query(
      'SELECT id FROM event_types WHERE id = $1 AND user_id = $2',
      [req.params.eventId, req.userId]
    );

    if (eventCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Event type not found' });
    }

    const slotId = uuidv4();
    const result = await pool.query(
      `INSERT INTO availability_slots (id, event_type_id, day_of_week, start_time, end_time)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, day_of_week, start_time, end_time, is_active`,
      [slotId, req.params.eventId, day_of_week, start_time, end_time]
    );

    const slot = result.rows[0];
    res.status(201).json({
      success: true,
      message: 'Availability slot created',
      slot: {
        id: slot.id,
        dayOfWeek: slot.day_of_week,
        startTime: slot.start_time,
        endTime: slot.end_time,
        isActive: slot.is_active
      }
    });
  } catch (error) {
    next(error);
  }
});

// Get availability slots
router.get('/:eventId/availability', async (req, res, next) => {
  try {
    const result = await pool.query(
      `SELECT id, day_of_week, start_time, end_time, is_active
       FROM availability_slots WHERE event_type_id = $1 AND is_active = TRUE
       ORDER BY
         CASE WHEN day_of_week = 'Monday' THEN 1
              WHEN day_of_week = 'Tuesday' THEN 2
              WHEN day_of_week = 'Wednesday' THEN 3
              WHEN day_of_week = 'Thursday' THEN 4
              WHEN day_of_week = 'Friday' THEN 5
              WHEN day_of_week = 'Saturday' THEN 6
              WHEN day_of_week = 'Sunday' THEN 7
         END,
         start_time`,
      [req.params.eventId]
    );

    const slots = result.rows.map(s => ({
      id: s.id,
      dayOfWeek: s.day_of_week,
      startTime: s.start_time,
      endTime: s.end_time,
      isActive: s.is_active
    }));

    res.json({
      success: true,
      slots
    });
  } catch (error) {
    next(error);
  }
});

// Delete availability slot
router.delete('/availability/:slotId', async (req, res, next) => {
  try {
    const result = await pool.query(
      'UPDATE availability_slots SET is_active = FALSE WHERE id = $1 RETURNING id',
      [req.params.slotId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Availability slot not found' });
    }

    res.json({
      success: true,
      message: 'Availability slot deleted'
    });
  } catch (error) {
    next(error);
  }
});

export default router;
