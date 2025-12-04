export function generateOtp(length = Number(process.env.OTP_LENGTH || 6)) {
  const digits = "0123456789";
  let otp = "";
  for (let i = 0; i < length; i++) {
    otp += digits[Math.floor(Math.random() * digits.length)];
  }
  return otp;
}

export function getOtpExpiryDate(
  minutes = Number(process.env.OTP_EXPIRES_MINUTES || 10)
) {
  return new Date(Date.now() + minutes * 60 * 1000);
}
