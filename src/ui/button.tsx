"use client"

import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded text-sm font-semibold transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 dark:focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 relative overflow-hidden group",
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground shadow-[var(--shadow-4dp)] hover:bg-[hsl(var(--primary-hover))] hover:shadow-[var(--shadow-8dp)] active:shadow-[var(--shadow-4dp)] active:translate-y-[1px]",
        destructive:
          "bg-destructive text-destructive-foreground shadow-[var(--shadow-4dp)] hover:bg-destructive/90 hover:shadow-[var(--shadow-8dp)] active:shadow-[var(--shadow-4dp)] active:translate-y-[1px]",
        outline:
          "border border-border bg-background shadow-[var(--shadow-4dp)] hover:bg-muted hover:border-primary/30 hover:shadow-[var(--shadow-8dp)] active:shadow-[var(--shadow-4dp)] active:translate-y-[1px]",
        secondary:
          "bg-secondary text-secondary-foreground shadow-[var(--shadow-4dp)] hover:bg-secondary/80 hover:shadow-[var(--shadow-8dp)] active:shadow-[var(--shadow-4dp)] active:translate-y-[1px]",
        ghost: "hover:bg-muted hover:text-foreground",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-9 px-4 py-2",
        sm: "h-8 px-3 text-xs",
        lg: "h-10 px-8",
        icon: "h-9 w-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
  withRipple?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, withRipple = true, onClick, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    const [ripples, setRipples] = React.useState<Array<{ x: number; y: number; id: number }>>([])

    const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
      if (withRipple && !asChild) {
        const button = e.currentTarget
        const rect = button.getBoundingClientRect()
        const x = e.clientX - rect.left
        const y = e.clientY - rect.top
        const id = Date.now()

        setRipples(prev => [...prev, { x, y, id }])

        setTimeout(() => {
          setRipples(prev => prev.filter(ripple => ripple.id !== id))
        }, 600)
      }

      onClick?.(e)
    }

    // When using asChild, disable ripple effects as Slot expects single child
    const effectiveRipple = asChild ? false : withRipple

    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        onClick={asChild ? onClick : handleClick}
        {...props}
      >
        {effectiveRipple && ripples.map(ripple => (
          <span
            key={ripple.id}
            className="absolute rounded-full bg-white/30 animate-ripple pointer-events-none"
            style={{
              left: ripple.x,
              top: ripple.y,
              width: 0,
              height: 0,
            }}
          />
        ))}
        {props.children}
      </Comp>
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }
