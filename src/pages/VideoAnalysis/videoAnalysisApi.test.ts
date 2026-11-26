import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getAnalysis, getFaces, getSources, getVisionStatus, listAnalyses, startAnalysis, stopAnalysis } from './videoAnalysisApi';

const { get, post } = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn() }));
vi.mock('../../axios_config', () => ({ default: { get, post } }));

beforeEach(() => { get.mockReset(); post.mockReset(); });

describe('getVisionStatus', () => {
    it('reads the enabled flag', async () => {
        get.mockResolvedValue({ data: { enabled: true } });
        expect(await getVisionStatus()).toBe(true);
        expect(get).toHaveBeenCalledWith('/api/taklab/vision/status');
        get.mockResolvedValue({ data: { enabled: false } });
        expect(await getVisionStatus()).toBe(false);
    });
    it('is false when the server refuses', async () => {
        get.mockRejectedValue(new Error('403'));
        expect(await getVisionStatus()).toBe(false);
    });
});

describe('listAnalyses', () => {
    it('unwraps the analyses envelope', async () => {
        get.mockResolvedValue({ data: { analyses: [{ id: 3 }] } });
        expect(await listAnalyses()).toEqual([{ id: 3 }]);
        expect(get).toHaveBeenCalledWith('/api/taklab/vision/analyses');
    });
    it('gives an empty list when the envelope is missing', async () => {
        get.mockResolvedValue({ data: {} });
        expect(await listAnalyses()).toEqual([]);
    });
});

describe('getSources', () => {
    it('returns live streams and recordings', async () => {
        get.mockResolvedValue({ data: { live: [{ path: 'live/jan' }], recordings: [{ id: 'r1' }] } });
        expect(await getSources()).toEqual({ live: [{ path: 'live/jan' }], recordings: [{ id: 'r1' }] });
        expect(get).toHaveBeenCalledWith('/api/taklab/vision/sources');
    });
    it('defaults missing lists to empty', async () => {
        get.mockResolvedValue({ data: {} });
        expect(await getSources()).toEqual({ live: [], recordings: [] });
    });
});

describe('startAnalysis', () => {
    it('posts a live choice', async () => {
        post.mockResolvedValue({ data: { id: 7 } });
        expect(await startAnalysis({ source: 'live', path: 'live/jan' })).toEqual({ id: 7 });
        expect(post).toHaveBeenCalledWith('/api/taklab/vision/analyses', { source: 'live', path: 'live/jan' });
    });
    it('posts a recording choice', async () => {
        post.mockResolvedValue({ data: { id: 8 } });
        await startAnalysis({ source: 'recording', recording_id: 'abc' });
        expect(post).toHaveBeenCalledWith('/api/taklab/vision/analyses', { source: 'recording', recording_id: 'abc' });
    });
});

describe('single analysis', () => {
    it('gets one analysis', async () => {
        get.mockResolvedValue({ data: { id: 5 } });
        expect(await getAnalysis(5)).toEqual({ id: 5 });
        expect(get).toHaveBeenCalledWith('/api/taklab/vision/analyses/5');
    });
    it('stops one analysis', async () => {
        post.mockResolvedValue({ data: { id: 5, state: 'stopped' } });
        expect(await stopAnalysis(5)).toEqual({ id: 5, state: 'stopped' });
        expect(post).toHaveBeenCalledWith('/api/taklab/vision/analyses/5/stop');
    });
    it('unwraps faces', async () => {
        get.mockResolvedValue({ data: { items: [{ id: 1, label: 'Osoba 1' }] } });
        expect(await getFaces(5)).toEqual([{ id: 1, label: 'Osoba 1' }]);
        expect(get).toHaveBeenCalledWith('/api/taklab/vision/analyses/5/faces');
    });
});
