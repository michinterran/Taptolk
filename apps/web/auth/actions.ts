"use server";

import { validateAdminRegistration } from "@taptolk/auth";
import type { Route } from "next";
import { redirect } from "next/navigation";
import type { AppLocale } from "../i18n/config";
import { isAppLocale } from "../i18n/locale";
import { loadAdminContext } from "./admin-context";
import { getAdminLoginPath, getLocalizedAdminPath, readAdminLoginArea } from "./admin-routing";
import {
  type AdminRegistrationFlow,
  getAdminAuthCallbackUrl,
  getAdminAuthErrorPath,
  getAdminRegistrationPath,
} from "./registration-routing";
import { createAdminServerClient } from "./server-client";

export type AdminActionError =
  | "CONFIGURATION"
  | "INVALID_CODE"
  | "INVALID_CREDENTIALS"
  | "SESSION"
  | "UNAVAILABLE";

export type AdminRegistrationActionError =
  | "CONFIGURATION"
  | "INVALID_EMAIL"
  | "INVALID_PASSWORD"
  | "OAUTH_UNAVAILABLE"
  | "PASSWORD_MISMATCH"
  | "UNAVAILABLE";

export type MfaEnrollmentResult =
  | { error: AdminActionError; status: "ERROR" }
  | {
      factorId: string;
      qrCode: string;
      secret: string;
      status: "READY";
    };

export type MfaVerificationResult = { error: AdminActionError; ok: false } | { ok: true };

function readLocale(value: FormDataEntryValue | string | null): AppLocale {
  return typeof value === "string" && isAppLocale(value) ? value : "en";
}

function loginErrorPath(
  locale: AppLocale,
  area: ReturnType<typeof readAdminLoginArea>,
  error: AdminActionError,
) {
  return getAdminLoginPath(locale, area, `?error=${error.toLowerCase()}`);
}

function readRegistrationFlow(value: FormDataEntryValue | null): AdminRegistrationFlow {
  return value === "signup" ? "signup" : "login";
}

function registrationErrorPath(locale: AppLocale, error: AdminRegistrationActionError) {
  return getAdminRegistrationPath(locale, `?error=${error.toLowerCase()}`);
}

export async function signInAdmin(formData: FormData): Promise<never> {
  const locale = readLocale(formData.get("locale"));
  const area = readAdminLoginArea(formData.get("area"));
  const emailValue = formData.get("email");
  const passwordValue = formData.get("password");
  const email = typeof emailValue === "string" ? emailValue.trim() : "";
  const password = typeof passwordValue === "string" ? passwordValue : "";

  if (!email.includes("@") || password.length < 8) {
    redirect(loginErrorPath(locale, area, "INVALID_CREDENTIALS"));
  }

  const client = await createAdminServerClient();
  if (!client) {
    redirect(loginErrorPath(locale, area, "CONFIGURATION"));
  }

  const { error } = await client.auth.signInWithPassword({ email, password });
  if (error) {
    redirect(loginErrorPath(locale, area, "INVALID_CREDENTIALS"));
  }

  redirect(getLocalizedAdminPath(locale));
}

export async function signUpAdmin(formData: FormData): Promise<never> {
  const locale = readLocale(formData.get("locale"));
  const emailValue = formData.get("email");
  const passwordValue = formData.get("password");
  const passwordConfirmationValue = formData.get("passwordConfirmation");
  const validation = validateAdminRegistration({
    email: typeof emailValue === "string" ? emailValue : "",
    password: typeof passwordValue === "string" ? passwordValue : "",
    passwordConfirmation:
      typeof passwordConfirmationValue === "string" ? passwordConfirmationValue : "",
  });

  if (!validation.valid) {
    redirect(registrationErrorPath(locale, validation.error));
  }

  const callbackUrl = getAdminAuthCallbackUrl(locale, "signup");
  const client = await createAdminServerClient();
  if (!client || !callbackUrl) {
    redirect(registrationErrorPath(locale, "CONFIGURATION"));
  }

  const { data, error } = await client.auth.signUp({
    email: validation.email,
    password: validation.password,
    options: {
      emailRedirectTo: callbackUrl,
    },
  });
  if (error) {
    redirect(registrationErrorPath(locale, "UNAVAILABLE"));
  }
  if (data.session) {
    redirect(getLocalizedAdminPath(locale));
  }

  redirect(getAdminRegistrationPath(locale, "?status=check_email"));
}

export async function signInWithGoogle(formData: FormData): Promise<never> {
  const locale = readLocale(formData.get("locale"));
  const area = readAdminLoginArea(formData.get("area"));
  const flow = readRegistrationFlow(formData.get("flow"));
  const callbackUrl = getAdminAuthCallbackUrl(locale, flow, area);
  const client = await createAdminServerClient();
  if (!client || !callbackUrl) {
    redirect(getAdminAuthErrorPath(locale, flow, "configuration", area));
  }

  const { data, error } = await client.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: callbackUrl,
    },
  });
  if (error || !data.url) {
    redirect(getAdminAuthErrorPath(locale, flow, "oauth_unavailable", area));
  }

  redirect(data.url as Route);
}

export async function signOutAdmin(formData: FormData): Promise<never> {
  const locale = readLocale(formData.get("locale"));
  const client = await createAdminServerClient();
  if (client) {
    await client.auth.signOut({ scope: "local" });
  }
  redirect(getLocalizedAdminPath(locale, "/login"));
}

export async function startMfaEnrollment(localeValue: string): Promise<MfaEnrollmentResult> {
  const locale = readLocale(localeValue);
  const context = await loadAdminContext();
  if (context.status === "CONFIGURATION_MISSING") {
    return { error: "CONFIGURATION", status: "ERROR" };
  }
  if (context.status === "LOAD_ERROR") {
    return { error: "UNAVAILABLE", status: "ERROR" };
  }
  if (context.decision.state === "MFA_CHALLENGE_REQUIRED") {
    redirect(getLocalizedAdminPath(locale, "/mfa/challenge"));
  }
  if (context.decision.state !== "MFA_ENROLL_REQUIRED") {
    return { error: "SESSION", status: "ERROR" };
  }

  const client = await createAdminServerClient();
  if (!client) {
    return { error: "CONFIGURATION", status: "ERROR" };
  }

  const factorsResult = await client.auth.mfa.listFactors();
  if (factorsResult.error) {
    return { error: "UNAVAILABLE", status: "ERROR" };
  }

  if (factorsResult.data.totp.length > 0) {
    redirect(getLocalizedAdminPath(locale, "/mfa/challenge"));
  }

  const unverifiedTotpFactors = factorsResult.data.all.filter(
    (factor) => factor.factor_type === "totp" && factor.status === "unverified",
  );
  for (const factor of unverifiedTotpFactors) {
    const { error } = await client.auth.mfa.unenroll({ factorId: factor.id });
    if (error) {
      return { error: "UNAVAILABLE", status: "ERROR" };
    }
  }

  const enrollmentResult = await client.auth.mfa.enroll({
    factorType: "totp",
    friendlyName: "Taptolk Admin",
    issuer: "Taptolk",
  });
  if (enrollmentResult.error || enrollmentResult.data.type !== "totp") {
    return { error: "UNAVAILABLE", status: "ERROR" };
  }

  return {
    factorId: enrollmentResult.data.id,
    qrCode: enrollmentResult.data.totp.qr_code,
    secret: enrollmentResult.data.totp.secret,
    status: "READY",
  };
}

export async function verifyMfaCode(
  localeValue: string,
  factorId: string,
  codeValue: string,
  mode: "challenge" | "enroll",
): Promise<MfaVerificationResult> {
  const locale = readLocale(localeValue);
  const code = codeValue.replaceAll(/\s/gu, "");
  if (!/^\d{6}$/u.test(code)) {
    return { error: "INVALID_CODE", ok: false };
  }

  const context = await loadAdminContext();
  if (context.status === "CONFIGURATION_MISSING") {
    return { error: "CONFIGURATION", ok: false };
  }
  if (context.status === "LOAD_ERROR") {
    return { error: "UNAVAILABLE", ok: false };
  }
  const expectedDecision = mode === "challenge" ? "MFA_CHALLENGE_REQUIRED" : "MFA_ENROLL_REQUIRED";
  if (context.decision.state !== expectedDecision) {
    return { error: "SESSION", ok: false };
  }

  const client = await createAdminServerClient();
  if (!client) {
    return { error: "CONFIGURATION", ok: false };
  }

  const factorsResult = await client.auth.mfa.listFactors();
  if (factorsResult.error) {
    return { error: "UNAVAILABLE", ok: false };
  }

  const expectedStatus = mode === "challenge" ? "verified" : "unverified";
  const factorBelongsToSession = factorsResult.data.all.some(
    (factor) =>
      factor.id === factorId && factor.factor_type === "totp" && factor.status === expectedStatus,
  );
  if (!factorBelongsToSession) {
    return { error: "SESSION", ok: false };
  }

  const verificationResult = await client.auth.mfa.challengeAndVerify({
    code,
    factorId,
  });
  if (verificationResult.error) {
    return { error: "INVALID_CODE", ok: false };
  }

  redirect(getLocalizedAdminPath(locale));
}
