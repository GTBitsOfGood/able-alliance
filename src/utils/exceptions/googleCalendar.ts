import { HTTP_STATUS_CODE } from "../consts";

export class GoogleCalendarNotConnectedException extends Error {
  code: HTTP_STATUS_CODE = HTTP_STATUS_CODE.BAD_REQUEST;

  constructor(message = "No Google Calendar connected for this user") {
    super(message);
    this.name = "GoogleCalendarNotConnectedException";
  }
}

/**
 * Thrown when Google rejects our stored refresh token — the user revoked access
 * from their Google account settings, or the token expired from disuse. The
 * connection is unusable and must be cleared so the UI stops claiming we're
 * connected.
 */
export class GoogleCalendarAccessRevokedException extends Error {
  code: HTTP_STATUS_CODE = HTTP_STATUS_CODE.UNAUTHORIZED;

  constructor(
    message = "Google Calendar access was revoked. Please reconnect your account.",
  ) {
    super(message);
    this.name = "GoogleCalendarAccessRevokedException";
  }
}

export class GoogleCalendarConfigException extends Error {
  code: HTTP_STATUS_CODE = HTTP_STATUS_CODE.INTERNAL_SERVER_ERROR;

  constructor(message = "Google Calendar is not configured on this server") {
    super(message);
    this.name = "GoogleCalendarConfigException";
  }
}
