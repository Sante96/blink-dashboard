import * as React from "react";
import { cn } from "@/lib/utils";

type TextSize = "xs" | "sm" | "base" | "lg" | "xl" | "2xl";
type TextWeight = "normal" | "medium" | "semibold" | "bold";
type TextShadow = "none" | "sm" | "md" | "lg";

const sizeMap: Record<TextSize, string> = {
  xs: "text-[10px]",
  sm: "text-xs",
  base: "text-sm",
  lg: "text-base",
  xl: "text-lg",
  "2xl": "text-2xl",
};

const weightMap: Record<TextWeight, string> = {
  normal: "font-normal",
  medium: "font-medium",
  semibold: "font-semibold",
  bold: "font-bold",
};

const shadowMap: Record<TextShadow, string> = {
  none: "",
  sm: "text-shadow-sm",
  md: "text-shadow",
  lg: "text-shadow-lg",
};

interface TextProps extends React.HTMLAttributes<HTMLElement> {
  as?: "span" | "p" | "div" | "label" | "h1" | "h2" | "h3";
  /** Se omesso eredita dal parent (utile per size custom). */
  size?: TextSize;
  /** Se omesso eredita dal parent. */
  weight?: TextWeight;
  /** Ombra per leggibilità sopra glass/video. Default "sm". */
  shadow?: TextShadow;
}

/**
 * Componente testo con ombra di default per garantire leggibilità sopra
 * glassmorphism e video. Usare shadow="none" per testo su fondo pieno.
 * size/weight omessi ereditano dal parent.
 */
export const Text = React.forwardRef<HTMLElement, TextProps>(
  ({ as = "span", size, weight, shadow = "sm", className, ...props }, ref) => {
    const Comp = as as React.ElementType;
    return (
      <Comp
        ref={ref}
        className={cn(
          size && sizeMap[size],
          weight && weightMap[weight],
          shadowMap[shadow],
          className
        )}
        {...props}
      />
    );
  }
);
Text.displayName = "Text";
