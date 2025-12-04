import nodemailer from "nodemailer";
import dotenv from "dotenv";

dotenv.config();

const host = process.env.SMTP_HOST || "smtp.gmail.com";
const port = Number(process.env.SMTP_PORT || 587);
const user = process.env.SMTP_USER!;
const pass = process.env.SMTP_PASS!;
const from = process.env.EMAIL_FROM || process.env.SMTP_USER;

if (!user || !pass) {
  console.warn("SMTP_USER or SMTP_PASS not set - email sending will fail");
}

export const transporter = nodemailer.createTransport({
  host,
  port,
  secure: false, // TLS will be used with port 587
  auth: {
    user,
    pass,
  },
});

export async function sendOtpEmail(to: string, otp: string) {
  const subject = "Your SynapStore verification code";
  const text = `Your verification code is: ${otp}. It expires in ${
    process.env.OTP_EXPIRES_MINUTES || 10
  } minutes.`;
  const html = `
    <div>
      <p>Hello,</p>
      <p>Your SynapStore verification code is:</p>
      <h2>${otp}</h2>
      <p>This code will expire in ${
        process.env.OTP_EXPIRES_MINUTES || 10
      } minutes.</p>
      <p>If you did not request this, you can safely ignore this email.</p>
    </div>
  `;

  const info = await transporter.sendMail({
    from,
    to,
    subject,
    text,
    html,
  });

  return info;
}
