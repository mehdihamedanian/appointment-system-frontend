/**
 * Authentication methods this dedicated business UI is built against.
 * The live Backend currently exposes only health; these flags describe the
 * frontend contract, not invented marketplace login types.
 */
export const authConfig = {
  customer: {
    passwordLogin: true,
    otpLogin: true,
    registration: true,
    passwordReset: true,
  },
  admin: {
    passwordLogin: true,
    otpLogin: false,
    registration: false,
  },
  otpLength: 6,
  passwordMinLength: 8,
} as const;

export type OtpPurpose = "login" | "register" | "reset_password";
