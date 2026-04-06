import { describe, it, expect } from "vitest";
import {
  verifyDomainToctou,
  ssrfValidateUrl,
  PopBrowserInjector,
  CARD_NUMBER_SELECTORS,
  EXPIRY_SELECTORS,
  CVV_SELECTORS,
  FIRST_NAME_SELECTORS,
  COUNTRY_SELECTORS,
  STATE_SELECTORS,
  CITY_SELECTORS,
} from "../src/engine/injector.js";

// ---------------------------------------------------------------------------
// TOCTOU domain verification
// ---------------------------------------------------------------------------
describe("verifyDomainToctou", () => {
  it("passes when page domain matches known vendor", () => {
    expect(verifyDomainToctou("https://aws.amazon.com/checkout", "AWS")).toBeNull();
  });

  it("passes for known payment processor domain", () => {
    expect(verifyDomainToctou("https://checkout.stripe.com/pay/cs_123", "SomeVendor")).toBeNull();
  });

  it("blocks mismatched domain for known vendor", () => {
    const result = verifyDomainToctou("https://evil.com/checkout", "AWS");
    expect(result).toBe("domain_mismatch:evil.com");
  });

  it("passes for unknown vendor with token match in domain", () => {
    expect(verifyDomainToctou("https://acme-shop.com/pay", "Acme Shop")).toBeNull();
  });

  it("returns null when both args are empty", () => {
    expect(verifyDomainToctou("", "")).toBeNull();
  });

  it("returns null when pageUrl is empty", () => {
    expect(verifyDomainToctou("", "AWS")).toBeNull();
  });

  it("strips www prefix from domain", () => {
    expect(verifyDomainToctou("https://www.github.com/pricing", "github")).toBeNull();
  });

  it("blocks subdomain spoofing for known vendor", () => {
    const result = verifyDomainToctou("https://github.attacker.com", "github");
    expect(result).toBe("domain_mismatch:github.attacker.com");
  });
});

// ---------------------------------------------------------------------------
// SSRF validation
// ---------------------------------------------------------------------------
describe("ssrfValidateUrl", () => {
  it("accepts valid https URL", () => {
    expect(ssrfValidateUrl("https://example.com")).toBeNull();
  });

  it("accepts valid http URL", () => {
    expect(ssrfValidateUrl("http://example.com")).toBeNull();
  });

  it("rejects non-http protocol", () => {
    expect(ssrfValidateUrl("ftp://example.com")).not.toBeNull();
    expect(ssrfValidateUrl("file:///etc/passwd")).not.toBeNull();
  });

  it("rejects localhost", () => {
    expect(ssrfValidateUrl("http://localhost:3000")).not.toBeNull();
    expect(ssrfValidateUrl("http://127.0.0.1:8080")).not.toBeNull();
  });

  it("rejects private IPs", () => {
    expect(ssrfValidateUrl("http://10.0.0.1")).not.toBeNull();
    expect(ssrfValidateUrl("http://192.168.1.1")).not.toBeNull();
    expect(ssrfValidateUrl("http://172.16.0.1")).not.toBeNull();
  });

  it("rejects invalid URL", () => {
    expect(ssrfValidateUrl("not-a-url")).not.toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Selector registries
// ---------------------------------------------------------------------------
describe("selector registries", () => {
  it("card number selectors include Stripe Elements", () => {
    expect(CARD_NUMBER_SELECTORS).toContain(
      "input[data-elements-stable-field-name='cardNumber']"
    );
  });

  it("expiry selectors include autocomplete", () => {
    expect(EXPIRY_SELECTORS).toContain("input[autocomplete='cc-exp']");
  });

  it("CVV selectors include common names", () => {
    expect(CVV_SELECTORS).toContain("input[name='cvc']");
    expect(CVV_SELECTORS).toContain("input[name='cvv']");
  });

  it("billing selectors cover common patterns", () => {
    expect(FIRST_NAME_SELECTORS.length).toBeGreaterThan(5);
    expect(COUNTRY_SELECTORS.some((s) => s.startsWith("select["))).toBe(true);
    expect(STATE_SELECTORS.some((s) => s.startsWith("select["))).toBe(true);
    expect(CITY_SELECTORS.some((s) => s.startsWith("input["))).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Masked card display
// ---------------------------------------------------------------------------
describe("PopBrowserInjector.maskedCard", () => {
  it("masks card number showing last 4", () => {
    expect(PopBrowserInjector.maskedCard("4242424242424242")).toBe("****-****-****-4242");
  });

  it("handles short input gracefully", () => {
    expect(PopBrowserInjector.maskedCard("1234")).toBe("****-****-****-1234");
  });
});
