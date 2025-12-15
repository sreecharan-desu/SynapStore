/**
 * Email Templates for SynapStore
 * "Super Classy" Design: Minimalist, clean typography, professional darks.
 */

const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:5173";

const BASE_STYLES = `
  font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif;
  max-width: 600px;
  margin: 0 auto;
  padding: 40px 20px;
  background-color: #f3f4f6; /* Slate-100 */
`;

const CONTAINER_STYLES = `
  background-color: #ffffff;
  padding: 40px;
  border-radius: 12px;
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -1px rgba(0, 0, 0, 0.03);
  border: 1px solid #e5e7eb;
`;

const HEADING_STYLES = `
  color: #111827; /* Gray-900 */
  font-size: 24px;
  margin-bottom: 24px;
  font-weight: 700;
  letter-spacing: -0.025em;
  text-align: center;
`;

const PARAGRAPH_STYLES = `
  color: #4b5563; /* Gray-600 */
  font-size: 16px;
  line-height: 1.625;
  margin-bottom: 20px;
`;

const BUTTON_STYLES = `
  display: inline-block;
  background-color: #111827; /* Gray-900 */
  color: #ffffff;
  padding: 14px 28px;
  border-radius: 8px;
  text-decoration: none;
  font-weight: 600;
  margin-top: 24px;
  font-size: 14px;
`;

const FOOTER_STYLES = `
  margin-top: 32px;
  text-align: center;
  color: #9ca3af; /* Gray-400 */
  font-size: 12px;
`;

function wrapContent(content: string, title: string = "SynapStore"): string {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${title}</title>
    </head>
    <body style="margin: 0; padding: 0; background-color: #f3f4f6; -webkit-font-smoothing: antialiased;">
      <div style="${BASE_STYLES}">
        <div style="${CONTAINER_STYLES}">
          <div style="text-align: center; margin-bottom: 32px;">
             <span style="color: #111827; font-size: 20px; font-weight: 800; tracking-wide: 0.1em; text-transform: uppercase;">SynapStore</span>
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
    <h2 style="${HEADING_STYLES}">Verify Your Account</h2>
    <p style="${PARAGRAPH_STYLES} text-align: center;">
      Use the secure code below to complete your sign-in.
    </p>
    <div style="text-align: center; margin: 40px 0;">
      <span style="font-family: monospace; font-size: 36px; font-weight: 700; letter-spacing: 8px; color: #111827; background: #f3f4f6; padding: 16px 32px; border-radius: 12px; border: 1px solid #e5e7eb;">
        ${otp}
      </span>
    </div>
    <p style="${PARAGRAPH_STYLES} font-size: 14px; text-align: center; color: #6b7280;">
      This code is valid for 10 minutes.
    </p>
  `, "Verify Email");
}

export function getSupplierRequestEmailTemplate(supplierName: string, message?: string): string {
  const messageBlock = message 
    ? `<div style="background-color: #f9fafb; padding: 20px; border-left: 4px solid #111827; margin: 24px 0; color: #4b5563; font-style: italic;">"${message}"</div>` 
    : '';

  return wrapContent(`
    <h2 style="${HEADING_STYLES}">New Connection Request</h2>
    <p style="${PARAGRAPH_STYLES}">
      <strong>${supplierName}</strong> has requested to join your supplier network.
    </p>
    ${messageBlock}
    <p style="${PARAGRAPH_STYLES}">
      Review their profile and deciding whether to accept instantly on your dashboard.
    </p>
    <div style="text-align: center;">
      <a href="${FRONTEND_URL}/dashboard" style="${BUTTON_STYLES}">Review Request</a>
    </div>
  `, "Connection Request");
}

export function getStoreConnectionRequestEmailTemplate(storeName: string, message?: string): string {
  const messageBlock = message 
    ? `<div style="background-color: #f9fafb; padding: 20px; border-left: 4px solid #111827; margin: 24px 0; color: #4b5563; font-style: italic;">"${message}"</div>` 
    : '';

  return wrapContent(`
    <h2 style="${HEADING_STYLES}">Partnership Inquiry</h2>
    <p style="${PARAGRAPH_STYLES}">
      <strong>${storeName}</strong> is interested in sourcing from you.
    </p>
    ${messageBlock}
    <p style="${PARAGRAPH_STYLES}">
      Log in to your portal to manage this connection.
    </p>
    <div style="text-align: center;">
      <a href="${FRONTEND_URL}/supplier/dashboard" style="${BUTTON_STYLES}">Supplier Dashboard</a>
    </div>
  `, "New Partnership");
}

export function getRequestAcceptedEmailTemplate(partnerName: string): string {
  return wrapContent(`
    <h2 style="${HEADING_STYLES}">Connection Active</h2>
    <p style="${PARAGRAPH_STYLES}">
      Great news. Your connection with <strong>${partnerName}</strong> is now active.
    </p>
    <p style="${PARAGRAPH_STYLES}">
      You can now begin seamless inventory operations.
    </p>
    <div style="text-align: center;">
      <a href="${FRONTEND_URL}/dashboard" style="${BUTTON_STYLES}">Go to Dashboard</a>
    </div>
  `, "Request Accepted");
}

export function getRequestRejectedEmailTemplate(partnerName: string): string {
  return wrapContent(`
    <h2 style="${HEADING_STYLES}">Status Update</h2>
    <p style="${PARAGRAPH_STYLES}">
      Your connection request to <strong>${partnerName}</strong> was declined at this time.
    </p>
    <p style="${PARAGRAPH_STYLES}">
      This may be due to current vendor capacity. You are welcome to try again in the future.
    </p>
  `, "Request Status");
}

export function getDisconnectionEmailTemplate(partnerName: string): string {
  return wrapContent(`
    <h2 style="${HEADING_STYLES}">Connection Terminated</h2>
    <p style="${PARAGRAPH_STYLES}">
      The secure link with <strong>${partnerName}</strong> has been closed.
    </p>
    <p style="${PARAGRAPH_STYLES}">
      All active data sharing has ceased efficiently.
    </p>
    <div style="text-align: center;">
      <a href="${FRONTEND_URL}" style="${BUTTON_STYLES} background-color: #f3f4f6; color: #374151; border: 1px solid #d1d5db;">Return to Home</a>
    </div>
  `, "Connection Ended");
}

export function getReceiptEmailTemplate(storeName: string, receiptData: any, additionalInfo?: string): string {
  const extraContent = additionalInfo 
    ? `<div style="margin-top: 20px; border-top: 1px solid #e5e7eb; padding-top: 20px;">
         <h3 style="color: #111827; font-size: 16px; margin-bottom: 12px;">Order Summary</h3>
         ${additionalInfo}
       </div>`
    : "";

  return wrapContent(`
    <h2 style="${HEADING_STYLES}">Processing Complete</h2>
    <p style="${PARAGRAPH_STYLES}">
      Inventory data for <strong>${storeName}</strong> has been successfully processed.
    </p>
    <div style="background-color: #f9fafb; padding: 24px; border-radius: 8px; margin: 24px 0; border: 1px solid #e5e7eb;">
        <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
          <strong style="color: #111827;">Status</strong>
          <span style="color: #059669; font-weight: 600;">Success</span>
        </div>
        <div style="display: flex; justify-content: space-between;">
           <strong style="color: #111827;">Date</strong>
           <span>${new Date().toLocaleDateString()}</span>
        </div>
    </div>
    ${extraContent}
    <div style="text-align: center; margin-top: 24px;">
      <a href="${FRONTEND_URL}/dashboard" style="${BUTTON_STYLES}">View Report</a>
    </div>
  `, "Upload Receipt");
}

export function getNotificationEmailTemplate(title: string, message: string): string {
  return wrapContent(`
    <p style="${PARAGRAPH_STYLES}">
       ${message}
    </p>
  `, title);
}

export function getReorderRequestEmailTemplate(supplierEmail: string, storeName: string, requestId: string, details: string, frontendUrl: string): string {
  return wrapContent(`
    <h2 style="${HEADING_STYLES}">New Reorder Request</h2>
    <p style="${PARAGRAPH_STYLES}">
      <strong>${storeName}</strong> has sent a new reorder request (ID: #${requestId.slice(0, 6)}).
    </p>
    <div style="background-color: #f9fafb; padding: 20px; border-left: 4px solid #111827; margin: 24px 0; color: #4b5563;">
        <pre style="font-family: inherit; white-space: pre-wrap;">${details}</pre>
    </div>
    <div style="text-align: center;">
      <a href="${frontendUrl}/supplier/requests" style="${BUTTON_STYLES}">View Request</a>
    </div>
  `, "Reorder Request");
}

export function getCustomerReceiptEmailTemplate(storeName: string, receiptNo: string, total: string): string {
  return wrapContent(`
    <h2 style="${HEADING_STYLES}">Receipt from ${storeName}</h2>
    <p style="${PARAGRAPH_STYLES}">
      Dear Customer,
    </p>
    <p style="${PARAGRAPH_STYLES}">
      Thank you for your purchase. Please find your receipt (<strong>${receiptNo}</strong>) attached for the total amount of <strong>${total}</strong>.
    </p>
    <p style="${PARAGRAPH_STYLES}">
       We appreciate your business and hope to see you again soon!
    </p>
  `, "Your Receipt");
}

