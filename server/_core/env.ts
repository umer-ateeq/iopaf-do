export const ENV = {
  appId: process.env.VITE_APP_ID ?? "",
  cookieSecret: process.env.JWT_SECRET ?? "",
  databaseUrl: process.env.DATABASE_URL ?? "",
  oAuthServerUrl: process.env.OAUTH_SERVER_URL ?? "",
  ownerOpenId: process.env.OWNER_OPEN_ID ?? "",
  isProduction: process.env.NODE_ENV === "production",
  forgeApiUrl: process.env.BUILT_IN_FORGE_API_URL ?? "",
  forgeApiKey: process.env.BUILT_IN_FORGE_API_KEY ?? "",
  // The AI Copilot talks to one OpenAI-compatible account on behalf of every
  // signed-in user. The key is server-only: it is never sent to the browser,
  // stored in the database or written into the assessment file.
  openaiApiKey: process.env.OPENAI_API_KEY ?? "",
  openaiBaseUrl: process.env.OPENAI_BASE_URL ?? "https://api.openai.com/v1",
  /** Fallback when a user has no saved model. Must exist in the account's catalogue. */
  copilotDefaultModel: process.env.COPILOT_DEFAULT_MODEL ?? "gpt-5-mini",
  // Supabase Auth replaces the Manus OAuth service. The publishable
  // (anon) key is safe to hold server-side; it only identifies the project.
  supabaseUrl: process.env.SUPABASE_URL ?? "",
  supabaseKey: process.env.SUPABASE_PUBLISHABLE_KEY ?? "",
};
