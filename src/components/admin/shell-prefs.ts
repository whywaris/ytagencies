// Admin shell preferences, stored in cookies (path /admin) so the server renders the right theme
// and sidebar width on the first byte: no flash, no layout shift.

export const THEME_COOKIE = "admin-theme";
export const SIDEBAR_COOKIE = "admin-sidebar";

export type Theme = "system" | "light" | "dark";

export function parseTheme(value: string | undefined): Theme {
  return value === "light" || value === "dark" ? value : "system";
}

/** Client only. */
export function setPrefCookie(name: string, value: string | null) {
  document.cookie =
    value === null
      ? `${name}=; path=/admin; max-age=0; samesite=lax`
      : `${name}=${value}; path=/admin; max-age=31536000; samesite=lax`;
}
