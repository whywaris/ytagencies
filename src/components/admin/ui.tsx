import { cn } from "@/lib/utils";

// Plain admin tables. Wide tables scroll inside their wrapper; the page itself never scrolls sideways.

export function Table({ children }: { children: React.ReactNode }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-line">
      <table className="w-full border-collapse text-left text-[15px] [&_td]:border-t [&_td]:border-line [&_td]:px-4 [&_td]:py-3 [&_td]:align-top [&_th]:bg-surface [&_th]:px-4 [&_th]:py-3 [&_th]:text-[14px] [&_th]:font-medium [&_th]:whitespace-nowrap [&_th]:text-text-2">
        {children}
      </table>
    </div>
  );
}

/** A one-button form for a bound server action. Works without JavaScript. */
export function ActionButton({
  action,
  children,
  tone = "default",
}: {
  action: () => Promise<void>;
  children: React.ReactNode;
  tone?: "default" | "danger";
}) {
  return (
    <form action={action}>
      <button
        type="submit"
        className={cn(
          "min-h-11 whitespace-nowrap hover:underline",
          tone === "danger" ? "text-destructive" : "text-accent",
        )}
      >
        {children}
      </button>
    </form>
  );
}

export function Pill({ on, children }: { on: boolean; children: React.ReactNode }) {
  return (
    <span
      className={cn(
        "inline-flex h-6 items-center rounded-full px-2.5 text-[14px] whitespace-nowrap",
        on ? "bg-text text-bg" : "border border-line text-text-2",
      )}
    >
      {children}
    </span>
  );
}

export function Empty({ children }: { children: React.ReactNode }) {
  return <p className="rounded-lg bg-surface p-6 text-text-2">{children}</p>;
}
