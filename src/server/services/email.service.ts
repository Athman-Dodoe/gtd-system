// =============================================================================
// EmailService — Transactional email delivery via Resend
// =============================================================================
// Safety rules enforced here:
//   1. In development (NODE_ENV !== 'production'), ALL emails are redirected
//      to DEV_EMAIL_OVERRIDE. The real recipient is never contacted.
//   2. All send functions are void-returning and never throw. Errors are
//      caught and logged so email failures never affect the caller.
//   3. This service must only be called AFTER a transaction has committed,
//      using fire-and-forget: sendXxxEmail(...).catch(err => console.error(err))
// =============================================================================

import { Resend } from 'resend'

let resend: Resend | null = null

function getResend(): Resend | null {
  if (!process.env.RESEND_API_KEY) return null
  if (!resend) resend = new Resend(process.env.RESEND_API_KEY)
  return resend
}

// =============================================================================
// TYPE DEFINITIONS
// =============================================================================

export interface BriefAllocationEmailData {
  to: string
  counselName: string
  briefRef: string
  subject: string
  urgency: string
  estimatedHours: number
  expertiseArea: string
}

export interface BriefCompletionEmailData {
  to: string
  dsgName: string
  counselName: string
  briefRef: string
  subject: string
  completionNotes: string
  documentReference?: string
}

export interface PasswordResetEmailData {
  to: string
  userName: string
  resetLink: string
}

// =============================================================================
// EMAIL TEMPLATE HELPERS (plain HTML — no React Email dependency)
// =============================================================================

function buildAllocationHtml(data: Omit<BriefAllocationEmailData, 'to'>): string {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>New Brief Assigned — ${data.briefRef}</title>
</head>
<body style="font-family: Arial, sans-serif; background-color: #f4f4f4; margin: 0; padding: 0;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f4f4f4; padding: 32px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.08);">

          <!-- Header -->
          <tr>
            <td style="background-color: #1a3c5e; padding: 24px 32px;">
              <p style="margin: 0; font-size: 13px; color: #a0b4c8; letter-spacing: 0.5px; text-transform: uppercase;">
                Office of the Attorney General, Kenya
              </p>
              <p style="margin: 4px 0 0; font-size: 18px; font-weight: bold; color: #ffffff;">
                GTD Legal Brief Allocation System
              </p>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding: 32px;">
              <p style="font-size: 20px; font-weight: bold; color: #1a3c5e; margin: 0 0 8px;">
                📋 New Brief Assigned to You
              </p>
              <p style="color: #555; margin: 0 0 24px; font-size: 15px;">
                Dear ${data.counselName},
              </p>
              <p style="color: #555; margin: 0 0 24px; font-size: 15px;">
                A new legal brief has been assigned to you in the GTD Legal Brief Allocation System.
              </p>

              <!-- Brief Details Table -->
              <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f0f4f8; border-radius: 6px; margin-bottom: 24px;">
                <tr>
                  <td style="padding: 20px 24px;">
                    <p style="margin: 0 0 12px; font-size: 12px; font-weight: bold; color: #1a3c5e; letter-spacing: 1px; text-transform: uppercase;">
                      Brief Details
                    </p>
                    <table cellpadding="4" cellspacing="0" style="width: 100%;">
                      <tr>
                        <td style="font-size: 13px; color: #666; width: 140px; vertical-align: top; padding-bottom: 6px;">Reference</td>
                        <td style="font-size: 13px; color: #1a1a1a; font-weight: bold; padding-bottom: 6px;">${data.briefRef}</td>
                      </tr>
                      <tr>
                        <td style="font-size: 13px; color: #666; vertical-align: top; padding-bottom: 6px;">Subject</td>
                        <td style="font-size: 13px; color: #1a1a1a; padding-bottom: 6px;">${data.subject}</td>
                      </tr>
                      <tr>
                        <td style="font-size: 13px; color: #666; vertical-align: top; padding-bottom: 6px;">Expertise Area</td>
                        <td style="font-size: 13px; color: #1a1a1a; padding-bottom: 6px;">${data.expertiseArea.replace(/_/g, ' ')}</td>
                      </tr>
                      <tr>
                        <td style="font-size: 13px; color: #666; vertical-align: top; padding-bottom: 6px;">Urgency</td>
                        <td style="font-size: 13px; font-weight: bold; padding-bottom: 6px;
                          color: ${data.urgency === 'EMERGENCY' ? '#c0392b' : data.urgency === 'URGENT' ? '#d35400' : '#27ae60'};">
                          ${data.urgency}
                        </td>
                      </tr>
                      <tr>
                        <td style="font-size: 13px; color: #666; vertical-align: top;">Est. Hours</td>
                        <td style="font-size: 13px; color: #1a1a1a;">${data.estimatedHours}h</td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <p style="color: #555; margin: 0 0 24px; font-size: 15px;">
                Please log in to view your assignment and begin work.
              </p>

              <!-- CTA Button -->
              <table cellpadding="0" cellspacing="0">
                <tr>
                  <td style="background-color: #1a3c5e; border-radius: 6px;">
                    <a href="${process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'}/my-work"
                       style="display: inline-block; padding: 12px 28px; color: #ffffff; font-size: 14px; font-weight: bold; text-decoration: none;">
                      View My Work →
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #f0f4f8; padding: 16px 32px; border-top: 1px solid #e0e8f0;">
              <p style="margin: 0; font-size: 11px; color: #999; line-height: 1.6;">
                This is an automated notification from the Government Transactions Department,
                Office of the Attorney General, Kenya. Do not reply to this email.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`.trim()
}

function buildCompletionHtml(data: Omit<BriefCompletionEmailData, 'to'>): string {
  const docRef = data.documentReference ?? 'Not provided'
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Brief Completed — ${data.briefRef}</title>
</head>
<body style="font-family: Arial, sans-serif; background-color: #f4f4f4; margin: 0; padding: 0;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f4f4f4; padding: 32px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.08);">

          <!-- Header -->
          <tr>
            <td style="background-color: #1a3c5e; padding: 24px 32px;">
              <p style="margin: 0; font-size: 13px; color: #a0b4c8; letter-spacing: 0.5px; text-transform: uppercase;">
                Office of the Attorney General, Kenya
              </p>
              <p style="margin: 4px 0 0; font-size: 18px; font-weight: bold; color: #ffffff;">
                GTD Legal Brief Allocation System
              </p>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding: 32px;">
              <p style="font-size: 20px; font-weight: bold; color: #27ae60; margin: 0 0 8px;">
                ✅ Brief Work Completed
              </p>
              <p style="color: #555; margin: 0 0 24px; font-size: 15px;">
                Dear ${data.dsgName},
              </p>
              <p style="color: #555; margin: 0 0 24px; font-size: 15px;">
                <strong>${data.counselName}</strong> has submitted work on a brief assigned to them
                in the GTD Legal Brief Allocation System. The brief is ready for your review.
              </p>

              <!-- Brief Details -->
              <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f0f4f8; border-radius: 6px; margin-bottom: 16px;">
                <tr>
                  <td style="padding: 20px 24px;">
                    <p style="margin: 0 0 12px; font-size: 12px; font-weight: bold; color: #1a3c5e; letter-spacing: 1px; text-transform: uppercase;">
                      Brief Details
                    </p>
                    <table cellpadding="4" cellspacing="0" style="width: 100%;">
                      <tr>
                        <td style="font-size: 13px; color: #666; width: 140px; padding-bottom: 6px;">Reference</td>
                        <td style="font-size: 13px; color: #1a1a1a; font-weight: bold; padding-bottom: 6px;">${data.briefRef}</td>
                      </tr>
                      <tr>
                        <td style="font-size: 13px; color: #666; padding-bottom: 6px;">Subject</td>
                        <td style="font-size: 13px; color: #1a1a1a; padding-bottom: 6px;">${data.subject}</td>
                      </tr>
                      <tr>
                        <td style="font-size: 13px; color: #666;">Submitted By</td>
                        <td style="font-size: 13px; color: #1a1a1a;">${data.counselName}</td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <!-- Work Summary -->
              <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f9f9f9; border-left: 4px solid #27ae60; border-radius: 0 6px 6px 0; margin-bottom: 24px;">
                <tr>
                  <td style="padding: 20px 24px;">
                    <p style="margin: 0 0 10px; font-size: 12px; font-weight: bold; color: #1a3c5e; letter-spacing: 1px; text-transform: uppercase;">
                      Work Summary
                    </p>
                    <p style="margin: 0 0 12px; font-size: 14px; color: #333; line-height: 1.6; white-space: pre-wrap;">${data.completionNotes || 'No notes provided.'}</p>
                    <p style="margin: 0; font-size: 13px; color: #666;">
                      <strong>Document Reference:</strong> ${docRef}
                    </p>
                  </td>
                </tr>
              </table>

              <p style="color: #555; margin: 0 0 24px; font-size: 15px;">
                Log in to review the submission and formally close the brief.
              </p>

              <!-- CTA Button -->
              <table cellpadding="0" cellspacing="0">
                <tr>
                  <td style="background-color: #1a3c5e; border-radius: 6px;">
                    <a href="${process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'}/reports"
                       style="display: inline-block; padding: 12px 28px; color: #ffffff; font-size: 14px; font-weight: bold; text-decoration: none;">
                      Review in GTD System →
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #f0f4f8; padding: 16px 32px; border-top: 1px solid #e0e8f0;">
              <p style="margin: 0; font-size: 11px; color: #999; line-height: 1.6;">
                This is an automated notification from the Government Transactions Department,
                Office of the Attorney General, Kenya. Do not reply to this email.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`.trim()
}

// =============================================================================
// PASSWORD RESET EMAIL
// =============================================================================

function buildPasswordResetHtml(data: Omit<PasswordResetEmailData, 'to'>): string {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Password Reset Request</title>
</head>
<body style="font-family: Arial, sans-serif; background-color: #f4f4f4; margin: 0; padding: 0;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f4f4f4; padding: 32px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.08);">

          <!-- Header -->
          <tr>
            <td style="background-color: #1a3c5e; padding: 24px 32px;">
              <p style="margin: 0; font-size: 13px; color: #a0b4c8; letter-spacing: 0.5px; text-transform: uppercase;">
                Office of the Attorney General, Kenya
              </p>
              <p style="margin: 4px 0 0; font-size: 18px; font-weight: bold; color: #ffffff;">
                GTD Legal Brief Allocation System
              </p>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding: 32px;">
              <p style="font-size: 20px; font-weight: bold; color: #1a3c5e; margin: 0 0 8px;">
                🔒 Password Reset Request
              </p>
              <p style="color: #555; margin: 0 0 24px; font-size: 15px;">
                Dear ${data.userName},
              </p>
              <p style="color: #555; margin: 0 0 24px; font-size: 15px;">
                We received a request to reset the password for your GTD Legal Brief Allocation System account.
                Click the button below to set a new password. This link will expire in <strong>1 hour</strong>.
              </p>

              <!-- CTA Button -->
              <table cellpadding="0" cellspacing="0" style="margin-bottom: 24px;">
                <tr>
                  <td style="background-color: #1a3c5e; border-radius: 6px;">
                    <a href="${data.resetLink}"
                       style="display: inline-block; padding: 12px 28px; color: #ffffff; font-size: 14px; font-weight: bold; text-decoration: none;">
                      Reset My Password →
                    </a>
                  </td>
                </tr>
              </table>

              <p style="color: #999; margin: 0 0 8px; font-size: 13px;">
                If you did not request this password reset, please ignore this email.
                Your password will remain unchanged until you create a new one through the link above.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #f0f4f8; padding: 16px 32px; border-top: 1px solid #e0e8f0;">
              <p style="margin: 0; font-size: 11px; color: #999; line-height: 1.6;">
                This is an automated notification from the Government Transactions Department,
                Office of the Attorney General, Kenya. Do not reply to this email.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`.trim()
}

// =============================================================================
// EXPORTED SEND FUNCTIONS
// =============================================================================

/**
 * Sends a "New Brief Assigned" email to the allocated counsel.
 *
 * In development, the email is redirected to DEV_EMAIL_OVERRIDE.
 * Never throws — all errors are caught and logged internally.
 *
 * Usage (fire-and-forget):
 *   sendBriefAllocationEmail({ ... }).catch(err => console.error('[EMAIL]', err))
 */
export async function sendBriefAllocationEmail(data: BriefAllocationEmailData): Promise<void> {
  const client = getResend()
  if (!client) {
    console.log('[EMAIL] RESEND_API_KEY not configured — skipping sendBriefAllocationEmail')
    return
  }

  const overrideEmail = process.env.DEV_EMAIL_OVERRIDE
  const recipient = overrideEmail ?? data.to

  if (overrideEmail) {
    console.log(`[EMAIL OVERRIDE] Would have sent to: ${data.to}`)
    console.log(`[EMAIL OVERRIDE] Redirected to:      ${recipient}`)
  }

  try {
    const { data: result, error } = await client.emails.send({
      from: process.env.FROM_EMAIL ?? 'onboarding@resend.dev',
      to: [recipient],
      subject: `New Brief Assigned — ${data.briefRef}`,
      html: buildAllocationHtml(data),
    })

    if (error) {
      console.error('[EMAIL] sendBriefAllocationEmail — Resend API error:', error)
      return
    }

    console.log(`[EMAIL] sendBriefAllocationEmail — sent successfully. id=${result?.id}`)
  } catch (err) {
    console.error('[EMAIL] sendBriefAllocationEmail — unexpected error:', err)
  }
}

/**
 * Sends a "Brief Completed" email to the DSG.
 *
 * In development, the email is redirected to DEV_EMAIL_OVERRIDE.
 * Never throws — all errors are caught and logged internally.
 *
 * Usage (fire-and-forget):
 *   sendBriefCompletionEmail({ ... }).catch(err => console.error('[EMAIL]', err))
 */
export async function sendBriefCompletionEmail(data: BriefCompletionEmailData): Promise<void> {
  const client = getResend()
  if (!client) {
    console.log('[EMAIL] RESEND_API_KEY not configured — skipping sendBriefCompletionEmail')
    return
  }

  const overrideEmail = process.env.DEV_EMAIL_OVERRIDE
  const recipient = overrideEmail ?? data.to

  if (overrideEmail) {
    console.log(`[EMAIL OVERRIDE] Would have sent to: ${data.to}`)
    console.log(`[EMAIL OVERRIDE] Redirected to:      ${recipient}`)
  }

  try {
    const { data: result, error } = await client.emails.send({
      from: process.env.FROM_EMAIL ?? 'onboarding@resend.dev',
      to: [recipient],
      subject: `Brief Completed — ${data.briefRef}`,
      html: buildCompletionHtml(data),
    })

    if (error) {
      console.error('[EMAIL] sendBriefCompletionEmail — Resend API error:', error)
      return
    }

    console.log(`[EMAIL] sendBriefCompletionEmail — sent successfully. id=${result?.id}`)
  } catch (err) {
    console.error('[EMAIL] sendBriefCompletionEmail — unexpected error:', err)
  }
}

/**
 * Sends a "Password Reset" email with a one-time token link.
 *
 * In development, the email is redirected to DEV_EMAIL_OVERRIDE.
 * Never throws — all errors are caught and logged internally.
 *
 * Usage (fire-and-forget):
 *   sendPasswordResetEmail({ ... }).catch(err => console.error('[EMAIL]', err))
 */
export async function sendPasswordResetEmail(data: PasswordResetEmailData): Promise<void> {
  const client = getResend()
  if (!client) {
    console.log('[EMAIL] RESEND_API_KEY not configured — skipping sendPasswordResetEmail')
    return
  }

  const overrideEmail = process.env.DEV_EMAIL_OVERRIDE
  const recipient = overrideEmail ?? data.to

  if (overrideEmail) {
    console.log(`[EMAIL OVERRIDE] Would have sent to: ${data.to}`)
    console.log(`[EMAIL OVERRIDE] Redirected to:      ${recipient}`)
    console.log(`[EMAIL OVERRIDE] Reset link:          ${data.resetLink}`)
  }

  try {
    const { data: result, error } = await client.emails.send({
      from: process.env.FROM_EMAIL ?? 'onboarding@resend.dev',
      to: [recipient],
      subject: 'Password Reset — GTD Legal Brief Allocation System',
      html: buildPasswordResetHtml(data),
    })

    if (error) {
      console.error('[EMAIL] sendPasswordResetEmail — Resend API error:', error)
      return
    }

    console.log(`[EMAIL] sendPasswordResetEmail — sent successfully. id=${result?.id}`)
  } catch (err) {
    console.error('[EMAIL] sendPasswordResetEmail — unexpected error:', err)
  }
}
