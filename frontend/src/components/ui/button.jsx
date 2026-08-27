import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva } from "class-variance-authority";

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        // El relleno usa `turf-btn` (#00873D, 4.63:1 con blanco) y no
        // `primary`, que es el verde de marca y da 2.24:1. El anillo de foco SÍ
        // sigue siendo `primary`: ahí el verde brillante se ve mejor sobre
        // fondo claro, y oscurecerlo iría en contra de lo que se busca.
        default:
          "bg-turf-btn text-white shadow hover:bg-turf-btn-dark",
        destructive:
          "bg-destructive text-destructive-foreground shadow-sm hover:bg-destructive/90",
        outline:
          "border border-input shadow-sm hover:bg-accent hover:text-accent-foreground",
        secondary:
          "bg-secondary text-secondary-foreground shadow-sm hover:bg-secondary/80",
        ghost: "hover:bg-accent hover:text-accent-foreground",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        // Minimum 44x44px touch target (design_guidelines.json accessibility.touch_targets)
        default: "h-11 px-4 py-2",
        sm: "h-11 rounded-md px-3 text-xs",
        lg: "h-12 rounded-md px-8",
        icon: "h-11 w-11",
      },
      // "pill" is the CTA/action-button shape from design_guidelines.json
      // (components.buttons.primary/secondary): rounded-full, uppercase,
      // bold, and a press affordance. Previously every page redefined this
      // by hand (PRIMARY_CTA/PILL_BTN constants), causing rounded-xl vs
      // rounded-full drift across ~10 screens — this makes it a real variant.
      shape: {
        default: "rounded-md",
        pill: "rounded-full uppercase font-bold tracking-wider active:scale-95 transition-transform",
      },
    },
    compoundVariants: [
      { variant: "default", shape: "pill", class: "shadow-lg shadow-primary/20 hover:shadow-xl" },
      { variant: "outline", shape: "pill", class: "border-2" },
    ],
    defaultVariants: {
      variant: "default",
      size: "default",
      shape: "default",
    },
  }
)

const Button = React.forwardRef(({ className, variant, size, shape, asChild = false, ...props }, ref) => {
  const Comp = asChild ? Slot : "button"
  return (
    <Comp
      className={cn(buttonVariants({ variant, size, shape, className }))}
      ref={ref}
      {...props} />
  );
})
Button.displayName = "Button"

export { Button, buttonVariants }
