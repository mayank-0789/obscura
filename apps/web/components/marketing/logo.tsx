export function Logo({
  size = "md",
}: {
  size?: "sm" | "md" | "lg";
}) {
  const sizeClass =
    size === "sm" ? "h-6 w-6" : size === "lg" ? "h-10 w-10" : "h-7 w-7";
  const iconClass =
    size === "sm" ? "h-3 w-3" : size === "lg" ? "h-5 w-5" : "h-4 w-4";

  return (
    <div
      className={`${sizeClass} flex items-center justify-center rounded-md bg-gradient-to-br from-emerald-400 to-emerald-600 shadow-lg shadow-emerald-500/20`}
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        className={`${iconClass} text-black`}
        aria-hidden="true"
      >
        <path
          d="M5 12h14M5 12l4-4M5 12l4 4"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  );
}
