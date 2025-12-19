import Joi from 'joi';

export const signupSchema = Joi.object({
  email: Joi.string().email().required().messages({
    'string.email': 'Invalid email format',
    'any.required': 'Email is required'
  }),
  password: Joi.string().min(8).required().messages({
    'string.min': 'Password must be at least 8 characters',
    'any.required': 'Password is required'
  }),
  firstName: Joi.string().max(100),
  lastName: Joi.string().max(100),
  companyName: Joi.string().max(255)
});

export const loginSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().required()
});

export const eventTypeSchema = Joi.object({
  name: Joi.string().max(255).required(),
  description: Joi.string().max(1000),
  duration_minutes: Joi.number().integer().min(15).max(480).default(30),
  color: Joi.string().regex(/^#[0-9A-F]{6}$/i),
  location_type: Joi.string().valid('google_meet', 'zoom', 'teams', 'custom').default('google_meet'),
  custom_location: Joi.string().max(255),
  buffer_time_before: Joi.number().integer().min(0),
  buffer_time_after: Joi.number().integer().min(0),
  min_advance_notice_minutes: Joi.number().integer().min(0),
  max_advance_booking_days: Joi.number().integer().min(1).max(365)
});

export const bookingSchema = Joi.object({
  event_type_id: Joi.string().uuid().required(),
  guest_name: Joi.string().max(255).required(),
  guest_email: Joi.string().email().required(),
  guest_phone: Joi.string().max(20),
  guest_timezone: Joi.string().max(50),
  scheduled_at: Joi.date().iso().required(),
  description: Joi.string().max(1000),
  custom_fields: Joi.object()
});

export const availabilitySlotSchema = Joi.object({
  day_of_week: Joi.string().valid('Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday').required(),
  start_time: Joi.string().regex(/^\d{2}:\d{2}$/).required(),
  end_time: Joi.string().regex(/^\d{2}:\d{2}$/).required()
});

export const userSettingsSchema = Joi.object({
  theme: Joi.string().valid('light', 'dark'),
  language: Joi.string().max(10),
  notification_email: Joi.boolean(),
  notification_sms: Joi.boolean(),
  notification_push: Joi.boolean(),
  timezone: Joi.string().max(50),
  default_meeting_duration: Joi.number().integer().min(15).max(480),
  buffer_time_before: Joi.number().integer().min(0),
  buffer_time_after: Joi.number().integer().min(0)
});

export async function validate(schema, data) {
  try {
    const result = await schema.validateAsync(data, { abortEarly: false });
    return { valid: true, data: result };
  } catch (error) {
    return {
      valid: false,
      errors: error.details.map(d => ({
        field: d.path.join('.'),
        message: d.message
      }))
    };
  }
}
