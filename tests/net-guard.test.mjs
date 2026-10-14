// Server-side fetch guard (src/lib/net-guard.ts).
import assert from "node:assert/strict";
import { test } from "node:test";

import { isPublicIp } from "../src/lib/net-guard.ts";

test("private, loopback, link-local and reserved addresses are refused", () => {
  for (const ip of [
    "127.0.0.1",
    "10.1.2.3",
    "172.16.0.1",
    "172.31.255.255",
    "192.168.1.1",
    "169.254.169.254",
    "100.64.0.1",
    "0.0.0.0",
    "224.0.0.1",
    "::1",
    "::",
    "fc00::1",
    "fd12::1",
    "fe80::1",
    "::ffff:127.0.0.1",
    "::ffff:10.0.0.1",
    "not-an-ip",
    "999.1.1.1",
  ])
    assert.equal(isPublicIp(ip), false, ip);
});

test("public addresses are allowed", () => {
  for (const ip of ["8.8.8.8", "142.250.1.1", "172.32.0.1", "2606:4700:4700::1111"])
    assert.equal(isPublicIp(ip), true, ip);
});
