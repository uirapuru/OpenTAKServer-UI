import { beforeAll, describe, expect, it } from 'vitest';
import i18next from 'i18next';
import { formatDuration, isActive, progressText, stateLabel } from './videoAnalysisUtils';
import type { Analysis } from './videoAnalysisApi';

// Uninitialised i18next returns undefined from t(); keys are English text.
beforeAll(() => i18next.init({ lng: 'en', resources: {}, returnEmptyString: false }));

const base: Analysis = {
    id: 1, source: 'recording', label: 'Patrol', account: 'operator', created_by: 'admin',
    created_at: '2026-11-26T10:00:00Z', started_at: null, finished_at: null, state: 'queued',
    percent: null, elapsed_s: null, persons: 0, error: null,
};
const rec = { ...base, source: 'recording' as const };
const live = { ...base, source: 'live' as const };

describe('formatDuration', () => {
    it('formats durations', () => {
        expect(formatDuration(5)).toBe('0:05');
        expect(formatDuration(760)).toBe('12:40');
        expect(formatDuration(3723)).toBe('1:02:03');
    });
});

describe('isActive', () => {
    it('is true for queued and running only', () => {
        expect(isActive({ ...rec, state: 'queued' })).toBe(true);
        expect(isActive({ ...rec, state: 'running' })).toBe(true);
        for (const state of ['done', 'stopped', 'error'] as const) expect(isActive({ ...rec, state })).toBe(false);
    });
});

describe('stateLabel', () => {
    it('names every state', () => {
        expect(stateLabel('queued')).toBe('Queued');
        expect(stateLabel('running')).toBe('Running');
        expect(stateLabel('done')).toBe('Done');
        expect(stateLabel('stopped')).toBe('Stopped');
        expect(stateLabel('error')).toBe('Error');
    });
});

describe('progressText', () => {
    it('shows percent for a running recording and elapsed time for live', () => {
        expect(progressText({ ...rec, state: 'running', percent: 41 })).toBe('Running · 41%');
        expect(progressText({ ...live, state: 'running', elapsed_s: 725 })).toBe('Running · 12:05');
        expect(progressText({ ...live, state: 'stopped' })).toBe('Stopped');
    });
    it('leaves out the suffix when the figure is missing', () => {
        expect(progressText({ ...rec, state: 'running', percent: null })).toBe('Running');
        expect(progressText({ ...live, state: 'running', elapsed_s: null })).toBe('Running');
    });
});
