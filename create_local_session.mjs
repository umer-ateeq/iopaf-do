import { createHmac } from "node:crypto";

const encode = value => Buffer.from(JSON.stringify(value)).toString("base64url");
const secret = process.env.JWT_SECRET;
const appId = process.env.VITE_APP_ID;

if (!secret || !appId) {
  throw new Error("JWT_SECRET and VITE_APP_ID are required");
}

const header = encode({ alg: "HS256", typ: "JWT" });
const payload = encode({
  openId: "9XieKBGHj7ugpkA5JQGU9a",
  appId,
  name: "Shabir Ali",
  exp: Math.floor(Date.now() / 1000) + 300,
});
const signature = createHmac("sha256", secret)
  .update(`${header}.${payload}`)
  .digest("base64url");

process.stdout.write(`${header}.${payload}.${signature}`);
