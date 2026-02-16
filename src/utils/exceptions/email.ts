import { HTTP_STATUS_CODE } from "../consts";

export class EmailFailedToSendException extends Error {
  code: HTTP_STATUS_CODE = HTTP_STATUS_CODE.INTERNAL_SERVER_ERROR;

  constructor(message = "Failed to send email") {
    super(message);
    this.name = "EmailFailedToSendException";
  }
}

export class EmailSendException extends Error {
  code: HTTP_STATUS_CODE = HTTP_STATUS_CODE.INTERNAL_SERVER_ERROR;

  constructor(message = "Failed to send email") {
    super(message);
    this.name = "EmailSendException";
  }
}

export class EmailConfigException extends Error {
  code: HTTP_STATUS_CODE = HTTP_STATUS_CODE.INTERNAL_SERVER_ERROR;

  constructor(message = "Email service is not configured properly") {
    super(message);
    this.name = "EmailConfigException";
  }
}

export class EmailValidationException extends Error {
  code: HTTP_STATUS_CODE = HTTP_STATUS_CODE.BAD_REQUEST;

  constructor(message = "Invalid email parameters") {
    super(message);
    this.name = "EmailValidationException";
  }
}
