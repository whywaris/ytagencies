// Which addresses a server-side fetch may reach (remote images pasted into the guide editor).
// Private, loopback, link-local, CGNAT, multicast and reserved ranges are refused, so a pasted
// URL can't make the server call internal services (SSRF). No imports: tested.

const v4 = (ip: string) => {
  const m = ip.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  return m ? m.slice(1).map(Number) : null;
};

export function isPublicIp(ip: string): boolean {
  const mapped = ip.toLowerCase().match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  const a = v4(mapped ? mapped[1] : ip);
  if (a) {
    if (a.some((n) => n > 255)) return false;
    const [p, q] = a;
    return !(
      p === 0 ||
      p === 10 ||
      p === 127 ||
      (p === 100 && q >= 64 && q <= 127) || // CGNAT
      (p === 169 && q === 254) || // link-local, cloud metadata
      (p === 172 && q >= 16 && q <= 31) ||
      (p === 192 && q === 168) ||
      (p === 192 && q === 0) ||
      (p === 198 && (q === 18 || q === 19)) ||
      p >= 224 // multicast and reserved
    );
  }
  const v6 = ip.toLowerCase();
  if (!v6.includes(":")) return false;
  return !(
    v6 === "::" ||
    v6 === "::1" ||
    /^f[cd]/.test(v6) || // unique local
    /^fe[89ab]/.test(v6) || // link-local
    /^ff/.test(v6) || // multicast
    v6.startsWith("::ffff:") ||
    v6.startsWith("64:ff9b:") // NAT64
  );
}
