import express from 'express';
import { pool } from '../config/database.js';
import { validate, bookingSchema } from '../utils/validators.js';
import { v4 as uuidv4 } from 'uuid';
import { optionalAuth } from '../middleware/auth.js';
import { createGoogleMeetEvent, updateGoogleMeetEvent, deleteGoogleMeetEvent } from '../services/googleMeetService.js';
import { sendBookingConfirmation, sendBookingReminder, sendCancellationNotice } from '../services/emailService.js';

const router = express.Router();

// Create booking (public endpoint for embeds, optional auth)
router.post('/', optionalAuth, async (req, res, next) => {
  try {
    const validation = await validate(bookingSchema, req.body);
    if (!validation.valid) {
      return res.status(400).json({ errors: validation.errors });
    }

    const { event_type_id, guest_name, guest_email, guest_phone, guest_timezone, scheduled_at, description, custom_fields } = validation.data;

    // Get event type details
    const eventResult = await pool.query(
      `SELECT et.id, et.user_id, et.name, et.duration_minutes, u.email as user_email, u.timezone
       FROM event_types et
       JOIN users u ON et.user_id = u.id
       WHERE et.id = $1 AND et.is_active = TRUE AND et.deleted_at IS NULL`,
      [event_type_id]
    );

    if (eventResult.rows.length === 0) {
      return res.status(404).json({ error: 'Event type not found' });
    }

    const eventType = eventResult.rows[0];
    const endTime = new Date(scheduled_at);
    endTime.setMinutes(endTime.getMinutes() + eventType.duration_minutes);

    // Check for conflicts
    const conflictCheck = await pool.query(
      `SELECT id FROM bookings
       WHERE event_type_id = $1 AND status = 'confirmed'
       AND scheduled_at < $2 AND end_time > $3`,
      [event_type_id, endTime.toISOString(), scheduled_at]
    );

    if (conflictCheck.rows.length > 0) {
      return res.status(409).json({ error: 'This time slot is already booked' });
    }

    // Create Google Meet event
    let meetLink = null;
    let googleEventId = null;
    try {
      const googleEvent = await createGoogleMeetEvent({
        summary: `Consultation: ${guest_name}`,
        description: description || `Consultation with ${guest_name}`,
        startTime: new Date(scheduled_at),
        endTime: endTime,
        attendeeEmail: guest_email,
        organizerEmail: eventType.user_email
      });

      if (googleEvent) {
        meetLink = googleEvent.meetLink;
        googleEventId = googleEvent.eventId;
      }
    } catch (googleError) {
      console.error('Google Meet creation failed:', googleError);
      // Continue with booking even if Google Meet fails
    }

    // Create booking
    const bookingId = uuidv4();
    const result = await pool.query(
      `INSERT INTO bookings (id, event_type_id, user_id, guest_name, guest_email, guest_phone, guest_timezone, scheduled_at, end_time, duration_minutes, description, google_meet_link, google_calendar_event_id, custom_fields)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
       RETURNING id, event_type_id, user_id, guest_name, guest_email, scheduled_at, status, google_meet_link, created_at`,
      [bookingId, event_type_id, eventType.user_id, guest_name, guest_email, guest_phone, guest_timezone, scheduled_at, endTime.toISOString(), eventType.duration_minutes, description, meetLink, googleEventId, JSON.stringify(custom_fields || {})]
    );

    const booking = result.rows[0];

    // Update analytics
    try {
      const today = new Date().toISOString().split('T')[0];
      await pool.query(
        `INSERT INTO analytics (user_id, event_type_id, action_type, booking_count, date)
         VALUES ($1, $2, 'booking_created', 1, $3)
         ON CONFLICT (user_id, event_type_id, date)
         DO UPDATE SET booking_count = booking_count + 1, updated_at = CURRENT_TIMESTAMP`,
        [eventType.user_id, event_type_id, today]
      );
      console.log(`✅ Analytics updated for booking ${bookingId}`);
    } catch (analyticsError) {
      console.error('Failed to update analytics:', analyticsError);
    }

    // Update availability slots - mark booked times as unavailable
    try {
      const bookingStart = new Date(scheduled_at);
      const bookingEnd = endTime;
      const dayOfWeek = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][bookingStart.getDay()];
      const bookingStartTime = bookingStart.toTimeString().slice(0, 5); // HH:MM format
      const bookingEndTime = bookingEnd.toTimeString().slice(0, 5); // HH:MM format

      // Find and disable all availability slots that overlap with this booking
      // A slot overlaps if: slot.start_time < booking.end_time AND slot.end_time > booking.start_time
      await pool.query(
        `UPDATE availability_slots
         SET is_active = FALSE, updated_at = CURRENT_TIMESTAMP
         WHERE event_type_id = $1
         AND day_of_week = $2
         AND start_time < $3
         AND end_time > $4`,
        [
          event_type_id,
          dayOfWeek,
          bookingEndTime,    // Slot must start before booking ends
          bookingStartTime   // Slot must end after booking starts
        ]
      );
      console.log(`✅ Availability slots marked as booked for ${bookingStartTime}-${bookingEndTime} on ${dayOfWeek}`);
    } catch (slotError) {
      console.error('Failed to update availability slots:', slotError);
    }

    // Send confirmation email to guest
    try {
      await sendBookingConfirmation({
        guestName: guest_name,
        guestEmail: guest_email,
        eventName: eventType.name,
        scheduledAt: new Date(scheduled_at),
        duration: eventType.duration_minutes,
        meetLink: meetLink
      });
      console.log(`✅ Confirmation email sent to ${guest_email}`);
    } catch (emailError) {
      console.error('Failed to send confirmation email:', emailError);
    }

    // Send notification email to owner
    try {
      await sendBookingConfirmation({
        guestName: `New Booking: ${guest_name}`,
        guestEmail: eventType.user_email,
        eventName: eventType.name,
        scheduledAt: new Date(scheduled_at),
        duration: eventType.duration_minutes,
        meetLink: meetLink,
        isOwnerNotification: true,
        guestContactEmail: guest_email,
        guestPhone: guest_phone
      });
      console.log(`✅ Owner notification sent to ${eventType.user_email}`);
    } catch (emailError) {
      console.error('Failed to send owner notification:', emailError);
    }

    // Schedule reminders (24 hours and 1 hour before)
    try {
      const scheduledDate = new Date(scheduled_at);

      // 24-hour reminder
      const reminderTime24h = new Date(scheduledDate.getTime() - 24 * 60 * 60 * 1000);
      if (reminderTime24h > new Date()) {
        setTimeout(() => {
          sendBookingReminder({
            guestName: guest_name,
            guestEmail: guest_email,
            eventName: eventType.name,
            scheduledAt: new Date(scheduled_at),
            meetLink: meetLink,
            hoursUntilBooking: 24
          }).catch(err => console.error('Failed to send 24h reminder:', err));
        }, reminderTime24h.getTime() - Date.now());
      }

      // 1-hour reminder
      const reminderTime1h = new Date(scheduledDate.getTime() - 60 * 60 * 1000);
      if (reminderTime1h > new Date()) {
        setTimeout(() => {
          sendBookingReminder({
            guestName: guest_name,
            guestEmail: guest_email,
            eventName: eventType.name,
            scheduledAt: new Date(scheduled_at),
            meetLink: meetLink,
            hoursUntilBooking: 1
          }).catch(err => console.error('Failed to send 1h reminder:', err));
        }, reminderTime1h.getTime() - Date.now());
      }

      console.log(`✅ Reminders scheduled for booking ${bookingId}`);
    } catch (reminderError) {
      console.error('Failed to schedule reminders:', reminderError);
    }

    res.status(201).json({
      success: true,
      message: 'Booking created successfully',
      booking: {
        id: booking.id,
        eventTypeId: booking.event_type_id,
        userId: booking.user_id,
        guestName: booking.guest_name,
        guestEmail: booking.guest_email,
        scheduledAt: booking.scheduled_at,
        status: booking.status,
        googleMeetLink: booking.google_meet_link,
        createdAt: booking.created_at
      }
    });
  } catch (error) {
    next(error);
  }
});

// Get user's bookings
router.get('/', async (req, res, next) => {
  try {
    const { status, eventTypeId, startDate, endDate, limit = 50, offset = 0 } = req.query;

    let query = `SELECT id, event_type_id, guest_name, guest_email, scheduled_at, status, google_meet_link, created_at
                 FROM bookings WHERE user_id = $1 AND deleted_at IS NULL`;
    const params = [req.userId];
    let paramIndex = 2;

    if (status) {
      query += ` AND status = $${paramIndex}`;
      params.push(status);
      paramIndex++;
    }

    if (eventTypeId) {
      query += ` AND event_type_id = $${paramIndex}`;
      params.push(eventTypeId);
      paramIndex++;
    }

    if (startDate) {
      query += ` AND scheduled_at >= $${paramIndex}`;
      params.push(startDate);
      paramIndex++;
    }

    if (endDate) {
      query += ` AND scheduled_at <= $${paramIndex}`;
      params.push(endDate);
      paramIndex++;
    }

    query += ` ORDER BY scheduled_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(limit, offset);

    const result = await pool.query(query, params);

    const bookings = result.rows.map(b => ({
      id: b.id,
      eventTypeId: b.event_type_id,
      guestName: b.guest_name,
      guestEmail: b.guest_email,
      scheduledAt: b.scheduled_at,
      status: b.status,
      googleMeetLink: b.google_meet_link,
      createdAt: b.created_at
    }));

    res.json({
      success: true,
      bookings,
      pagination: {
        limit: parseInt(limit),
        offset: parseInt(offset),
        total: result.rows.length
      }
    });
  } catch (error) {
    next(error);
  }
});

// Get booking by ID
router.get('/:bookingId', async (req, res, next) => {
  try {
    const result = await pool.query(
      `SELECT id, event_type_id, user_id, guest_name, guest_email, guest_phone, guest_timezone, scheduled_at, end_time, duration_minutes, description, google_meet_link, status, notes, created_at, updated_at
       FROM bookings WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL`,
      [req.params.bookingId, req.userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Booking not found' });
    }

    const b = result.rows[0];
    res.json({
      success: true,
      booking: {
        id: b.id,
        eventTypeId: b.event_type_id,
        userId: b.user_id,
        guestName: b.guest_name,
        guestEmail: b.guest_email,
        guestPhone: b.guest_phone,
        guestTimezone: b.guest_timezone,
        scheduledAt: b.scheduled_at,
        endTime: b.end_time,
        duration: b.duration_minutes,
        description: b.description,
        googleMeetLink: b.google_meet_link,
        status: b.status,
        notes: b.notes,
        createdAt: b.created_at,
        updatedAt: b.updated_at
      }
    });
  } catch (error) {
    next(error);
  }
});

// Cancel booking
router.put('/:bookingId/cancel', async (req, res, next) => {
  try {
    const { reason } = req.body;

    // Get booking details first
    const bookingResult = await pool.query(
      `SELECT id, event_type_id, user_id, guest_name, guest_email, scheduled_at, status
       FROM bookings WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL`,
      [req.params.bookingId, req.userId]
    );

    if (bookingResult.rows.length === 0) {
      return res.status(404).json({ error: 'Booking not found' });
    }

    const booking = bookingResult.rows[0];

    // Get event type details for owner info
    const eventResult = await pool.query(
      `SELECT id, name, duration_minutes, user_id FROM event_types WHERE id = $1`,
      [booking.event_type_id]
    );

    const eventType = eventResult.rows[0];

    // Cancel the booking
    const cancelResult = await pool.query(
      `UPDATE bookings SET status = 'cancelled', cancelled_at = CURRENT_TIMESTAMP, cancellation_reason = $1
       WHERE id = $2 AND user_id = $3
       RETURNING id, status, cancelled_at`,
      [reason || null, req.params.bookingId, req.userId]
    );

    const cancelledBooking = cancelResult.rows[0];

    // Re-release availability slots
    try {
      const bookingStart = new Date(booking.scheduled_at);
      const dayOfWeek = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][bookingStart.getDay()];
      const bookingStartTime = bookingStart.toTimeString().slice(0, 5);

      await pool.query(
        `UPDATE availability_slots
         SET is_active = TRUE, updated_at = CURRENT_TIMESTAMP
         WHERE event_type_id = $1 AND day_of_week = $2
         AND start_time = $3`,
        [booking.event_type_id, dayOfWeek, bookingStartTime]
      );
      console.log(`✅ Availability slots re-released for cancelled booking ${req.params.bookingId}`);
    } catch (slotError) {
      console.error('Failed to re-release availability slots:', slotError);
    }

    // Update analytics - record cancellation
    try {
      const today = new Date().toISOString().split('T')[0];
      await pool.query(
        `INSERT INTO analytics (user_id, event_type_id, action_type, cancellation_count, date)
         VALUES ($1, $2, 'booking_cancelled', 1, $3)
         ON CONFLICT (user_id, event_type_id, date)
         DO UPDATE SET cancellation_count = COALESCE(cancellation_count, 0) + 1, updated_at = CURRENT_TIMESTAMP`,
        [eventType.user_id, booking.event_type_id, today]
      );
      console.log(`✅ Analytics updated for cancelled booking ${req.params.bookingId}`);
    } catch (analyticsError) {
      console.error('Failed to update analytics:', analyticsError);
    }

    // Send cancellation email to guest
    try {
      await sendCancellationNotice({
        guestName: booking.guest_name,
        guestEmail: booking.guest_email,
        eventName: eventType.name,
        scheduledAt: new Date(booking.scheduled_at),
        reason: reason || 'The consultation has been cancelled'
      });
      console.log(`✅ Cancellation notice sent to ${booking.guest_email}`);
    } catch (emailError) {
      console.error('Failed to send cancellation email:', emailError);
    }

    // Send cancellation notification to owner
    try {
      const userResult = await pool.query(
        `SELECT email FROM users WHERE id = $1`,
        [eventType.user_id]
      );
      const ownerEmail = userResult.rows[0]?.email;

      if (ownerEmail) {
        await sendCancellationNotice({
          guestName: `Booking Cancelled: ${booking.guest_name}`,
          guestEmail: ownerEmail,
          eventName: eventType.name,
          scheduledAt: new Date(booking.scheduled_at),
          reason: reason || 'A scheduled consultation has been cancelled',
          isOwnerNotification: true
        });
        console.log(`✅ Cancellation notification sent to owner ${ownerEmail}`);
      }
    } catch (emailError) {
      console.error('Failed to send owner cancellation notification:', emailError);
    }

    res.json({
      success: true,
      message: 'Booking cancelled successfully',
      booking: {
        id: cancelledBooking.id,
        status: cancelledBooking.status,
        cancelledAt: cancelledBooking.cancelled_at
      }
    });
  } catch (error) {
    next(error);
  }
});

// Reschedule booking
router.put('/:bookingId/reschedule', async (req, res, next) => {
  try {
    const { scheduled_at } = req.body;

    if (!scheduled_at) {
      return res.status(400).json({ error: 'scheduled_at is required' });
    }

    // Get current booking details
    const bookingResult = await pool.query(
      `SELECT id, event_type_id, user_id, guest_name, guest_email, scheduled_at, duration_minutes, google_meet_link
       FROM bookings WHERE id = $1 AND user_id = $2 AND status = 'confirmed'`,
      [req.params.bookingId, req.userId]
    );

    if (bookingResult.rows.length === 0) {
      return res.status(404).json({ error: 'Booking not found' });
    }

    const oldBooking = bookingResult.rows[0];
    const newEndTime = new Date(scheduled_at);
    newEndTime.setMinutes(newEndTime.getMinutes() + oldBooking.duration_minutes);

    // Check for conflicts at new time
    const conflictCheck = await pool.query(
      `SELECT id FROM bookings
       WHERE event_type_id = $1 AND id != $2 AND status = 'confirmed'
       AND scheduled_at < $3 AND end_time > $4`,
      [oldBooking.event_type_id, req.params.bookingId, newEndTime.toISOString(), scheduled_at]
    );

    if (conflictCheck.rows.length > 0) {
      return res.status(409).json({ error: 'This time slot is already booked' });
    }

    // Re-release old time slot
    try {
      const oldStart = new Date(oldBooking.scheduled_at);
      const oldDayOfWeek = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][oldStart.getDay()];
      const oldStartTime = oldStart.toTimeString().slice(0, 5);

      await pool.query(
        `UPDATE availability_slots SET is_active = TRUE, updated_at = CURRENT_TIMESTAMP
         WHERE event_type_id = $1 AND day_of_week = $2 AND start_time = $3`,
        [oldBooking.event_type_id, oldDayOfWeek, oldStartTime]
      );
    } catch (slotError) {
      console.error('Failed to re-release old slot:', slotError);
    }

    // Book new time slot
    try {
      const newStart = new Date(scheduled_at);
      const newDayOfWeek = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][newStart.getDay()];
      const newStartTime = newStart.toTimeString().slice(0, 5);

      await pool.query(
        `UPDATE availability_slots SET is_active = FALSE, updated_at = CURRENT_TIMESTAMP
         WHERE event_type_id = $1 AND day_of_week = $2
         AND start_time < $3 AND end_time > $4`,
        [oldBooking.event_type_id, newDayOfWeek, newEndTime.toTimeString().slice(0, 5), newStartTime]
      );
    } catch (slotError) {
      console.error('Failed to book new slot:', slotError);
    }

    // Update booking with new time
    const updateResult = await pool.query(
      `UPDATE bookings SET scheduled_at = $1, end_time = $2, updated_at = CURRENT_TIMESTAMP
       WHERE id = $3 RETURNING id, scheduled_at, status`,
      [scheduled_at, newEndTime.toISOString(), req.params.bookingId]
    );

    const updatedBooking = updateResult.rows[0];

    // Get event details for email
    const eventResult = await pool.query(
      `SELECT name FROM event_types WHERE id = $1`,
      [oldBooking.event_type_id]
    );
    const eventName = eventResult.rows[0]?.name || 'Consultation';

    // Send rescheduling confirmation to guest
    try {
      await sendBookingConfirmation({
        guestName: oldBooking.guest_name,
        guestEmail: oldBooking.guest_email,
        eventName: eventName,
        scheduledAt: new Date(scheduled_at),
        duration: oldBooking.duration_minutes,
        meetLink: oldBooking.google_meet_link,
        isRescheduleNotification: true
      });
      console.log(`✅ Reschedule confirmation sent to ${oldBooking.guest_email}`);
    } catch (emailError) {
      console.error('Failed to send reschedule email:', emailError);
    }

    res.json({
      success: true,
      message: 'Booking rescheduled successfully',
      booking: {
        id: updatedBooking.id,
        scheduledAt: updatedBooking.scheduled_at,
        status: updatedBooking.status
      }
    });
  } catch (error) {
    next(error);
  }
});

export default router;
