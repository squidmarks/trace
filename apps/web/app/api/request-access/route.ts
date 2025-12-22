import { NextRequest, NextResponse } from "next/server"
import { ServerClient } from "postmark"
import { z } from "zod"

const requestAccessSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().email("Invalid email address"),
  message: z.string().optional(),
})

/**
 * POST /api/request-access
 * Handle access request submissions and send email to admin
 */
export async function POST(request: NextRequest) {
  try {
    // Parse and validate request body
    const body = await request.json()
    const validatedData = requestAccessSchema.parse(body)

    // Get admin email from environment
    const adminEmail = process.env.ADMIN_EMAIL
    if (!adminEmail) {
      console.error("ADMIN_EMAIL not configured in environment variables")
      return NextResponse.json(
        { error: "Email service not configured" },
        { status: 500 }
      )
    }

    // Get Postmark API token
    const postmarkToken = process.env.POSTMARK_API_TOKEN
    if (!postmarkToken) {
      console.error("POSTMARK_API_TOKEN not configured in environment variables")
      return NextResponse.json(
        { error: "Email service not configured" },
        { status: 500 }
      )
    }

    // Create Postmark client
    const client = new ServerClient(postmarkToken)

    // Send email to admin
    const emailHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #2563eb 0%, #9333ea 100%); color: white; padding: 20px; border-radius: 8px 8px 0 0; }
            .content { background: #f9fafb; padding: 20px; border: 1px solid #e5e7eb; border-top: none; }
            .field { margin-bottom: 15px; }
            .label { font-weight: bold; color: #4b5563; }
            .value { margin-top: 5px; padding: 10px; background: white; border-radius: 4px; border: 1px solid #e5e7eb; }
            .footer { text-align: center; padding: 20px; color: #6b7280; font-size: 14px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h2 style="margin: 0;">🔔 New Access Request for Trace</h2>
            </div>
            <div class="content">
              <p>A new user has requested access to Trace:</p>
              
              <div class="field">
                <div class="label">Name:</div>
                <div class="value">${validatedData.name}</div>
              </div>
              
              <div class="field">
                <div class="label">Email:</div>
                <div class="value">${validatedData.email}</div>
              </div>
              
              ${
                validatedData.message
                  ? `
                <div class="field">
                  <div class="label">Message:</div>
                  <div class="value">${validatedData.message}</div>
                </div>
              `
                  : ""
              }
              
              <p style="margin-top: 20px;">
                <strong>Next Steps:</strong><br>
                Log in to your Trace admin panel to review this request and grant access.
              </p>
            </div>
            <div class="footer">
              <p>This is an automated message from your Trace application.</p>
            </div>
          </div>
        </body>
      </html>
    `

    // Send email via Postmark
    await client.sendEmail({
      From: process.env.POSTMARK_FROM_EMAIL || adminEmail,
      To: adminEmail,
      Subject: `Trace Access Request from ${validatedData.name}`,
      HtmlBody: emailHtml,
      TextBody: `
New Access Request for Trace

Name: ${validatedData.name}
Email: ${validatedData.email}
${validatedData.message ? `Message: ${validatedData.message}` : ""}

Log in to your Trace admin panel to review this request and grant access.
      `.trim(),
      MessageStream: "outbound",
    })

    console.log(`[Access Request] Email sent to ${adminEmail} for ${validatedData.email}`)

    return NextResponse.json({
      success: true,
      message: "Access request submitted successfully",
    })
  } catch (error: any) {
    console.error("Error processing access request:", error)

    if (error.name === "ZodError") {
      return NextResponse.json(
        { error: "Invalid request data", details: error.errors },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { error: "Failed to submit access request" },
      { status: 500 }
    )
  }
}

