// TakLab: client for the recordings registry in the taklab OpenTAKServer fork.
// Contract: docs/superpowers/specs/2026-11-24-recordings-design.md in ~/taklab
// (section "Kontrakt API").
import axios from '../../axios_config';
import { apiRoutes } from '../../apiRoutes';

export type RecordingKind = 'video' | 'voice' | 'scan';

export interface Recording {
    id: number | string;
    kind: RecordingKind;
    account: string;
    callsign: string | null;
    uid: string | null;
    name: string | null;
    started_at: string;
    ended_at: string | null;
    duration_s: number | null;
    lat: number | null;
    lon: number | null;
    size_bytes: number | null;
    has_text: boolean;
}

export type TrackPoint = [number, number, string | number];

export interface RecordingDetail extends Recording {
    track: TrackPoint[];
    text: string | null;
}

export interface RecordingFilters {
    kind?: RecordingKind | '';
    account?: string;
    from?: string | null;
    to?: string | null;
}

export interface RecordingPage {
    items: Recording[];
    total: number;
    page: number;
    totalPages: number;
    perPage: number;
}

export interface RecordingUsage {
    usedBytes: number;
    limitBytes: number | null;
}

const base = apiRoutes.taklabRecordings;

export function recordingFileUrl(id: Recording['id']): string {
    return `${base}/${encodeURIComponent(String(id))}/file`;
}

// The OTS archive route takes up to 100 ids in one request.
export const MAX_ARCHIVE_IDS = 100;

// ZIP of chosen recordings: GET /api/taklab/recordings/archive?ids=a,b,c.
// The browser downloads it through a plain link, so the session cookie goes
// along and a multi-GB archive streams to disk instead of into memory.
export function archiveUrlForIds(ids: Recording['id'][]): string {
    const params = new URLSearchParams({ ids: ids.map(String).join(',') });
    return `${base}/archive?${params.toString()}`;
}

// ZIP of every recording matching the list filters:
// GET /api/taklab/recordings/archive?all=1&kind=&account=&from=&to=.
export function archiveUrlForFilters(filters: RecordingFilters): string {
    const params = new URLSearchParams({ all: '1' });
    const { page: _page, ...rest } = filterParams(filters, 1);
    for (const [key, value] of Object.entries(rest)) params.set(key, String(value));
    return `${base}/archive?${params.toString()}`;
}

// The contract names the fields of a single recording but not the envelope of
// the list. OTS lists are usually paginated as {results, total, current_page,
// total_pages, per_page}; a bare array is accepted too.
export function parseRecordingPage(data: unknown, requestedPage: number): RecordingPage {
    if (Array.isArray(data)) {
        return { items: data as Recording[], total: data.length, page: 1, totalPages: 1, perPage: Math.max(data.length, 1) };
    }
    const body = (data ?? {}) as Record<string, unknown>;
    const items = (body.results ?? body.recordings ?? body.items ?? []) as Recording[];
    const total = Number(body.total ?? items.length);
    const perPage = Number(body.per_page ?? (items.length || 1));
    const totalPages = Number(body.total_pages ?? Math.max(1, Math.ceil(total / perPage)));
    const page = Number(body.current_page ?? body.page ?? requestedPage);
    return { items, total, page, totalPages, perPage };
}

export function parseUsage(data: unknown): RecordingUsage {
    const body = (data ?? {}) as Record<string, unknown>;
    const used = body.used_bytes ?? body.used ?? body.size_bytes ?? 0;
    const limit = body.limit_bytes ?? body.limit ?? body.quota_bytes ?? null;
    return { usedBytes: Number(used), limitBytes: limit === null ? null : Number(limit) };
}

function toIso(value: string | null | undefined): string | undefined {
    if (!value) return undefined;
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
}

export function filterParams(filters: RecordingFilters, page: number): Record<string, string | number> {
    const params: Record<string, string | number> = { page };
    if (filters.kind) params.kind = filters.kind;
    if (filters.account && filters.account.trim() !== '') params.account = filters.account.trim();
    const from = toIso(filters.from);
    const to = toIso(filters.to);
    if (from) params.from = from;
    if (to) params.to = to;
    return params;
}

export async function listRecordings(filters: RecordingFilters, page: number): Promise<RecordingPage> {
    const r = await axios.get(base, { params: filterParams(filters, page) });
    return parseRecordingPage(r.data, page);
}

export async function getRecording(id: Recording['id']): Promise<RecordingDetail> {
    const r = await axios.get(`${base}/${encodeURIComponent(String(id))}`);
    const data = r.data as RecordingDetail;
    return { ...data, track: Array.isArray(data.track) ? data.track : [], text: data.text ?? null };
}

export async function renameRecording(id: Recording['id'], name: string): Promise<void> {
    await axios.patch(`${base}/${encodeURIComponent(String(id))}`, { name });
}

export async function deleteRecording(id: Recording['id']): Promise<void> {
    await axios.delete(`${base}/${encodeURIComponent(String(id))}`);
}

export async function getUsage(): Promise<RecordingUsage> {
    const r = await axios.get(`${base}/usage`);
    return parseUsage(r.data);
}
