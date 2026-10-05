import { absoluteUrl, BRAND_NAME, SITE_DOMAIN } from "@/lib/site";

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
                        <a
                          href={absoluteUrl("/")}
                          style={{
                            ...text,
                            display: "block",
                            color: "#1d1d1f",
                            textDecoration: "none",
                          }}
                        >
                          {/* Email clients need a plain <img> with an absolute URL; next/image can't work here. */}
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={absoluteUrl("/logo.png")}
                            width={28}
                            height={28}
                            alt=""
                            style={{
                              verticalAlign: "middle",
                              borderRadius: "8px",
                              marginRight: "10px",
                            }}
                          />
                          <span
                            style={{ verticalAlign: "middle", fontSize: "18px", fontWeight: 600 }}
                          >
                            {BRAND_NAME}
                          </span>
                        </a>
                        {children}
                      </td>
                    </tr>
                    <tr>
                      <td style={{ padding: "0 32px 32px" }}>
                        <p style={{ ...muted, margin: 0 }}>
                          <a href={absoluteUrl("/")} style={link}>
                            {SITE_DOMAIN}
                          </a>
                          {" · "}
                          <a href={absoluteUrl("/privacy")} style={link}>
                            Privacy
                          </a>
                          {" · "}
                          <a href={absoluteUrl("/terms")} style={link}>
                            Terms
                          </a>
                          <br />
                          {BRAND_NAME} is an independent directory and is not affiliated with
                          YouTube or Google.
                        </p>
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
