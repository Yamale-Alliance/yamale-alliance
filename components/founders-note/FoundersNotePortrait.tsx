type Props = {
  url: string;
  alt?: string;
  size?: "sm" | "md" | "lg";
  className?: string;
};

const sizeClasses = {
  sm: "h-16 w-16",
  md: "h-24 w-24 sm:h-28 sm:w-28",
  lg: "h-32 w-32 sm:h-40 sm:w-40",
};

/** Founder headshot from platform settings (admin upload). */
export function FoundersNotePortrait({
  url,
  alt = "Meghan Waters, Chief Executive Officer of Yamalé",
  size = "lg",
  className = "",
}: Props) {
  return (
    <div
      className={`relative shrink-0 overflow-hidden rounded-full border-2 border-[#C8922A]/40 bg-muted shadow-md ${sizeClasses[size]} ${className}`}
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- dynamic Cloudinary URL from admin */}
      <img src={url} alt={alt} className="h-full w-full object-cover object-center" />
    </div>
  );
}
