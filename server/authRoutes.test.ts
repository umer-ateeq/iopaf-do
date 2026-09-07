import express from "express";
import request from "supertest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { COOKIE_NAME } from "@shared/const";

const { verifyMock, upsertMock, createSessionTokenMock } = vi.hoisted(() => ({
  verifyMock: vi.fn(),
  upsertMock: vi.fn(),
  createSessionTokenMock: vi.fn(),
}));

vi.mock("./_core/supabaseAuth", () => ({
  verifySupabaseAccessToken: verifyMock,
  isSupabaseConfigured: () => true,
}));
vi.mock("./db", () => ({ upsertUser: upsertMock }));
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
  upsertMock.mockReset().mockResolvedValue(undefined);
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
    expect(upsertMock).not.toHaveBeenCalled();
  });

  it("records the user and sets an HttpOnly session cookie on success", async () => {
    verifyMock.mockResolvedValue({
      openId: "uuid-9",
      email: "a@b.com",
      name: "Ada",
      loginMethod: "email",
    });

    const res = await request(appWithRoutes())
      .post("/api/auth/session")
      .set("Authorization", "Bearer good-token")
      .send({});

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ success: true, openId: "uuid-9" });

    expect(upsertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        openId: "uuid-9",
        email: "a@b.com",
        name: "Ada",
        loginMethod: "email",
      })
    );
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
    verifyMock.mockResolvedValue({ openId: "uuid-10", email: null, name: null, loginMethod: "email" });
    const res = await request(appWithRoutes())
      .post("/api/auth/session")
      .send({ accessToken: "body-token" });
    expect(res.status).toBe(200);
    expect(verifyMock).toHaveBeenCalledWith("body-token");
  });

  it("does not set a cookie when recording the user fails", async () => {
    verifyMock.mockResolvedValue({ openId: "uuid-11", email: null, name: null, loginMethod: "email" });
    upsertMock.mockRejectedValue(new Error("database unavailable"));

    const res = await request(appWithRoutes())
      .post("/api/auth/session")
      .set("Authorization", "Bearer good-token")
      .send({});

    expect(res.status).toBe(500);
    expect(res.headers["set-cookie"]).toBeUndefined();
    expect(createSessionTokenMock).not.toHaveBeenCalled();
  });
});
