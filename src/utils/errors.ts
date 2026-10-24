import { NextResponse } from "next/server";
import { HTTP_STATUS_CODE } from "@/utils/consts";

export class HttpError extends Error {
  constructor(
    readonly statusCode: HTTP_STATUS_CODE,
    message: string,
  ) {
    super(message);
    this.name = new.target.name;
  }
}

export class ArgumentError extends HttpError {
  constructor(message: string) {
    super(HTTP_STATUS_CODE.BAD_REQUEST, message);
  }
}

export class NotFoundError extends HttpError {
  constructor(message: string) {
    super(HTTP_STATUS_CODE.NOT_FOUND, message);
  }
}

export class ConflictError extends HttpError {
  constructor(message: string) {
    super(HTTP_STATUS_CODE.CONFLICT, message);
  }
}

export class InternalError extends HttpError {
  constructor(message = "Internal server error") {
    super(HTTP_STATUS_CODE.INTERNAL_SERVER_ERROR, message);
  }
}

export function errorResponse(error: unknown) {
  if (error instanceof InternalError) {
    console.error("Internal API error", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: HTTP_STATUS_CODE.INTERNAL_SERVER_ERROR },
    );
  }
  if (error instanceof HttpError) {
    return NextResponse.json(
      { error: error.message },
      { status: error.statusCode },
    );
  }

  console.error("Unexpected API error", error);
  return NextResponse.json(
    { error: "Internal server error" },
    { status: HTTP_STATUS_CODE.INTERNAL_SERVER_ERROR },
  );
}
