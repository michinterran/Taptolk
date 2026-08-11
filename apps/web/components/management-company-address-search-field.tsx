"use client";

import { AddressField, type AddressFieldLabels, type AddressValue } from "@taptolk/ui";
import { useMemo, useRef, useState } from "react";

interface ManagementCompanyAddressSearchFieldProps {
  ariaDescribedBy?: string;
  ariaInvalid?: boolean;
  detailLabel: string;
  detailPlaceholder: string;
  idPrefix?: string;
  initialAddress?: string;
  labels: AddressFieldLabels;
  name: string;
  scriptSrc: string;
}

export function ManagementCompanyAddressSearchField({
  ariaDescribedBy,
  ariaInvalid = false,
  detailLabel,
  detailPlaceholder,
  idPrefix = "company-create-address",
  initialAddress = "",
  labels,
  name,
  scriptSrc,
}: ManagementCompanyAddressSearchFieldProps) {
  const [address, setAddress] = useState<AddressValue>({});
  const [detail, setDetail] = useState("");
  const detailRef = useRef<HTMLInputElement | null>(null);
  const selectedAddress = address.roadAddress || address.jibunAddress || "";
  const composedAddress = useMemo(() => {
    return selectedAddress
      ? [selectedAddress, detail.trim()].filter(Boolean).join(" ")
      : initialAddress;
  }, [detail, initialAddress, selectedAddress]);

  function selectAddress(nextAddress: AddressValue) {
    setAddress(nextAddress);
    window.requestAnimationFrame(() => detailRef.current?.focus());
  }

  return (
    <div className="admin-company-address-search">
      <div className="admin-company-address-search__postcode-row">
        <input
          aria-label={labels.zonecode}
          className="admin-company-address-search__postcode"
          placeholder={labels.zonecode}
          readOnly
          value={address.zonecode ?? ""}
        />
        <AddressField
          className="admin-company-address-search__trigger"
          labels={labels}
          onChange={selectAddress}
          scriptSrc={scriptSrc}
          value={address}
        />
      </div>
      <input
        aria-describedby={ariaDescribedBy}
        aria-invalid={ariaInvalid}
        aria-label={labels.roadAddress}
        className="admin-company-address-search__selected"
        placeholder={labels.roadAddress}
        readOnly
        value={selectedAddress || initialAddress}
      />
      <label className="admin-field" htmlFor={`${idPrefix}-detail`}>
        <span>{detailLabel}</span>
        <input
          autoComplete="address-line2"
          id={`${idPrefix}-detail`}
          maxLength={120}
          onChange={(event) => setDetail(event.currentTarget.value)}
          placeholder={detailPlaceholder}
          ref={detailRef}
          value={detail}
        />
      </label>
      <input aria-label={labels.roadAddress} name={name} type="hidden" value={composedAddress} />
    </div>
  );
}
