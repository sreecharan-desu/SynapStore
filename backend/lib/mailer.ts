import nodemailer from "nodemailer";
import dotenv from "dotenv";

dotenv.config();

// SMTP config
const host = process.env.SMTP_HOST || "smtp.gmail.com";
const port = Number(process.env.SMTP_PORT || 587);
const user = process.env.SMTP_USER!;
const pass = process.env.SMTP_PASS!;
const from = process.env.EMAIL_FROM || user;

if (!user || !pass) {
  console.warn("SMTP_USER or SMTP_PASS missing - emails will not send");
}

// Transporter
export const transporter = nodemailer.createTransport({
  host,
  port,
  secure: false, // true for 465, false for other ports
  auth: { user, pass },
});

// Generic email sender
export async function sendMail(options: {
  to: string;
  subject: string;
  text?: string;
  html?: string;
}) {
  const { to, subject, text, html } = options;

  return transporter.sendMail({
    from,
    to,
    subject,
    text,
    html,
  });
}

