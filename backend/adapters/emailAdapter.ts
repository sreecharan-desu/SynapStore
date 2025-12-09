// src/adapters/emailAdapter.ts
import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT || 587),
  secure: process.env.SMTP_SECURE === "true",
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

export async function sendEmail(
  to: string,
  subject: string,
  htmlBody: string,
  textBody?: string
) {
  const info = await transporter.sendMail({
    from: process.env.SMTP_FROM || "no-reply@yourapp.local",
    to,
    subject,
    text: textBody ?? undefined,
    html: htmlBody,
  });
  return info; // provider response metadata
}
