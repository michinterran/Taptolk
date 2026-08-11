function hasValue(value: string | null | undefined): boolean {
  return Boolean(value?.trim());
}

export function hasManagementCompanyContactChannel(input: {
  email: string | null | undefined;
  phone: string | null | undefined;
}): boolean {
  return hasValue(input.email) || hasValue(input.phone);
}

export type OperationsManagerCompleteness =
  | "COMPLETE"
  | "EMPTY"
  | "MISSING_CHANNEL"
  | "MISSING_NAME";

export function getOperationsManagerCompleteness(input: {
  email: string | null | undefined;
  name: string | null | undefined;
  phone: string | null | undefined;
}): OperationsManagerCompleteness {
  const hasName = hasValue(input.name);
  const hasChannel = hasManagementCompanyContactChannel(input);

  if (!hasName && !hasChannel) {
    return "EMPTY";
  }
  if (!hasName) {
    return "MISSING_NAME";
  }
  return hasChannel ? "COMPLETE" : "MISSING_CHANNEL";
}
