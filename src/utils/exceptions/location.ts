import { HTTP_STATUS_CODE } from "../consts";

export class LocationAlreadyExistsException extends Error {
  code: HTTP_STATUS_CODE = HTTP_STATUS_CODE.BAD_REQUEST;

  constructor(message = "Location already exists") {
    super(message);
    this.name = "LocationAlreadyExistsException";
  }
}
