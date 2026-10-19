interface D1Result<T = Record<string, unknown>> {
  results?: T[];
  success: boolean;
}

interface D1PreparedStatement {
  bind(...values: unknown[]): D1PreparedStatement;
  first<T = Record<string, unknown>>(): Promise<T | null>;
  run<T = Record<string, unknown>>(): Promise<D1Result<T>>;
}

interface D1Database {
  prepare(query: string): D1PreparedStatement;
}

interface Env {
  DB: D1Database;
  GEMINI_API_KEY: string;
  ADMIN_TOKEN: string;
  GEMINI_MODEL?: string;
}

interface LicenseRow {
  id: string;
  status: "active" | "revoked";
  credit_limit: number;
  used_credits: number;
  max_devices: number;
  expires_at: string | null;
}

interface AccessRow extends LicenseRow {
  device_id: string;
}

const JSON_HEADERS = {
  "content-type": "application/json; charset=utf-8",
  "cache-control": "no-store",
};

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    try {
      const url = new URL(request.url);
      if (request.method === "GET" && url.pathname === "/health") {
        return json({ ok: true, service: "manager-ai-gateway" });
      }
      if (request.method === "POST" && url.pathname === "/v1/activate") {
        return activate(request, env);
      }
      if (request.method === "GET" && url.pathname === "/v1/access") {
        return accessStatus(request, env);
      }
      if (request.method === "POST" && url.pathname === "/v1/generate") {
        return generate(request, env);
      }
      if (request.method === "POST" && url.pathname === "/v1/admin/licenses") {
        return createLicense(request, env);
      }
      if (request.method === "POST" && url.pathname === "/v1/admin/licenses/revoke") {
        return revokeLicense(request, env);
      }
      return json({ error: "Not found" }, 404);
    } catch (error) {
      console.error("gateway_error", error instanceof Error ? error.message : String(error));
      return json({ error: "The AI service could not complete this request." }, 500);
    }
  },
};

async function activate(request: Request, env: Env): Promise<Response> {
  const body = await readBody(request);
  const activationCode = stringField(body, "activationCode", 64).toUpperCase().replace(/\s+/g, "");
  const deviceId = stringField(body, "deviceId", 128);
  if (!activationCode || !deviceId) return json({ error: "Activation code and device ID are required." }, 400);

  const codeHash = await sha256(activationCode);
  const deviceHash = await sha256(deviceId);
  const license = await env.DB.prepare(
    "SELECT id, status, credit_limit, used_credits, max_devices, expires_at FROM licenses WHERE code_hash = ?",
  ).bind(codeHash).first<LicenseRow>();

  const invalid = validateLicense(license);
  if (invalid) return json({ error: invalid }, 403);

  const existing = await env.DB.prepare(
    "SELECT id FROM devices WHERE license_id = ? AND device_hash = ?",
  ).bind(license!.id, deviceHash).first<{ id: string }>();

  if (!existing) {
    const count = await env.DB.prepare(
      "SELECT COUNT(*) AS count FROM devices WHERE license_id = ?",
    ).bind(license!.id).first<{ count: number }>();
    if ((count?.count ?? 0) >= license!.max_devices) {
      return json({ error: "This activation has reached its device limit." }, 403);
    }
  }

  const accessToken = randomToken(32);
  const tokenHash = await sha256(accessToken);
  const now = new Date().toISOString();
  if (existing) {
    await env.DB.prepare(
      "UPDATE devices SET token_hash = ?, last_seen_at = ? WHERE id = ?",
    ).bind(tokenHash, now, existing.id).run();
  } else {
    await env.DB.prepare(
      "INSERT INTO devices (id, license_id, device_hash, token_hash, created_at, last_seen_at) VALUES (?, ?, ?, ?, ?, ?)",
    ).bind(crypto.randomUUID(), license!.id, deviceHash, tokenHash, now, now).run();
  }

  return json({
    accessToken,
    status: "active",
    creditLimit: license!.credit_limit,
    usedCredits: license!.used_credits,
    remainingCredits: Math.max(0, license!.credit_limit - license!.used_credits),
    expiresAt: license!.expires_at,
  });
}

async function accessStatus(request: Request, env: Env): Promise<Response> {
  const access = await authenticate(request, env);
  if (access instanceof Response) return access;
  await touchDevice(env, access.device_id);
  return json(accessPayload(access));
}

async function generate(request: Request, env: Env): Promise<Response> {
  const access = await authenticate(request, env);
  if (access instanceof Response) return access;

  const body = await readBody(request);
  const systemInstruction = stringField(body, "systemInstruction", 8_000);
  const input = stringField(body, "input", 24_000);
  if (!input.trim()) return json({ error: "A prompt is required." }, 400);

  const reservation = await env.DB.prepare(
    `UPDATE licenses
     SET used_credits = used_credits + 1
     WHERE id = ? AND status = 'active' AND used_credits < credit_limit
       AND (expires_at IS NULL OR expires_at > ?)
     RETURNING used_credits, credit_limit`,
  ).bind(access.id, new Date().toISOString()).first<{ used_credits: number; credit_limit: number }>();
  if (!reservation) return json({ error: "Your Manager AI credits have been used." }, 402);

  const model = env.GEMINI_MODEL || "gemini-3.5-flash";
  try {
    const upstream = await fetch("https://generativelanguage.googleapis.com/v1beta/interactions", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-goog-api-key": env.GEMINI_API_KEY,
      },
      body: JSON.stringify({
        model,
        system_instruction: systemInstruction,
        input,
        generation_config: {
          temperature: 0.7,
          max_output_tokens: 2048,
          thinking_level: "low",
        },
      }),
    });
    const raw = await upstream.text();
    if (!upstream.ok) {
      const message = googleError(raw) || `Gemini request failed (${upstream.status}).`;
      throw new Error(message);
    }
    const text = extractGeminiText(raw);
    const now = new Date().toISOString();
    await env.DB.prepare(
      "INSERT INTO usage_events (id, license_id, device_id, model, input_chars, output_chars, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
    ).bind(crypto.randomUUID(), access.id, access.device_id, model, input.length + systemInstruction.length, text.length, now).run();
    await touchDevice(env, access.device_id);
    return json({
      text,
      source: "manager",
      creditLimit: reservation.credit_limit,
      usedCredits: reservation.used_credits,
      remainingCredits: Math.max(0, reservation.credit_limit - reservation.used_credits),
    });
  } catch (error) {
    await env.DB.prepare(
      "UPDATE licenses SET used_credits = MAX(0, used_credits - 1) WHERE id = ?",
    ).bind(access.id).run();
    const message = error instanceof Error ? error.message : "Gemini request failed.";
    return json({ error: message }, 502);
  }
}

async function createLicense(request: Request, env: Env): Promise<Response> {
  if (!isAdmin(request, env)) return json({ error: "Unauthorized" }, 401);
  const body = await readBody(request);
  const label = stringField(body, "label", 120);
  const creditLimit = integerField(body, "creditLimit", 300, 1, 100_000);
  const maxDevices = integerField(body, "maxDevices", 2, 1, 10);
  const expiresAt = optionalStringField(body, "expiresAt", 40);
  if (expiresAt && Number.isNaN(Date.parse(expiresAt))) return json({ error: "expiresAt must be an ISO date." }, 400);

  const activationCode = `MGR-${randomCode(4)}-${randomCode(4)}-${randomCode(4)}`;
  const codeHash = await sha256(activationCode);
  const id = crypto.randomUUID();
  await env.DB.prepare(
    "INSERT INTO licenses (id, code_hash, label, credit_limit, max_devices, expires_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
  ).bind(id, codeHash, label, creditLimit, maxDevices, expiresAt, new Date().toISOString()).run();
  return json({ id, activationCode, label, creditLimit, maxDevices, expiresAt }, 201);
}

async function revokeLicense(request: Request, env: Env): Promise<Response> {
  if (!isAdmin(request, env)) return json({ error: "Unauthorized" }, 401);
  const body = await readBody(request);
  const id = stringField(body, "id", 80);
  if (!id) return json({ error: "License ID is required." }, 400);
  await env.DB.prepare("UPDATE licenses SET status = 'revoked' WHERE id = ?").bind(id).run();
  return json({ ok: true });
}

async function authenticate(request: Request, env: Env): Promise<AccessRow | Response> {
  const header = request.headers.get("authorization") || "";
  const token = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  if (!token) return json({ error: "Manager AI activation is required." }, 401);
  const tokenHash = await sha256(token);
  const row = await env.DB.prepare(
    `SELECT l.id, l.status, l.credit_limit, l.used_credits, l.max_devices, l.expires_at, d.id AS device_id
     FROM devices d JOIN licenses l ON l.id = d.license_id
     WHERE d.token_hash = ?`,
  ).bind(tokenHash).first<AccessRow>();
  const invalid = validateLicense(row);
  if (invalid) return json({ error: invalid }, 403);
  return row!;
}

function validateLicense(row: LicenseRow | null): string | null {
  if (!row) return "Invalid activation code.";
  if (row.status !== "active") return "This Manager activation has been revoked.";
  if (row.expires_at && Date.parse(row.expires_at) <= Date.now()) return "This Manager activation has expired.";
  return null;
}

function accessPayload(row: LicenseRow): Record<string, unknown> {
  return {
    status: row.status,
    creditLimit: row.credit_limit,
    usedCredits: row.used_credits,
    remainingCredits: Math.max(0, row.credit_limit - row.used_credits),
    expiresAt: row.expires_at,
  };
}

async function touchDevice(env: Env, deviceId: string): Promise<void> {
  await env.DB.prepare("UPDATE devices SET last_seen_at = ? WHERE id = ?")
    .bind(new Date().toISOString(), deviceId).run();
}

function isAdmin(request: Request, env: Env): boolean {
  const auth = request.headers.get("authorization") || "";
  return Boolean(env.ADMIN_TOKEN) && auth === `Bearer ${env.ADMIN_TOKEN}`;
}

async function readBody(request: Request): Promise<Record<string, unknown>> {
  const length = Number(request.headers.get("content-length") || 0);
  if (length > 64_000) throw new Error("Request is too large.");
  const value: unknown = await request.json();
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Invalid JSON body.");
  return value as Record<string, unknown>;
}

function stringField(body: Record<string, unknown>, key: string, max: number): string {
  const value = body[key];
  return typeof value === "string" ? value.slice(0, max) : "";
}

function optionalStringField(body: Record<string, unknown>, key: string, max: number): string | null {
  const value = stringField(body, key, max).trim();
  return value || null;
}

function integerField(body: Record<string, unknown>, key: string, fallback: number, min: number, max: number): number {
  const value = body[key];
  if (typeof value !== "number" || !Number.isInteger(value)) return fallback;
  return Math.max(min, Math.min(max, value));
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: JSON_HEADERS });
}

async function sha256(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function randomToken(byteLength: number): string {
  const bytes = crypto.getRandomValues(new Uint8Array(byteLength));
  return toBase64Url(bytes);
}

function randomCode(length: number): string {
  const alphabet = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  return [...bytes].map((byte) => alphabet[byte % alphabet.length]).join("");
}

function toBase64Url(bytes: Uint8Array): string {
  let raw = "";
  for (const byte of bytes) raw += String.fromCharCode(byte);
  return btoa(raw).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function googleError(raw: string): string | null {
  try {
    const parsed = JSON.parse(raw) as { error?: { message?: string } };
    return parsed.error?.message || null;
  } catch {
    return null;
  }
}

function extractGeminiText(raw: string): string {
  const parsed = JSON.parse(raw) as {
    output_text?: string;
    steps?: Array<{ output?: Array<{ text?: string }>; content?: Array<{ text?: string }> }>;
  };
  if (parsed.output_text?.trim()) return parsed.output_text;
  const parts: string[] = [];
  for (const step of parsed.steps || []) {
    for (const block of [...(step.output || []), ...(step.content || [])]) {
      if (block.text) parts.push(block.text);
    }
  }
  const text = parts.join("").trim();
  if (!text) throw new Error("Gemini returned an empty response.");
  return text;
}
