import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, userEvent, within } from '@test-utils';
import i18next from 'i18next';
import Recordings, { RecordingPreview } from './Recordings';

// Uninitialised i18next returns undefined from t(); keys are English text.
beforeAll(() => i18next.init({ lng: 'en', resources: {}, returnEmptyString: false }));

const { get, patch, del } = vi.hoisted(() => ({ get: vi.fn(), patch: vi.fn(), del: vi.fn() }));
vi.mock('../../axios_config', () => ({ default: { get, patch, delete: del } }));

const list = {
    results: [
        { id: 1, kind: 'video', account: 'operator', callsign: 'ALFA', uid: 'ANDROID-1', name: 'Patrol', started_at: '2026-11-24T10:00:00Z', ended_at: '2026-11-24T10:05:00Z', duration_s: 300, lat: 51.1, lon: 17.0, size_bytes: 1048576, has_text: false },
        { id: 2, kind: 'scan', account: 'biali', callsign: 'BRAVO', uid: 'ANDROID-2', name: null, started_at: '2026-11-24T11:00:00Z', ended_at: null, duration_s: null, lat: null, lon: null, size_bytes: 2048, has_text: true },
    ],
    total: 2, current_page: 1, total_pages: 1, per_page: 10,
};

// mantine-datatable hides a column when its media query does not match; the
// global jsdom stub answers "false" to every query, which hides all cells.
// Mantine Textarea autosize listens to document.fonts, which jsdom lacks.
Object.defineProperty(document, 'fonts', { value: { addEventListener: () => {}, removeEventListener: () => {} }, configurable: true });

Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: (query: string) => ({
        matches: true, media: query, onchange: null,
        addListener: () => {}, removeListener: () => {}, addEventListener: () => {}, removeEventListener: () => {}, dispatchEvent: () => false,
    }),
});

beforeEach(() => {
    localStorage.clear();
    get.mockReset(); patch.mockReset(); del.mockReset();
    get.mockImplementation((url: string) => {
        if (url.endsWith('/usage')) return Promise.resolve({ status: 200, data: { used_bytes: 45 * 2 ** 30, limit_bytes: 50 * 2 ** 30 } });
        return Promise.resolve({ status: 200, data: list });
    });
});

describe('Recordings page', () => {
    it('shows the usage bar and all actions to the administrator', async () => {
        localStorage.setItem('administrator', 'true');
        localStorage.setItem('username', 'administrator');
        render(<Recordings />);
        expect(await screen.findByText('Patrol')).toBeInTheDocument();
        expect(await screen.findByTestId('usage-bar')).toHaveTextContent('90%');
        expect(screen.getAllByLabelText('Delete recording')).toHaveLength(2);
        expect(get).toHaveBeenCalledWith('/api/taklab/recordings', { params: { page: 1 } });
    });

    it('lets a regular user change only own recordings and hides usage', async () => {
        localStorage.setItem('administrator', 'false');
        localStorage.setItem('username', 'operator');
        render(<Recordings />);
        expect(await screen.findByText('Patrol')).toBeInTheDocument();
        expect(screen.getAllByLabelText('Delete recording')).toHaveLength(1);
        expect(screen.getAllByLabelText('Download')).toHaveLength(2);
        expect(screen.queryByTestId('usage-bar')).toBeNull();
        expect(get).not.toHaveBeenCalledWith('/api/taklab/recordings/usage');
    });

    it('sends the filters to the API', async () => {
        localStorage.setItem('username', 'operator');
        render(<Recordings />);
        await screen.findByText('Patrol');
        await userEvent.type(screen.getByLabelText('Account'), 'biali{enter}');
        await waitFor(() => expect(get).toHaveBeenCalledWith('/api/taklab/recordings', { params: { page: 1, account: 'biali' } }));
    });

    it('renames through PATCH and deletes through DELETE', async () => {
        localStorage.setItem('username', 'operator');
        patch.mockResolvedValue({ status: 200 });
        del.mockResolvedValue({ status: 200 });
        render(<Recordings />);
        await screen.findByText('Patrol');
        await userEvent.click(screen.getByLabelText('Rename'));
        const input = await screen.findByDisplayValue('Patrol');
        await userEvent.clear(input);
        await userEvent.type(input, 'Patrol 2{enter}');
        await waitFor(() => expect(patch).toHaveBeenCalledWith('/api/taklab/recordings/1', { name: 'Patrol 2' }));
        await userEvent.click(screen.getByLabelText('Delete recording'));
        const dialog = await screen.findByRole('dialog', { name: 'Delete recording' });
        await userEvent.click(within(dialog).getByRole('button', { name: 'Delete recording' }));
        await waitFor(() => expect(del).toHaveBeenCalledWith('/api/taklab/recordings/1'));
    });
});

describe('RecordingPreview', () => {
    it('shows a scan with its text and a copy button', () => {
        render(<RecordingPreview detail={{ ...list.results[1], kind: 'scan', track: [], text: 'ROZKAZ' } as never} />);
        expect(screen.getByDisplayValue('ROZKAZ')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Copy' })).toBeInTheDocument();
        expect(screen.getByRole('img')).toHaveAttribute('src', '/api/taklab/recordings/2/file');
    });
    it('plays video and voice from the file route', () => {
        const { unmount } = render(<RecordingPreview detail={{ ...list.results[0], lat: null, track: [], text: null } as never} />);
        expect(screen.getByTestId('preview-video')).toHaveAttribute('src', '/api/taklab/recordings/1/file');
        unmount();
        render(<RecordingPreview detail={{ ...list.results[0], kind: 'voice', lat: null, track: [], text: 'meldunek' } as never} />);
        expect(screen.getByTestId('preview-audio')).toBeInTheDocument();
        expect(screen.getByDisplayValue('meldunek')).toBeInTheDocument();
    });
});
