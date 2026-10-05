import * as React from "react";

import { cn } from "@/lib/utils";

// DESIGN.md: 44px, 12px radius, surface fill, no border until focus.
const fieldClasses =
  "h-11 w-full min-w-0 rounded-md border border-transparent bg-surface px-4 text-[17px] text-text transition-colors duration-150 ease-out placeholder:text-text-2 focus-visible:border-accent disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive";

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return <input type={type} data-slot="input" className={cn(fieldClasses, className)} {...props} />;
}

export { Input, fieldClasses };
