// TakLab: pure helpers for the Recordings page.
import type { Recording, RecordingKind, TrackPoint } from './recordingsApi';

// User decision 24 XI 2026: the whole recordings registry is for the OTS
// administrator role only. Login stores the role in localStorage.
export function isAdministrator(storage: Pick<Storage, 'getItem'> = localStorage): boolean {
    return storage.getItem('administrator') === 'true';
}

export const KIND_LABELS: Record<RecordingKind, string> = {
    video: 'Video',
    voice: 'Voice message',
    scan: 'Scan',
};

export function formatDurationSeconds(seconds: number | null | undefined): string {
    if (seconds === null || seconds === undefined || Number.isNaN(seconds)) return '';
    const total = Math.max(0, Math.round(seconds));
    const h = Math.floor(total / 3600);
    const m = Math.floor((total % 3600) / 60);
    const s = total % 60;
    const pad = (n: number) => String(n).padStart(2, '0');
    return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}

export function formatTimestamp(value: string | null | undefined): string {
    if (!value) return '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

// The OTS panel of a taklab environment lives at <env>.<domain>, CloudTAK at
// <env>-mapa.<domain>. A panel opened by IP (port mode, Tailscale) or from
// localhost has no CloudTAK name to derive, so there is no link.
export function cloudtakUrl(hostname: string): string | null {
    if (!hostname || hostname === 'localhost') return null;
    if (/^\d{1,3}(\.\d{1,3}){3}$/.test(hostname) || hostname.includes(':')) return null;
    const dot = hostname.indexOf('.');
    if (dot <= 0) return null;
    const env = hostname.slice(0, dot);
    const domain = hostname.slice(dot + 1);
    if (!domain.includes('.')) return null;
    return `https://${env}-mapa.${domain}/`;
}

export function displayName(
    recording: Pick<Recording, 'name' | 'kind' | 'started_at'>,
    translate: (key: string) => string = (key) => key,
): string {
    if (recording.name && recording.name.trim() !== '') return recording.name;
    const kind = KIND_LABELS[recording.kind] ? translate(KIND_LABELS[recording.kind]) : recording.kind;
    return `${kind} ${formatTimestamp(recording.started_at)}`;
}

export function usagePercent(usedBytes: number, limitBytes: number | null): number | null {
    if (limitBytes === null || !(limitBytes > 0)) return null;
    return Math.min(100, Math.max(0, (usedBytes / limitBytes) * 100));
}

export function trackLatLngs(track: TrackPoint[]): [number, number][] {
    return track
        .filter((p) => Array.isArray(p) && Number.isFinite(p[0]) && Number.isFinite(p[1]))
        .map((p) => [p[0], p[1]]);
}
