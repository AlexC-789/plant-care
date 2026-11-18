export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

/** Uniform error body: only our own message, never stacks or provider text. */
export function jsonError(status: number, message: string): Response {
  return json({ error: message }, status);
}

/** Reads a JSON object body, capping the bytes actually read (the header can lie). */
export async function readJsonBody(req: Request, maxBytes = 10_240): Promise<Record<string, unknown> | Response> {
  const declared = Number(req.headers.get('content-length'));
  if (declared > maxBytes) return jsonError(413, 'Request too large.');
  const reader = req.body?.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (reader) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > maxBytes) {
      await reader.cancel();
      return jsonError(413, 'Request too large.');
    }
    chunks.push(value);
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(new TextDecoder().decode(await new Blob(chunks as BlobPart[]).arrayBuffer()));
  } catch {
    return jsonError(400, 'Invalid request.');
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    return jsonError(400, 'Invalid request.');
  }
  return parsed as Record<string, unknown>;
}
