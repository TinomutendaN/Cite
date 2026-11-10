// Calls to the backend. The browser only ever calls /api/... on this site;
// next.config.js forwards it to FastAPI. No keys here.

/** A non-2xx response. `body` is the parsed JSON body, if there was one. */
export class ApiRequestError extends Error {
  constructor(
    public status: number,
    public body: unknown,
  ) {
    super(`Request failed with status ${status}`);
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, { cache: "no-store", ...init });
  const body = await res.json().catch(() => null);
  if (!res.ok) throw new ApiRequestError(res.status, body);
  return body as T;
}

export function apiGet<T>(path: string, signal?: AbortSignal): Promise<T> {
  return request<T>(path, { signal });
}

/**
 * POST and read a stream of JSON lines (NDJSON), calling `onEvent` for each line.
 * A non-2xx response throws ApiRequestError with its JSON body, like apiPost.
 */
export async function apiStream<T>(
  path: string,
  data: unknown,
  onEvent: (event: T) => void,
  signal?: AbortSignal,
): Promise<void> {
  const res = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
    cache: "no-store",
    signal,
  });
  if (!res.ok || !res.body) {
    const body = await res.json().catch(() => null);
    throw new ApiRequestError(res.status, body);
  }

  const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
  let buffered = "";
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buffered += value;
    const lines = buffered.split("\n");
    buffered = lines.pop() ?? "";
    for (const line of lines) if (line.trim()) onEvent(JSON.parse(line) as T);
  }
  if (buffered.trim()) onEvent(JSON.parse(buffered) as T);
}

export function apiPost<T>(path: string, data: unknown, signal?: AbortSignal): Promise<T> {
  return request<T>(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
    signal,
  });
}
