import { cn } from "@/lib/utils"

function Skeleton({
  className,
  variant = "default",
  ...props
}: React.HTMLAttributes<HTMLDivElement> & {
  variant?: "default" | "shimmer"
}) {
  return (
    <div
      className={cn(
        "rounded-md bg-muted/50",
        variant === "default" && "animate-pulse",
        variant === "shimmer" && "animate-shimmer bg-gradient-to-r from-muted/50 via-muted/70 to-muted/50 bg-[length:1000px_100%]",
        className
      )}
      {...props}
    />
  )
}

export { Skeleton }
