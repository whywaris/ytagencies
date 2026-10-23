// Pro booking buttons (src/lib/booking.ts): calendly.com and wa.me only, shown only while on Pro.
import assert from "node:assert/strict";
import { test } from "node:test";

import { bookingLinks, parseCalendly, parseWhatsApp } from "../src/lib/booking.ts";

test("Calendly: calendly.com links only, normalised to https without query", () => {
  assert.equal(parseCalendly(""), "");
  assert.equal(parseCalendly("calendly.com/acme/intro"), "https://calendly.com/acme/intro");
  assert.equal(
    parseCalendly("http://www.calendly.com/acme/?utm=x"),
    "https://www.calendly.com/acme",
  );
  assert.equal(parseCalendly("https://calendly.com.evil.com/acme"), null);
  assert.equal(parseCalendly("https://cal.com/acme"), null);
  assert.equal(parseCalendly("javascript:alert(1)"), null);
  assert.equal(parseCalendly("https://calendly.com/"), null);
});

test("WhatsApp: a number with its country code or a wa.me link, stored as digits", () => {
  assert.equal(parseWhatsApp(""), "");
  assert.equal(parseWhatsApp("+92 300 123-4567"), "923001234567");
  assert.equal(parseWhatsApp("https://wa.me/14155550123"), "14155550123");
  assert.equal(parseWhatsApp("wa.me/+14155550123"), "14155550123");
  assert.equal(parseWhatsApp("https://api.whatsapp.com/send?phone=1415"), null);
  assert.equal(parseWhatsApp("12345"), null);
  assert.equal(parseWhatsApp("0300 1234567"), null, "needs the country code");
});

const agency = { calendlyUrl: "https://calendly.com/acme", whatsappNumber: "14155550123" };

test("buttons only while Pro is active", () => {
  assert.deepEqual(bookingLinks(agency, false), []);
  assert.deepEqual(
    bookingLinks(agency, true).map((b) => [b.kind, b.href]),
    [
      ["calendly", "https://calendly.com/acme"],
      ["whatsapp", "https://wa.me/14155550123"],
    ],
  );
  assert.deepEqual(bookingLinks({ calendlyUrl: null, whatsappNumber: null }, true), []);
  // A bad stored value never becomes a link.
  assert.deepEqual(
    bookingLinks({ calendlyUrl: "https://evil.com", whatsappNumber: null }, true),
    [],
  );
});
