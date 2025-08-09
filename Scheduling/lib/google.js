import { google } from 'googleapis';

const {
  GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET,
  GOOGLE_REFRESH_TOKEN
} = process.env;

export function getOAuthClient() {
  const oauth2 = new google.auth.OAuth2(GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET);
  oauth2.setCredentials({ refresh_token: GOOGLE_REFRESH_TOKEN });
  return oauth2;
}

export function getCalendar() {
  return google.calendar({ version: 'v3', auth: getOAuthClient() });
}