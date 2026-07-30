"use client";

import type { Route } from "next";
import { usePathname, useRouter } from "next/navigation";
import type { FormEvent, FormHTMLAttributes } from "react";

type ConsoleQueryFormProps = Omit<
  FormHTMLAttributes<HTMLFormElement>,
  "action" | "method" | "onSubmit"
>;

export function ConsoleQueryForm({ children, ...props }: ConsoleQueryFormProps) {
  const pathname = usePathname();
  const router = useRouter();

  return (
    <form
      {...props}
      method="get"
      onSubmit={(event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();

        const search = new URLSearchParams();
        for (const [key, value] of new FormData(event.currentTarget).entries()) {
          if (typeof value === "string" && value.length > 0) search.set(key, value);
        }
        const query = search.toString();
        router.push((query.length > 0 ? `${pathname}?${query}` : pathname) as Route);
      }}
    >
      {children}
    </form>
  );
}
