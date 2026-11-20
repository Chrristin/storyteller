/**
 * Small pure helpers shared by the features that act on a selection of books one
 * server at a time (Archive, Add to collection, Drive, Kindle).
 */

/** Groups items by a key, keeping the order keys and items were first seen. */
export function groupBy<T, K>(
  items: readonly T[],
  keyFn: (item: T) => K,
): Map<K, T[]> {
  const groups = new Map<K, T[]>()
  for (const item of items) {
    const key = keyFn(item)
    const group = groups.get(key)
    if (group) group.push(item)
    else groups.set(key, [item])
  }
  return groups
}

export interface ErrorMessageOptions {
  /** Shown when nothing in the error gives better text. */
  fallback: string
  /** Text for an HTTP status, such as 403 or 409. */
  byStatus?: Partial<Record<number, string>>
  /** Text for a `data.code` the server sends. */
  byCode?: Record<string, string>
  /** Text for a request that never reached the server. */
  fetchError?: string
  /** Use the error's own `message` after the server's. Default true. */
  useMessage?: boolean
}

function text(value: unknown) {
  return typeof value === "string" && value ? value : undefined
}

/**
 * Plain English for a failed request: text for the status, for a FETCH_ERROR,
 * for a known server code, then the server's `data.message`, the error's own
 * `message`, and last the fallback.
 */
export function errorMessage(
  error: unknown,
  options: ErrorMessageOptions,
): string {
  if (typeof error === "object" && error !== null) {
    const { status, data, message } = error as {
      status?: unknown
      data?: unknown
      message?: unknown
    }
    if (typeof status === "number" && options.byStatus?.[status]) {
      return options.byStatus[status]
    }
    if (status === "FETCH_ERROR" && options.fetchError) {
      return options.fetchError
    }
    if (typeof data === "object" && data !== null) {
      const code = text((data as { code?: unknown }).code)
      if (code && options.byCode?.[code]) return options.byCode[code]
      const dataMessage = text((data as { message?: unknown }).message)
      if (dataMessage) return dataMessage
    }
    if (options.useMessage !== false) {
      const own = text(message)
      if (own) return own
    }
  }
  return options.fallback
}
