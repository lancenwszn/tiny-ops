import * as React from "react";
import { Slot } from "radix-ui";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex w-fit shrink-0 items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold [&>svg]:size-3",
  {
    variants: {
      variant: {
        default: "bg-secondary text-secondary-foreground",
        solid: "bg-primary text-primary-foreground",
        outline: "border border-border text-foreground",
        muted: "bg-muted text-muted-foreground",
        green: "bg-tint-green text-tint-green-fg",
        violet: "bg-tint-violet text-tint-violet-fg",
        coral: "bg-tint-coral text-tint-coral-fg",
        sky: "bg-tint-sky text-tint-sky-fg",
        amber: "bg-tint-amber text-tint-amber-fg",
      },
    },
    defaultVariants: { variant: "default" },
  },
);

function Badge({
  className,
  variant,
  asChild = false,
  ...props
}: React.ComponentProps<"span"> & VariantProps<typeof badgeVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot.Root : "span";
  return <Comp data-slot="badge" className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
