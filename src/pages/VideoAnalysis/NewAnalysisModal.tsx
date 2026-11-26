// TakLab: "New analysis" window - pick one live stream or one ready recording.
import React, { useEffect, useState } from 'react';
import { Button, Group, LoadingOverlay, Modal, Radio, Stack, Text } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { IconX } from '@tabler/icons-react';
import { t } from 'i18next';
import { Analysis, AnalysisChoice, getSources, LiveSource, RecordingSource, startAnalysis } from './videoAnalysisApi';
import { formatDuration } from './videoAnalysisUtils';

function clock(value: string | null): string {
    if (!value) return '';
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return '';
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function stamp(value: string): string {
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return value;
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${clock(value)}`;
}

function errorText(err: unknown): string {
    const e = err as { response?: { data?: { error?: string } }; message?: string };
    return e?.response?.data?.error ?? e?.message ?? '';
}

export function NewAnalysisModal({ opened, onClose, onStarted }: { opened: boolean; onClose: () => void; onStarted: (a: Analysis) => void }) {
    const [live, setLive] = useState<LiveSource[]>([]);
    const [recordings, setRecordings] = useState<RecordingSource[]>([]);
    const [loading, setLoading] = useState(false);
    const [choice, setChoice] = useState<string>('');
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        if (!opened) return undefined;
        let cancelled = false;
        setChoice('');
        setLoading(true);
        getSources()
            .then((s) => { if (!cancelled) { setLive(s.live); setRecordings(s.recordings); } })
            .catch((err) => { if (!cancelled) notifications.show({ title: t('Error'), message: errorText(err), color: 'red', icon: <IconX /> }); })
            .finally(() => { if (!cancelled) setLoading(false); });
        return () => { cancelled = true; };
    }, [opened]);

    const submit = async () => {
        let body: AnalysisChoice;
        if (choice.startsWith('live:')) body = { source: 'live', path: choice.slice(5) };
        else if (choice.startsWith('rec:')) body = { source: 'recording', recording_id: choice.slice(4) };
        else return;
        setSubmitting(true);
        try {
            const a = await startAnalysis(body);
            onStarted(a);
            onClose();
        } catch (err) {
            notifications.show({ title: t('Error'), message: errorText(err), color: 'red', icon: <IconX /> });
        } finally {
            setSubmitting(false);
        }
    };

    const empty = !loading && live.length === 0 && recordings.length === 0;

    return (
        <Modal opened={opened} onClose={onClose} title={t('New analysis')} size="lg">
            <LoadingOverlay visible={loading} />
            <Stack>
                {empty && <Text c="dimmed">{t('Nothing to analyse: no live streams and no ready recordings.')}</Text>}
                <Radio.Group value={choice} onChange={setChoice}>
                    <Stack gap="md">
                        {live.length > 0 && (
                            <Stack gap="xs">
                                <Text fw={600}>{t('Live')}</Text>
                                {live.map((s) => (
                                    <Radio
                                        key={s.path}
                                        value={`live:${s.path}`}
                                        disabled={s.analysis !== null}
                                        label={(
                                            <>
                                                {[
                                                    s.path,
                                                    s.account,
                                                    s.ready_time ? t('since {{time}}', { time: clock(s.ready_time) }) : '',
                                                ].filter((p) => p).join(' · ')}
                                                {s.analysis !== null && <> · <Text span c="dimmed">{t('already being analysed')}</Text></>}
                                            </>
                                        )}
                                    />
                                ))}
                            </Stack>
                        )}
                        {recordings.length > 0 && (
                            <Stack gap="xs">
                                <Text fw={600}>{t('Recordings')}</Text>
                                {recordings.map((r) => (
                                    <Radio
                                        key={r.id}
                                        value={`rec:${r.id}`}
                                        label={[
                                            r.name,
                                            r.account,
                                            stamp(r.started_at),
                                            r.duration_s !== null ? formatDuration(r.duration_s) : '',
                                        ].filter((p) => p).join(' · ')}
                                    />
                                ))}
                            </Stack>
                        )}
                    </Stack>
                </Radio.Group>
                <Group justify="flex-end">
                    <Button variant="default" onClick={onClose}>{t('Cancel')}</Button>
                    <Button disabled={choice === ''} loading={submitting} onClick={submit}>{t('Analyse')}</Button>
                </Group>
            </Stack>
        </Modal>
    );
}

export default NewAnalysisModal;
