import type { PlanDto, VenueDto, VenueMapDto } from "./types";

// Client đọc dữ liệu cho Viewer, dùng được cả trên web lẫn React Native (chỉ cần fetch).
//
// - Có backend: apiBase = địa chỉ backend ("" = cùng origin, ví dụ khi Vite chuyển /api tới backend local).
// - Không có backend: đọc bản chụp tĩnh staticBase + /data/venues.json và /data/venues/{slug}.json
//   (tạo bằng "npm run export-data" ở Front-End).
/** Đủ dùng cho fetch của trình duyệt lẫn React Native, không cần thư viện kiểu DOM */
export interface FetchResponse {
    ok: boolean;
    status: number;
    headers: { get(name: string): string | null };
    json(): Promise<unknown>;
    text(): Promise<string>;
}
export type FetchLike = (url: string, init?: { headers?: Record<string, string> }) => Promise<FetchResponse>;

export interface ApiClientOptions {
    apiBase?: string | null;
    /** Thử API trước rồi mới tới bản tĩnh */
    tryApi?: boolean;
    staticBase?: string;
    fetch?: FetchLike;
}

export type DataSource = "api" | "static";

export class HttpError extends Error {
    constructor(public readonly status: number) {
        super(`HTTP ${status}`);
    }
}

export function createApiClient({ apiBase = "", tryApi = true, staticBase = "", fetch: fetchArg }: ApiClientOptions = {}) {
    const fetchFn: FetchLike = fetchArg ?? ((globalThis as unknown as { fetch: FetchLike }).fetch.bind(globalThis) as FetchLike);
    const base = (apiBase ?? "").replace(/\/+$/, "");
    let lastSource: DataSource = tryApi ? "api" : "static";

    async function getJson<T>(url: string): Promise<T> {
        const response = await fetchFn(url, { headers: { Accept: "application/json" } });
        if (!response.ok) throw new HttpError(response.status);
        const type = response.headers.get("content-type") ?? "";
        if (!type.includes("json")) throw new Error("Không phải JSON");
        return (await response.json()) as T;
    }

    // Lỗi mạng / 5xx / không phải JSON thì dùng bản tĩnh. 404 từ một backend thật là "không có" thật.
    async function load<T>(apiPath: string, staticPath: string): Promise<T> {
        if (tryApi) {
            try {
                const data = await getJson<T>(`${base}${apiPath}`);
                lastSource = "api";
                return data;
            } catch (error) {
                if (error instanceof HttpError && error.status === 404 && base !== "") throw error;
            }
        }
        const data = await getJson<T>(`${staticBase}${staticPath}`);
        lastSource = "static";
        return data;
    }

    const bundles = new Map<string, Promise<VenueMapDto>>();
    const plans = new Map<string, Promise<string | null>>();

    return {
        get source(): DataSource {
            return lastSource;
        },
        fetchVenues: () => load<VenueDto[]>("/api/venues", "/data/venues.json"),
        fetchVenueMap(slug: string): Promise<VenueMapDto> {
            let promise = bundles.get(slug);
            if (!promise) {
                const s = encodeURIComponent(slug);
                promise = load<VenueMapDto>(`/api/venues/${s}/map`, `/data/venues/${s}.json`);
                promise.catch(() => bundles.delete(slug));
                bundles.set(slug, promise);
            }
            return promise;
        },
        /** Chữ SVG của bản vẽ: nội tuyến (plan.svg) hoặc tải từ plan.imageUrl. Mỗi tệp tải một lần. */
        fetchPlanSvg(plan: PlanDto): Promise<string | null> {
            if (plan.svg) return Promise.resolve(plan.svg);
            if (!plan.imageUrl) return Promise.resolve(null);
            const url = /^https?:/i.test(plan.imageUrl) || plan.imageUrl.startsWith("/plans/")
                ? `${plan.imageUrl.startsWith("/") ? staticBase : ""}${plan.imageUrl}`
                : `${base}${plan.imageUrl}`;
            let promise = plans.get(url);
            if (!promise) {
                promise = fetchFn(url).then(r => (r.ok ? r.text() : null)).catch(() => null);
                plans.set(url, promise);
            }
            return promise;
        }
    };
}

export type ApiClient = ReturnType<typeof createApiClient>;
