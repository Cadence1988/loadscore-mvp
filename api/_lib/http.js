export function sendJson(response, status, body) {
  response.status(status).setHeader("content-type", "application/json; charset=utf-8").json(body);
}

export function bearerToken(request) {
  const value = String(request.headers?.authorization || "");
  const match = value.match(/^Bearer\s+([^\s]+)$/i);
  return match?.[1] || "";
}

export async function readJsonBody(request) {
  if (request.body && typeof request.body === "object" && !Buffer.isBuffer(request.body)) return request.body;
  const raw = await readRawBody(request);
  if (raw.length > 16_384) throw new Error("request_too_large");
  return raw.length ? JSON.parse(raw.toString("utf8")) : {};
}

export async function readRawBody(request, limit = 1_048_576) {
  if (Buffer.isBuffer(request.body)) return request.body;
  if (typeof request.body === "string") return Buffer.from(request.body);
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += buffer.length;
    if (size > limit) throw new Error("request_too_large");
    chunks.push(buffer);
  }
  return Buffer.concat(chunks);
}
