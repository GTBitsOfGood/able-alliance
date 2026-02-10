import { HTTP_STATUS_CODE } from "../consts";

export class VehicleAlreadyExistsException extends Error {
  code: HTTP_STATUS_CODE = HTTP_STATUS_CODE.BAD_REQUEST;

  constructor(message = "Vehicle already exists") {
    super(message);
    this.name = "VehicleAlreadyExistsException";
  }
}
