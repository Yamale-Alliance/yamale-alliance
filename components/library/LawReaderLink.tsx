import type { ComponentProps } from "react";

const linkClass =
  "!text-blue-600 font-bold underline decoration-blue-600 break-words hover:decoration-blue-600";

/** In-document hash links stay in-tab; external links open in a new tab. */
export function LawReaderLink({ href, children, className, ...props }: ComponentProps<"a">) {
  const isInternal = Boolean(href?.startsWith("#"));
  const merged = className ? `${linkClass} ${className}` : linkClass;

  if (isInternal) {
    return (
      <a href={href} className={merged} {...props}>
        {children}
      </a>
    );
  }

  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className={merged} {...props}>
      {children}
    </a>
  );
}
