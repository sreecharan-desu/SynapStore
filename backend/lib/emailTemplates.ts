/**
 * Email Templates for SynapStore
 * "Super Responsive / Classy" Design
 * Optimized for readability on all devices.
 */

const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:5173";

// Base styles for the HTML body
const BODY_STYLES = `
  margin: 0;
  padding: 0;
  width: 100%;
  background-color: #f3f4f6;
  font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif;
  color: #1f2937;
  -webkit-font-smoothing: antialiased;
`;

// Main container - max width for desktop, 100% for mobile
const CONTAINER_TABLE_STYLES = `
  width: 100%;
  max-width: 600px;
  margin: 0 auto;
  background-color: #ffffff;
  border-radius: 8px;
  overflow: hidden;
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);
  border: 1px solid #e5e7eb;
`;

const CONTENT_PADDING = `
  padding: 40px;
`;

const LOGO_TEXT_STYLES = `
  font-size: 20px;
  font-weight: 800;
  color: #111827;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  text-decoration: none;
`;

const HEADING_STYLES = `
  margin-top: 0;
  margin-bottom: 16px;
  font-size: 24px;
  font-weight: 700;
  color: #111827;
  line-height: 1.3;
`;

const TEXT_STYLES = `
  font-size: 16px;
  line-height: 1.6;
  color: #4b5563;
  margin-bottom: 24px;
`;

const BUTTON_STYLES = `
  display: inline-block;
  background-color: #111827;
  color: #ffffff;
  padding: 14px 28px;
  border-radius: 6px;
  text-decoration: none;
  font-weight: 600;
  font-size: 14px;
`;

const INFO_BOX_STYLES = `
  background-color: #f9fafb;
  border-left: 4px solid #111827;
  padding: 16px 20px;
  margin-bottom: 24px;
  color: #4b5563;
  font-size: 14px;
  line-height: 1.5;
`;

const FOOTER_TEXT_STYLES = `
  font-size: 12px;
  color: #9ca3af;
  text-align: center;
  margin-top: 32px;
`;

function wrapContent(content: string, title: string = "SynapStore Notification"): string {
  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${title}</title>
      <style>
        /* Resets */
        body, p, h1, h2, h3, h4, h5, h6 { margin: 0; padding: 0; }
        body { width: 100% !important; -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
        
        /* Mobile Tweaks */
        @media only screen and (max-width: 600px) {
           .container { width: 100% !important; border-radius: 0 !important; border: none !important; }
           .content { padding: 24px !important; }
           .h-mobile { font-size: 20px !important; }
        }
      </style>
    </head>
    <body style="${BODY_STYLES}">
      <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #f3f4f6; padding: 40px 0;">
        <tr>
          <td align="center">
            
            <!-- Branding -->
            <div style="margin-bottom: 24px; text-align: center;">
               <a href="${FRONTEND_URL}" style="${LOGO_TEXT_STYLES}">SynapStore</a>
            </div>

            <!-- Main Card -->
            <table role="presentation" class="container" width="600" border="0" cellspacing="0" cellpadding="0" style="${CONTAINER_TABLE_STYLES}">
              <tr>
                <td class="content" style="${CONTENT_PADDING}">
                   ${content}
                </td>
              </tr>
            </table>

            <!-- Footer -->
            <div style="${FOOTER_TEXT_STYLES}">
               &copy; ${new Date().getFullYear()} SynapStore. All rights reserved.<br>
            </div>

          </td>
        </tr>
      </table>
    </body>
    </html>
  `;
}

// ---------------- ALERTS & NOTIFICATIONS ---------------- //

export function getOtpEmailTemplate(otp: string): string {
  const content = `
    <h1 class="h-mobile" style="${HEADING_STYLES}">Verify Your Account</h1>
    <p style="${TEXT_STYLES}">
      Identify verification required. Please use the following code to complete your login.
    </p>

    <div style="text-align: center; margin: 32px 0;">
      <span style="font-family: monospace; font-size: 32px; font-weight: 700; letter-spacing: 4px; background: #f3f4f6; padding: 16px 24px; border-radius: 8px; color: #111827;">
        ${otp}
      </span>
    </div>

    <p style="${TEXT_STYLES}; font-size: 13px; color: #6b7280; text-align: center;">
      This code is valid for 10 minutes. If you did not request this, please ignore.
    </p>
  `;
  return wrapContent(content, "Login Verification");
}

export function getSupplierRequestEmailTemplate(supplierName: string, message?: string): string {
  const messageHtml = message 
    ? `<div style="${INFO_BOX_STYLES}">"${message}"</div>` 
    : '';

  const content = `
    <h1 class="h-mobile" style="${HEADING_STYLES}">Connection Request</h1>
    <p style="${TEXT_STYLES}">
      <strong>${supplierName}</strong> wants to join your supplier network.
    </p>
    ${messageHtml}
    <p style="${TEXT_STYLES}">
      Review their profile to approve or deny this connection.
    </p>
    <div style="text-align: center; margin-top: 32px;">
      <a href="${FRONTEND_URL}/dashboard" style="${BUTTON_STYLES}">View Dashboard</a>
    </div>
  `;
  return wrapContent(content, "New Supplier Request");
}

export function getStoreConnectionRequestEmailTemplate(storeName: string, message?: string): string {
  const messageHtml = message 
    ? `<div style="${INFO_BOX_STYLES}">"${message}"</div>` 
    : '';

  const content = `
    <h1 class="h-mobile" style="${HEADING_STYLES}">Partnership Inquiry</h1>
    <p style="${TEXT_STYLES}">
      <strong>${storeName}</strong> has requested to source inventory from you.
    </p>
    ${messageHtml}
    <div style="text-align: center; margin-top: 32px;">
      <a href="${FRONTEND_URL}/supplier/dashboard" style="${BUTTON_STYLES}">Manage Requests</a>
    </div>
  `;
  return wrapContent(content, "New Store Request");
}

export function getRequestAcceptedEmailTemplate(partnerName: string): string {
  const content = `
    <h1 class="h-mobile" style="${HEADING_STYLES}">Connection Active</h1>
    <p style="${TEXT_STYLES}">
      Good news. <strong>${partnerName}</strong> has accepted your connection request.
    </p>
    <p style="${TEXT_STYLES}">
      You can now begin sending inventory updates and processing orders.
    </p>
    <div style="text-align: center; margin-top: 32px;">
      <a href="${FRONTEND_URL}/dashboard" style="${BUTTON_STYLES}">Go to Dashboard</a>
    </div>
  `;
  return wrapContent(content, "Request Accepted");
}

export function getRequestRejectedEmailTemplate(partnerName: string, message?: string): string {
  const messageHtml = message 
    ? `<div style="${INFO_BOX_STYLES}">Note from supplier: "${message}"</div>` 
    : '';

  const content = `
    <h1 class="h-mobile" style="${HEADING_STYLES}">Status Update</h1>
    <p style="${TEXT_STYLES}">
      Your request to connect with <strong>${partnerName}</strong> was declined at this time.
    </p>
    ${messageHtml}
    <p style="${TEXT_STYLES}">
      This is often due to vendor capacity limits. Feel free to try again later.
    </p>
  `;
  return wrapContent(content, "Request Update");
}

export function getDisconnectionEmailTemplate(partnerName: string): string {
  const content = `
    <h1 class="h-mobile" style="${HEADING_STYLES}">Connection Terminated</h1>
    <p style="${TEXT_STYLES}">
      The secure link with <strong>${partnerName}</strong> has been closed. Data sharing has ceased.
    </p>
    <div style="text-align: center; margin-top: 32px;">
      <a href="${FRONTEND_URL}" style="${BUTTON_STYLES}; background: #e5e7eb; color: #1f2937;">Return Home</a>
    </div>
  `;
  return wrapContent(content, "Connection Closed");
}

export function getReceiptEmailTemplate(storeName: string, receiptData: any, additionalInfo?: string): string {
  const additionalHtml = additionalInfo 
    ? `<div style="margin-top: 24px; padding-top: 24px; border-top: 1px solid #e5e7eb;">
         <h3 style="font-size: 16px; color: #111827; margin-bottom: 12px;">Summary</h3>
         ${additionalInfo}
       </div>`
    : "";

  const content = `
    <h1 class="h-mobile" style="${HEADING_STYLES}">Processing Complete</h1>
    <p style="${TEXT_STYLES}">
      Inventory data for <strong>${storeName}</strong> was successfully processed.
    </p>
    
    <div style="background-color: #f9fafb; padding: 20px; border-radius: 8px; border: 1px solid #e5e7eb;">
      <table width="100%" border="0">
        <tr>
          <td style="font-weight: 600; color: #111827;">Status</td>
          <td align="right" style="color: #059669; font-weight: 600;">Success</td>
        </tr>
        <tr>
          <td style="font-weight: 600; color: #111827; padding-top: 8px;">Date</td>
          <td align="right" style="color: #4b5563; padding-top: 8px;">${new Date().toLocaleDateString()}</td>
        </tr>
      </table>
    </div>

    ${additionalHtml}

    <div style="text-align: center; margin-top: 32px;">
       <a href="${FRONTEND_URL}/dashboard" style="${BUTTON_STYLES}">View Report</a>
    </div>
  `;
  return wrapContent(content, "Upload Receipt");
}

export function getNotificationEmailTemplate(title: string, message: string): string {
  const content = `
    <h1 class="h-mobile" style="${HEADING_STYLES}">${title}</h1>
    <p style="${TEXT_STYLES}">${message}</p>
  `;
  return wrapContent(content, title);
}

export function getReorderRequestEmailTemplate(supplierEmail: string, storeName: string, requestId: string, details: string, frontendUrl: string): string {
    const content = `
    <h1 class="h-mobile" style="${HEADING_STYLES}">New Reorder Request</h1>
    <p style="${TEXT_STYLES}">
      <strong>${storeName}</strong> sent a reorder request (ID: #${requestId.slice(0, 6)}).
    </p>
    
    <div style="${INFO_BOX_STYLES}">
       <pre style="font-family: inherit; font-size: 14px; white-space: pre-wrap; margin: 0;">${details}</pre>
    </div>

    <div style="text-align: center; margin-top: 32px;">
      <a href="${frontendUrl}/supplier/requests" style="${BUTTON_STYLES}">View Request</a>
    </div>
  `;
  return wrapContent(content, "Reorder Request");
}

export function getCustomerReceiptEmailTemplate(storeName: string, receiptNo: string, total: string): string {
    const content = `
    <h1 class="h-mobile" style="${HEADING_STYLES}">Receipt from ${storeName}</h1>
    <p style="${TEXT_STYLES}">Thank you for your business. Here is your receipt.</p>
    
    <div style="background: #f9fafb; padding: 24px; border-radius: 8px; text-align: center; margin: 24px 0;">
       <div style="font-size: 13px; color: #6b7280; margin-bottom: 4px;">RECEIPT NO</div>
       <div style="font-weight: 600; color: #111827; margin-bottom: 16px;">${receiptNo}</div>
       
       <div style="font-size: 13px; color: #6b7280; margin-bottom: 4px;">TOTAL PAID</div>
       <div style="font-size: 24px; font-weight: 800; color: #111827;">${total}</div>
    </div>
    
    <p style="${TEXT_STYLES}; text-align: center;">We hope to see you again soon!</p>
  `;
  return wrapContent(content, "Your Receipt");
}

export function getStockAlertEmailTemplate(storeName: string, expiringItems: any[], lowStockItems: any[]): string {
  
  const generateList = (items: any[], type: 'expiry' | 'stock') => {
    if (items.length === 0) return '';
    
    const rows = items.map(item => `
      <tr style="border-bottom: 1px solid #f3f4f6;">
        <td style="padding: 12px 0;">
          <div style="font-weight: 600; color: #111827;">${item.name}</div>
          <div style="font-size: 12px; color: #6b7280;">Batch: ${item.batch}</div>
        </td>
        <td align="right" style="padding: 12px 0; font-weight: 600; color: ${type === 'expiry' ? '#ef4444' : '#f59e0b'};">
           ${type === 'expiry' ? `Exp: ${new Date(item.expiryDate).toLocaleDateString()}` : `Qty: ${item.qty}`}
        </td>
      </tr>
    `).join('');

    return `
      <div style="margin-bottom: 32px;">
        <h3 style="font-size: 14px; text-transform: uppercase; color: #6b7280; font-weight: 700; border-bottom: 2px solid ${type === 'expiry' ? '#ef4444' : '#f59e0b'}; padding-bottom: 8px; margin-bottom: 12px; display: inline-block;">
          ${type === 'expiry' ? 'Action: Expiring Items' : 'Action: Low Stock'}
        </h3>
        <table width="100%" border="0" cellspacing="0" cellpadding="0">
          ${rows}
        </table>
      </div>
    `;
  };

  const expirySection = generateList(expiringItems, 'expiry');
  const lowStockSection = generateList(lowStockItems, 'stock');

  const content = `
    <h1 class="h-mobile" style="${HEADING_STYLES}">Inventory Alert</h1>
    <p style="${TEXT_STYLES}">
       Attention required for <strong>${storeName}</strong>. The following items triggered system thresholds.
    </p>

    ${expirySection}
    ${lowStockSection}

    <div style="text-align: center; margin-top: 32px;">
      <a href="${FRONTEND_URL}/inventory" style="${BUTTON_STYLES}">Review & Reorder</a>
    </div>
  `;
  return wrapContent(content, `Action Required - ${storeName}`);
}

export function getSupplierClientStockAlertEmailTemplate(supplierName: string, storeName: string, lowStockItems: any[]): string {
  if (!lowStockItems.length) return '';

  const rows = lowStockItems.map(item => `
    <tr style="border-bottom: 1px solid #f3f4f6;">
      <td style="padding: 12px 0;">
        <div style="font-weight: 600; color: #111827;">${item.name}</div>
      </td>
      <td align="right" style="padding: 12px 0; font-weight: 600; color: #f59e0b;">
         Qty: ${item.qty}
      </td>
    </tr>
  `).join('');

  const content = `
    <h1 class="h-mobile" style="${HEADING_STYLES}">Client Stock Alert</h1>
    <p style="${TEXT_STYLES}">
       Hello <strong>${supplierName}</strong>,
    </p>
    <p style="${TEXT_STYLES}">
       Your client, <strong>${storeName}</strong>, is running low on the following items. This is a great opportunity to reach out and restock them.
    </p>

    <div style="margin-bottom: 32px;">
      <table width="100%" border="0" cellspacing="0" cellpadding="0">
        ${rows}
      </table>
    </div>

    <div style="text-align: center; margin-top: 32px;">
      <a href="${FRONTEND_URL}/supplier/dashboard" style="${BUTTON_STYLES}">Go to Dashboard</a>
    </div>
  `;
  return wrapContent(content, `Client Stock Alert - ${storeName}`);
}
