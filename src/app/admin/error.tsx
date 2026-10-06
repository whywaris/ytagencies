"use client";

// Error state with retry for every admin page. Shows Next's digest so a log line can be found;
// never the raw error message, which can carry query details.
export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div
      role="alert"
      className="flex max-w-reading flex-col items-start gap-3 rounded-xl border border-line px-6 py-10"
    >
      <h1 className="text-admin-section">This page didn&apos;t load</h1>
      <p className="text-text-2">
        Something went wrong while loading the data. Try again; if it keeps happening, check the
        server logs{error.digest ? ` for error ${error.digest}` : ""}.
      </p>
      <button
        type="button"
        onClick={reset}
        className="h-9 rounded-lg border border-line px-3 font-medium transition-colors duration-150 hover:bg-surface-2"
      >
        Try again
      </button>
    </div>
  );
}
