import { HTTP_STATUS_CODE } from "../consts";

export class RouteAlreadyExistsException extends Error {
  code: HTTP_STATUS_CODE = HTTP_STATUS_CODE.BAD_REQUEST;

  constructor(message = "Route already exists") {
    super(message);
    this.name = "RouteAlreadyExistsException";
  }
}

export class RouteReferenceNotFoundException extends Error {
  code: HTTP_STATUS_CODE = HTTP_STATUS_CODE.BAD_REQUEST;

  constructor(message: string) {
    super(message);
    this.name = "RouteReferenceNotFoundException";
  }
}

export class DriverNotAvailableException extends Error {
  code: HTTP_STATUS_CODE = HTTP_STATUS_CODE.BAD_REQUEST;

  constructor(message = "Driver is not available during the scheduled time") {
    super(message);
    this.name = "DriverNotAvailableException";
  }
}
