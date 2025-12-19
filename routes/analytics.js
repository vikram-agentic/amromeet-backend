import express from 'express';
import { pool } from '../config/database.js';

const router = express.Router();

// Get dashboard analytics
router.get('/dashboard', async (req, res, next) => {
  try {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    // Total bookings
    const bookingsResult = await pool.query(
      `SELECT COUNT(*) as total,
              SUM(CASE WHEN status = 'confirmed' THEN 1 ELSE 0 END) as confirmed,
              SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END) as cancelled
       FROM bookings WHERE user_id = $1 AND created_at >= $2`,
      [req.userId, thirtyDaysAgo.toISOString()]
    );

    // Total event types
    const eventsResult = await pool.query(
      'SELECT COUNT(*) as total FROM event_types WHERE user_id = $1 AND deleted_at IS NULL',
      [req.userId]
    );

    // Upcoming bookings
    const upcomingResult = await pool.query(
      `SELECT COUNT(*) as total FROM bookings
       WHERE user_id = $1 AND status = 'confirmed' AND scheduled_at > NOW()`,
      [req.userId]
    );

    // Recent bookings
    const recentResult = await pool.query(
      `SELECT id, event_type_id, guest_name, guest_email, scheduled_at, status
       FROM bookings WHERE user_id = $1 AND deleted_at IS NULL
       ORDER BY created_at DESC LIMIT 10`,
      [req.userId]
    );

    const bookingsData = bookingsResult.rows[0];
    const eventsData = eventsResult.rows[0];
    const upcomingData = upcomingResult.rows[0];

    res.json({
      success: true,
      analytics: {
        bookings: {
          total: parseInt(bookingsData.total),
          confirmed: parseInt(bookingsData.confirmed),
          cancelled: parseInt(bookingsData.cancelled)
        },
        eventTypes: {
          total: parseInt(eventsData.total)
        },
        upcoming: parseInt(upcomingData.total),
        recentBookings: recentResult.rows.map(b => ({
          id: b.id,
          eventTypeId: b.event_type_id,
          guestName: b.guest_name,
          guestEmail: b.guest_email,
          scheduledAt: b.scheduled_at,
          status: b.status
        }))
      }
    });
  } catch (error) {
    next(error);
  }
});

// Get bookings by date range
router.get('/bookings-range', async (req, res, next) => {
  try {
    const { startDate, endDate } = req.query;

    if (!startDate || !endDate) {
      return res.status(400).json({ error: 'startDate and endDate are required' });
    }

    const result = await pool.query(
      `SELECT DATE(scheduled_at) as date, COUNT(*) as count
       FROM bookings
       WHERE user_id = $1 AND scheduled_at >= $2 AND scheduled_at <= $3
       GROUP BY DATE(scheduled_at)
       ORDER BY DATE(scheduled_at)`,
      [req.userId, startDate, endDate]
    );

    const analytics = result.rows.map(row => ({
      date: row.date,
      bookings: parseInt(row.count)
    }));

    res.json({
      success: true,
      analytics
    });
  } catch (error) {
    next(error);
  }
});

// Get analytics by event type
router.get('/by-event-type', async (req, res, next) => {
  try {
    const result = await pool.query(
      `SELECT et.id, et.name, COUNT(b.id) as booking_count,
              SUM(CASE WHEN b.status = 'confirmed' THEN 1 ELSE 0 END) as confirmed,
              SUM(CASE WHEN b.status = 'cancelled' THEN 1 ELSE 0 END) as cancelled
       FROM event_types et
       LEFT JOIN bookings b ON et.id = b.event_type_id
       WHERE et.user_id = $1 AND et.deleted_at IS NULL
       GROUP BY et.id, et.name
       ORDER BY booking_count DESC`,
      [req.userId]
    );

    const analytics = result.rows.map(row => ({
      eventTypeId: row.id,
      eventTypeName: row.name,
      totalBookings: parseInt(row.booking_count),
      confirmed: parseInt(row.confirmed) || 0,
      cancelled: parseInt(row.cancelled) || 0
    }));

    res.json({
      success: true,
      analytics
    });
  } catch (error) {
    next(error);
  }
});

// Get conversion analytics
router.get('/conversion', async (req, res, next) => {
  try {
    const { days = 30 } = req.query;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - parseInt(days));

    // Get unique visitors and bookings
    const result = await pool.query(
      `SELECT
        COUNT(DISTINCT guest_email) as unique_guests,
        COUNT(*) as total_bookings,
        SUM(CASE WHEN status = 'confirmed' THEN 1 ELSE 0 END) as confirmed_bookings
       FROM bookings
       WHERE user_id = $1 AND created_at >= $2`,
      [req.userId, startDate.toISOString()]
    );

    const data = result.rows[0];
    const conversionRate = data.unique_guests > 0
      ? ((data.confirmed_bookings / data.unique_guests) * 100).toFixed(2)
      : 0;

    res.json({
      success: true,
      analytics: {
        period: `Last ${days} days`,
        uniqueGuests: parseInt(data.unique_guests),
        totalBookingAttempts: parseInt(data.total_bookings),
        confirmedBookings: parseInt(data.confirmed_bookings),
        conversionRate: parseFloat(conversionRate)
      }
    });
  } catch (error) {
    next(error);
  }
});

export default router;
