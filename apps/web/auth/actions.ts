"use server";

import { validateAdminRegistration } from "@taptolk/auth";
import type { Route } from "next";
import { redirect } from "next/navigation";
import type { AppLocale } from "../i18n/config";
import { isAppLocale } from "../i18n/locale";
import { getAdminLoginPath, getLocalizedAdminPath } from "./admin-routing";
import {
  type AdminRegistrationFlow,
  getAdminAuthCallbackUrl,
  getAdminAuthErrorPath,
  getAdminRegistrationPath,
} from "./registration-routing";
import { createAdminServerClient } from "./server-client";

export type AdminActionError = "CONFIGURATION" | "INVALID_CREDENTIALS" | "SESSION" | "UNAVAILABLE";

export type AdminRegistrationActionError =
  | "CONFIGURATION"
  | "INVALID_EMAIL"
  | "INVALID_PASSWORD"
  | "OAUTH_UNAVAILABLE"
  | "PASSWORD_MISMATCH"
  | "UNAVAILABLE";

function readLocale(value: FormDataEntryValue | string | null): AppLocale {
  return typeof value === "string" && isAppLocale(value) ? value : "en";
}

function loginErrorPath(locale: AppLocale, error: AdminActionError) {
  return getAdminLoginPath(locale, `?error=${error.toLowerCase()}`);
}

function readRegistrationFlow(value: FormDataEntryValue | null): AdminRegistrationFlow {
  return value === "signup" ? "signup" : "login";
}

function registrationErrorPath(locale: AppLocale, error: AdminRegistrationActionError) {
  return getAdminRegistrationPath(locale, `?error=${error.toLowerCase()}`);
}

export async function signInAdmin(formData: FormData): Promise<never> {
  const locale = readLocale(formData.get("locale"));
  const emailValue = formData.get("email");
  const passwordValue = formData.get("password");
  const email = typeof emailValue === "string" ? emailValue.trim() : "";
  const password = typeof passwordValue === "string" ? passwordValue : "";

  if (!email.includes("@") || password.length < 8) {
    redirect(loginErrorPath(locale, "INVALID_CREDENTIALS"));
  }

  const client = await createAdminServerClient();
  if (!client) {
    redirect(loginErrorPath(locale, "CONFIGURATION"));
  }

  const { error } = await client.auth.signInWithPassword({ email, password });
  if (error) {
    redirect(loginErrorPath(locale, "INVALID_CREDENTIALS"));
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
  const flow = readRegistrationFlow(formData.get("flow"));
  const callbackUrl = getAdminAuthCallbackUrl(locale, flow);
  const client = await createAdminServerClient();
  if (!client || !callbackUrl) {
    redirect(getAdminAuthErrorPath(locale, flow, "configuration"));
  }

  const { data, error } = await client.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: callbackUrl,
    },
  });
  if (error || !data.url) {
    redirect(getAdminAuthErrorPath(locale, flow, "oauth_unavailable"));
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
