import { BRAND_NAME } from "@/lib/site";

// The mark: a rounded square holding a short list, i.e. a directory. Deliberately nothing like a play
// button, and no red: YT Agencies must not look affiliated with YouTube.
// Plain shapes, returned as an array and called as a function: Satori (next/og) only accepts
// intrinsic elements inside <svg>, and the same shapes draw the icons and social images.
export function logoMarkShapes(color: string, fill?: string) {
  return [
    <rect
      key="frame"
      x="1.5"
      y="1.5"
      width="21"
      height="21"
      rx="6"
      fill={fill ?? "none"}
      stroke={fill ?? color}
      strokeWidth="2"
    />,
    ...[7, 11, 15].flatMap((y) => [
      <rect key={`d${y}`} x="6.5" y={y} width="2" height="2" rx="1" fill={color} />,
      <rect key={`l${y}`} x="10.5" y={y} width="7" height="2" rx="1" fill={color} />,
    ]),
  ];
}

/**
 * Mark + wordmark in currentColor, so it follows light and dark mode. Size it with a height class.
 * Decorative: wrap it in a link or element that carries the accessible name.
 */
export function Logo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 140 28" className={className} aria-hidden>
      <svg x="0" y="2" width="24" height="24" viewBox="0 0 24 24">
        {logoMarkShapes("currentColor")}
      </svg>
      {/* Inherits the site font stack. textLength keeps it inside the viewBox whichever font loads. */}
      <text
        x="32"
        y="20.5"
        fill="currentColor"
        fontSize="20"
        fontWeight="600"
        letterSpacing="-0.4"
        textLength="106"
        lengthAdjust="spacing"
      >
        {BRAND_NAME}
      </text>
    </svg>
  );
}
