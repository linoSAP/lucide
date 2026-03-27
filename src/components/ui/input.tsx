import * as React from "react";
import { cn } from "@/lib/utils";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {}

const Input = React.forwardRef<HTMLInputElement, InputProps>(({ className, ...props }, ref) => {
  return (
    <input
      ref={ref}
      className={cn(
        "flex h-11 w-full rounded-[14px] border border-white/5 bg-white/4 px-4 py-2 text-sm text-foreground outline-none transition placeholder:text-muted-foreground/80 focus:border-primary/20 focus:ring-2 focus:ring-primary/20",
        className,
      )}
      {...props}
    />
  );
});

Input.displayName = "Input";

export { Input };
