/**
 * PopBrowserInjector: CDP-based browser injector with iframe + Shadow DOM traversal.
 *
 * Connects to an already-running Chromium browser (via --remote-debugging-port)
 * and auto-fills credit card fields on the active page — including fields inside
 * Stripe and other third-party payment iframes. Also fills billing detail fields
 * (name, address, email) that live in the main page frame.
 *
 * New in TS port: Shadow DOM piercing support.
 */

import { KNOWN_PAYMENT_PROCESSORS } from "./known-processors.js";

// ---------------------------------------------------------------------------
// ISO 3166-1 alpha-2 -> E.164 dial prefix
// ---------------------------------------------------------------------------
const COUNTRY_DIAL_CODES: Record<string, string> = {
  US: "+1",   CA: "+1",   GB: "+44",  AU: "+61",  DE: "+49",
  FR: "+33",  JP: "+81",  CN: "+86",  IN: "+91",  BR: "+55",
  TW: "+886", HK: "+852", SG: "+65",  KR: "+82",  MX: "+52",
  NL: "+31",  SE: "+46",  NO: "+47",  DK: "+45",  FI: "+358",
  CH: "+41",  AT: "+43",  BE: "+32",  IT: "+39",  ES: "+34",
  PT: "+351", PL: "+48",  RU: "+7",   UA: "+380", NZ: "+64",
  ZA: "+27",  NG: "+234", EG: "+20",  IL: "+972", AE: "+971",
  SA: "+966", TR: "+90",  AR: "+54",  CO: "+57",  CL: "+56",
  TH: "+66",  VN: "+84",  ID: "+62",  MY: "+60",  PH: "+63",
};

function nationalNumber(phoneE164: string, countryCode: string): string {
  if (!phoneE164.startsWith("+")) return phoneE164;
  const cc = countryCode.trim();
  let dial: string;
  if (!cc.startsWith("+")) {
    dial = COUNTRY_DIAL_CODES[cc.toUpperCase()] ?? `+${cc}`;
  } else {
    dial = cc;
  }
  if (phoneE164.startsWith(dial)) return phoneE164.slice(dial.length);
  return phoneE164;
}

// ---------------------------------------------------------------------------
// US state abbreviation -> full name (for dropdowns that use full names)
// ---------------------------------------------------------------------------
const US_STATE_CODES: Record<string, string> = {
  AL: "Alabama", AK: "Alaska", AZ: "Arizona", AR: "Arkansas",
  CA: "California", CO: "Colorado", CT: "Connecticut", DE: "Delaware",
  DC: "District of Columbia", FL: "Florida", GA: "Georgia", HI: "Hawaii",
  ID: "Idaho", IL: "Illinois", IN: "Indiana", IA: "Iowa",
  KS: "Kansas", KY: "Kentucky", LA: "Louisiana", ME: "Maine",
  MD: "Maryland", MA: "Massachusetts", MI: "Michigan", MN: "Minnesota",
  MS: "Mississippi", MO: "Missouri", MT: "Montana", NE: "Nebraska",
  NV: "Nevada", NH: "New Hampshire", NJ: "New Jersey", NM: "New Mexico",
  NY: "New York", NC: "North Carolina", ND: "North Dakota", OH: "Ohio",
  OK: "Oklahoma", OR: "Oregon", PA: "Pennsylvania", RI: "Rhode Island",
  SC: "South Carolina", SD: "South Dakota", TN: "Tennessee", TX: "Texas",
  UT: "Utah", VT: "Vermont", VA: "Virginia", WA: "Washington",
  WV: "West Virginia", WI: "Wisconsin", WY: "Wyoming",
};

// ---------------------------------------------------------------------------
// CSS selectors for credit card fields across major payment providers
// ---------------------------------------------------------------------------
export const CARD_NUMBER_SELECTORS = [
  "input[autocomplete='cc-number']",
  "input[name='cardnumber']",
  "input[name='card_number']",
  "input[name='card-number']",
  "input[id*='card'][id*='number']",
  "input[placeholder*='Card number']",
  "input[placeholder*='card number']",
  "input[data-elements-stable-field-name='cardNumber']",   // Stripe Elements
  "input.__PrivateStripeElement",                          // Stripe v2
];

export const EXPIRY_SELECTORS = [
  "input[autocomplete='cc-exp']",
  "input[name='cc-exp']",
  "input[name='expiry']",
  "input[name='card_expiry']",
  "input[placeholder*='MM / YY']",
  "input[placeholder*='MM/YY']",
  "input[placeholder*='Expiry']",
  "input[data-elements-stable-field-name='cardExpiry']",   // Stripe Elements
];

export const CVV_SELECTORS = [
  "input[autocomplete='cc-csc']",
  "input[name='cvc']",
  "input[name='cvv']",
  "input[name='security_code']",
  "input[name='card_cvc']",
  "input[placeholder*='CVC']",
  "input[placeholder*='CVV']",
  "input[placeholder*='Security code']",
  "input[data-elements-stable-field-name='cardCvc']",      // Stripe Elements
];

// ---------------------------------------------------------------------------
// CSS selectors for billing detail fields
// ---------------------------------------------------------------------------
export const FIRST_NAME_SELECTORS = [
  "input[autocomplete='given-name']",
  "input[name='first_name']", "input[name='firstName']", "input[name='first-name']",
  "input[id*='first'][id*='name']", "input[id='first_name']", "input[id='firstName']",
  "input[placeholder*='First name']", "input[placeholder*='first name']",
  "input[aria-label*='First name']", "input[aria-label*='first name']",
];

export const LAST_NAME_SELECTORS = [
  "input[autocomplete='family-name']",
  "input[name='last_name']", "input[name='lastName']", "input[name='last-name']",
  "input[id*='last'][id*='name']", "input[id='last_name']", "input[id='lastName']",
  "input[placeholder*='Last name']", "input[placeholder*='last name']",
  "input[aria-label*='Last name']", "input[aria-label*='last name']",
];

export const FULL_NAME_SELECTORS = [
  "input[autocomplete='name']",
  "input[name='full_name']", "input[name='fullName']", "input[name='name']",
  "input[id='full_name']", "input[id='fullName']",
  "input[placeholder*='Full name']", "input[placeholder*='full name']",
  "input[aria-label*='Full name']", "input[aria-label*='full name']",
];

export const STREET_SELECTORS = [
  "input[autocomplete='street-address']", "input[autocomplete='address-line1']",
  "input[name='address']", "input[name='address1']", "input[name='street']",
  "input[name='street_address']", "input[name='billing_address']",
  "input[id*='address']", "input[id*='street']",
  "input[placeholder*='Street']", "input[placeholder*='street']",
  "input[placeholder*='Address']", "input[placeholder*='address']",
  "input[aria-label*='Street']", "input[aria-label*='street']",
];

export const ZIP_SELECTORS = [
  "input[autocomplete='postal-code']",
  "input[name='zip']", "input[name='postal_code']", "input[name='postcode']",
  "input[name='zipcode']", "input[name='zip_code']",
  "input[id*='zip']", "input[id*='postal']",
  "input[placeholder*='Zip']", "input[placeholder*='zip']",
  "input[placeholder*='Postal']", "input[placeholder*='postal']",
  "input[aria-label*='Zip']", "input[aria-label*='zip']", "input[aria-label*='Postal']",
];

export const EMAIL_SELECTORS = [
  "input[autocomplete='email']", "input[type='email']",
  "input[name='email']", "input[name='email_address']",
  "input[id='email']", "input[id*='email']",
  "input[placeholder*='Email']", "input[placeholder*='email']",
  "input[aria-label*='Email']", "input[aria-label*='email']",
];

export const PHONE_SELECTORS = [
  "input[autocomplete='tel']", "input[type='tel']",
  "input[name='phone']", "input[name='phone_number']", "input[name='phoneNumber']",
  "input[name='telephone']", "input[name='mobile']",
  "input[id*='phone']", "input[id*='tel']", "input[id*='mobile']",
  "input[placeholder*='Phone']", "input[placeholder*='phone']",
  "input[placeholder*='Mobile']",
  "input[aria-label*='Phone']", "input[aria-label*='phone']",
];

export const PHONE_COUNTRY_CODE_SELECTORS = [
  "select[autocomplete='tel-country-code']",
  "select[name='phone_country_code']", "select[name='phoneCountryCode']",
  "select[name='dialCode']", "select[name='dial_code']",
  "select[name='country_code']", "select[name='countryCode']",
  "select[id*='country_code']", "select[id*='dialCode']", "select[id*='dial_code']",
  "select[aria-label*='Country code']", "select[aria-label*='country code']",
  "select[aria-label*='Dial code']",
];

export const COUNTRY_SELECTORS = [
  "select[autocomplete='country']", "select[autocomplete='country-name']",
  "select[name='country']", "select[name='billing_country']", "select[name='billingCountry']",
  "select[id='country']", "select[id*='country']",
  "select[aria-label*='Country']", "select[aria-label*='country']",
  "input[autocomplete='country']", "input[autocomplete='country-name']", "input[name='country']",
];

export const STATE_SELECTORS = [
  "select[autocomplete='address-level1']",
  "select[name='state']", "select[name='province']", "select[name='region']",
  "select[name='billing_state']",
  "select[id='state']", "select[id*='state']", "select[id*='province']",
  "select[aria-label*='State']", "select[aria-label*='state']",
  "select[aria-label*='Province']",
  "input[autocomplete='address-level1']", "input[name='state']", "input[name='province']",
];

export const CITY_SELECTORS = [
  "input[autocomplete='address-level2']",
  "input[name='city']", "input[name='town']", "input[name='billing_city']",
  "input[id='city']", "input[id*='city']",
  "input[placeholder*='City']", "input[placeholder*='city']",
  "input[aria-label*='City']",
  "select[autocomplete='address-level2']", "select[name='city']",
];

// ---------------------------------------------------------------------------
// Known vendor domains (shared with guardrails)
// ---------------------------------------------------------------------------
const KNOWN_VENDOR_DOMAINS: Record<string, string[]> = {
  aws: ["amazonaws.com", "aws.amazon.com"],
  amazon: ["amazon.com", "amazon.co.uk", "amazon.co.jp"],
  github: ["github.com"],
  cloudflare: ["cloudflare.com"],
  openai: ["openai.com", "platform.openai.com"],
  stripe: ["stripe.com", "dashboard.stripe.com"],
  anthropic: ["anthropic.com", "claude.ai"],
  google: ["google.com", "cloud.google.com", "console.cloud.google.com"],
  microsoft: ["microsoft.com", "azure.microsoft.com", "portal.azure.com"],
  wikipedia: ["wikipedia.org", "wikimedia.org", "donate.wikimedia.org"],
  digitalocean: ["digitalocean.com", "cloud.digitalocean.com"],
  heroku: ["heroku.com", "dashboard.heroku.com"],
  vercel: ["vercel.com", "app.vercel.com"],
  netlify: ["netlify.com", "app.netlify.com"],
};

// ---------------------------------------------------------------------------
// SSRF guard
// ---------------------------------------------------------------------------
export function ssrfValidateUrl(url: string): string | null {
  try {
    const parsed = new URL(url);
    if (!["http:", "https:"].includes(parsed.protocol)) {
      return "Only http/https URLs are allowed.";
    }
    // Block private/reserved IPs
    const hostname = parsed.hostname;
    if (
      hostname === "localhost" ||
      hostname === "127.0.0.1" ||
      hostname === "0.0.0.0" ||
      hostname.startsWith("10.") ||
      hostname.startsWith("192.168.") ||
      /^172\.(1[6-9]|2\d|3[01])\./.test(hostname) ||
      hostname === "[::1]" ||
      hostname.endsWith(".local")
    ) {
      // Allow localhost only for CDP URLs (checked separately)
      return "Private/reserved IP addresses are not allowed.";
    }
  } catch {
    return "Invalid URL.";
  }
  return null;
}

// ---------------------------------------------------------------------------
// CDP protocol types (minimal subset we need)
// ---------------------------------------------------------------------------
interface CDPSession {
  send(method: string, params?: Record<string, unknown>): Promise<any>;
  on(event: string, handler: (params: any) => void): void;
  detach(): Promise<void>;
}

interface CDPFrameTree {
  frame: { id: string; url: string; securityOrigin: string; name?: string };
  childFrames?: CDPFrameTree[];
}

interface CDPTarget {
  targetId: string;
  type: string;
  title: string;
  url: string;
  webSocketDebuggerUrl?: string;
}

interface SelectOption {
  value: string;
  text: string;
}

export interface InjectionResult {
  cardFilled: boolean;
  billingFilled: boolean;
  blockedReason: string;
  billingDetails?: { filled: string[]; failed: string[]; skipped: string[] };
}

export interface BillingInfo {
  firstName: string;
  lastName: string;
  street: string;
  city: string;
  state: string;
  country: string;
  zip: string;
  email: string;
  phone: string;
  phoneCountryCode: string;
}

export interface PageSnapshot {
  url: string;
  title: string;
  html: string;
  frames: { url: string; html: string }[];
}

// ---------------------------------------------------------------------------
// TOCTOU domain verification (shared between payment + billing injection)
// ---------------------------------------------------------------------------
export function verifyDomainToctou(
  pageUrl: string,
  approvedVendor: string
): string | null {
  if (!pageUrl || !approvedVendor) return null;

  let actualDomain: string;
  try {
    actualDomain = new URL(pageUrl).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return "invalid_url";
  }

  const vendorLower = approvedVendor.toLowerCase();
  const vendorTokens = new Set(
    vendorLower.split(/[\s\-_./]+/).filter(Boolean)
  );

  let domainOk = false;
  let vendorIsKnown = false;

  // Check against KNOWN_VENDOR_DOMAINS using strict suffix matching
  for (const [knownVendor, knownDomains] of Object.entries(KNOWN_VENDOR_DOMAINS)) {
    if (vendorTokens.has(knownVendor) || knownVendor === vendorLower) {
      vendorIsKnown = true;
      if (knownDomains.some((d) => actualDomain === d || actualDomain.endsWith("." + d))) {
        domainOk = true;
      }
      break;
    }
  }

  // Fallback for unknown vendors
  if (!domainOk && !vendorIsKnown) {
    const commonTlds = new Set(["com", "org", "net", "io", "co", "uk", "jp", "de", "fr"]);
    const domainLabels = new Set(
      actualDomain.split(".").filter((l) => !commonTlds.has(l))
    );
    domainOk =
      [...vendorTokens].some((tok) => domainLabels.has(tok)) ||
      [...vendorTokens].some(
        (tok) =>
          tok.length >= 4 &&
          [...domainLabels].some((label) => label.includes(tok))
      );
  }

  // Payment processor passthrough
  if (!domainOk) {
    let userProcessors: string[] = [];
    try {
      userProcessors = JSON.parse(
        process.env.POP_ALLOWED_PAYMENT_PROCESSORS ?? "[]"
      );
    } catch {}
    const allProcessors = new Set([...KNOWN_PAYMENT_PROCESSORS, ...userProcessors]);
    if ([...allProcessors].some((p) => actualDomain === p || actualDomain.endsWith("." + p))) {
      domainOk = true;
    }
  }

  if (!domainOk) {
    return `domain_mismatch:${actualDomain}`;
  }
  return null;
}

// ---------------------------------------------------------------------------
// CDP connection helper using raw WebSocket
// ---------------------------------------------------------------------------
async function fetchJSON(url: string): Promise<any> {
  const resp = await fetch(url, { signal: AbortSignal.timeout(5000) });
  return resp.json();
}

// Minimal WebSocket-based CDP client
class CDPClient {
  private ws!: import("node:net").Socket | any;
  private msgId = 0;
  private pending = new Map<number, { resolve: (v: any) => void; reject: (e: Error) => void }>();
  private eventHandlers = new Map<string, ((params: any) => void)[]>();

  static async connect(wsUrl: string): Promise<CDPClient> {
    const client = new CDPClient();
    const { WebSocket } = await import("ws" as string).catch(() => {
      // Fallback: use global WebSocket if available (Node 21+)
      return { WebSocket: globalThis.WebSocket };
    });
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(wsUrl);
      client.ws = ws;
      ws.onopen = () => resolve(client);
      ws.onerror = (e: any) => reject(new Error(`CDP WebSocket error: ${e.message ?? e}`));
      ws.onmessage = (event: any) => {
        const data = typeof event.data === "string" ? event.data : event.data.toString();
        const msg = JSON.parse(data);
        if (msg.id !== undefined) {
          const p = client.pending.get(msg.id);
          if (p) {
            client.pending.delete(msg.id);
            if (msg.error) p.reject(new Error(msg.error.message));
            else p.resolve(msg.result);
          }
        } else if (msg.method) {
          const handlers = client.eventHandlers.get(msg.method);
          if (handlers) handlers.forEach((h) => h(msg.params));
        }
      };
      ws.onclose = () => {
        for (const p of client.pending.values()) {
          p.reject(new Error("CDP connection closed"));
        }
        client.pending.clear();
      };
    });
  }

  async send(method: string, params: Record<string, unknown> = {}): Promise<any> {
    const id = ++this.msgId;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      const msg = JSON.stringify({ id, method, params });
      this.ws.send(msg);
    });
  }

  on(event: string, handler: (params: any) => void): void {
    const handlers = this.eventHandlers.get(event) ?? [];
    handlers.push(handler);
    this.eventHandlers.set(event, handlers);
  }

  close(): void {
    try { this.ws.close(); } catch {}
  }
}

// ---------------------------------------------------------------------------
// PopBrowserInjector
// ---------------------------------------------------------------------------
export class PopBrowserInjector {
  private cdpUrl: string;
  private headless: boolean;

  constructor(cdpUrl: string = "http://localhost:9222", headless: boolean = false) {
    this.cdpUrl = cdpUrl;
    this.headless = headless;
  }

  // ------------------------------------------------------------------
  // Public API: inject payment info (card + billing)
  // ------------------------------------------------------------------
  async injectPaymentInfo(opts: {
    sealId: string;
    cardNumber: string;
    cvv: string;
    expirationDate: string;
    pageUrl?: string;
    approvedVendor?: string;
  }): Promise<InjectionResult> {
    const result: InjectionResult = {
      cardFilled: false,
      billingFilled: false,
      blockedReason: "",
    };

    // TOCTOU guard
    const blocked = verifyDomainToctou(opts.pageUrl ?? "", opts.approvedVendor ?? "");
    if (blocked) {
      result.blockedReason = blocked;
      return result;
    }

    const billingInfo = this.loadBillingInfo();
    const hasBilling = Object.values(billingInfo).some((v) => v !== "");

    let client: CDPClient | null = null;
    try {
      const target = await this.findBestTarget(opts.pageUrl);
      if (!target?.webSocketDebuggerUrl) {
        result.blockedReason = "no_target_found";
        return result;
      }

      client = await CDPClient.connect(target.webSocketDebuggerUrl);

      // Enable DOM + Runtime
      await client.send("Runtime.enable");
      await client.send("DOM.enable");
      await client.send("Page.enable");

      // Blackout mode
      const blackoutMode = (process.env.POP_BLACKOUT_MODE ?? "after").toLowerCase();
      if (blackoutMode === "before") {
        await this.enableBlackout(client);
      }

      // Fill card fields across all frames (including iframes + shadow DOM)
      result.cardFilled = await this.fillCardAcrossFrames(
        client,
        opts.cardNumber,
        opts.expirationDate,
        opts.cvv
      );

      // Fill billing fields
      if (hasBilling) {
        const billingResult = await this.fillBillingFields(client, billingInfo);
        result.billingFilled = billingResult.filled.length > 0;
        result.billingDetails = billingResult;
      }

      if (blackoutMode === "after") {
        await this.enableBlackout(client);
      }

      return result;
    } catch (err: any) {
      process.stderr.write(`PopBrowserInjector error: ${err.message}\n`);
      return result;
    } finally {
      client?.close();
    }
  }

  // ------------------------------------------------------------------
  // Public API: inject billing info only (no card)
  // ------------------------------------------------------------------
  async injectBillingOnly(opts: {
    pageUrl?: string;
    approvedVendor?: string;
  }): Promise<InjectionResult> {
    const result: InjectionResult = {
      cardFilled: false,
      billingFilled: false,
      blockedReason: "",
    };

    const blocked = verifyDomainToctou(opts.pageUrl ?? "", opts.approvedVendor ?? "");
    if (blocked) {
      result.blockedReason = blocked;
      return result;
    }

    const billingInfo = this.loadBillingInfo();
    let client: CDPClient | null = null;
    try {
      const target = await this.findBestTarget(opts.pageUrl);
      if (!target?.webSocketDebuggerUrl) {
        result.blockedReason = "no_target_found";
        return result;
      }

      client = await CDPClient.connect(target.webSocketDebuggerUrl);
      await client.send("Runtime.enable");
      await client.send("DOM.enable");

      const billingResult = await this.fillBillingFields(client, billingInfo);
      result.billingFilled = billingResult.filled.length > 0;
      result.billingDetails = billingResult;

      return result;
    } catch (err: any) {
      process.stderr.write(`PopBrowserInjector billing error: ${err.message}\n`);
      return result;
    } finally {
      client?.close();
    }
  }

  // ------------------------------------------------------------------
  // Public API: page snapshot
  // ------------------------------------------------------------------
  async pageSnapshot(pageUrl?: string): Promise<PageSnapshot | null> {
    let client: CDPClient | null = null;
    try {
      const target = await this.findBestTarget(pageUrl);
      if (!target?.webSocketDebuggerUrl) return null;

      client = await CDPClient.connect(target.webSocketDebuggerUrl);
      await client.send("Runtime.enable");
      await client.send("DOM.enable");
      await client.send("Page.enable");

      // Get main frame info
      const { result: titleResult } = await client.send("Runtime.evaluate", {
        expression: "document.title",
      });
      const { result: urlResult } = await client.send("Runtime.evaluate", {
        expression: "window.location.href",
      });
      const { result: htmlResult } = await client.send("Runtime.evaluate", {
        expression: "document.documentElement.outerHTML",
      });

      // Get frame tree for iframe content
      const { frameTree } = await client.send("Page.getFrameTree");
      const frames: { url: string; html: string }[] = [];

      const collectFrames = async (tree: CDPFrameTree) => {
        if (tree.childFrames) {
          for (const child of tree.childFrames) {
            try {
              const { result: frameHtml } = await client!.send("Runtime.evaluate", {
                expression: "document.documentElement.outerHTML",
                contextId: undefined, // Would need execution context for each frame
              });
              frames.push({ url: child.frame.url, html: frameHtml?.value ?? "" });
            } catch {}
            await collectFrames(child);
          }
        }
      };
      await collectFrames(frameTree);

      return {
        url: urlResult?.value ?? target.url,
        title: titleResult?.value ?? target.title,
        html: htmlResult?.value ?? "",
        frames,
      };
    } catch (err: any) {
      process.stderr.write(`PopBrowserInjector snapshot error: ${err.message}\n`);
      return null;
    } finally {
      client?.close();
    }
  }

  // ------------------------------------------------------------------
  // Internal: find the best CDP target (prefer checkout pages)
  // ------------------------------------------------------------------
  private async findBestTarget(pageUrl?: string): Promise<CDPTarget | null> {
    let targets: CDPTarget[];
    try {
      targets = await fetchJSON(`${this.cdpUrl}/json/list`);
    } catch {
      return null;
    }

    const pageTargets = targets.filter((t) => t.type === "page");
    if (pageTargets.length === 0) return null;

    const checkoutKeywords = [
      "checkout", "payment", "donate", "pay", "purchase", "order", "gateway", "cart",
    ];

    // Prefer pages whose URL looks like a checkout/payment page
    for (const t of pageTargets) {
      const urlLower = t.url.toLowerCase();
      if (checkoutKeywords.some((kw) => urlLower.includes(kw))) {
        return t;
      }
    }

    // If pageUrl is provided, try to find a matching target
    if (pageUrl) {
      for (const t of pageTargets) {
        if (t.url === pageUrl) return t;
      }
    }

    // Fallback: last target
    return pageTargets[pageTargets.length - 1];
  }

  // ------------------------------------------------------------------
  // Internal: fill card fields across all frames (iframes + shadow DOM)
  // ------------------------------------------------------------------
  private async fillCardAcrossFrames(
    client: CDPClient,
    cardNumber: string,
    expiry: string,
    cvv: string
  ): Promise<boolean> {
    let cardFilled = false;

    // Get frame tree
    const { frameTree } = await client.send("Page.getFrameTree");

    // Process main frame
    const mainFilled = await this.fillCardInContext(client, undefined, cardNumber, expiry, cvv);
    if (mainFilled) cardFilled = true;

    // Process child frames (iframes)
    const processFrame = async (tree: CDPFrameTree) => {
      if (tree.childFrames) {
        for (const child of tree.childFrames) {
          try {
            // Create isolated world for cross-origin iframe access
            const { executionContextId } = await client.send(
              "Page.createIsolatedWorld",
              { frameId: child.frame.id, worldName: "pop-pay-injector" }
            );
            const filled = await this.fillCardInContext(
              client,
              executionContextId,
              cardNumber,
              expiry,
              cvv
            );
            if (filled) cardFilled = true;
          } catch {
            // Cross-origin frame access may fail — continue
          }
          await processFrame(child);
        }
      }
    };
    await processFrame(frameTree);

    // Shadow DOM piercing: search for shadow roots in main frame
    const shadowFilled = await this.fillCardInShadowDom(client, cardNumber, expiry, cvv);
    if (shadowFilled) cardFilled = true;

    return cardFilled;
  }

  // ------------------------------------------------------------------
  // Internal: fill card fields in a single execution context
  // ------------------------------------------------------------------
  private async fillCardInContext(
    client: CDPClient,
    contextId: number | undefined,
    cardNumber: string,
    expiry: string,
    cvv: string
  ): Promise<boolean> {
    const evalOpts: Record<string, unknown> = contextId !== undefined
      ? { contextId }
      : {};

    // Try to fill card number
    const cardSelector = CARD_NUMBER_SELECTORS.join(", ");
    const cardFilled = await this.fillInputViaEval(client, evalOpts, cardSelector, cardNumber);
    if (!cardFilled) return false;

    // Fill expiry
    const expirySelector = EXPIRY_SELECTORS.join(", ");
    await this.fillInputViaEval(client, evalOpts, expirySelector, expiry);

    // Fill CVV
    const cvvSelector = CVV_SELECTORS.join(", ");
    await this.fillInputViaEval(client, evalOpts, cvvSelector, cvv);

    return true;
  }

  // ------------------------------------------------------------------
  // Internal: Shadow DOM piercing support (new feature!)
  // ------------------------------------------------------------------
  private async fillCardInShadowDom(
    client: CDPClient,
    cardNumber: string,
    expiry: string,
    cvv: string
  ): Promise<boolean> {
    try {
      const { result } = await client.send("Runtime.evaluate", {
        expression: `
          (function() {
            function queryShadowAll(root, selectors) {
              const results = [];
              const selectorList = selectors.split(', ');
              for (const sel of selectorList) {
                const found = root.querySelector(sel);
                if (found) results.push(found);
              }
              // Recurse into shadow roots
              const allElements = root.querySelectorAll('*');
              for (const el of allElements) {
                if (el.shadowRoot) {
                  results.push(...queryShadowAll(el.shadowRoot, selectors));
                }
              }
              return results;
            }

            const cardSelectors = ${JSON.stringify(CARD_NUMBER_SELECTORS.join(", "))};
            const cardFields = queryShadowAll(document, cardSelectors);
            return cardFields.length > 0;
          })()
        `,
        returnByValue: true,
      });

      if (!result?.value) return false;

      // Found shadow DOM card fields — fill them
      const { result: fillResult } = await client.send("Runtime.evaluate", {
        expression: `
          (function() {
            function queryShadowFirst(root, selectors) {
              const selectorList = selectors.split(', ');
              for (const sel of selectorList) {
                const found = root.querySelector(sel);
                if (found) return found;
              }
              const allElements = root.querySelectorAll('*');
              for (const el of allElements) {
                if (el.shadowRoot) {
                  const found = queryShadowFirst(el.shadowRoot, selectors);
                  if (found) return found;
                }
              }
              return null;
            }

            function fillField(root, selectors, value) {
              const el = queryShadowFirst(root, selectors);
              if (!el) return false;
              const nativeSetter = Object.getOwnPropertyDescriptor(
                HTMLInputElement.prototype, 'value'
              ).set;
              nativeSetter.call(el, value);
              el.dispatchEvent(new Event('input', { bubbles: true }));
              el.dispatchEvent(new Event('change', { bubbles: true }));
              el.dispatchEvent(new Event('blur', { bubbles: true }));
              return true;
            }

            const cardFilled = fillField(
              document,
              ${JSON.stringify(CARD_NUMBER_SELECTORS.join(", "))},
              ${JSON.stringify(cardNumber)}
            );
            if (cardFilled) {
              fillField(document, ${JSON.stringify(EXPIRY_SELECTORS.join(", "))}, ${JSON.stringify(expiry)});
              fillField(document, ${JSON.stringify(CVV_SELECTORS.join(", "))}, ${JSON.stringify(cvv)});
            }
            return cardFilled;
          })()
        `,
        returnByValue: true,
      });

      return fillResult?.value === true;
    } catch {
      return false;
    }
  }

  // ------------------------------------------------------------------
  // Internal: fill a single input field via Runtime.evaluate
  // ------------------------------------------------------------------
  private async fillInputViaEval(
    client: CDPClient,
    evalOpts: Record<string, unknown>,
    selector: string,
    value: string
  ): Promise<boolean> {
    try {
      const { result } = await client.send("Runtime.evaluate", {
        expression: `
          (function() {
            const el = document.querySelector(${JSON.stringify(selector)});
            if (!el) return false;
            // Use native setter to bypass framework interception
            const proto = el.tagName === 'SELECT'
              ? HTMLSelectElement.prototype
              : HTMLInputElement.prototype;
            const nativeSetter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
            if (nativeSetter) {
              nativeSetter.call(el, ${JSON.stringify(value)});
            } else {
              el.value = ${JSON.stringify(value)};
            }
            el.dispatchEvent(new Event('input', { bubbles: true }));
            el.dispatchEvent(new Event('change', { bubbles: true }));
            el.dispatchEvent(new FocusEvent('blur', { bubbles: true }));
            return true;
          })()
        `,
        returnByValue: true,
        ...evalOpts,
      });
      return result?.value === true;
    } catch {
      return false;
    }
  }

  // ------------------------------------------------------------------
  // Internal: select an option from a <select> dropdown
  // ------------------------------------------------------------------
  private async selectOption(
    client: CDPClient,
    evalOpts: Record<string, unknown>,
    selector: string,
    value: string
  ): Promise<boolean> {
    try {
      const { result } = await client.send("Runtime.evaluate", {
        expression: `
          (function() {
            const el = document.querySelector(${JSON.stringify(selector)});
            if (!el || el.tagName !== 'SELECT') return false;

            const options = Array.from(el.options).map(o => ({
              value: o.value, text: o.text.trim()
            }));
            const valueLower = ${JSON.stringify(value.toLowerCase())};

            let matchedValue = null;
            // Exact value match
            for (const opt of options) {
              if (opt.value.toLowerCase() === valueLower) { matchedValue = opt.value; break; }
            }
            // Exact text match
            if (!matchedValue) {
              for (const opt of options) {
                if (opt.text.toLowerCase() === valueLower) { matchedValue = opt.value; break; }
              }
            }
            // Partial match
            if (!matchedValue) {
              for (const opt of options) {
                const optText = opt.text.toLowerCase();
                const optVal = opt.value.toLowerCase();
                if ((valueLower.includes(optText) || optText.includes(valueLower) ||
                     valueLower.includes(optVal) || optVal.includes(valueLower)) && opt.value) {
                  matchedValue = opt.value; break;
                }
              }
            }
            if (!matchedValue) return false;

            // Native setter trick for React/Angular/Vue/Zoho
            const nativeSetter = Object.getOwnPropertyDescriptor(
              HTMLSelectElement.prototype, 'value'
            ).set;
            nativeSetter.call(el, matchedValue);

            el.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
            el.dispatchEvent(new FocusEvent('focus', { bubbles: false }));
            el.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
            el.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
            el.dispatchEvent(new MouseEvent('click', { bubbles: true }));
            el.dispatchEvent(new Event('input', { bubbles: true }));
            el.dispatchEvent(new Event('change', { bubbles: true }));
            el.dispatchEvent(new FocusEvent('blur', { bubbles: false }));
            el.dispatchEvent(new FocusEvent('focusout', { bubbles: true }));

            return el.value === matchedValue;
          })()
        `,
        returnByValue: true,
        ...evalOpts,
      });
      return result?.value === true;
    } catch {
      return false;
    }
  }

  // ------------------------------------------------------------------
  // Internal: fill a billing field (input or select)
  // ------------------------------------------------------------------
  private async fillBillingField(
    client: CDPClient,
    selectors: string[],
    value: string,
    fieldName: string
  ): Promise<boolean> {
    if (!value) return false;

    // Detect if first matching element is a <select> or <input>
    const allSelector = selectors.join(", ");
    try {
      const { result } = await client.send("Runtime.evaluate", {
        expression: `
          (function() {
            const el = document.querySelector(${JSON.stringify(allSelector)});
            if (!el) return null;
            return el.tagName.toLowerCase();
          })()
        `,
        returnByValue: true,
      });

      if (!result?.value) return false;

      if (result.value === "select") {
        return await this.selectOption(client, {}, allSelector, value);
      } else {
        return await this.fillInputViaEval(client, {}, allSelector, value);
      }
    } catch {
      return false;
    }
  }

  // ------------------------------------------------------------------
  // Internal: fill all billing fields
  // ------------------------------------------------------------------
  private async fillBillingFields(
    client: CDPClient,
    info: BillingInfo
  ): Promise<{ filled: string[]; failed: string[]; skipped: string[] }> {
    const filled: string[] = [];
    const failed: string[] = [];
    const skipped: string[] = [];

    // Auto-expand US state abbreviations
    const state =
      info.state.length === 2
        ? US_STATE_CODES[info.state.toUpperCase()] ?? info.state
        : info.state;

    const tryFill = async (
      selectors: string[],
      value: string,
      name: string
    ) => {
      if (!value) {
        skipped.push(name);
        return;
      }
      const ok = await this.fillBillingField(client, selectors, value, name);
      if (ok) filled.push(name);
      else failed.push(`${name} (value='${value}')`);
    };

    await tryFill(FIRST_NAME_SELECTORS, info.firstName, "first_name");
    await tryFill(LAST_NAME_SELECTORS, info.lastName, "last_name");

    // Full name fallback
    if (info.firstName || info.lastName) {
      const fullName = [info.firstName, info.lastName].filter(Boolean).join(" ");
      await tryFill(FULL_NAME_SELECTORS, fullName, "full_name");
    }

    await tryFill(STREET_SELECTORS, info.street, "street");
    await tryFill(CITY_SELECTORS, info.city, "city");
    await tryFill(STATE_SELECTORS, state, "state");
    await tryFill(COUNTRY_SELECTORS, info.country, "country");
    await tryFill(ZIP_SELECTORS, info.zip, "zip");
    await tryFill(EMAIL_SELECTORS, info.email, "email");

    // Phone: country code dropdown first, then number
    let ccFilled = false;
    if (info.phoneCountryCode) {
      ccFilled = await this.fillBillingField(
        client,
        PHONE_COUNTRY_CODE_SELECTORS,
        info.phoneCountryCode,
        "phone_country_code"
      );
      if (ccFilled) filled.push("phone_country_code");
    }
    const phoneValue = ccFilled
      ? nationalNumber(info.phone, info.phoneCountryCode)
      : info.phone;
    await tryFill(PHONE_SELECTORS, phoneValue, "phone");

    return { filled, failed, skipped };
  }

  // ------------------------------------------------------------------
  // Internal: load billing info from env vars
  // ------------------------------------------------------------------
  private loadBillingInfo(): BillingInfo {
    return {
      firstName: (process.env.POP_BILLING_FIRST_NAME ?? "").trim(),
      lastName: (process.env.POP_BILLING_LAST_NAME ?? "").trim(),
      street: (process.env.POP_BILLING_STREET ?? "").trim(),
      city: (process.env.POP_BILLING_CITY ?? "").trim(),
      state: (process.env.POP_BILLING_STATE ?? "").trim(),
      country: (process.env.POP_BILLING_COUNTRY ?? "").trim(),
      zip: (process.env.POP_BILLING_ZIP ?? "").trim(),
      email: (process.env.POP_BILLING_EMAIL ?? "").trim(),
      phone: (process.env.POP_BILLING_PHONE ?? "").trim(),
      phoneCountryCode: (process.env.POP_BILLING_PHONE_COUNTRY_CODE ?? "").trim(),
    };
  }

  // ------------------------------------------------------------------
  // Internal: blackout mode (mask card fields)
  // ------------------------------------------------------------------
  private async enableBlackout(client: CDPClient): Promise<void> {
    try {
      await client.send("Runtime.evaluate", {
        expression: `
          (function() {
            // Inject into main frame
            function addBlackout(doc) {
              if (doc.getElementById('pop-pay-blackout')) return;
              const style = doc.createElement('style');
              style.id = 'pop-pay-blackout';
              style.textContent = \`
                input[autocomplete*="cc-"],
                input[name*="card"], input[name*="Card"],
                input[name*="expir"], input[name*="cvc"], input[name*="cvv"],
                input[data-elements-stable-field-name],
                input.__PrivateStripeElement,
                input[name="cardnumber"], input[name="cc-exp"],
                input[name="security_code"], input[name="card_number"],
                input[name="card_expiry"], input[name="card_cvc"] {
                  -webkit-text-security: disc !important;
                  color: transparent !important;
                  text-shadow: 0 0 8px rgba(0,0,0,0.5) !important;
                }
              \`;
              doc.head.appendChild(style);
            }
            addBlackout(document);

            // Try iframes (same-origin only)
            try {
              const iframes = document.querySelectorAll('iframe');
              for (const iframe of iframes) {
                try {
                  if (iframe.contentDocument) {
                    addBlackout(iframe.contentDocument);
                  }
                } catch {}
              }
            } catch {}
          })()
        `,
      });
    } catch {}
  }

  // ------------------------------------------------------------------
  // Masked card display helper
  // ------------------------------------------------------------------
  static maskedCard(cardNumber: string): string {
    const last4 = cardNumber.slice(-4);
    return `****-****-****-${last4}`;
  }
}
