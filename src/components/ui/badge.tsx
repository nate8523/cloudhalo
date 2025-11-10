import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center rounded border px-2.5 py-0.5 text-xs font-semibold transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-primary text-primary-foreground shadow-[var(--shadow-4dp)] hover:bg-[hsl(var(--primary-hover))]",
        secondary:
          "border-transparent bg-secondary text-secondary-foreground shadow-[var(--shadow-4dp)] hover:bg-secondary/80",
        destructive:
          "border-transparent bg-destructive text-destructive-foreground shadow-[var(--shadow-4dp)] hover:bg-destructive/80",
        outline: "border-border text-foreground hover:bg-muted",
        gradient:
          "badge-gradient text-white border-transparent shadow-[var(--shadow-4dp)]",
        success:
          "border-transparent bg-success text-success-foreground shadow-[var(--shadow-4dp)] hover:bg-success/80",
        warning:
          "border-transparent bg-warning text-warning-foreground shadow-[var(--shadow-4dp)] hover:bg-warning/80",
        info:
          "border-transparent bg-info text-info-foreground shadow-[var(--shadow-4dp)] hover:bg-info/80",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  )
}

export { Badge, badgeVariants }
