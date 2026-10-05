import { BRAND_NAME } from "@/lib/site";

// Minimal table-based shell. Inline styles only: email clients ignore stylesheets and CSS variables.
export const text = { color: "#1d1d1f", fontSize: "16px", lineHeight: "24px", margin: "0 0 16px" };
export const muted = { ...text, color: "#6e6e73", fontSize: "14px", lineHeight: "20px" };
export const link = { color: "#0b57d0" };

export function EmailLayout({ preview, children }: { preview: string; children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width" />
      </head>
      <body
        style={{
          margin: 0,
          padding: "24px 12px",
          backgroundColor: "#f5f5f7",
          fontFamily: '-apple-system, BlinkMacSystemFont, "Inter", "Segoe UI", Roboto, sans-serif',
        }}
      >
        {/* Inbox preview line, hidden in the body */}
        <div style={{ display: "none", maxHeight: 0, overflow: "hidden" }}>{preview}</div>
        <table role="presentation" width="100%" cellPadding={0} cellSpacing={0}>
          <tbody>
            <tr>
              <td align="center">
                <table
                  role="presentation"
                  width="100%"
                  cellPadding={0}
                  cellSpacing={0}
                  style={{ maxWidth: "560px", backgroundColor: "#ffffff", borderRadius: "16px" }}
                >
                  <tbody>
                    <tr>
                      <td style={{ padding: "32px" }}>
                        <p style={{ ...text, fontWeight: 600, color: "#0b57d0" }}>{BRAND_NAME}</p>
                        {children}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </td>
            </tr>
          </tbody>
        </table>
      </body>
    </html>
  );
}

export function Details({ rows }: { rows: [string, string | null | undefined][] }) {
  return (
    <table
      role="presentation"
      cellPadding={0}
      cellSpacing={0}
      style={{ margin: "0 0 16px", width: "100%" }}
    >
      <tbody>
        {rows
          .filter(([, v]) => v)
          .map(([label, value]) => (
            <tr key={label}>
              <td
                style={{
                  ...muted,
                  margin: 0,
                  padding: "4px 16px 4px 0",
                  verticalAlign: "top",
                  whiteSpace: "nowrap",
                }}
              >
                {label}
              </td>
              <td style={{ ...text, margin: 0, padding: "4px 0", whiteSpace: "pre-wrap" }}>
                {value}
              </td>
            </tr>
          ))}
      </tbody>
    </table>
  );
}
