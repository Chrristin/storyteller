import { describe, expect, it, vi } from "vitest"

import {
  HardcoverAuthError,
  HardcoverRateLimitError,
  authorizationHeader,
  searchHardcover,
} from "../client"

import { twoTowers } from "./fixtures"

function reply(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status })
}

const ok = {
  data: { search: { results: { hits: [{ document: twoTowers }] } } },
}
const limited = {
  error: "Too Many Requests",
  message: "API rate limit exceeded for tier 'Free'. Try again in 1 seconds.",
}

describe("hardcover client", () => {
  it("accepts a token with or without Bearer", () => {
    expect(authorizationHeader("abc")).toBe("Bearer abc")
    expect(authorizationHeader("Bearer abc")).toBe("Bearer abc")
    expect(authorizationHeader("  bearer  abc ")).toBe("Bearer abc")
  })

  it("returns the documents of the hits", async () => {
    const fetchImpl = vi.fn(async () => reply(ok))
    const docs = await searchHardcover("t", "The Two Towers", {
      fetchImpl: fetchImpl as unknown as typeof fetch,
    })
    expect(docs).toHaveLength(1)
    expect(docs[0]?.title).toBe("The Two Towers")
  })

  it("retries once after the rate limit message", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(reply(limited))
      .mockResolvedValueOnce(reply(ok))
    const sleep = vi.fn(async () => {})
    const docs = await searchHardcover("t", "q", {
      fetchImpl: fetchImpl as unknown as typeof fetch,
      sleep,
    })
    expect(docs).toHaveLength(1)
    expect(sleep).toHaveBeenCalledTimes(1)
  })

  it("gives up after a second rate limit", async () => {
    const fetchImpl = vi.fn(async () => reply(limited))
    await expect(
      searchHardcover("t", "q", {
        fetchImpl: fetchImpl as unknown as typeof fetch,
        sleep: async () => {},
      }),
    ).rejects.toBeInstanceOf(HardcoverRateLimitError)
    expect(fetchImpl).toHaveBeenCalledTimes(2)
  })

  it("reports a rejected token", async () => {
    const fetchImpl = vi.fn(async () => reply({}, 401))
    await expect(
      searchHardcover("t", "q", {
        fetchImpl: fetchImpl as unknown as typeof fetch,
      }),
    ).rejects.toBeInstanceOf(HardcoverAuthError)
  })
})
