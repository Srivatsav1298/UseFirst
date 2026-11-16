"use client";

import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 rounded-xl text-sm font-semibold transition-colors disabled:pointer-events-none disabled:opacity-50 select-none",
  {
    variants: {
      variant: {
        primary: "bg-forest-600 text-white hover:bg-forest-700 active:bg-forest-800 shadow-sm",
        secondary: "bg-forest-50 text-forest-800 hover:bg-forest-100 border border-forest-100",
        outline: "border border-stone-200 bg-white text-ink hover:bg-stone-50",
        ghost: "text-forest-700 hover:bg-forest-50",
        danger: "bg-red-600 text-white hover:bg-red-700",
        dangerSoft: "bg-red-50 text-red-700 hover:bg-red-100 border border-red-100",
        amber: "bg-amber-100 text-amber-800 hover:bg-amber-200",
      },
      size: {
        sm: "h-9 px-3 text-xs",
        md: "h-11 px-4",
        lg: "h-12 px-6 text-base",
        icon: "h-11 w-11",
      },
    },
    defaultVariants: { variant: "primary", size: "md" },
  },
);

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & VariantProps<typeof buttonVariants>;

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, type = "button", ...props }, ref) => (
    <button ref={ref} type={type} className={cn(buttonVariants({ variant, size }), className)} {...props} />
  ),
);
Button.displayName = "Button";
