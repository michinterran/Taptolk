const DAY_MS = 86_400_000;

export const OPERATIONS_PERIOD_DAYS = [1, 7, 14, 30, 90] as const;
export const OPERATIONS_DEFAULT_WINDOW_DAYS = 14;
export const OPERATIONS_MAX_WINDOW_DAYS = 90;

export type OperationsRangeQuery = {
  days?: string | string[];
  end?: string | string[];
  start?: string | string[];
};

export type ResolvedOperationsRange = {
  endDate: string;
  isExplicit: boolean;
  startDate: string;
  windowDays: number;
};

export function readOperationsQueryValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function dateKey(value: Date): string {
  return value.toISOString().slice(0, 10);
}

export function shiftOperationsDate(value: string, days: number): string {
  return dateKey(new Date(new Date(`${value}T00:00:00.000Z`).getTime() + days * DAY_MS));
}

function inclusiveDays(startDate: string, endDate: string): number {
  return (
    Math.floor(
      (new Date(`${endDate}T00:00:00.000Z`).getTime() -
        new Date(`${startDate}T00:00:00.000Z`).getTime()) /
        DAY_MS,
    ) + 1
  );
}

function isDateKey(value: string | undefined): value is string {
  return Boolean(value && /^\d{4}-\d{2}-\d{2}$/u.test(value) && !Number.isNaN(Date.parse(value)));
}

export function resolveOperationsRange(query: OperationsRangeQuery): ResolvedOperationsRange {
  const today = new Intl.DateTimeFormat("en-CA", {
    day: "2-digit",
    month: "2-digit",
    timeZone: "Asia/Seoul",
    year: "numeric",
  }).format(new Date());
  const requestedStart = readOperationsQueryValue(query.start);
  const requestedEnd = readOperationsQueryValue(query.end);
  if (isDateKey(requestedStart) && isDateKey(requestedEnd)) {
    const windowDays = inclusiveDays(requestedStart, requestedEnd);
    if (windowDays >= 1 && windowDays <= OPERATIONS_MAX_WINDOW_DAYS && requestedEnd <= today) {
      return { endDate: requestedEnd, isExplicit: true, startDate: requestedStart, windowDays };
    }
  }

  const parsedDays = Number.parseInt(readOperationsQueryValue(query.days) ?? "", 10);
  const windowDays = OPERATIONS_PERIOD_DAYS.includes(
    parsedDays as (typeof OPERATIONS_PERIOD_DAYS)[number],
  )
    ? parsedDays
    : OPERATIONS_DEFAULT_WINDOW_DAYS;
  return {
    endDate: today,
    isExplicit: false,
    startDate: shiftOperationsDate(today, -(windowDays - 1)),
    windowDays,
  };
}
