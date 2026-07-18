export const ROUTE_POLICIES = Object.freeze({
  admin: Object.freeze({
    authentication: "email-password-mfa",
    bottomNavigation: "hidden",
    routePrefix: "/admin",
  }),
  owner: Object.freeze({
    authentication: "phone-otp-or-response-token",
    bottomNavigation: "owner-only",
    routePrefix: "/owner",
  }),
  publicCaller: Object.freeze({
    authentication: "anonymous-session-cookie",
    bottomNavigation: "hidden",
    routePrefix: "/q",
  }),
});
