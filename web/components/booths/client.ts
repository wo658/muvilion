export async function boothRequest<T>(url: string, options: { method?: string; token?: string; body?: unknown; signal?: AbortSignal } = {}): Promise<T> {
  const response = await fetch(url, {
    method: options.method ?? "GET", signal: options.signal, cache: "no-store",
    headers: { ...(options.body ? { "Content-Type": "application/json" } : {}), ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}) },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  const data = await response.json();
  if (!response.ok) throw new Error(typeof data.error === "string" ? data.error : "요청을 처리하지 못했습니다. 다시 시도해 주세요.");
  return data as T;
}
export const applicationStatus = { pending: "승인 대기", approved: "참가 승인", rejected: "반려" } as const;
export function won(value: number) { return new Intl.NumberFormat("ko-KR", { style: "currency", currency: "KRW", maximumFractionDigits: 0 }).format(value); }
