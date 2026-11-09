/**
 * Supabase/PostgREST legacy versions can reject an otherwise valid, freshly
 * issued JWT with HTTP 401 PGRST303 ("JWT issued at future").
 *
 * Retry ONLY this exact authentication-stage rejection. PostgREST rejects
 * the JWT before running any query, so there cannot be a successful write
 * hidden behind this response. Never retry network failures, timeouts,
 * 401s from other endpoints, or any different PGRST error.
 *
 * The permanent fix is updating Supabase PostgREST to >=14.18.
 */
const RETRY_DELAYS_MS = [400, 1200, 2500] as const;

export async function isPostgrestJwtFuture(response: Response): Promise<boolean> {
  if (response.status !== 401) return false;
  try {
    const body: unknown = await response.clone().json();
    if (!body || typeof body !== "object") return false;
    const error = body as { code?: unknown; message?: unknown };
    return error.code === "PGRST303" &&
      typeof error.message === "string" &&
      /JWT issued at future/i.test(error.message);
  } catch {
    return false;
  }
}

export async function retryPostgrestJwtFuture(
  attempt: () => Promise<Response>,
  options: {
    wait?: (ms: number) => Promise<void>;
    log?: (attemptNumber: number) => void;
  } = {},
): Promise<Response> {
  const wait = options.wait ?? (ms => new Promise<void>(resolve => setTimeout(resolve, ms)));
  for (let i = 0; ; i++) {
    const response = await attempt();
    if (!(await isPostgrestJwtFuture(response)) || i >= RETRY_DELAYS_MS.length) {
      return response;
    }
    options.log?.(i + 1);
    await wait(RETRY_DELAYS_MS[i]);
  }
}
