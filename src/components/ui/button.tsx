import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

export const buttonVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap rounded-[14px] text-sm font-medium transition duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50 active:scale-[0.99]",
  {
    variants: {
      variant: {
        default: "bg-primary text-background hover:bg-primary/90",
        secondary: "bg-secondary/92 text-foreground hover:bg-secondary",
        ghost: "bg-transparent text-muted-foreground hover:bg-card/76 hover:text-foreground",
        positive: "bg-positive/15 text-positive hover:bg-positive/20",
        warning:
          "bg-warning/22 text-warning ring-1 ring-warning/22 shadow-[0_10px_26px_rgba(255,176,32,0.1)] hover:bg-warning/30 hover:ring-warning/32",
        negative: "bg-negative/15 text-negative hover:bg-negative/20",
      },
      size: {
        default: "h-11 px-4 py-2",
        sm: "h-9 px-3",
        lg: "h-12 px-5 text-base",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, type = "button", ...props }, ref) => (
    <button
      ref={ref}
      type={type}
      className={cn(buttonVariants({ variant, size }), className)}
      {...props}
    />
  ),
);

Button.displayName = "Button";

export { Button };
