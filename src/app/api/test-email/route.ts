import { NextRequest, NextResponse } from "next/server";
import { sendEmail } from "@/server/db/actions/EmailAction";
import { EmailFailedToSendException } from "@/utils/exceptions/email";
import { HTTP_STATUS_CODE } from "@/utils/consts";
import { internalErrorPayload } from "@/utils/apiError";

export async function POST(request: NextRequest) {
  try {
    console.log("📨 Test email endpoint called");
    const body = await request.json();
    console.log("Request body:", body);
    
    const { to, toName, subject, html } = body;

    if (!to) {
      return NextResponse.json(
        { error: "Recipient email (to) is required" },
        { status: HTTP_STATUS_CODE.BAD_REQUEST }
      );
    }

    console.log("Calling sendEmail function...");
    await sendEmail({
      to,
      toName,
      subject: subject || "Test Email from Able Alliance",
      html: html || "<h1>Hello!</h1><p>This is a test email.</p>",
    });

    console.log("✅ Email sent successfully from API endpoint");
    return NextResponse.json(
      { success: true, message: "Email sent successfully" },
      { status: HTTP_STATUS_CODE.OK }
    );
  } catch (error: any) {
    console.error("❌ Email send error in API endpoint:", error);
    console.error("Error stack:", error.stack);
    console.error("Error details:", {
      name: error.name,
      message: error.message,
      code: error.code,
    });
    
    if (error instanceof EmailFailedToSendException) {
      return NextResponse.json(
        { error: error.message, details: error },
        { status: error.code }
      );
    }
    return NextResponse.json(
      { 
        error: internalErrorPayload(error),
        errorMessage: error.message,
        errorName: error.name,
      },
      { status: HTTP_STATUS_CODE.INTERNAL_SERVER_ERROR }
    );
  }
}
