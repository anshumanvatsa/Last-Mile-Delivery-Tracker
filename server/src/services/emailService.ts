import nodemailer from 'nodemailer';

// ─────────────────────────────────────────────────────────────
// TRANSPORTER (lazy initialization — handles missing env gracefully)
// ─────────────────────────────────────────────────────────────

let transporter: nodemailer.Transporter | null = null;

function getTransporter(): nodemailer.Transporter | null {
  if (!process.env.SMTP_HOST || !process.env.SMTP_PASS) {
    return null; // Email not configured — fail gracefully
  }

  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT) || 465,
      secure: Number(process.env.SMTP_PORT) === 465,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
  }

  return transporter;
}

// ─────────────────────────────────────────────────────────────
// STATUS LABELS
// ─────────────────────────────────────────────────────────────

const statusLabels: Record<string, string> = {
  PENDING: 'Order Placed',
  PICKED_UP: 'Picked Up',
  IN_TRANSIT: 'In Transit',
  OUT_FOR_DELIVERY: 'Out for Delivery',
  DELIVERED: 'Delivered',
  FAILED: 'Delivery Failed',
};

const statusColors: Record<string, string> = {
  PENDING: '#6b7280',
  PICKED_UP: '#f59e0b',
  IN_TRANSIT: '#3b82f6',
  OUT_FOR_DELIVERY: '#f97316',
  DELIVERED: '#22c55e',
  FAILED: '#ef4444',
};

// ─────────────────────────────────────────────────────────────
// HTML EMAIL TEMPLATE
// ─────────────────────────────────────────────────────────────

function buildEmailTemplate(params: {
  customerName: string;
  trackingNumber: string;
  status: string;
  note?: string;
  scheduledDate?: string;
  isFailed?: boolean;
  frontendUrl: string;
}): string {
  const { customerName, trackingNumber, status, note, isFailed, frontendUrl, scheduledDate } = params;
  const label = statusLabels[status] || status;
  const color = statusColors[status] || '#3b82f6';
  const trackingUrl = `${frontendUrl}/track/${trackingNumber}`;
  const rescheduleUrl = `${frontendUrl}/track/${trackingNumber}/reschedule`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Delivery Update — ${trackingNumber}</title>
</head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:Inter,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;padding:40px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 6px rgba(0,0,0,0.07);">

          <!-- Header -->
          <tr>
            <td style="background:#0a0f1e;padding:32px 40px;text-align:center;">
              <div style="font-size:24px;font-weight:700;color:#ffffff;letter-spacing:-0.5px;">
                🚚 LastMile
              </div>
              <div style="font-size:13px;color:#94a3b8;margin-top:4px;">Last-Mile Delivery Tracker</div>
            </td>
          </tr>

          <!-- Status Banner -->
          <tr>
            <td style="background:${color};padding:20px 40px;text-align:center;">
              <div style="font-size:18px;font-weight:600;color:#ffffff;">${label}</div>
              <div style="font-size:13px;color:rgba(255,255,255,0.85);margin-top:4px;">${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}</div>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:40px;">
              <p style="margin:0 0 16px;font-size:16px;color:#1f2937;">Hi <strong>${customerName}</strong>,</p>
              <p style="margin:0 0 24px;font-size:15px;color:#4b5563;line-height:1.6;">
                Your delivery status has been updated to <strong style="color:${color};">${label}</strong>.
              </p>

              <!-- Tracking Number Box -->
              <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:20px;margin-bottom:24px;text-align:center;">
                <div style="font-size:11px;text-transform:uppercase;letter-spacing:1px;color:#6b7280;margin-bottom:8px;">Tracking Number</div>
                <div style="font-size:22px;font-weight:700;color:#0a0f1e;letter-spacing:2px;">${trackingNumber}</div>
              </div>

              ${note ? `
              <!-- Note -->
              <div style="background:#eff6ff;border-left:4px solid ${color};border-radius:0 8px 8px 0;padding:16px;margin-bottom:24px;">
                <div style="font-size:13px;font-weight:600;color:#1d4ed8;margin-bottom:4px;">Delivery Note</div>
                <div style="font-size:14px;color:#374151;">${note}</div>
              </div>
              ` : ''}

              ${scheduledDate ? `
              <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:16px;margin-bottom:24px;">
                <div style="font-size:13px;font-weight:600;color:#15803d;">Rescheduled For</div>
                <div style="font-size:15px;color:#166534;margin-top:4px;">${scheduledDate}</div>
              </div>
              ` : ''}

              <!-- Track Button -->
              <div style="text-align:center;margin-bottom:24px;">
                <a href="${trackingUrl}" style="display:inline-block;background:#3b82f6;color:#ffffff;text-decoration:none;padding:14px 32px;border-radius:8px;font-size:15px;font-weight:600;">
                  Track Your Order →
                </a>
              </div>

              ${isFailed ? `
              <!-- Reschedule Section -->
              <div style="background:#fef2f2;border:1px solid #fecaca;border-radius:8px;padding:24px;text-align:center;">
                <div style="font-size:16px;font-weight:600;color:#dc2626;margin-bottom:8px;">Delivery Attempt Failed</div>
                <p style="font-size:14px;color:#7f1d1d;margin:0 0 16px;line-height:1.5;">
                  We were unable to deliver your package. Would you like to reschedule for a different date?
                </p>
                <a href="${rescheduleUrl}" style="display:inline-block;background:#dc2626;color:#ffffff;text-decoration:none;padding:12px 28px;border-radius:8px;font-size:14px;font-weight:600;">
                  Reschedule Delivery
                </a>
              </div>
              ` : ''}
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background:#f9fafb;padding:24px 40px;text-align:center;border-top:1px solid #e5e7eb;">
              <p style="margin:0;font-size:12px;color:#9ca3af;">
                © ${new Date().getFullYear()} LastMile Delivery. This is an automated notification.<br>
                If you have questions, reply to this email.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

// ─────────────────────────────────────────────────────────────
// SEND EMAIL — Graceful failure (never crashes the request)
// ─────────────────────────────────────────────────────────────

export interface SendEmailParams {
  to: string;
  customerName: string;
  trackingNumber: string;
  status: string;
  note?: string;
  scheduledDate?: string;
}

export async function sendStatusEmail(params: SendEmailParams): Promise<{ sent: boolean; error?: string }> {
  const transport = getTransporter();

  if (!transport) {
    const msg = 'Email service not configured (SMTP_HOST/SMTP_PASS missing) — skipping email';
    console.warn(`[EMAIL] ${msg}`);
    return { sent: false, error: msg };
  }

  const isFailed = params.status === 'FAILED';
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
  const label = statusLabels[params.status] || params.status;

  try {
    await transport.sendMail({
      from: `LastMile Delivery <${process.env.EMAIL_FROM}>`,
      to: params.to,
      subject: `Your delivery ${params.trackingNumber} is now: ${label}`,
      html: buildEmailTemplate({
        customerName: params.customerName,
        trackingNumber: params.trackingNumber,
        status: params.status,
        note: params.note,
        scheduledDate: params.scheduledDate,
        isFailed,
        frontendUrl,
      }),
    });

    console.log(`[EMAIL] Sent status email to ${params.to} — ${params.status} — ${params.trackingNumber}`);
    return { sent: true };
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    console.error(`[EMAIL] Failed to send email to ${params.to}:`, error);
    // IMPORTANT: Do NOT re-throw — email failure should never crash the request
    return { sent: false, error };
  }
}
