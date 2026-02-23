"use client";

import { cn } from "@/lib/utils";
import { ButtonHTMLAttributes, forwardRef } from "react";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "ghost" | "outline";
  size?: "sm" | "md" | "lg";
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", size = "md", ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(
          "inline-flex items-center justify-center font-heading font-semibold transition-all duration-150 disabled:opacity-40 disabled:cursor-not-allowed",
          {
            // Variants
            "bg-[#7C3AED] text-white hover:bg-[#6D28D9] active:scale-[0.98]": variant === "primary",
            "bg-transparent text-black border-2 border-black hover:bg-black hover:text-white active:scale-[0.98]": variant === "outline",
            "bg-transparent text-black hover:underline": variant === "ghost",
            // Sizes
            "px-4 py-2 text-sm": size === "sm",
            "px-6 py-3 text-base": size === "md",
            "px-8 py-4 text-lg w-full": size === "lg",
          },
          className
        )}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";

export default Button;
