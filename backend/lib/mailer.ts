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
  secure: false,
  auth: { user, pass },
});

// Generic email sender
export async function sendMail(options: {
  to: string;
  subject: string;
  text?: string;
  html?: string;
  otp?: string; // optional attribute
}) {
  const { to, subject, text, html, otp } = options;

  // If OTP is provided, build a consistent template
  const finalHtml =
    html ||
    (otp
      ? `
        <div style="font-family: Arial; line-height: 1.6;">
          <p>Hello,</p>
          <p>Your SynapStore verification code is:</p>
          <h2 style="font-size: 24px; margin: 8px 0;">${otp}</h2>
          <p>This code expires in ${
            process.env.OTP_EXPIRES_MINUTES || 10
          } minutes.</p>
          <p>If you didn't request this, you can ignore this message.</p>
        </div>
      `
      : undefined);

  const finalText =
    text ||
    (otp
      ? `Your verification code is ${otp}. It expires in ${
          process.env.OTP_EXPIRES_MINUTES || 10
        } minutes.`
      : undefined);

  return transporter.sendMail({
    from,
    to,
    subject,
    text: finalText,
    html: finalHtml,
  });
}

// OTP wrapper for convenience
export async function sendOtpEmail(to: string, otp: string) {
  return sendMail({
    to,
    otp,
    subject: "Your SynapStore verification code",
  });
}
