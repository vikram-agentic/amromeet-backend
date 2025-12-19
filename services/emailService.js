import { Resend } from 'resend';
import { format } from 'date-fns';

const resend = new Resend(process.env.RESEND_API_KEY);
const FROM_EMAIL = process.env.FROM_EMAIL || 'noreply@amromeet.com';

export async function sendBookingConfirmation(bookingData) {
  try {
    const {
      guestName,
      guestEmail,
      eventName,
      scheduledAt,
      duration,
      meetLink,
      isOwnerNotification = false,
      guestContactEmail,
      guestPhone
    } = bookingData;

    const formattedDate = format(new Date(scheduledAt), 'MMMM d, yyyy');
    const formattedTime = format(new Date(scheduledAt), 'h:mm a');

    let html;

    if (isOwnerNotification) {
      // Owner notification email
      html = `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <style>
              body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
              .container { max-width: 600px; margin: 0 auto; padding: 20px; }
              .header { background: linear-gradient(135deg, #14b8a6 0%, #0d9488 100%); color: white; padding: 30px; border-radius: 8px; margin-bottom: 30px; text-align: center; }
              .header h2 { margin: 0; }
              .content { background: #f8fafc; padding: 20px; border-radius: 8px; margin-bottom: 20px; }
              .booking-details { background: white; padding: 15px; border-radius: 6px; border-left: 4px solid #14b8a6; margin: 15px 0; }
              .booking-details p { margin: 8px 0; }
              .booking-details strong { color: #14b8a6; }
              .button { display: inline-block; background-color: #14b8a6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 10px 0; }
              .footer { color: #666; font-size: 12px; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e2e8f0; text-align: center; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h2>📅 New Booking Received!</h2>
              </div>

              <div class="content">
                <p>Hi,</p>

                <p>You have received a new booking! Here are the details:</p>

                <div class="booking-details">
                  <h3 style="margin-top: 0; color: #14b8a6;">Booking Information</h3>
                  <p><strong>Guest Name:</strong> ${guestName}</p>
                  <p><strong>Guest Email:</strong> ${guestContactEmail}</p>
                  ${guestPhone ? `<p><strong>Guest Phone:</strong> ${guestPhone}</p>` : ''}
                  <p><strong>Event:</strong> ${eventName}</p>
                  <p><strong>Date:</strong> ${formattedDate}</p>
                  <p><strong>Time:</strong> ${formattedTime}</p>
                  <p><strong>Duration:</strong> ${duration} minutes</p>
                  ${meetLink ? `<p><a href="${meetLink}" class="button">Join Meeting</a></p>` : ''}
                </div>

                <p style="background: #dcfce7; padding: 12px; border-radius: 6px; border-left: 4px solid #16a34a;">
                  <strong>✅ Confirmation email has been sent to the guest.</strong>
                </p>

                <p>You can manage this booking in your Amromeet dashboard.</p>
              </div>

              <div class="footer">
                <p>&copy; ${new Date().getFullYear()} Amromeet. All rights reserved.</p>
              </div>
            </div>
          </body>
        </html>
      `;
    } else {
      // Guest confirmation email
      html = `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <style>
              body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
              .container { max-width: 600px; margin: 0 auto; padding: 20px; }
              .header { background: linear-gradient(135deg, #14b8a6 0%, #0d9488 100%); color: white; padding: 30px; border-radius: 8px; margin-bottom: 30px; text-align: center; }
              .header h2 { margin: 0; }
              .content { background: #f8fafc; padding: 20px; border-radius: 8px; margin-bottom: 20px; }
              .booking-details { background: white; padding: 15px; border-radius: 6px; border-left: 4px solid #14b8a6; margin: 15px 0; }
              .booking-details p { margin: 8px 0; }
              .booking-details strong { color: #14b8a6; }
              .button { display: inline-block; background-color: #14b8a6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 10px 0; }
              .footer { color: #666; font-size: 12px; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e2e8f0; text-align: center; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h2>✓ Your Booking is Confirmed!</h2>
              </div>

              <div class="content">
                <p>Hi ${guestName},</p>

                <p>Thank you for booking with us! Your consultation is confirmed and ready to go.</p>

                <div class="booking-details">
                  <h3 style="margin-top: 0; color: #14b8a6;">Booking Details</h3>
                  <p><strong>Event:</strong> ${eventName}</p>
                  <p><strong>Date:</strong> ${formattedDate}</p>
                  <p><strong>Time:</strong> ${formattedTime}</p>
                  <p><strong>Duration:</strong> ${duration} minutes</p>
                  ${meetLink ? `<p><a href="${meetLink}" class="button">Join Google Meet</a></p>` : ''}
                </div>

                <p style="background: #fef3c7; padding: 12px; border-radius: 6px; border-left: 4px solid #f59e0b;">
                  <strong>💡 Tip:</strong> Please join 5 minutes early to test your audio and video.
                </p>

                <p>If you need to reschedule or have any questions, please reply to this email.</p>

                <p style="margin-top: 30px;">
                  Looking forward to meeting you!<br>
                  <strong>Amromeet Team</strong>
                </p>
              </div>

              <div class="footer">
                <p>This is an automated message. Please do not reply with sensitive information.</p>
                <p>&copy; ${new Date().getFullYear()} Amromeet. All rights reserved.</p>
              </div>
            </div>
          </body>
        </html>
      `;
    }

    const result = await resend.emails.send({
      from: FROM_EMAIL,
      to: guestEmail,
      subject: `Booking Confirmed: ${eventName} on ${formattedDate}`,
      html: html
    });

    console.log(`✅ Booking confirmation sent to ${guestEmail}`);
    return result;
  } catch (error) {
    console.error('Error sending booking confirmation:', error);
    throw error;
  }
}

export async function sendBookingReminder(bookingData) {
  try {
    const {
      guestName,
      guestEmail,
      eventName,
      scheduledAt,
      meetLink,
      hoursUntilBooking
    } = bookingData;

    const formattedTime = format(new Date(scheduledAt), 'h:mm a');

    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #14b8a6 0%, #0d9488 100%); color: white; padding: 30px; border-radius: 8px; margin-bottom: 30px; text-align: center; }
            .header h2 { margin: 0; }
            .content { background: #f8fafc; padding: 20px; border-radius: 8px; }
            .button { display: inline-block; background-color: #14b8a6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 10px 0; }
            .footer { color: #666; font-size: 12px; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e2e8f0; text-align: center; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h2>🔔 Your Consultation is Coming Up!</h2>
            </div>

            <div class="content">
              <p>Hi ${guestName},</p>

              <p>This is a friendly reminder about your upcoming consultation with us.</p>

              <p><strong>Consultation starts in ${hoursUntilBooking} hours at ${formattedTime}</strong></p>

              ${meetLink ? `
                <p>
                  <a href="${meetLink}" class="button">Join the Meeting Now</a>
                </p>
              ` : ''}

              <p>If you need to reschedule or have any questions, please contact us right away.</p>

              <p>We look forward to speaking with you!</p>
            </div>

            <div class="footer">
              <p>&copy; ${new Date().getFullYear()} Amromeet. All rights reserved.</p>
            </div>
          </div>
        </body>
      </html>
    `;

    const result = await resend.emails.send({
      from: FROM_EMAIL,
      to: guestEmail,
      subject: `Reminder: ${eventName} at ${formattedTime}`,
      html: html
    });

    console.log(`✅ Booking reminder sent to ${guestEmail}`);
    return result;
  } catch (error) {
    console.error('Error sending booking reminder:', error);
    throw error;
  }
}

export async function sendCancellationNotice(bookingData) {
  try {
    const {
      guestName,
      guestEmail,
      eventName,
      scheduledAt,
      reason,
      isOwnerNotification = false
    } = bookingData;

    const formattedDate = format(new Date(scheduledAt), 'MMMM d, yyyy');
    const formattedTime = format(new Date(scheduledAt), 'h:mm a');

    let html;

    if (isOwnerNotification) {
      // Owner cancellation notification
      html = `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <style>
              body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
              .container { max-width: 600px; margin: 0 auto; padding: 20px; }
              .header { background: #dc2626; color: white; padding: 30px; border-radius: 8px; margin-bottom: 30px; text-align: center; }
              .header h2 { margin: 0; }
              .content { background: #f8fafc; padding: 20px; border-radius: 8px; }
              .alert { background: #fee2e2; padding: 12px; border-radius: 6px; border-left: 4px solid #dc2626; margin: 15px 0; }
              .footer { color: #666; font-size: 12px; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e2e8f0; text-align: center; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h2>⚠️ Booking Cancelled</h2>
              </div>

              <div class="content">
                <p>Hi,</p>

                <p>A scheduled consultation has been cancelled.</p>

                <div class="alert">
                  <p><strong>Event:</strong> ${eventName}</p>
                  <p><strong>Date:</strong> ${formattedDate}</p>
                  <p><strong>Time:</strong> ${formattedTime}</p>
                  ${reason ? `<p><strong>Reason:</strong> ${reason}</p>` : ''}
                </div>

                <p>The time slot has been released and is now available for other bookings.</p>

                <p>You can view all your bookings in your Amromeet dashboard.</p>
              </div>

              <div class="footer">
                <p>&copy; ${new Date().getFullYear()} Amromeet. All rights reserved.</p>
              </div>
            </div>
          </body>
        </html>
      `;
    } else {
      // Guest cancellation email
      html = `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <style>
              body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
              .container { max-width: 600px; margin: 0 auto; padding: 20px; }
              .header { background: #dc2626; color: white; padding: 30px; border-radius: 8px; margin-bottom: 30px; text-align: center; }
              .header h2 { margin: 0; }
              .content { background: #f8fafc; padding: 20px; border-radius: 8px; }
              .footer { color: #666; font-size: 12px; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e2e8f0; text-align: center; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h2>Consultation Cancelled</h2>
              </div>

              <div class="content">
                <p>Hi ${guestName},</p>

                <p>We wanted to let you know that your consultation scheduled for <strong>${formattedDate} at ${formattedTime}</strong> has been cancelled.</p>

                ${reason ? `<p><strong>Reason:</strong> ${reason}</p>` : ''}

                <p>If you have any questions or would like to reschedule, please reach out to us.</p>

                <p>We hope to work with you soon!</p>
              </div>

              <div class="footer">
                <p>&copy; ${new Date().getFullYear()} Amromeet. All rights reserved.</p>
              </div>
            </div>
          </body>
        </html>
      `;
    }

    const result = await resend.emails.send({
      from: FROM_EMAIL,
      to: guestEmail,
      subject: isOwnerNotification ? `Booking Cancelled: ${eventName}` : `Consultation Cancelled: ${eventName}`,
      html: html
    });

    console.log(`✅ Cancellation notice sent to ${guestEmail}`);
    return result;
  } catch (error) {
    console.error('Error sending cancellation notice:', error);
    throw error;
  }
}
