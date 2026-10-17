import { HTTP_STATUS_CODE } from "../consts";

export class RideSeriesNotFoundException extends Error {
  code: HTTP_STATUS_CODE = HTTP_STATUS_CODE.NOT_FOUND;

  constructor(message = "Ride series not found") {
    super(message);
    this.name = "RideSeriesNotFoundException";
  }
}

export class RideSeriesInvalidException extends Error {
  code: HTTP_STATUS_CODE = HTTP_STATUS_CODE.BAD_REQUEST;

  constructor(message = "Invalid ride series") {
    super(message);
    this.name = "RideSeriesInvalidException";
  }
}
