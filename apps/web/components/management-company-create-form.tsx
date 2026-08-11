"use client";

import {
  getOperationsManagerCompleteness,
  hasManagementCompanyContactChannel,
} from "@taptolk/domain";
import { type FormEvent, useActionState, useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import {
  createManagementCompany,
  type ManagementCompanyCreateActionState,
  type ManagementCompanyCreateField,
  type ManagementCompanyCreateFieldError,
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
  contactChannel: string;
  contactChannelHelp: string;
  contactEmail: string;
  contactName: string;
  contactPhone: string;
  contactSectionTitle: string;
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
  oneRequired: string;
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

type ClientFieldErrors = Partial<
  Record<ManagementCompanyCreateField, ManagementCompanyCreateFieldError>
>;

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
  kind,
}: {
  copy: ManagementCompanyCreateFormCopy;
  kind: "oneRequired" | "optional" | "required";
}) {
  const isRequired = kind !== "optional";
  return (
    <span
      className={`admin-field-requirement ${isRequired ? "admin-field-requirement--required" : ""}`}
    >
      {kind === "required"
        ? copy.required
        : kind === "oneRequired"
          ? copy.oneRequired
          : copy.optional}
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
  const [clientFieldErrors, setClientFieldErrors] = useState<ClientFieldErrors>({});
  const errorSummaryRef = useRef<HTMLDivElement | null>(null);
  const displayState: ManagementCompanyCreateActionState = {
    ...state,
    fieldErrors: { ...state.fieldErrors, ...clientFieldErrors },
  };
  const hasFieldErrors = Object.keys(displayState.fieldErrors).length > 0;
  const hasErrors = hasFieldErrors || Boolean(state.formError);

  useEffect(() => {
    if (hasErrors) {
      errorSummaryRef.current?.focus();
    }
  }, [hasErrors]);

  function updateValue(name: TextInputName, value: string) {
    const nextValues = { ...values, [name]: value };
    setValues(nextValues);
    setClientFieldErrors((current) => {
      const next = { ...current };
      delete next[name];
      if (
        (name === "contactPhone" || name === "contactEmail") &&
        hasManagementCompanyContactChannel({
          email: nextValues.contactEmail,
          phone: nextValues.contactPhone,
        })
      ) {
        delete next.contactChannel;
      }
      if (
        name === "operationsManagerName" ||
        name === "operationsManagerPhone" ||
        name === "operationsManagerEmail"
      ) {
        delete next.operationsManagerChannel;
        delete next.operationsManagerName;
      }
      return next;
    });
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    const errors: ClientFieldErrors = {};
    if (
      !hasManagementCompanyContactChannel({
        email: values.contactEmail,
        phone: values.contactPhone,
      })
    ) {
      errors.contactChannel = "channelRequired";
    }

    const operationsManagerCompleteness = getOperationsManagerCompleteness({
      email: values.operationsManagerEmail,
      name: values.operationsManagerName,
      phone: values.operationsManagerPhone,
    });
    if (operationsManagerCompleteness === "MISSING_NAME") {
      errors.operationsManagerName = "required";
    }
    if (operationsManagerCompleteness === "MISSING_CHANNEL") {
      errors.operationsManagerChannel = "operationsManagerChannelRequired";
    }

    if (Object.keys(errors).length > 0) {
      event.preventDefault();
      setClientFieldErrors(errors);
      requestAnimationFrame(() => errorSummaryRef.current?.focus());
    }
  }

  function describedBy(...ids: Array<string | false | undefined>): string | undefined {
    const value = ids.filter(Boolean).join(" ");
    return value || undefined;
  }

  const formErrorMessage = state.formError ? copy.error[state.formError] : null;
  const addressDescribedBy = describedBy(
    "company-create-address-help",
    displayState.fieldErrors.address && "company-create-address-error",
  );

  return (
    <form
      action={formAction}
      className="admin-tenant-form admin-company-form"
      onSubmit={handleSubmit}
    >
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
              <Requirement copy={copy} kind="required" />
            </span>
            <input
              aria-describedby={describedBy(
                displayState.fieldErrors.name && "company-create-name-error",
              )}
              aria-invalid={Boolean(displayState.fieldErrors.name)}
              id="company-create-name"
              maxLength={200}
              name="name"
              onChange={(event) => updateValue("name", event.currentTarget.value)}
              required
              value={values.name}
            />
            <FieldError
              copy={copy}
              field="name"
              id="company-create-name-error"
              state={displayState}
            />
          </label>
          <label className="admin-field" htmlFor="company-create-business-number">
            <span className="admin-field-label">
              {copy.businessNumber}
              <Requirement copy={copy} kind="required" />
            </span>
            <input
              aria-describedby={describedBy(
                "company-create-business-number-help",
                displayState.fieldErrors.businessNumber && "company-create-business-number-error",
              )}
              aria-invalid={Boolean(displayState.fieldErrors.businessNumber)}
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
              state={displayState}
            />
          </label>
          <div className="admin-field admin-company-form__wide-field">
            <span className="admin-field-label">
              {copy.address}
              <Requirement copy={copy} kind="required" />
            </span>
            <ManagementCompanyAddressSearchField
              {...(addressDescribedBy ? { ariaDescribedBy: addressDescribedBy } : {})}
              ariaInvalid={Boolean(displayState.fieldErrors.address)}
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
              state={displayState}
            />
          </div>
        </div>
      </div>

      <div className="admin-company-form__section" id="company-create-contact">
        <h2>{copy.contactSectionTitle}</h2>
        <p className="admin-company-form__section-help" id="company-create-contact-channel-help">
          {copy.contactChannelHelp}
        </p>
        <div className="admin-company-form__grid">
          <label className="admin-field" htmlFor="company-create-representative-phone">
            <span className="admin-field-label">
              {copy.representativePhone}
              <Requirement copy={copy} kind="optional" />
            </span>
            <input
              aria-describedby={describedBy(
                displayState.fieldErrors.representativePhone &&
                  "company-create-representative-phone-error",
              )}
              aria-invalid={Boolean(displayState.fieldErrors.representativePhone)}
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
              state={displayState}
            />
          </label>
          <label className="admin-field" htmlFor="company-create-contact-name">
            <span className="admin-field-label">
              {copy.contactName}
              <Requirement copy={copy} kind="required" />
            </span>
            <input
              aria-describedby={describedBy(
                displayState.fieldErrors.contactName && "company-create-contact-name-error",
              )}
              aria-invalid={Boolean(displayState.fieldErrors.contactName)}
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
              state={displayState}
            />
          </label>
          <div className="admin-company-form__channel-heading admin-company-form__wide-field">
            <span className="admin-field-label">
              {copy.contactChannel}
              <Requirement copy={copy} kind="oneRequired" />
            </span>
          </div>
          <label className="admin-field" htmlFor="company-create-contact-phone">
            <span>{copy.contactPhone}</span>
            <input
              aria-describedby={describedBy(
                "company-create-contact-channel-help",
                displayState.fieldErrors.contactChannel && "company-create-contact-channel-error",
                displayState.fieldErrors.contactPhone && "company-create-contact-phone-error",
              )}
              aria-invalid={Boolean(
                displayState.fieldErrors.contactChannel || displayState.fieldErrors.contactPhone,
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
              state={displayState}
            />
          </label>
          <label className="admin-field" htmlFor="company-create-contact-email">
            <span>{copy.contactEmail}</span>
            <input
              aria-describedby={describedBy(
                "company-create-contact-channel-help",
                displayState.fieldErrors.contactChannel && "company-create-contact-channel-error",
                displayState.fieldErrors.contactEmail && "company-create-contact-email-error",
              )}
              aria-invalid={Boolean(
                displayState.fieldErrors.contactChannel || displayState.fieldErrors.contactEmail,
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
              state={displayState}
            />
          </label>
          <div className="admin-company-form__wide-field">
            <FieldError
              copy={copy}
              field="contactChannel"
              id="company-create-contact-channel-error"
              state={displayState}
            />
          </div>
        </div>
      </div>

      <div className="admin-company-form__section" id="company-create-operations">
        <div className="admin-company-form__section-heading">
          <h2>{copy.operationsManagerName}</h2>
          <Requirement copy={copy} kind="optional" />
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
                displayState.fieldErrors.operationsManagerName &&
                  "company-create-operations-manager-name-error",
              )}
              aria-invalid={Boolean(displayState.fieldErrors.operationsManagerName)}
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
              state={displayState}
            />
          </label>
          <label className="admin-field" htmlFor="company-create-operations-manager-phone">
            <span>{copy.operationsManagerPhone}</span>
            <input
              aria-describedby={describedBy(
                "company-create-operations-manager-help",
                displayState.fieldErrors.operationsManagerChannel &&
                  "company-create-operations-manager-channel-error",
                displayState.fieldErrors.operationsManagerPhone &&
                  "company-create-operations-manager-phone-error",
              )}
              aria-invalid={Boolean(
                displayState.fieldErrors.operationsManagerChannel ||
                  displayState.fieldErrors.operationsManagerPhone,
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
              state={displayState}
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
                displayState.fieldErrors.operationsManagerChannel &&
                  "company-create-operations-manager-channel-error",
                displayState.fieldErrors.operationsManagerEmail &&
                  "company-create-operations-manager-email-error",
              )}
              aria-invalid={Boolean(
                displayState.fieldErrors.operationsManagerChannel ||
                  displayState.fieldErrors.operationsManagerEmail,
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
              state={displayState}
            />
          </label>
          <div className="admin-company-form__wide-field">
            <FieldError
              copy={copy}
              field="operationsManagerChannel"
              id="company-create-operations-manager-channel-error"
              state={displayState}
            />
          </div>
        </div>
      </div>

      <div className="admin-company-form__section" id="company-create-reason">
        <h2>{copy.reason}</h2>
        <label className="admin-field" htmlFor="company-create-reason-input">
          <span className="admin-field-label">
            {copy.reason}
            <Requirement copy={copy} kind="required" />
          </span>
          <textarea
            aria-describedby={describedBy(
              displayState.fieldErrors.reason && "company-create-reason-error",
            )}
            aria-invalid={Boolean(displayState.fieldErrors.reason)}
            id="company-create-reason-input"
            maxLength={500}
            minLength={3}
            name="reason"
            onChange={(event) => updateValue("reason", event.currentTarget.value)}
            placeholder={copy.reasonPlaceholder}
            required
            value={values.reason}
          />
          <FieldError
            copy={copy}
            field="reason"
            id="company-create-reason-error"
            state={displayState}
          />
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
