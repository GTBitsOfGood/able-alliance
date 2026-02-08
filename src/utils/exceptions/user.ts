import { HTTP_STATUS_CODE } from "../consts";

export class UserAlreadyExistsException extends Error {
  code: HTTP_STATUS_CODE = HTTP_STATUS_CODE.BAD_REQUEST;

  constructor(message = "User with this email already exists") {
    super(message);
    this.name = "UserAlreadyExistsException";
  }
}

export class UserNotFoundException extends Error {
  code: HTTP_STATUS_CODE = HTTP_STATUS_CODE.NOT_FOUND;

  constructor(message = "User not found") {
    super(message);
    this.name = "UserNotFoundException";
  }
}
