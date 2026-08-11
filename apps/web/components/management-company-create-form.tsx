"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import {
  createManagementCompany,
  type ManagementCompanyCreateActionState,
  type ManagementCompanyCreateField,
} from "../admin/management-company-actions";
import { ManagementCompanyAddressSearchField } from "./management-company-address-search-field";

interface ManagementCompanyCreateFormCopy {
  address: string;
  addressDetail: string;
  addressDetailPlaceholder: string;
  addressHelp: string;
  addressSearch: {
    close: string;
    fallbackHint: string;
    jibunAddress: string;
    open: string;
    roadAddress: string;
    title: string;
    zonecode: string;
  };
  businessNumber: string;
  businessNumberHelp: string;
  cancel: string;
  contactChannelHelp: string;
  contactEmail: string;
  contactName: string;
  contactPhone: string;
  create: string;
  error: {
    blocked: string;
    channelRequired: string;
    conflict: string;
    forbidden: string;
    formSummary: string;
    invalid: string;
    operationsManagerChannelRequired: string;
    required: string;
    unavailable: string;
  };
  localeLabel: string;
  name: string;
  operationsManagerEmail: string;
  operationsManagerHelp: string;
  operationsManagerName: string;
  operationsManagerPhone: string;
  optional: string;
  reason: string;
  reasonPlaceholder: string;
  representativePhone: string;
  required: string;
  requiredHint: string;
  submitting: string;
}

interface ManagementCompanyCreateFormProps {
  addressScriptSrc: string;
  copy: ManagementCompanyCreateFormCopy;
  listPath: string;
  locale: string;
}

const INITIAL_STATE: ManagementCompanyCreateActionState = { fieldErrors: {} };

type TextInputName =
  | "businessNumber"
  | "contactEmail"
  | "contactName"
  | "contactPhone"
  | "name"
  | "operationsManagerEmail"
  | "operationsManagerName"
  | "operationsManagerPhone"
  | "reason"
  | "representativePhone";

type TextInputValues = Readonly<Record<TextInputName, string>>;

const INITIAL_VALUES: TextInputValues = {
  businessNumber: "",
  contactEmail: "",
  contactName: "",
  contactPhone: "",
  name: "",
  operationsManagerEmail: "",
  operationsManagerName: "",
  operationsManagerPhone: "",
  reason: "",
  representativePhone: "",
};

function Requirement({
  copy,
  required,
}: {
  copy: ManagementCompanyCreateFormCopy;
  required: boolean;
}) {
  return (
    <span
      className={`admin-field-requirement ${required ? "admin-field-requirement--required" : ""}`}
    >
      {required ? copy.required : copy.optional}
    </span>
  );
}

function FieldError({
  field,
  id,
  state,
  copy,
}: {
  copy: ManagementCompanyCreateFormCopy;
  field: ManagementCompanyCreateField;
  id: string;
  state: ManagementCompanyCreateActionState;
}) {
  const error = state.fieldErrors[field];
  if (!error) {
    return null;
  }
  const message =
    error === "required"
      ? copy.error.required
      : error === "channelRequired"
        ? copy.error.channelRequired
        : error === "operationsManagerChannelRequired"
          ? copy.error.operationsManagerChannelRequired
          : copy.error.invalid;
  return (
    <small className="admin-field-error" id={id}>
      {message}
    </small>
  );
}

function SubmitButton({ copy }: { copy: ManagementCompanyCreateFormCopy }) {
  const { pending } = useFormStatus();
  return (
    <button className="tt-button" disabled={pending} type="submit">
      {pending ? copy.submitting : copy.create}
    </button>
  );
}

export function ManagementCompanyCreateForm({
  addressScriptSrc,
  copy,
  listPath,
  locale,
}: ManagementCompanyCreateFormProps) {
  const [state, formAction] = useActionState(createManagementCompany, INITIAL_STATE);
  const [values, setValues] = useState<TextInputValues>(INITIAL_VALUES);
  const errorSummaryRef = useRef<HTMLDivElement | null>(null);
  const hasFieldErrors = Object.keys(state.fieldErrors).length > 0;
  const hasErrors = hasFieldErrors || Boolean(state.formError);

  useEffect(() => {
    if (hasErrors) {
      errorSummaryRef.current?.focus();
    }
  }, [hasErrors]);

  function updateValue(name: TextInputName, value: string) {
    setValues((current) => ({ ...current, [name]: value }));
  }

  function describedBy(...ids: Array<string | false | undefined>): string | undefined {
    const value = ids.filter(Boolean).join(" ");
    return value || undefined;
  }

  const formErrorMessage = state.formError ? copy.error[state.formError] : null;
  const addressDescribedBy = describedBy(
    "company-create-address-help",
    state.fieldErrors.address && "company-create-address-error",
  );

  return (
    <form action={formAction} className="admin-tenant-form admin-company-form">
      <input aria-label={copy.localeLabel} name="locale" type="hidden" value={locale} />

      <div className="admin-company-form__guidance">
        <strong>{copy.requiredHint}</strong>
      </div>

      {hasErrors ? (
        <div
          className="admin-notice admin-notice--danger admin-company-form__error-summary"
          ref={errorSummaryRef}
          role="alert"
          tabIndex={-1}
        >
          <strong>{formErrorMessage ?? copy.error.formSummary}</strong>
        </div>
      ) : null}

      <div className="admin-company-form__section" id="company-create-basic">
        <h2>{copy.name}</h2>
        <div className="admin-company-form__grid">
          <label className="admin-field" htmlFor="company-create-name">
            <span className="admin-field-label">
              {copy.name}
              <Requirement copy={copy} required />
            </span>
            <input
              aria-describedby={describedBy(state.fieldErrors.name && "company-create-name-error")}
              aria-invalid={Boolean(state.fieldErrors.name)}
              id="company-create-name"
              maxLength={200}
              name="name"
              onChange={(event) => updateValue("name", event.currentTarget.value)}
              required
              value={values.name}
            />
            <FieldError copy={copy} field="name" id="company-create-name-error" state={state} />
          </label>
          <label className="admin-field" htmlFor="company-create-business-number">
            <span className="admin-field-label">
              {copy.businessNumber}
              <Requirement copy={copy} required />
            </span>
            <input
              aria-describedby={describedBy(
                "company-create-business-number-help",
                state.fieldErrors.businessNumber && "company-create-business-number-error",
              )}
              aria-invalid={Boolean(state.fieldErrors.businessNumber)}
              id="company-create-business-number"
              inputMode="numeric"
              name="businessNumber"
              onChange={(event) => updateValue("businessNumber", event.currentTarget.value)}
              pattern="[0-9\s-]*"
              required
              value={values.businessNumber}
            />
            <small id="company-create-business-number-help">{copy.businessNumberHelp}</small>
            <FieldError
              copy={copy}
              field="businessNumber"
              id="company-create-business-number-error"
              state={state}
            />
          </label>
          <div className="admin-field admin-company-form__wide-field">
            <span className="admin-field-label">
              {copy.address}
              <Requirement copy={copy} required />
            </span>
            <ManagementCompanyAddressSearchField
              {...(addressDescribedBy ? { ariaDescribedBy: addressDescribedBy } : {})}
              ariaInvalid={Boolean(state.fieldErrors.address)}
              detailLabel={copy.addressDetail}
              detailPlaceholder={copy.addressDetailPlaceholder}
              labels={copy.addressSearch}
              name="address"
              scriptSrc={addressScriptSrc}
            />
            <small id="company-create-address-help">{copy.addressHelp}</small>
            <FieldError
              copy={copy}
              field="address"
              id="company-create-address-error"
              state={state}
            />
          </div>
        </div>
      </div>

      <div className="admin-company-form__section" id="company-create-contact">
        <h2>{copy.contactName}</h2>
        <p className="admin-company-form__section-help" id="company-create-contact-channel-help">
          {copy.contactChannelHelp}
        </p>
        <div className="admin-company-form__grid">
          <label className="admin-field" htmlFor="company-create-representative-phone">
            <span className="admin-field-label">
              {copy.representativePhone}
              <Requirement copy={copy} required={false} />
            </span>
            <input
              aria-describedby={describedBy(
                state.fieldErrors.representativePhone &&
                  "company-create-representative-phone-error",
              )}
              aria-invalid={Boolean(state.fieldErrors.representativePhone)}
              autoComplete="tel"
              id="company-create-representative-phone"
              inputMode="tel"
              name="representativePhone"
              onChange={(event) => updateValue("representativePhone", event.currentTarget.value)}
              pattern="[0-9\s-]*"
              value={values.representativePhone}
            />
            <FieldError
              copy={copy}
              field="representativePhone"
              id="company-create-representative-phone-error"
              state={state}
            />
          </label>
          <label className="admin-field" htmlFor="company-create-contact-name">
            <span className="admin-field-label">
              {copy.contactName}
              <Requirement copy={copy} required />
            </span>
            <input
              aria-describedby={describedBy(
                state.fieldErrors.contactName && "company-create-contact-name-error",
              )}
              aria-invalid={Boolean(state.fieldErrors.contactName)}
              id="company-create-contact-name"
              maxLength={100}
              name="contactName"
              onChange={(event) => updateValue("contactName", event.currentTarget.value)}
              required
              value={values.contactName}
            />
            <FieldError
              copy={copy}
              field="contactName"
              id="company-create-contact-name-error"
              state={state}
            />
          </label>
          <label className="admin-field" htmlFor="company-create-contact-phone">
            <span className="admin-field-label">
              {copy.contactPhone}
              <Requirement copy={copy} required={false} />
            </span>
            <input
              aria-describedby={describedBy(
                "company-create-contact-channel-help",
                state.fieldErrors.contactChannel && "company-create-contact-channel-error",
                state.fieldErrors.contactPhone && "company-create-contact-phone-error",
              )}
              aria-invalid={Boolean(
                state.fieldErrors.contactChannel || state.fieldErrors.contactPhone,
              )}
              autoComplete="tel"
              id="company-create-contact-phone"
              inputMode="tel"
              name="contactPhone"
              onChange={(event) => updateValue("contactPhone", event.currentTarget.value)}
              pattern="[0-9\s-]*"
              value={values.contactPhone}
            />
            <FieldError
              copy={copy}
              field="contactPhone"
              id="company-create-contact-phone-error"
              state={state}
            />
          </label>
          <label className="admin-field" htmlFor="company-create-contact-email">
            <span className="admin-field-label">
              {copy.contactEmail}
              <Requirement copy={copy} required={false} />
            </span>
            <input
              aria-describedby={describedBy(
                "company-create-contact-channel-help",
                state.fieldErrors.contactChannel && "company-create-contact-channel-error",
                state.fieldErrors.contactEmail && "company-create-contact-email-error",
              )}
              aria-invalid={Boolean(
                state.fieldErrors.contactChannel || state.fieldErrors.contactEmail,
              )}
              autoComplete="email"
              id="company-create-contact-email"
              maxLength={254}
              name="contactEmail"
              onChange={(event) => updateValue("contactEmail", event.currentTarget.value)}
              type="email"
              value={values.contactEmail}
            />
            <FieldError
              copy={copy}
              field="contactEmail"
              id="company-create-contact-email-error"
              state={state}
            />
          </label>
          <div className="admin-company-form__wide-field">
            <FieldError
              copy={copy}
              field="contactChannel"
              id="company-create-contact-channel-error"
              state={state}
            />
          </div>
        </div>
      </div>

      <div className="admin-company-form__section" id="company-create-operations">
        <div className="admin-company-form__section-heading">
          <h2>{copy.operationsManagerName}</h2>
          <Requirement copy={copy} required={false} />
        </div>
        <p className="admin-company-form__section-help" id="company-create-operations-manager-help">
          {copy.operationsManagerHelp}
        </p>
        <div className="admin-company-form__grid">
          <label className="admin-field" htmlFor="company-create-operations-manager-name">
            <span>{copy.operationsManagerName}</span>
            <input
              aria-describedby={describedBy(
                "company-create-operations-manager-help",
                state.fieldErrors.operationsManagerName &&
                  "company-create-operations-manager-name-error",
              )}
              aria-invalid={Boolean(state.fieldErrors.operationsManagerName)}
              id="company-create-operations-manager-name"
              maxLength={100}
              name="operationsManagerName"
              onChange={(event) => updateValue("operationsManagerName", event.currentTarget.value)}
              value={values.operationsManagerName}
            />
            <FieldError
              copy={copy}
              field="operationsManagerName"
              id="company-create-operations-manager-name-error"
              state={state}
            />
          </label>
          <label className="admin-field" htmlFor="company-create-operations-manager-phone">
            <span>{copy.operationsManagerPhone}</span>
            <input
              aria-describedby={describedBy(
                "company-create-operations-manager-help",
                state.fieldErrors.operationsManagerChannel &&
                  "company-create-operations-manager-channel-error",
                state.fieldErrors.operationsManagerPhone &&
                  "company-create-operations-manager-phone-error",
              )}
              aria-invalid={Boolean(
                state.fieldErrors.operationsManagerChannel ||
                  state.fieldErrors.operationsManagerPhone,
              )}
              autoComplete="tel"
              id="company-create-operations-manager-phone"
              inputMode="tel"
              name="operationsManagerPhone"
              onChange={(event) => updateValue("operationsManagerPhone", event.currentTarget.value)}
              pattern="[0-9\s-]*"
              value={values.operationsManagerPhone}
            />
            <FieldError
              copy={copy}
              field="operationsManagerPhone"
              id="company-create-operations-manager-phone-error"
              state={state}
            />
          </label>
          <label
            className="admin-field admin-company-form__wide-field"
            htmlFor="company-create-operations-manager-email"
          >
            <span>{copy.operationsManagerEmail}</span>
            <input
              aria-describedby={describedBy(
                "company-create-operations-manager-help",
                state.fieldErrors.operationsManagerChannel &&
                  "company-create-operations-manager-channel-error",
                state.fieldErrors.operationsManagerEmail &&
                  "company-create-operations-manager-email-error",
              )}
              aria-invalid={Boolean(
                state.fieldErrors.operationsManagerChannel ||
                  state.fieldErrors.operationsManagerEmail,
              )}
              autoComplete="email"
              id="company-create-operations-manager-email"
              maxLength={254}
              name="operationsManagerEmail"
              onChange={(event) => updateValue("operationsManagerEmail", event.currentTarget.value)}
              type="email"
              value={values.operationsManagerEmail}
            />
            <FieldError
              copy={copy}
              field="operationsManagerEmail"
              id="company-create-operations-manager-email-error"
              state={state}
            />
          </label>
          <div className="admin-company-form__wide-field">
            <FieldError
              copy={copy}
              field="operationsManagerChannel"
              id="company-create-operations-manager-channel-error"
              state={state}
            />
          </div>
        </div>
      </div>

      <div className="admin-company-form__section" id="company-create-reason">
        <h2>{copy.reason}</h2>
        <label className="admin-field" htmlFor="company-create-reason-input">
          <span className="admin-field-label">
            {copy.reason}
            <Requirement copy={copy} required />
          </span>
          <textarea
            aria-describedby={describedBy(
              state.fieldErrors.reason && "company-create-reason-error",
            )}
            aria-invalid={Boolean(state.fieldErrors.reason)}
            id="company-create-reason-input"
            maxLength={500}
            minLength={3}
            name="reason"
            onChange={(event) => updateValue("reason", event.currentTarget.value)}
            placeholder={copy.reasonPlaceholder}
            required
            value={values.reason}
          />
          <FieldError copy={copy} field="reason" id="company-create-reason-error" state={state} />
        </label>
      </div>

      <div className="admin-company-form__actions">
        <a className="tt-button tt-button--secondary" href={listPath}>
          {copy.cancel}
        </a>
        <SubmitButton copy={copy} />
      </div>
    </form>
  );
}
