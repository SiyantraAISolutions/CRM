export interface ProfessionalEmailParams {
  recipientName?: string
  recipientEmail: string
  subject: string
  bodyText: string
  brandName?: string
  orderDetails?: {
    orderId?: string
    address?: string
    titleNumber?: string
    amount?: string
    status?: string
  }
  supportPhone?: string
  supportEmail?: string
}

export function generateProfessionalEmailHtml({
  recipientName,
  bodyText,
  brandName = 'Online Land Registry',
  orderDetails,
  supportPhone = '0333 577 0077',
  supportEmail = 'support@onlinelandregistry.uk',
}: ProfessionalEmailParams): string {
  // Process body text paragraphs
  const paragraphs = bodyText
    .split(/\n+/)
    .map(p => p.trim())
    .filter(Boolean)
    .map(p => `<p style="margin: 0 0 16px 0; line-height: 1.6; color: #334155; font-size: 15px;">${p}</p>`)
    .join('')

  const greetingHtml = recipientName
    ? `<p style="margin: 0 0 16px 0; line-height: 1.6; color: #0f172a; font-size: 16px; font-weight: 600;">Dear ${recipientName},</p>`
    : ''

  const orderBoxHtml = orderDetails && (orderDetails.orderId || orderDetails.address || orderDetails.titleNumber)
    ? `
    <div style="margin: 24px 0; padding: 20px; background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px;">
      <h4 style="margin: 0 0 12px 0; font-size: 13px; font-weight: 700; text-transform: uppercase; tracking: 0.05em; color: #475569;">Application Reference Details</h4>
      <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
        ${orderDetails.orderId ? `
        <tr>
          <td style="padding: 6px 0; color: #64748b; font-weight: 500; width: 140px;">Order Reference:</td>
          <td style="padding: 6px 0; color: #0f172a; font-weight: 700; font-family: monospace;">#${orderDetails.orderId}</td>
        </tr>` : ''}
        ${orderDetails.titleNumber ? `
        <tr>
          <td style="padding: 6px 0; color: #64748b; font-weight: 500;">Title Number:</td>
          <td style="padding: 6px 0; color: #0f172a; font-weight: 600;">${orderDetails.titleNumber}</td>
        </tr>` : ''}
        ${orderDetails.address ? `
        <tr>
          <td style="padding: 6px 0; color: #64748b; font-weight: 500;">Property Address:</td>
          <td style="padding: 6px 0; color: #0f172a; font-weight: 600;">${orderDetails.address}</td>
        </tr>` : ''}
        ${orderDetails.amount ? `
        <tr>
          <td style="padding: 6px 0; color: #64748b; font-weight: 500;">Amount:</td>
          <td style="padding: 6px 0; color: #0f172a; font-weight: 600;">${orderDetails.amount}</td>
        </tr>` : ''}
      </table>
    </div>`
    : ''

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${brandName}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f1f5f9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased;">
  <table role="presentation" style="width: 100%; border-collapse: collapse; background-color: #f1f5f9; padding: 30px 0;">
    <tr>
      <td align="center">
        <table role="presentation" style="width: 100%; max-width: 600px; border-collapse: collapse; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -1px rgba(0, 0, 0, 0.03);">
          <!-- Header Banner -->
          <tr>
            <td style="background-color: #0b1b3a; padding: 28px 32px; text-align: left;">
              <h1 style="margin: 0; color: #ffffff; font-size: 20px; font-weight: 800; tracking-tight: -0.025em;">${brandName}</h1>
              <p style="margin: 4px 0 0 0; color: #94a3b8; font-size: 12px; font-weight: 500;">Official Land Registry Documentation Services</p>
            </td>
          </tr>

          <!-- Email Content Body -->
          <tr>
            <td style="padding: 32px;">
              ${greetingHtml}
              ${paragraphs}
              ${orderBoxHtml}

              <!-- Queries & Support Callout -->
              <div style="margin-top: 32px; padding: 16px; background-color: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; font-size: 13px; color: #166534; line-height: 1.5;">
                <strong>Need Help or Have Queries?</strong><br>
                If you have any questions regarding this email or your application, please feel free to reply directly to this email or call our support line at <strong>${supportPhone}</strong>.
              </div>

              <!-- Sign Off -->
              <div style="margin-top: 32px; padding-top: 20px; border-top: 1px solid #e2e8f0; color: #475569; font-size: 14px;">
                <p style="margin: 0; font-weight: 600;">Kind regards,</p>
                <p style="margin: 4px 0 0 0; color: #0b1b3a; font-weight: 700;">Customer Support Team</p>
                <p style="margin: 2px 0 0 0; color: #64748b; font-size: 12px;">${brandName}</p>
              </div>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #f8fafc; padding: 20px 32px; border-top: 1px solid #e2e8f0; text-align: center; font-size: 11px; color: #94a3b8; line-height: 1.5;">
              <p style="margin: 0;">This email was sent by ${brandName}.</p>
              <p style="margin: 4px 0 0 0;">Please retain this email for your records.</p>
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
