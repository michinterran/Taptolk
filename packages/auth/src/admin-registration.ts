export const ADMIN_REGISTRATION_PASSWORD_MIN_LENGTH = 12;
export const ADMIN_REGISTRATION_PASSWORD_MAX_LENGTH = 128;
const ADMIN_REGISTRATION_EMAIL_PATTERN = /^[^@\s]+@[^@\s]+\.[^@\s]+$/u;

export type AdminRegistrationValidationError =
  | "INVALID_EMAIL"
  | "INVALID_PASSWORD"
  | "PASSWORD_MISMATCH";

export interface AdminRegistrationInput {
  email: string;
  password: string;
  passwordConfirmation: string;
}

export type AdminRegistrationValidationResult =
  | {
      email: string;
      password: string;
      valid: true;
    }
  | {
      error: AdminRegistrationValidationError;
      valid: false;
    };

export function validateAdminRegistration(
  input: AdminRegistrationInput,
): AdminRegistrationValidationResult {
  const email = input.email.trim().toLowerCase();
  if (!ADMIN_REGISTRATION_EMAIL_PATTERN.test(email) || email.length > 254) {
    return { error: "INVALID_EMAIL", valid: false };
  }
  if (
    input.password.length < ADMIN_REGISTRATION_PASSWORD_MIN_LENGTH ||
    input.password.length > ADMIN_REGISTRATION_PASSWORD_MAX_LENGTH
  ) {
    return { error: "INVALID_PASSWORD", valid: false };
  }
  if (input.password !== input.passwordConfirmation) {
    return { error: "PASSWORD_MISMATCH", valid: false };
  }
  return {
    email,
    password: input.password,
    valid: true,
  };
}
