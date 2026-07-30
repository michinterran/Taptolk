"use client";

import { MoonIcon, SunIcon } from "@phosphor-icons/react";
import { useEffect, useState } from "react";

type ConsoleTheme = "dark" | "light";

const STORAGE_KEY = "taptolk-console-theme";

function applyTheme(theme: ConsoleTheme) {
  document.documentElement.dataset.consoleTheme = theme;
  window.localStorage.setItem(STORAGE_KEY, theme);
}

export function ConsoleThemeControl({
  darkLabel,
  lightLabel,
}: {
  darkLabel: string;
  lightLabel: string;
}) {
  const [theme, setTheme] = useState<ConsoleTheme>("dark");

  useEffect(() => {
    const current = window.localStorage.getItem(STORAGE_KEY) === "light" ? "light" : "dark";
    document.documentElement.dataset.consoleTheme = current;
    setTheme(current);
  }, []);

  const nextTheme: ConsoleTheme = theme === "dark" ? "light" : "dark";
  const nextLabel = nextTheme === "light" ? lightLabel : darkLabel;

  return (
    <button
      aria-label={nextLabel}
      className="admin-console-icon-button"
      type="button"
      onClick={() => {
        applyTheme(nextTheme);
        setTheme(nextTheme);
      }}
      title={nextLabel}
    >
      {theme === "dark" ? (
        <SunIcon aria-hidden="true" weight="bold" />
      ) : (
        <MoonIcon aria-hidden="true" weight="bold" />
      )}
    </button>
  );
}
