import { describe, expect, it } from 'vitest';
import { cloudtakUrl, isAdministrator, displayName, formatDurationSeconds, trackLatLngs, usagePercent } from './recordingsUtils';
import { archiveUrlForFilters, archiveUrlForIds, filterParams, parseRecordingPage, parseUsage, recordingFileUrl } from './recordingsApi';

describe('cloudtakUrl', () => {
    it('maps the OTS panel host to the CloudTAK host of the same environment', () => {
        expect(cloudtakUrl('public.taklab.eu')).toBe('https://public-mapa.taklab.eu/');
        expect(cloudtakUrl('snipy-poligon26.taklab.eu')).toBe('https://snipy-poligon26-mapa.taklab.eu/');
    });
    it('gives no link for IP addresses, localhost and bare names', () => {
        expect(cloudtakUrl('100.64.1.2')).toBeNull();
        expect(cloudtakUrl('localhost')).toBeNull();
        expect(cloudtakUrl('::1')).toBeNull();
        expect(cloudtakUrl('taklab.eu')).toBeNull();
        expect(cloudtakUrl('')).toBeNull();
    });
});

describe('isAdministrator', () => {
    it('reads the role stored at login', () => {
        expect(isAdministrator({ getItem: () => 'true' })).toBe(true);
        expect(isAdministrator({ getItem: () => 'false' })).toBe(false);
        expect(isAdministrator({ getItem: () => null })).toBe(false);
    });
});

describe('archive links', () => {
    it('lists the chosen ids', () => {
        expect(archiveUrlForIds(['a1', 'b2'])).toBe('/api/taklab/recordings/archive?ids=a1%2Cb2');
    });
    it('passes the applied filters with all=1 and no page', () => {
        expect(archiveUrlForFilters({ kind: '', account: '', from: null, to: null })).toBe('/api/taklab/recordings/archive?all=1');
        const url = new URL(archiveUrlForFilters({ kind: 'video', account: ' biali ', from: '2026-11-24T10:00:00Z', to: null }), 'http://x');
        expect(url.pathname).toBe('/api/taklab/recordings/archive');
        expect(Object.fromEntries(url.searchParams)).toEqual({ all: '1', kind: 'video', account: 'biali', from: '2026-11-24T10:00:00.000Z' });
    });
});

describe('formatting', () => {
    it('formats durations', () => {
        expect(formatDurationSeconds(null)).toBe('');
        expect(formatDurationSeconds(7)).toBe('0:07');
        expect(formatDurationSeconds(125.4)).toBe('2:05');
        expect(formatDurationSeconds(3725)).toBe('1:02:05');
    });
    it('falls back to kind and time when the recording has no name', () => {
        expect(displayName({ name: 'Patrol', kind: 'video', started_at: '2026-11-24T10:00:00Z' })).toBe('Patrol');
        expect(displayName({ name: '  ', kind: 'scan', started_at: 'x' }, (k) => (k === 'Scan' ? 'Skan' : k))).toBe('Skan x');
    });
    it('computes usage percent only with a limit', () => {
        expect(usagePercent(5, null)).toBeNull();
        expect(usagePercent(5, 0)).toBeNull();
        expect(usagePercent(45, 50)).toBe(90);
        expect(usagePercent(80, 50)).toBe(100);
    });
    it('drops malformed track points', () => {
        expect(trackLatLngs([[51.1, 17.0, 't'], [Number.NaN, 1, 0] as never, [51.2, 17.1, 2]])).toEqual([[51.1, 17.0], [51.2, 17.1]]);
    });
});

describe('API envelope', () => {
    it('accepts a bare array', () => {
        const page = parseRecordingPage([{ id: 1 }, { id: 2 }], 3);
        expect(page.items).toHaveLength(2);
        expect(page.totalPages).toBe(1);
    });
    it('accepts the usual OTS paginated envelope', () => {
        const page = parseRecordingPage({ results: [{ id: 1 }], total: 31, current_page: 2, total_pages: 4, per_page: 10 }, 2);
        expect(page).toMatchObject({ total: 31, page: 2, totalPages: 4, perPage: 10 });
    });
    it('reads usage under either field name', () => {
        expect(parseUsage({ used_bytes: 10, limit_bytes: 100 })).toEqual({ usedBytes: 10, limitBytes: 100 });
        expect(parseUsage({ used: 10, limit: null })).toEqual({ usedBytes: 10, limitBytes: null });
    });
    it('sends only filled filters, dates as ISO', () => {
        expect(filterParams({ kind: '', account: '  ', from: null, to: undefined }, 1)).toEqual({ page: 1 });
        const p = filterParams({ kind: 'voice', account: ' operator ', from: '2026-11-24 10:00:00', to: 'nonsense' }, 2);
        expect(p.kind).toBe('voice');
        expect(p.account).toBe('operator');
        expect(String(p.from)).toMatch(/^2026-11-24T\d\d:00:00\.000Z$/);
        expect(p.to).toBeUndefined();
    });
    it('builds the file address under the recordings route', () => {
        expect(recordingFileUrl(7)).toBe('/api/taklab/recordings/7/file');
        expect(recordingFileUrl('a/b')).toBe('/api/taklab/recordings/a%2Fb/file');
    });
});
