import { cn } from "@/lib/utils";

export function RiverPlateLogo({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 100 120"
      className={cn("h-8 w-8", className)}
      fill="none"
    >
      <path
        d="M50 0L95 25V90L50 115L5 90V25L50 0Z"
        className="fill-card stroke-border"
        strokeWidth="3"
      />
      <path
        d="M33 35L95 25L67 80L5 90L33 35Z"
        className="fill-primary"
      />
    </svg>
  );
}
