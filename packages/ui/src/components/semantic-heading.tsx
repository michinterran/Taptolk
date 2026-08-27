import type { ElementType, HTMLAttributes } from "react";

export interface SemanticHeadingProps extends HTMLAttributes<HTMLHeadingElement> {
  as?: Extract<ElementType, "h1" | "h2" | "h3">;
  lines: readonly [string, ...string[]];
}

export function SemanticHeading({
  as: Heading = "h1",
  className = "",
  lines,
  ...props
}: SemanticHeadingProps) {
  const accessibleText = lines.join(" ");

  return (
    <Heading
      aria-label={accessibleText}
      className={`semantic-heading ${className}`.trim()}
      {...props}
    >
      {lines.map((line) => (
        <span aria-hidden="true" className="semantic-line" key={line}>
          {line}
        </span>
      ))}
    </Heading>
  );
}
