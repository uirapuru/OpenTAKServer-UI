// TakLab: client for on-demand video analysis in the taklab OpenTAKServer fork
// (blueprint taklab_vision_api.py, routes under /api/taklab/vision).
import axios from '../../axios_config';
import { apiRoutes } from '../../apiRoutes';

export type AnalysisState = 'queued' | 'running' | 'done' | 'stopped' | 'error';

export interface Analysis {
    id: number;
    source: 'live' | 'recording';
    label: string;
    account: string | null;
    created_by: string;
    created_at: string;
    started_at: string | null;
    finished_at: string | null;
    state: AnalysisState;
    percent: number | null;
    elapsed_s: number | null;
    persons: number;
    error: string | null;
}

export interface LiveSource {
    path: string;
    account: string | null;
    ready_time: string | null;
    auto: boolean;
    analysis: number | null;
}

export interface RecordingSource {
    id: string;
    name: string;
    account: string | null;
    started_at: string;
    duration_s: number | null;
}

export interface FaceMoment {
    moment: string;
    at: string;
    sighting_id: number;
}

export interface AnalysisFace {
    id: number;
    label: string;
    count: number;
    thumb_url: string;
    moments: FaceMoment[];
}

export type AnalysisChoice = { source: 'live'; path: string } | { source: 'recording'; recording_id: string };

const base = apiRoutes.taklabVision;

// Any failure (feature off, not an administrator, server down) means "hide it".
export async function getVisionStatus(): Promise<boolean> {
    try {
        const r = await axios.get(`${base}/status`);
        return r.data?.enabled === true;
    } catch {
        return false;
    }
}

export async function listAnalyses(): Promise<Analysis[]> {
    const r = await axios.get(`${base}/analyses`);
    return Array.isArray(r.data?.analyses) ? r.data.analyses : [];
}

export async function getSources(): Promise<{ live: LiveSource[]; recordings: RecordingSource[] }> {
    const r = await axios.get(`${base}/sources`);
    return {
        live: Array.isArray(r.data?.live) ? r.data.live : [],
        recordings: Array.isArray(r.data?.recordings) ? r.data.recordings : [],
    };
}

export async function startAnalysis(choice: AnalysisChoice): Promise<Analysis> {
    const r = await axios.post(`${base}/analyses`, choice);
    return r.data as Analysis;
}

export async function getAnalysis(id: number): Promise<Analysis> {
    const r = await axios.get(`${base}/analyses/${id}`);
    return r.data as Analysis;
}

export async function stopAnalysis(id: number): Promise<Analysis> {
    const r = await axios.post(`${base}/analyses/${id}/stop`);
    return r.data as Analysis;
}

export async function getFaces(id: number): Promise<AnalysisFace[]> {
    const r = await axios.get(`${base}/analyses/${id}/faces`);
    return Array.isArray(r.data?.items) ? r.data.items : [];
}
