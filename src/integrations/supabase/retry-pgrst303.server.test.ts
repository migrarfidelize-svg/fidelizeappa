import { describe, expect, it, vi } from "vitest";
import { isPostgrestJwtFuture, retryPostgrestJwtFuture } from "./retry-pgrst303.server";

const future = () => new Response(
  JSON.stringify({ code: "PGRST303", message: "JWT issued at future" }),
  { status: 401, headers: { "content-type": "application/json" } },
);
const success = () => new Response("{}", { status: 201 });

describe("PostgREST JWT future retry", () => {
  it("retries only auth-stage PGRST303 and preserves final write result", async () => {
    const attempt = vi.fn().mockImplementationOnce(async () => future())
      .mockImplementationOnce(async () => success());
    const wait = vi.fn(async () => {});
    const result = await retryPostgrestJwtFuture(attempt, { wait });
    expect(result.status).toBe(201);
    expect(attempt).toHaveBeenCalledTimes(2);
    expect(wait).toHaveBeenCalledWith(400);
  });

  it("does not retry unrelated 401 errors", async () => {
    const attempt = vi.fn(async () => new Response(
      JSON.stringify({ code: "PGRST303", message: "JWT invalid audience" }), { status: 401 },
    ));
    const result = await retryPostgrestJwtFuture(attempt, { wait: async () => {} });
    expect(result.status).toBe(401);
    expect(attempt).toHaveBeenCalledTimes(1);
  });

  it("does not retry network errors or timeouts", async () => {
    const attempt = vi.fn(async (): Promise<Response> => { throw new Error("network"); });
    await expect(retryPostgrestJwtFuture(attempt, { wait: async () => {} }))
      .rejects.toThrow("network");
    expect(attempt).toHaveBeenCalledTimes(1);
  });

  it("caps retries and leaves the last original error intact", async () => {
    const attempt = vi.fn(async () => future());
    const wait = vi.fn(async () => {});
    const result = await retryPostgrestJwtFuture(attempt, { wait });
    expect(result.status).toBe(401);
    expect(attempt).toHaveBeenCalledTimes(4);
    expect(wait).toHaveBeenCalledTimes(3);
    await expect(result.json()).resolves.toMatchObject({
      code: "PGRST303",
      message: "JWT issued at future",
    });
  });

  it("only reads a clone of error responses", async () => {
    const response = future();
    expect(await isPostgrestJwtFuture(response)).toBe(true);
    expect(response.bodyUsed).toBe(false);
  });
});
