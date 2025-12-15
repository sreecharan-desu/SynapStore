
import { Router } from "express";
import { z } from "zod";
import { sendMail } from "../../../lib/mailer";
import { sendSuccess, sendInternalError } from "../../../lib/api";

const router = Router();

/**
 * Zod schema for the Store Owner Dispatch Notification.
 * Validates the payload required to send an email to a store owner.
 */
const storeownerEmailSchema = z.object({
  to_email: z.string().email(),
  store_name: z.string(),
  supplier_name: z.string(),
  invoice_id: z.string(),
  items: z.record(z.string(), z.number().int().positive()),
  expected_delivery: z.string(), 
});

/**
 * Zod schema for Supplier Delivery Failed Notification.
 * Validates the payload required to notify a supplier of a failed dispatch email.
 */
const deliveryFailedEmailSchema = z.object({
  to_email: z.string().email(),
  store_name: z.string(),
  store_email: z.string().email(),
  supplier_name: z.string(),
  invoice_id: z.string(),
  failure_reason: z.string(),
});

/**
 * POST /api/v1/no-auth/storeowner-dispatch
 * Public (No Auth) Endpoint to send a stock dispatch notification email to a store owner.
 */
router.post("/storeowner-dispatch", async (req, res) => {
  const requestId = `REQ-${Date.now()}`;
  console.log(`[${requestId}] Received request to /storeowner-dispatch`);

  try {
    // 1. Validate Request Body
    const validationResult = storeownerEmailSchema.safeParse(req.body);

    if (!validationResult.success) {
      console.warn(`[${requestId}] Validation Failed:`, validationResult.error.errors);
      return res.status(400).json({
        error: "validation failed",
        details: validationResult.error.errors,
      });
    }

    const {
      to_email,
      store_name,
      supplier_name,
      invoice_id,
      items,
      expected_delivery,
    } = validationResult.data;

    console.log(`[${requestId}] Processing dispatch email for Invoice: ${invoice_id}, To: ${to_email}`);

    // 2. Generate HTML Content
    const itemsRows = Object.entries(items)
      .map(
        ([item, qty]) => `
        <tr>
            <td style="padding:8px;border:1px solid #ddd;">${item}</td>
            <td style="padding:8px;border:1px solid #ddd;text-align:center;">${qty}</td>
        </tr>
        `
      )
      .join("");

    const logo_url =
      "https://res.cloudinary.com/dzunpdnje/image/upload/" +
      "v1765706205/WhatsApp_Image_2025-12-14_at_15.23.36_sdfrsk.jpg";

    const subject = `Stock Dispatched to ${store_name} | Invoice #${invoice_id}`;
    const html_body = `
    <html>
      <body style="font-family:Arial,sans-serif;background:#f6f7f9;padding:20px;">
        <div style="max-width:600px;margin:auto;background:#ffffff;
                    padding:24px;border-radius:8px;border:1px solid #e0e0e0;">

          <div style="text-align:center;margin-bottom:20px;">
            <img src="${logo_url}" alt="SynapStore"
                 style="max-width:140px;height:auto;" />
          </div>

          <h2 style="margin-top:0;color:#1fa463;text-align:center;">
            Stock Dispatch Notification
          </h2>

          <p>Dear <strong>${store_name}</strong>,</p>

          <p>
            <strong>${supplier_name}</strong> has successfully dispatched
            stock to your store.
          </p>

          <p><strong>Invoice ID:</strong> ${invoice_id}</p>
          <p><strong>Expected Delivery:</strong> ${expected_delivery}</p>

          <table width="100%" cellspacing="0" cellpadding="0"
                 style="border-collapse:collapse;margin-top:16px;">
            <thead>
              <tr style="background:#f2f2f2;">
                <th style="padding:8px;border:1px solid #ddd;text-align:left;">Item</th>
                <th style="padding:8px;border:1px solid #ddd;">Quantity</th>
              </tr>
            </thead>
            <tbody>
              ${itemsRows}
            </tbody>
          </table>

          <p style="margin-top:20px;">
            Please verify the stock upon arrival and report any discrepancies immediately.
          </p>

          <p style="margin-top:30px;">
            Regards,<br>
            <strong>SynapStore</strong>
          </p>

          <hr>
          <p style="font-size:12px;color:#888;text-align:center;">
            ©️ SynapStore — Intelligent Pharmacy Management
          </p>

        </div>
      </body>
    </html>
    `;

    const plain_fallback = `
    Stock dispatched by ${supplier_name}
    Store: ${store_name}
    Invoice: ${invoice_id}
    Expected delivery: ${expected_delivery}
    `;

    // 3. Send Email
    await sendMail({
      to: to_email,
      subject: subject,
      html: html_body,
      text: plain_fallback,
    });

    console.log(`[${requestId}] Email sent successfully to ${to_email}`);
    sendSuccess(res, "Email sent successfully");

  } catch (error) {
    console.error(`[${requestId}] Error processing /storeowner-dispatch request:`, error);
    sendInternalError(res, error);
  }
});

/**
 * POST /api/v1/no-auth/supplier-delivery-failed
 * Public (No Auth) Endpoint to notify a supplier that an email to a store failed.
 */
router.post("/supplier-delivery-failed", async (req, res) => {
  const requestId = `REQ-${Date.now()}`;
  console.log(`[${requestId}] Received request to /supplier-delivery-failed`);

  try {
    // 1. Validate Request Body
    const validationResult = deliveryFailedEmailSchema.safeParse(req.body);

    if (!validationResult.success) {
      console.warn(`[${requestId}] Validation Failed:`, validationResult.error.errors);
      return res.status(400).json({
        error: "validation failed",
        details: validationResult.error.errors,
      });
    }

    const {
      to_email,
      store_name,
      store_email,
      supplier_name,
      invoice_id,
      failure_reason,
    } = validationResult.data;

    console.log(`[${requestId}] Processing failure notification for Invoice: ${invoice_id}, To Supplier: ${to_email}`);

    // 2. Generate HTML Content
    const logo_url =
      "https://res.cloudinary.com/dzunpdnje/image/upload/v1765706720/SynapStore_Logo_g2tlah.png";

    const timestamp = new Date().toUTCString();

    const subject = `Delivery Notification Failed | Invoice #${invoice_id}`;
    const html_body = `
    <html>
      <body style="font-family:Arial,sans-serif;background:#f6f7f9;padding:20px;">
        <div style="max-width:600px;margin:auto;background:#ffffff;
                    padding:24px;border-radius:8px;border:1px solid #e0e0e0;">

          <div style="text-align:center;margin-bottom:20px;">
            <img src="${logo_url}" alt="SynapStore"
                 style="max-width:140px;height:auto;" />
          </div>

          <h2 style="margin-top:0;color:#d9534f;text-align:center;">
            Email Delivery Failed
          </h2>

          <p>Dear <strong>${supplier_name}</strong>,</p>

          <p>
            We attempted to notify the following store regarding a stock dispatch,
            but the email delivery <strong>failed</strong>.
          </p>

          <table width="100%" cellspacing="0" cellpadding="8"
                 style="border-collapse:collapse;margin-top:16px;">
            <tr>
              <td style="border:1px solid #ddd;"><strong>Store Name</strong></td>
              <td style="border:1px solid #ddd;">${store_name}</td>
            </tr>
            <tr>
              <td style="border:1px solid #ddd;"><strong>Store Email</strong></td>
              <td style="border:1px solid #ddd;">${store_email}</td>
            </tr>
            <tr>
              <td style="border:1px solid #ddd;"><strong>Invoice ID</strong></td>
              <td style="border:1px solid #ddd;">${invoice_id}</td>
            </tr>
            <tr>
              <td style="border:1px solid #ddd;"><strong>Attempted At</strong></td>
              <td style="border:1px solid #ddd;">${timestamp}</td>
            </tr>
            <tr>
              <td style="border:1px solid #ddd;"><strong>Failure Reason</strong></td>
              <td style="border:1px solid #ddd;color:#d9534f;">
                ${failure_reason}
              </td>
            </tr>
          </table>

          <p style="margin-top:20px;">
            You may contact the store directly or retry the notification later.
          </p>

          <p style="margin-top:30px;">
            Regards,<br>
            <strong>SynapStore System</strong>
          </p>

          <hr>
          <p style="font-size:12px;color:#888;text-align:center;">
            This is an automated system alert.
          </p>

        </div>
      </body>
    </html>
    `;

    const plain_fallback = `
    EMAIL DELIVERY FAILED

    Store: ${store_name}
    Store Email: ${store_email}
    Invoice: ${invoice_id}
    Time: ${timestamp}
    Reason: ${failure_reason}
    `;

    // 3. Send Email
    await sendMail({
      to: to_email,
      subject: subject,
      html: html_body,
      text: plain_fallback,
    });

    console.log(`[${requestId}] Failure notification email sent successfully to ${to_email}`);
    sendSuccess(res, "Email sent successfully");

  } catch (error) {
    console.error(`[${requestId}] Error processing /supplier-delivery-failed request:`, error);
    sendInternalError(res, error);
  }
});

export default router;
