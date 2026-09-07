import express from "express";
import request from "supertest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { COOKIE_NAME } from "@shared/const";

const { verifyMock, createSessionTokenMock } = vi.hoisted(() => ({
  verifyMock: vi.fn(),
  createSessionTokenMock: vi.fn(),
}));

vi.mock("./_core/supabaseAuth", () => ({
  verifyAndRecordUser: verifyMock,
  isSupabaseConfigured: () => true,
}));
vi.mock("./_core/sdk", () => ({ sdk: { createSessionToken: createSessionTokenMock } }));

import { registerAuthRoutes } from "./authRoutes";

function appWithRoutes() {
  const app = express();
  app.use(express.json());
  registerAuthRoutes(app);
  return app;
}

beforeEach(() => {
  verifyMock.mockReset();
  createSessionTokenMock.mockReset().mockResolvedValue("signed.session.jwt");
});

afterEach(() => vi.clearAllMocks());

describe("POST /api/auth/session", () => {
  it("rejects a request carrying no token", async () => {
    const res = await request(appWithRoutes()).post("/api/auth/session").send({});
    expect(res.status).toBe(400);
    expect(verifyMock).not.toHaveBeenCalled();
  });

  it("rejects a token Supabase does not recognise", async () => {
    verifyMock.mockResolvedValue(null);
    const res = await request(appWithRoutes())
      .post("/api/auth/session")
      .set("Authorization", "Bearer bad-token")
      .send({});
    expect(res.status).toBe(401);
  });

  it("records the user and sets an HttpOnly session cookie on success", async () => {
    verifyMock.mockResolvedValue({ recorded: true, identity: {
      openId: "uuid-9",
      email: "a@b.com",
      name: "Ada",
      loginMethod: "email",
    } });

    const res = await request(appWithRoutes())
      .post("/api/auth/session")
      .set("Authorization", "Bearer good-token")
      .send({});

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ success: true, openId: "uuid-9" });

    expect(createSessionTokenMock).toHaveBeenCalledWith(
      "uuid-9",
      expect.objectContaining({ name: "Ada" })
    );

    const cookie = res.headers["set-cookie"]?.[0] ?? "";
    expect(cookie).toContain(`${COOKIE_NAME}=signed.session.jwt`);
    // The engine is a static asset and cannot attach a header, so the cookie
    // must be HttpOnly and readable by the server on every /app.html request.
    expect(cookie.toLowerCase()).toContain("httponly");
  });

  it("accepts the token in the JSON body as well as the Authorization header", async () => {
    verifyMock.mockResolvedValue({ recorded: true, identity: { openId: "uuid-10", email: null, name: null, loginMethod: "email" } });
    const res = await request(appWithRoutes())
      .post("/api/auth/session")
      .send({ accessToken: "body-token" });
    expect(res.status).toBe(200);
    expect(verifyMock).toHaveBeenCalledWith("body-token");
  });

});

describe("session display name", () => {
  it("falls back to email, then to the opaque id, so the claim is never empty", async () => {
    verifyMock.mockResolvedValue({ recorded: true, identity: {
      openId: "uuid-12", email: "only@email.com", name: null, loginMethod: "email",
    } });
    await request(appWithRoutes())
      .post("/api/auth/session").set("Authorization", "Bearer t").send({});
    expect(createSessionTokenMock).toHaveBeenCalledWith(
      "uuid-12", expect.objectContaining({ name: "only@email.com" })
    );

    createSessionTokenMock.mockClear();
    verifyMock.mockResolvedValue({ recorded: true, identity: {
      openId: "uuid-13", email: null, name: null, loginMethod: "email",
    } });
    await request(appWithRoutes())
      .post("/api/auth/session").set("Authorization", "Bearer t").send({});
    expect(createSessionTokenMock).toHaveBeenCalledWith(
      "uuid-13", expect.objectContaining({ name: "uuid-13" })
    );
  });
});
