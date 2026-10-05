import { createCn } from "cn/config";

// Register the DESIGN.md type scale as font sizes, otherwise cn("text-h1 text-text") drops text-h1 as a color clash.
// Import cn from here, not from "cn" directly.
export const cn = createCn({
  extend: {
    classGroups: { "font-size": [{ text: ["display", "h1", "h2", "h3", "body", "small"] }] },
  },
});
