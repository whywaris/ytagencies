// Server code may import only components from "use client" modules. Anything else (a function,
// a class string, a constant) arrives on the server as a client reference: calling it throws
// ("Attempted to call yearlySaving() from the server…", the dashboard 500), and using it as a
// value silently renders garbage. Shared helpers belong in plain modules (e.g. src/lib/pricing.ts).
import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { test } from "node:test";

const SRC = resolve(import.meta.dirname, "../src");

function files(dir) {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    return statSync(p).isDirectory() ? files(p) : /\.(ts|tsx)$/.test(name) ? [p] : [];
  });
}

const isClient = (source) => /^\s*["']use client["'];?/.test(source);

function resolveAlias(spec) {
  const base = join(SRC, spec.slice(2));
  for (const ext of [".ts", ".tsx", "/index.ts", "/index.tsx"])
    if (existsSync(base + ext)) return base + ext;
  return null;
}

test("no server module imports a non-component value from a client module", () => {
  const problems = [];
  for (const file of files(SRC)) {
    const source = readFileSync(file, "utf8");
    if (isClient(source)) continue;
    for (const m of source.matchAll(/import\s+(?!type\b)\{([^}]+)\}\s+from\s+"(@\/[^"]+)"/g)) {
      const target = resolveAlias(m[2]);
      if (!target || !isClient(readFileSync(target, "utf8"))) continue;
      for (const raw of m[1].split(",")) {
        const name = raw.trim().replace(/^type\s+/, "");
        if (!name || raw.trim().startsWith("type ")) continue;
        const local = name.split(/\s+as\s+/)[0];
        // Components are PascalCase; everything else is a value the server can't use.
        if (!/^[A-Z][a-z]/.test(local))
          problems.push(`${file.slice(SRC.length + 1)}: ${local} from ${m[2]}`);
      }
    }
  }
  assert.deepEqual(problems, []);
});
