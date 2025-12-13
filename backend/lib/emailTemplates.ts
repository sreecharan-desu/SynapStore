
/**
 * Email Templates for SynapStore
 * Using inline CSS for maximum compatibility.
 */

const BASE_STYLES = `
  font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
  max-width: 600px;
  margin: 0 auto;
  padding: 20px;
  background-color: #f6f9fc;
  border-radius: 8px;
`;

const CONTAINER_STYLES = `
  background-color: #ffffff;
  padding: 30px;
  border-radius: 8px;
  box-shadow: 0 4px 6px rgba(0,0,0,0.05);
`;

const HEADING_STYLES = `
  color: #1a1a1a;
  font-size: 24px;
  margin-bottom: 20px;
  font-weight: 600;
`;

const PARAGRAPH_STYLES = `
  color: #4a5568;
  font-size: 16px;
  line-height: 1.6;
  margin-bottom: 15px;
`;

const BUTTON_STYLES = `
  display: inline-block;
  background-color: #3b82f6;
  color: #ffffff;
  padding: 12px 24px;
  border-radius: 6px;
  text-decoration: none;
  font-weight: 500;
  margin-top: 20px;
`;

const FOOTER_STYLES = `
  margin-top: 30px;
  text-align: center;
  color: #a0aec0;
  font-size: 12px;
`;

function wrapContent(content: string): string {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="margin: 0; padding: 0; background-color: #f6f9fc;">
      <div style="${BASE_STYLES}">
        <div style="${CONTAINER_STYLES}">
          <div style="text-align: center; margin-bottom: 30px;">
             <!-- Placeholder for Logo if needed, for now just Text -->
             <h1 style="color: #3b82f6; margin: 0; font-size: 28px; font-weight: bold;">SynapStore</h1>
          </div>
          ${content}
        </div>
        <div style="${FOOTER_STYLES}">
          &copy; ${new Date().getFullYear()} SynapStore. All rights reserved.
        </div>
      </div>
    </body>
    </html>
  `;
}

export function getOtpEmailTemplate(otp: string): string {
  return wrapContent(`
    <h2 style="${HEADING_STYLES}">Verify Your Email</h2>
    <p style="${PARAGRAPH_STYLES}">
      Thank you for registering with SynapStore. To complete your sign up, please use the following verification code:
    </p>
    <div style="text-align: center; margin: 30px 0;">
      <span style="font-size: 32px; font-weight: bold; letter-spacing: 5px; color: #2d3748; background: #edf2f7; padding: 10px 20px; border-radius: 8px;">
        ${otp}
      </span>
    </div>
    <p style="${PARAGRAPH_STYLES}">
      This code will expire in 10 minutes. If you didn't request this code, you can safely ignore this email.
    </p>
  `);
}

export function getSupplierRequestEmailTemplate(supplierName: string, message?: string): string {
  const messageBlock = message 
    ? `<div style="background-color: #f7fafc; padding: 15px; border-left: 4px solid #3b82f6; margin: 15px 0; color: #4a5568; font-style: italic;">"${message}"</div>` 
    : '';

  return wrapContent(`
    <h2 style="${HEADING_STYLES}">New Supplier Connection Request</h2>
    <p style="${PARAGRAPH_STYLES}">
      <strong>${supplierName}</strong> has requested to connect with your store.
    </p>
    ${messageBlock}
    <p style="${PARAGRAPH_STYLES}">
      Please log in to your dashboard to review this request.
    </p>
    <div style="text-align: center;">
      <a href="${process.env.APP_URL || '#'}" style="${BUTTON_STYLES}">Go to Dashboard</a>
    </div>
  `);
}

export function getRequestAcceptedEmailTemplate(storeName: string): string {
  return wrapContent(`
    <h2 style="${HEADING_STYLES}">Request Accepted!</h2>
    <p style="${PARAGRAPH_STYLES}">
      Good news! Your request to supply <strong>${storeName}</strong> has been accepted.
    </p>
    <p style="${PARAGRAPH_STYLES}">
      You can now start managing inventory and engaging with this store through your portal.
    </p>
    <div style="text-align: center;">
      <a href="${process.env.APP_URL || '#'}" style="${BUTTON_STYLES}">View Store</a>
    </div>
  `);
}

export function getRequestRejectedEmailTemplate(storeName: string): string {
  return wrapContent(`
    <h2 style="${HEADING_STYLES}">Request Update</h2>
    <p style="${PARAGRAPH_STYLES}">
      Your request to supply <strong>${storeName}</strong> was not accepted at this time.
    </p>
    <p style="${PARAGRAPH_STYLES}">
      You can try contacting the store directly or waiting before sending another request.
    </p>
  `);
}

export function getReceiptEmailTemplate(storeName: string, receiptData: any): string {
  // Assuming receiptData has some basic info like date, total items, etc.
  // This is a placeholder since we don't have the full receipt structure yet.
  
  return wrapContent(`
    <h2 style="${HEADING_STYLES}">Inventory Upload Processed</h2>
    <p style="${PARAGRAPH_STYLES}">
      The inventory upload from <strong>${storeName}</strong> has been successfully processed.
    </p>
    <div style="background-color: #f8fafc; padding: 20px; border-radius: 6px; margin: 20px 0;">
        <p style="margin: 5px 0;"><strong>Date:</strong> ${new Date().toLocaleDateString()}</p>
        <p style="margin: 5px 0;"><strong>Status:</strong> Success</p>
        <!-- Add more details here when available -->
    </div>
    <p style="${PARAGRAPH_STYLES}">
      You can view the detailed report in your dashboard.
    </p>
  `);
}

export function getNotificationEmailTemplate(title: string, message: string): string {
  return wrapContent(`
    <h2 style="${HEADING_STYLES}">${title}</h2>
    <p style="${PARAGRAPH_STYLES}">
      ${message}
    </p>
    <p style="${PARAGRAPH_STYLES}; font-size: 14px; color: #718096; margin-top: 20px;">
      If this wasn't you, please contact support immediately.
    </p>
  `);
}

export function getStoreConnectionRequestEmailTemplate(storeName: string, message?: string): string {
  const messageBlock = message 
    ? `<div style="background-color: #f7fafc; padding: 15px; border-left: 4px solid #3b82f6; margin: 15px 0; color: #4a5568; font-style: italic;">"${message}"</div>` 
    : '';

  return wrapContent(`
    <h2 style="${HEADING_STYLES}">New Connection Request</h2>
    <p style="${PARAGRAPH_STYLES}">
      <strong>${storeName}</strong> has requested to connect with you.
    </p>
    ${messageBlock}
    <p style="${PARAGRAPH_STYLES}">
      Please log in to your supplier dashboard to review this request.
    </p>
    <div style="text-align: center;">
      <a href="${process.env.APP_URL || '#'}" style="${BUTTON_STYLES}">Go to Dashboard</a>
    </div>
  `);
}

export function getDisconnectionEmailTemplate(partyName: string): string {
  return wrapContent(`
    <h2 style="${HEADING_STYLES}">Connection Ended</h2>
    <p style="${PARAGRAPH_STYLES}">
      The connection with <strong>${partyName}</strong> has been terminated.
    </p>
    <p style="${PARAGRAPH_STYLES}">
      You will no longer receive requests or updates from this connection.
    </p>
  `);
}
