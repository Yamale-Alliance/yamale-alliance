type AiResearchLaunchIconProps = {
  className?: string;
};

/** Magnifying glass + sparkle — AI legal research launch affordance. */
export function AiResearchLaunchIcon({ className }: AiResearchLaunchIconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden
    >
      <circle cx="10.25" cy="10.25" r="5.75" stroke="currentColor" strokeWidth="2" />
      <path
        d="M14.5 14.5L19.25 19.25"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path
        d="M17.75 4.75 18.35 6.55 20.15 7.15 18.35 7.75 17.75 9.55 17.15 7.75 15.35 7.15 17.15 6.55 17.75 4.75Z"
        fill="currentColor"
      />
    </svg>
  );
}
