import { google } from 'googleapis';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Load Google Service Account credentials
let googleAuth = null;
const credentialsPath = path.join(__dirname, '../../modern-replica-473608-e3-2efc335070ff.json');

async function initializeGoogleAuth() {
  if (googleAuth) return googleAuth;

  try {
    const credentials = JSON.parse(fs.readFileSync(credentialsPath, 'utf8'));

    googleAuth = new google.auth.GoogleAuth({
      credentials: credentials,
      scopes: ['https://www.googleapis.com/auth/calendar'],
    });

    console.log('✅ Google Calendar API initialized');
    return googleAuth;
  } catch (error) {
    console.error('Failed to load Google credentials:', error.message);
    return null;
  }
}

export async function createGoogleMeetEvent(eventData) {
  try {
    const auth = await initializeGoogleAuth();
    if (!auth) {
      throw new Error('Google Calendar not initialized');
    }

    const calendar = google.calendar({ version: 'v3', auth });

    const event = {
      summary: eventData.summary,
      description: eventData.description,
      start: {
        dateTime: eventData.startTime.toISOString(),
        timeZone: 'UTC',
      },
      end: {
        dateTime: eventData.endTime.toISOString(),
        timeZone: 'UTC',
      },
      conferenceData: {
        createRequest: {
          requestId: `consultation-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          conferenceSolutionKey: {
            key: 'hangoutsMeet',
          },
        },
      },
      attendees: eventData.attendeeEmail ? [
        { email: eventData.attendeeEmail },
        { email: eventData.organizerEmail }
      ] : [{ email: eventData.organizerEmail }],
      guestCanModify: false,
      guestCanInviteOthers: false,
      guestCanSeeGuests: false,
    };

    const response = await calendar.events.insert({
      calendarId: 'primary',
      resource: event,
      conferenceDataVersion: 1,
      sendUpdates: 'all',
    });

    // Extract the Google Meet link
    const meetLink = response.data.conferenceData?.entryPoints?.find(
      (entry) => entry.entryPointType === 'video'
    )?.uri;

    return {
      success: true,
      eventId: response.data.id,
      meetLink: meetLink,
      htmlLink: response.data.htmlLink
    };
  } catch (error) {
    console.error('Error creating Google Meet event:', error.message);

    // Fallback - generate a mock meet link
    return {
      success: false,
      meetLink: `https://meet.google.com/${Math.random().toString(36).substr(2, 9)}`,
      error: error.message
    };
  }
}

export async function updateGoogleMeetEvent(eventId, eventData) {
  try {
    const auth = await initializeGoogleAuth();
    if (!auth) {
      throw new Error('Google Calendar not initialized');
    }

    const calendar = google.calendar({ version: 'v3', auth });

    const response = await calendar.events.update({
      calendarId: 'primary',
      eventId: eventId,
      resource: {
        summary: eventData.summary,
        description: eventData.description,
        start: {
          dateTime: eventData.startTime.toISOString(),
          timeZone: 'UTC',
        },
        end: {
          dateTime: eventData.endTime.toISOString(),
          timeZone: 'UTC',
        },
      },
      sendUpdates: 'all',
    });

    return {
      success: true,
      eventId: response.data.id
    };
  } catch (error) {
    console.error('Error updating Google Meet event:', error.message);
    return {
      success: false,
      error: error.message
    };
  }
}

export async function deleteGoogleMeetEvent(eventId) {
  try {
    const auth = await initializeGoogleAuth();
    if (!auth) {
      throw new Error('Google Calendar not initialized');
    }

    const calendar = google.calendar({ version: 'v3', auth });

    await calendar.events.delete({
      calendarId: 'primary',
      eventId: eventId,
      sendUpdates: 'all'
    });

    return {
      success: true
    };
  } catch (error) {
    console.error('Error deleting Google Meet event:', error.message);
    return {
      success: false,
      error: error.message
    };
  }
}
