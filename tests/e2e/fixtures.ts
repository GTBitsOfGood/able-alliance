/**
 * The harness: mint a session, open a browser or HTTP client as a persona,
 * and collect evidence that separates backend failures from frontend ones.
 *
 * Why minting works: the CAS callback (src/app/api/auth/cas/callback/route.ts)
 * finishes by calling next-auth's encode() and setting a cookie. There is no
 * server-side session store, so the same encode() call here yields a cookie
 * the app accepts. CAS is never involved.
 */
import {
  test as base,
  expect,
  type APIRequestContext,
  type BrowserContext,
  type Page,
} from "@playwright/test";
import { E2E } from "./env";
import { PERSONAS, type Persona, type PersonaKey } from "./seed";

export async function mintSessionToken(persona: Persona): Promise<string> {
  // next-auth is ESM-only and Playwright loads specs as CommonJS: dynamic import.
  const { encode } = await import("next-auth/jwt");
  return encode({
    token: {
      sub: persona.id,
      userId: persona.id,
      type: persona.type,
      email: persona.email,
      name: `${persona.firstName} ${persona.lastName}`,
      firstName: persona.firstName,
      lastName: persona.lastName,
    },
    secret: E2E.nextAuthSecret,
    salt: E2E.sessionCookieName,
    maxAge: 24 * 60 * 60,
  });
}

interface ApiFailure {
  method: string;
  url: string;
  status: number;
  body: string;
}

/** Evidence collector. Attach it to every page; read the verdict on failure. */
export class Diagnostics {
  apiFailures: ApiFailure[] = [];
  networkFailures: string[] = [];
  pageErrors: string[] = [];
  consoleErrors: string[] = [];

  watch(page: Page) {
    page.on("console", (m) => {
      if (m.type() === "error") this.consoleErrors.push(m.text());
    });
    page.on("pageerror", (e) => this.pageErrors.push(String(e)));
    page.on("requestfailed", (r) =>
      this.networkFailures.push(
        `${r.method()} ${r.url()} — ${r.failure()?.errorText ?? "failed"}`,
      ),
    );
    page.on("response", async (res) => {
      if (res.status() < 400 || !res.url().includes("/api/")) return;
      const body = await res.text().catch(() => "<unreadable>");
      this.apiFailures.push({
        method: res.request().method(),
        url: res.url(),
        status: res.status(),
        body: body.slice(0, 500),
      });
    });
  }

  verdict(): "backend" | "frontend" | "inconclusive" {
    if (this.apiFailures.length > 0) return "backend";
    if (this.networkFailures.some((f) => f.includes("/api/"))) return "backend";
    if (this.pageErrors.length > 0 || this.consoleErrors.length > 0)
      return "frontend";
    return "inconclusive";
  }

  summary(): string {
    const hint = {
      backend:
        "an /api call failed — run `npm run test:e2e:api` to confirm without the UI",
      frontend: "no API errors, but the page threw — rendering/state/selector",
      inconclusive:
        "no API or JS errors — check the assertion, timing, or seed data",
    }[this.verdict()];
    return [
      `VERDICT: ${this.verdict()} (${hint})`,
      `API failures: ${this.apiFailures.length}`,
      ...this.apiFailures.map(
        (f) => `  ${f.status} ${f.method} ${f.url}\n    ${f.body}`,
      ),
      `Network failures: ${this.networkFailures.length}`,
      ...this.networkFailures.map((f) => `  ${f}`),
      `Page errors: ${this.pageErrors.length}`,
      ...this.pageErrors.map((e) => `  ${e}`),
      `Console errors: ${this.consoleErrors.length}`,
      ...this.consoleErrors.map((e) => `  ${e}`),
    ].join("\n");
  }
}

interface Fixtures {
  /** HTTP client sending `persona`'s session cookie. No browser. */
  apiAs: (persona: PersonaKey) => Promise<APIRequestContext>;
  /** Fresh browser context + page logged in as `persona`. */
  pageAs: (persona: PersonaKey) => Promise<Page>;
  diag: Diagnostics;
}

export const test = base.extend<Fixtures>({
  diag: async ({}, provide, testInfo) => {
    const diag = new Diagnostics();
    await provide(diag);
    if (testInfo.status !== testInfo.expectedStatus) {
      await testInfo.attach("diagnostics", {
        body: diag.summary(),
        contentType: "text/plain",
      });
    }
  },

  apiAs: async ({ playwright }, provide) => {
    const open: APIRequestContext[] = [];
    await provide(async (key) => {
      const ctx = await playwright.request.newContext({
        baseURL: E2E.baseURL,
        extraHTTPHeaders: {
          cookie: `${E2E.sessionCookieName}=${await mintSessionToken(PERSONAS[key])}`,
        },
      });
      open.push(ctx);
      return ctx;
    });
    await Promise.all(open.map((c) => c.dispose()));
  },

  pageAs: async ({ browser, diag }, provide) => {
    const open: BrowserContext[] = [];
    await provide(async (key) => {
      const context = await browser.newContext({ baseURL: E2E.baseURL });
      await context.addCookies([
        {
          name: E2E.sessionCookieName,
          value: await mintSessionToken(PERSONAS[key]),
          url: E2E.baseURL,
          httpOnly: true,
          sameSite: "Lax",
        },
      ]);
      open.push(context);
      const page = await context.newPage();
      diag.watch(page);
      return page;
    });
    await Promise.all(open.map((c) => c.close()));
  },
});

export { expect };
