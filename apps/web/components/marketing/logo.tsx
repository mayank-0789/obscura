export function Logo({
  size = "md",
}: {
  size?: "sm" | "md" | "lg";
}) {
  const sizeClass =
    size === "sm" ? "h-7 w-7" : size === "lg" ? "h-12 w-12" : "h-9 w-9";

  return (
    <img
      src="/logo.svg"
      alt="Obscura"
      className={`${sizeClass} rounded-md`}
      aria-hidden="true"
    />
  );
}
