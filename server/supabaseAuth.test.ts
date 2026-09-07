import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// vi.mock is hoisted above const declarations, so the stub must be created
// inside vi.hoisted() for the factory to reach it.
const { ENV } = vi.hoisted(() => ({ ENV: { supabaseUrl: "", supabaseKey: "" } }));
vi.mock("./_core/env", () => ({ ENV }));

import { isSupabaseConfigured, verifySupabaseAccessToken } from "./_core/supabaseAuth";

const originalFetch = globalThis.fetch;

function fetchReturning(status: number, body: unknown) {
  return vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as Response);
}

beforeEach(() => {
  ENV.supabaseUrl = "https://project.supabase.co";
  ENV.supabaseKey = "sb_publishable_test";
});

afterEach(() => {
  globalThis.fetch = originalFetch;
  vi.restoreAllMocks();
});

describe("Supabase access-token verification", () => {
  it("reports unconfigured when the project URL or key is missing", async () => {
    ENV.supabaseUrl = "";
    expect(isSupabaseConfigured()).toBe(false);
    expect(await verifySupabaseAccessToken("anything")).toBeNull();
  });

  it("rejects an empty token without calling Supabase", async () => {
    const fetchSpy = fetchReturning(200, {});
    globalThis.fetch = fetchSpy as unknown as typeof fetch;

    expect(await verifySupabaseAccessToken("")).toBeNull();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("sends the bearer token and project key to /auth/v1/user", async () => {
    const fetchSpy = fetchReturning(200, {
      id: "uuid-1",
      email: "a@b.com",
      user_metadata: { full_name: "Ada" },
      app_metadata: { provider: "email" },
    });
    globalThis.fetch = fetchSpy as unknown as typeof fetch;

    const identity = await verifySupabaseAccessToken("token-abc");

    const [url, init] = fetchSpy.mock.calls[0];
    expect(url).toBe("https://project.supabase.co/auth/v1/user");
    expect((init as RequestInit).headers).toMatchObject({
      Authorization: "Bearer token-abc",
      apikey: "sb_publishable_test",
    });
    expect(identity).toEqual({
      openId: "uuid-1",
      email: "a@b.com",
      name: "Ada",
      loginMethod: "email",
    });
  });

  // Supabase answers an invalid token with 403, not 401; both must fail closed.
  it.each([401, 403, 500])("returns null when Supabase answers %i", async status => {
    globalThis.fetch = fetchReturning(status, { message: "bad" }) as unknown as typeof fetch;
    expect(await verifySupabaseAccessToken("token")).toBeNull();
  });

  it("returns null when Supabase responds 200 but omits a user id", async () => {
    globalThis.fetch = fetchReturning(200, { email: "a@b.com" }) as unknown as typeof fetch;
    expect(await verifySupabaseAccessToken("token")).toBeNull();
  });

  it("fails closed when the network call throws", async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new Error("ECONNRESET")) as unknown as typeof fetch;
    expect(await verifySupabaseAccessToken("token")).toBeNull();
  });

  it("falls back through full_name, name, then email for the display name", async () => {
    globalThis.fetch = fetchReturning(200, {
      id: "uuid-2",
      email: "fallback@b.com",
      user_metadata: { name: "Grace" },
      app_metadata: {},
    }) as unknown as typeof fetch;
    expect((await verifySupabaseAccessToken("t"))?.name).toBe("Grace");

    globalThis.fetch = fetchReturning(200, {
      id: "uuid-3",
      email: "only-email@b.com",
      user_metadata: {},
    }) as unknown as typeof fetch;
    const identity = await verifySupabaseAccessToken("t");
    expect(identity?.name).toBe("only-email@b.com");
    // No provider in app_metadata: default to email rather than null.
    expect(identity?.loginMethod).toBe("email");
  });
});
