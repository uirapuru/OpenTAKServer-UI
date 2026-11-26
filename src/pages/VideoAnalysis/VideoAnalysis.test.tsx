import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, userEvent, act } from '@test-utils';
import { useState } from 'react';
import i18next from 'i18next';
import VideoAnalysis from './VideoAnalysis';
import { AnalysisModal, POLL_MS } from './AnalysisModal';

// Uninitialised i18next returns undefined from t(); keys are English text.
beforeAll(() => i18next.init({ lng: 'en', resources: {}, returnEmptyString: false }));

const { get, post } = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn() }));
vi.mock('../../axios_config', () => ({ default: { get, post } }));

Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: (query: string) => ({
        matches: true, media: query, onchange: null,
        addListener: () => {}, removeListener: () => {}, addEventListener: () => {}, removeEventListener: () => {}, dispatchEvent: () => false,
    }),
});

const running = {
    id: 12, source: 'recording', label: 'patrol-3', account: 'ola', created_by: 'admin',
    created_at: '2026-11-26T14:10:00Z', started_at: '2026-11-26T14:10:05Z', finished_at: null,
    state: 'running', percent: 41, elapsed_s: null, persons: 3, error: null,
};
const liveAnalysis = { ...running, id: 13, source: 'live', label: 'live/jan', percent: null, elapsed_s: 60 };
const faces = [
    { id: 1, label: 'Osoba 1', count: 3, thumb_url: '/api/taklab/vision/faces/1/thumb', moments: [{ moment: '00:12:41', at: '2026-11-26T14:22:46Z', sighting_id: 9 }] },
    { id: 2, label: 'Osoba 2', count: 1, thumb_url: '/api/taklab/vision/faces/2/thumb', moments: [] },
];
let analyses: unknown[];
let sources: { live: unknown[]; recordings: unknown[] };
let single: unknown;

beforeEach(() => {
    localStorage.clear();
    localStorage.setItem('administrator', 'true');
    get.mockReset(); post.mockReset();
    analyses = [running];
    sources = { live: [], recordings: [] };
    single = running;
    get.mockImplementation((url: string) => {
        if (url.endsWith('/faces')) return Promise.resolve({ data: { items: faces } });
        if (url.endsWith('/sources')) return Promise.resolve({ data: sources });
        if (url.endsWith('/analyses')) return Promise.resolve({ data: { analyses } });
        return Promise.resolve({ data: single });
    });
});
afterEach(() => { vi.useRealTimers(); });

describe('VideoAnalysis page', () => {
    it('shows the admin-only message without calling the API', async () => {
        localStorage.setItem('administrator', 'false');
        render(<VideoAnalysis />);
        expect(screen.getByText('Video analysis is available to the administrator only.')).toBeInTheDocument();
        expect(get).not.toHaveBeenCalled();
    });

    it('shows the same message on 403', async () => {
        get.mockRejectedValue({ response: { status: 403 } });
        render(<VideoAnalysis />);
        expect(await screen.findByText('Video analysis is available to the administrator only.')).toBeInTheDocument();
    });

    it('lists analyses with source, creator and progress', async () => {
        render(<VideoAnalysis />);
        expect(await screen.findByText(/patrol-3/)).toBeInTheDocument();
        expect(screen.getByText('admin')).toBeInTheDocument();
        expect(screen.getByText('Running · 41%')).toBeInTheDocument();
        expect(screen.getByText('3')).toBeInTheDocument();
    });

    it('starts a recording analysis from the new-analysis modal', async () => {
        sources = { live: [], recordings: [{ id: 'r1', name: 'patrol-3', account: 'ola', started_at: '2026-11-26T14:10:00Z', duration_s: 760 }] };
        post.mockResolvedValue({ data: { ...running, id: 20 } });
        const user = userEvent.setup();
        render(<VideoAnalysis />);
        await user.click(await screen.findByRole('button', { name: 'New analysis' }));
        const analyse = await screen.findByRole('button', { name: 'Analyse' });
        expect(analyse).toBeDisabled();
        await user.click(await screen.findByRole('radio', { name: /patrol-3/ }));
        await user.click(analyse);
        await waitFor(() => expect(post).toHaveBeenCalledWith('/api/taklab/vision/analyses', { source: 'recording', recording_id: 'r1' }));
    });

    it('disables a live stream that is already being analysed', async () => {
        sources = { live: [
            { path: 'live/jan', account: 'jan', ready_time: null, auto: true, analysis: 5 },
            { path: 'live/ola', account: 'ola', ready_time: null, auto: true, analysis: null },
        ], recordings: [] };
        const user = userEvent.setup();
        render(<VideoAnalysis />);
        await user.click(await screen.findByRole('button', { name: 'New analysis' }));
        expect(await screen.findByRole('radio', { name: /live\/jan/ })).toBeDisabled();
        expect(screen.getByText('already being analysed')).toBeInTheDocument();
        expect(screen.getByRole('radio', { name: /live\/ola/ })).not.toBeDisabled();
    });

    it('shows the empty-sources message', async () => {
        const user = userEvent.setup();
        render(<VideoAnalysis />);
        await user.click(await screen.findByRole('button', { name: 'New analysis' }));
        expect(await screen.findByText('Nothing to analyse: no live streams and no ready recordings.')).toBeInTheDocument();
    });
});

describe('AnalysisModal', () => {
    it('shows faces with the count badge and moments on click', async () => {
        const user = userEvent.setup();
        render(<AnalysisModal analysisId={12} onClose={() => {}} />);
        expect(await screen.findByText('Analysis #12 · recording “patrol-3”')).toBeInTheDocument();
        expect(await screen.findByText('Running · 41%')).toBeInTheDocument();
        const imgs = await screen.findAllByRole('img');
        expect(imgs[0]).toHaveAttribute('src', '/api/taklab/vision/faces/1/thumb');
        expect(screen.getByText('3')).toBeInTheDocument();
        await user.click(imgs[0]);
        expect(await screen.findByText('00:12:41')).toBeInTheDocument();
    });

    it('titles a live analysis with its path', async () => {
        single = liveAnalysis;
        render(<AnalysisModal analysisId={13} onClose={() => {}} />);
        expect(await screen.findByText('Analysis #13 · live live/jan')).toBeInTheDocument();
    });

    it('shows the empty-grid message', async () => {
        get.mockImplementation((url: string) => Promise.resolve({ data: url.endsWith('/faces') ? { items: [] } : single }));
        render(<AnalysisModal analysisId={12} onClose={() => {}} />);
        expect(await screen.findByText('No faces recognised yet.')).toBeInTheDocument();
    });

    it('polls every 4 s while running and stops after the final state', async () => {
        vi.useFakeTimers({ shouldAdvanceTime: true });
        render(<AnalysisModal analysisId={12} onClose={() => {}} />);
        await screen.findByText('Running · 41%');
        const count = () => get.mock.calls.filter(([u]) => u === '/api/taklab/vision/analyses/12').length;
        expect(count()).toBe(1);
        await act(async () => { await vi.advanceTimersByTimeAsync(POLL_MS); });
        expect(count()).toBe(2);
        single = { ...running, state: 'done', percent: 100 };
        await act(async () => { await vi.advanceTimersByTimeAsync(POLL_MS); });
        expect(count()).toBe(3);
        expect(await screen.findByText('Done')).toBeInTheDocument();
        await act(async () => { await vi.advanceTimersByTimeAsync(POLL_MS * 3); });
        expect(count()).toBe(3);
    });

    it('starts no polling when closed before the first fetch resolves', async () => {
        vi.useFakeTimers({ shouldAdvanceTime: true });
        let release: (v: unknown) => void = () => {};
        const gate = new Promise((r) => { release = r; });
        get.mockImplementation(async (url: string) => {
            await gate;
            return url.endsWith('/faces') ? { data: { items: faces } } : { data: single };
        });
        // Close from inside, so the same component instance sees the id change.
        function Host() {
            const [id, setId] = useState<number | null>(12);
            return <><button type="button" onClick={() => setId(null)}>close-it</button><AnalysisModal analysisId={id} onClose={() => {}} /></>;
        }
        const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
        render(<Host />);
        await user.click(screen.getByText('close-it'));
        release(null);
        await act(async () => { await vi.advanceTimersByTimeAsync(0); });
        const before = get.mock.calls.length;
        await act(async () => { await vi.advanceTimersByTimeAsync(POLL_MS * 3); });
        expect(get.mock.calls.length).toBe(before);
    });

    it('stops polling when unmounted', async () => {
        vi.useFakeTimers({ shouldAdvanceTime: true });
        const { unmount } = render(<AnalysisModal analysisId={12} onClose={() => {}} />);
        await screen.findByText('Running · 41%');
        unmount();
        const before = get.mock.calls.length;
        await act(async () => { await vi.advanceTimersByTimeAsync(POLL_MS * 3); });
        expect(get.mock.calls.length).toBe(before);
    });

    it('stop button calls stopAnalysis', async () => {
        post.mockResolvedValue({ data: { ...running, state: 'stopped' } });
        const user = userEvent.setup();
        render(<AnalysisModal analysisId={12} onClose={() => {}} />);
        await user.click(await screen.findByRole('button', { name: 'Stop' }));
        await waitFor(() => expect(post).toHaveBeenCalledWith('/api/taklab/vision/analyses/12/stop'));
    });
});
