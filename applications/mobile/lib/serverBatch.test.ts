import { describe, expect, it } from "vitest"

import { errorMessage, groupBy } from "./serverBatch"

describe("groupBy", () => {
  it("groups in first seen order and keeps item order", () => {
    const groups = groupBy(
      [
        { id: 1, s: "b" },
        { id: 2, s: "a" },
        { id: 3, s: "b" },
      ],
      (item) => item.s,
    )
    expect([...groups.keys()]).toEqual(["b", "a"])
    expect(groups.get("b")?.map((i) => i.id)).toEqual([1, 3])
  })

  it("is empty for no items", () => {
    expect(groupBy([], (x) => x).size).toBe(0)
  })
})

describe("errorMessage", () => {
  const options = {
    fallback: "fallback",
    fetchError: "offline",
    byStatus: { 403: "forbidden", 409: "conflict" },
    byCode: { big: "too big" },
  }

  it("prefers the status text", () => {
    expect(errorMessage({ status: 403, data: { message: "x" } }, options)).toBe(
      "forbidden",
    )
    expect(errorMessage({ status: 409 }, options)).toBe("conflict")
  })

  it("reports a request that never reached the server", () => {
    expect(errorMessage({ status: "FETCH_ERROR" }, options)).toBe("offline")
  })

  it("uses a known code, then the server message, then the error message", () => {
    expect(errorMessage({ data: { code: "big", message: "m" } }, options)).toBe(
      "too big",
    )
    expect(
      errorMessage({ data: { code: "other", message: "m" } }, options),
    ).toBe("m")
    expect(errorMessage({ message: "own" }, options)).toBe("own")
  })

  it("can ignore the error's own message", () => {
    expect(
      errorMessage({ message: "own" }, { ...options, useMessage: false }),
    ).toBe("fallback")
  })

  it("falls back for anything else", () => {
    expect(errorMessage(null, options)).toBe("fallback")
    expect(errorMessage("boom", options)).toBe("fallback")
    expect(errorMessage({ status: 500 }, options)).toBe("fallback")
    expect(errorMessage({ status: "FETCH_ERROR" }, { fallback: "f" })).toBe("f")
  })
})
