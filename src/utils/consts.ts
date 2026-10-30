export enum HTTP_STATUS_CODE {
  BAD_REQUEST = 400,
  OK = 200,
  CREATED = 201,
  UNAUTHORIZED = 401,
  FORBIDDEN = 403,
  NOT_FOUND = 404,
  CONFLICT = 409,
  METHOD_NOT_ALLOWED = 405,
  INTERNAL_SERVER_ERROR = 500,
}

// Pickup times and windows must fall inside these hours (America/New_York).
export const SERVICE_START_TIME = "07:30";
export const SERVICE_END_TIME = "19:45";

// The maximum number of minutes a driver can report a delay for a route.
export const MAX_DELAY_MINUTES = 120;
