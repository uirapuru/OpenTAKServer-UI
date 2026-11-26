// TakLab: analysis window - state, progress, stop button and the grid of recognised faces.
import React, { useEffect, useRef, useState } from 'react';
import { Alert, Badge, Box, Button, Group, Image, Modal, SimpleGrid, Stack, Text, UnstyledButton } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { IconX } from '@tabler/icons-react';
import { t } from 'i18next';
import { Analysis, AnalysisFace, getAnalysis, getFaces, stopAnalysis } from './videoAnalysisApi';
import { isActive, progressText } from './videoAnalysisUtils';

export const POLL_MS = 4000;

export function analysisTitle(a: Analysis | null, id: number): string {
    const interpolation = { escapeValue: false };
    if (a?.source === 'live') return t('Analysis #{{id}} · live {{path}}', { id, path: a.label, interpolation });
    return t('Analysis #{{id}} · recording “{{name}}”', { id, name: a?.label ?? '', interpolation });
}

export function AnalysisModal({ analysisId, onClose }: { analysisId: number | null; onClose: () => void }) {
    const [analysis, setAnalysis] = useState<Analysis | null>(null);
    const [faces, setFaces] = useState<AnalysisFace[]>([]);
    const [selected, setSelected] = useState<AnalysisFace | null>(null);
    const [stopping, setStopping] = useState(false);
    const runRef = useRef<() => boolean>(() => false);

    // Each effect run owns its own `isCancelled` closure, so a late fetch from a
    // previous run (closed window, switched analysis) can neither write state nor
    // start an interval.
    useEffect(() => {
        setAnalysis(null);
        setFaces([]);
        setSelected(null);
        if (analysisId === null) return undefined;
        let isCancelled = false;
        let timer: ReturnType<typeof setInterval> | undefined;
        const stop = () => { if (timer !== undefined) { clearInterval(timer); timer = undefined; } };
        const refresh = async (): Promise<Analysis | null> => {
            try {
                const [a, f] = await Promise.all([getAnalysis(analysisId), getFaces(analysisId)]);
                if (isCancelled) return null;
                setAnalysis(a);
                setFaces(f);
                return a;
            } catch (err) {
                console.log(err);
                return null;
            }
        };
        runRef.current = () => !isCancelled;
        refresh().then((a) => {
            if (isCancelled || (a && !isActive(a))) return;
            timer = setInterval(async () => {
                const next = await refresh();
                if (next && !isActive(next)) stop();
            }, POLL_MS);
        });
        return () => { isCancelled = true; stop(); };
    }, [analysisId]);

    const handleStop = async () => {
        if (analysisId === null) return;
        setStopping(true);
        try {
            const a = await stopAnalysis(analysisId);
            if (runRef.current()) setAnalysis(a);
        } catch (err) {
            const e = err as { response?: { data?: { error?: string } }; message?: string };
            notifications.show({ title: t('Error'), message: e?.response?.data?.error ?? e?.message ?? '', color: 'red', icon: <IconX /> });
        } finally {
            if (runRef.current()) setStopping(false);
        }
    };

    return (
        <>
            <Modal opened={analysisId !== null} onClose={onClose} size="xl" title={analysisId !== null ? analysisTitle(analysis, analysisId) : ''}>
                <Stack>
                    {analysis && (
                        <Group justify="space-between">
                            <Text fw={600}>{progressText(analysis)}</Text>
                            {isActive(analysis) && (
                                <Button color="red" variant="light" loading={stopping} onClick={handleStop}>{t('Stop')}</Button>
                            )}
                        </Group>
                    )}
                    {analysis?.error && <Alert color="red">{analysis.error}</Alert>}
                    {faces.length === 0 ? (
                        <Text c="dimmed">{t('No faces recognised yet.')}</Text>
                    ) : (
                        <SimpleGrid cols={{ base: 2, sm: 3, md: 4 }}>
                            {faces.map((face) => (
                                <UnstyledButton key={face.id} onClick={() => setSelected(face)} aria-label={face.label} style={{ position: 'relative', display: 'block' }}>
                                    <Image src={face.thumb_url} alt={face.label} radius="sm" />
                                    <Badge color="red" radius="xl" style={{ position: 'absolute', right: 6, bottom: 6, color: 'white' }}>{face.count}</Badge>
                                </UnstyledButton>
                            ))}
                        </SimpleGrid>
                    )}
                </Stack>
            </Modal>
            <Modal opened={selected !== null} onClose={() => setSelected(null)} title={selected?.label ?? ''} size="md">
                {selected && (
                    <Stack>
                        <Image src={selected.thumb_url} alt={selected.label} radius="sm" />
                        <Text fw={600}>{t('Appearances')}</Text>
                        <Box>
                            {selected.moments.map((m) => (
                                <Text key={m.sighting_id} size="sm">{m.moment}</Text>
                            ))}
                        </Box>
                    </Stack>
                )}
            </Modal>
        </>
    );
}

export default AnalysisModal;
