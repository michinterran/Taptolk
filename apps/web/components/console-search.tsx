"use client";

import { MagnifyingGlassIcon } from "@phosphor-icons/react";
import type { Route } from "next";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

export interface ConsoleSearchItem {
  group: string;
  href: Route;
  label: string;
}

export function ConsoleSearch({
  emptyLabel,
  items,
  label,
  placeholder,
}: {
  emptyLabel: string;
  items: readonly ConsoleSearchItem[];
  label: string;
  placeholder: string;
}) {
  const router = useRouter();
  const [focused, setFocused] = useState(false);
  const [query, setQuery] = useState("");
  const normalizedQuery = query.trim().toLocaleLowerCase();
  const matches = useMemo(
    () =>
      normalizedQuery.length === 0
        ? []
        : items
            .filter((item) =>
              `${item.group} ${item.label}`.toLocaleLowerCase().includes(normalizedQuery),
            )
            .slice(0, 6),
    [items, normalizedQuery],
  );
  const showResults = focused && normalizedQuery.length > 0;

  return (
    <search>
      <form
        aria-label={label}
        className="admin-console-search"
        onSubmit={(event) => {
          event.preventDefault();
          if (matches[0]) {
            setFocused(false);
            router.push(matches[0].href);
          }
        }}
      >
        <MagnifyingGlassIcon aria-hidden="true" weight="bold" />
        <input
          aria-label={label}
          autoComplete="off"
          onBlur={() => window.setTimeout(() => setFocused(false), 120)}
          onChange={(event) => setQuery(event.currentTarget.value)}
          onFocus={() => setFocused(true)}
          placeholder={placeholder}
          type="search"
          value={query}
        />
        <button
          aria-label={label}
          className="admin-console-search__submit"
          disabled={matches.length === 0}
          title={label}
          type="submit"
        >
          <MagnifyingGlassIcon aria-hidden="true" weight="bold" />
        </button>
        {showResults ? (
          <div className="admin-console-search__results">
            {matches.length > 0 ? (
              matches.map((item) => (
                <Link href={item.href} key={item.href}>
                  <span>{item.label}</span>
                  <small>{item.group}</small>
                </Link>
              ))
            ) : (
              <p>{emptyLabel}</p>
            )}
          </div>
        ) : null}
      </form>
    </search>
  );
}
