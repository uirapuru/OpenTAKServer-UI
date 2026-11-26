// TakLab: "Video analysis" page - list of on-demand analyses, start a new one, open its faces.
import React, { useCallback, useEffect, useState } from 'react';
import { Alert, Button, Group, Table, Text, Title } from '@mantine/core';
import { IconLock } from '@tabler/icons-react';
import { t } from 'i18next';
import { isAdministrator } from '../Recordings/recordingsUtils';
import { Analysis, listAnalyses } from './videoAnalysisApi';
import { isActive, progressText } from './videoAnalysisUtils';
import { NewAnalysisModal } from './NewAnalysisModal';
import { AnalysisModal, POLL_MS } from './AnalysisModal';

export { POLL_MS };

function formatWhen(value: string): string {
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return value;
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function NotAllowed() {
    return (
        <Alert icon={<IconLock />} color="gray">
            {t('Video analysis is available to the administrator only.')}
        </Alert>
    );
}

export default function VideoAnalysis() {
    const admin = isAdministrator();
    const [analyses, setAnalyses] = useState<Analysis[]>([]);
    const [forbidden, setForbidden] = useState(false);
    const [newOpen, setNewOpen] = useState(false);
    const [openId, setOpenId] = useState<number | null>(null);

    const load = useCallback(async () => {
        try {
            setAnalyses(await listAnalyses());
        } catch (err) {
            if ((err as { response?: { status?: number } })?.response?.status === 403) setForbidden(true);
            else console.log(err);
        }
    }, []);

    useEffect(() => {
        if (admin) load();
    }, [admin, load]);

    const anyActive = analyses.some(isActive);
    useEffect(() => {
        if (!admin || !anyActive) return undefined;
        const timer = setInterval(load, POLL_MS);
        return () => clearInterval(timer);
    }, [admin, anyActive, load]);

    if (!admin || forbidden) return <NotAllowed />;

    return (
        <>
            <Group justify="space-between" mb="md">
                <Title order={3}>{t('Video analysis')}</Title>
                <Button onClick={() => setNewOpen(true)}>{t('New analysis')}</Button>
            </Group>
            <Table highlightOnHover>
                <Table.Thead>
                    <Table.Tr>
                        <Table.Th>{t('Source')}</Table.Th>
                        <Table.Th>{t('Started by')}</Table.Th>
                        <Table.Th>{t('When')}</Table.Th>
                        <Table.Th>{t('State')}</Table.Th>
                        <Table.Th>{t('Persons')}</Table.Th>
                    </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                    {analyses.map((a) => (
                        <Table.Tr key={a.id} onClick={() => setOpenId(a.id)} style={{ cursor: 'pointer' }}>
                            <Table.Td>
                                {a.label} <Text span c="dimmed" size="sm">({a.source === 'live' ? t('Live') : t('Recording')})</Text>
                            </Table.Td>
                            <Table.Td>{a.created_by}</Table.Td>
                            <Table.Td>{formatWhen(a.created_at)}</Table.Td>
                            <Table.Td>{progressText(a)}</Table.Td>
                            <Table.Td>{a.persons}</Table.Td>
                        </Table.Tr>
                    ))}
                </Table.Tbody>
            </Table>
            <NewAnalysisModal
                opened={newOpen}
                onClose={() => setNewOpen(false)}
                onStarted={(a) => { load(); setOpenId(a.id); }}
            />
            <AnalysisModal analysisId={openId} onClose={() => { setOpenId(null); load(); }} />
        </>
    );
}
