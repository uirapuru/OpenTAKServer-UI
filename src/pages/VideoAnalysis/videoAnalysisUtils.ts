// TakLab: pure helpers for the video analysis view.
import { t } from 'i18next';
import type { Analysis, AnalysisState } from './videoAnalysisApi';

export function formatDuration(seconds: number): string {
    const total = Math.max(0, Math.round(seconds));
    const h = Math.floor(total / 3600);
    const m = Math.floor((total % 3600) / 60);
    const s = total % 60;
    const pad = (n: number) => String(n).padStart(2, '0');
    return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}

export function isActive(a: Analysis): boolean {
    return a.state === 'queued' || a.state === 'running';
}

export function stateLabel(state: AnalysisState): string {
    switch (state) {
        case 'queued': return t('Queued');
        case 'running': return t('Running');
        case 'done': return t('Done');
        case 'stopped': return t('Stopped');
        default: return t('Error');
    }
}

export function progressText(a: Analysis): string {
    const label = stateLabel(a.state);
    if (a.state !== 'running') return label;
    if (a.source === 'recording' && a.percent !== null) return `${label} · ${Math.round(a.percent)}%`;
    if (a.source === 'live' && a.elapsed_s !== null) return `${label} · ${formatDuration(a.elapsed_s)}`;
    return label;
}
