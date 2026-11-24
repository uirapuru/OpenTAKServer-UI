// TakLab: "Recordings" page - videos, voice messages and OCR scans kept by the
// recordings registry of the taklab OpenTAKServer fork (/api/taklab/recordings).
import React, { useCallback, useEffect, useState } from 'react';
import {
    ActionIcon,
    Alert,
    Anchor,
    Badge,
    Button,
    CopyButton,
    Group,
    Image,
    LoadingOverlay,
    Modal,
    Paper,
    Progress,
    Select,
    Stack,
    Table,
    Text,
    TextInput,
    Textarea,
    Tooltip,
} from '@mantine/core';
import { DateTimePicker } from '@mantine/dates';
import { notifications } from '@mantine/notifications';
import {
    IconCheck,
    IconCopy,
    IconDownload,
    IconExternalLink,
    IconEye,
    IconFileZip,
    IconLock,
    IconPencil,
    IconTrash,
    IconX,
} from '@tabler/icons-react';
import { DataTable } from 'mantine-datatable';
import { t } from 'i18next';
import bytes_formatter from '@/bytes_formatter';
import {
    archiveUrlForFilters,
    archiveUrlForIds,
    deleteRecording,
    getRecording,
    getUsage,
    listRecordings,
    MAX_ARCHIVE_IDS,
    Recording,
    RecordingDetail,
    RecordingFilters,
    RecordingKind,
    RecordingUsage,
    recordingFileUrl,
    renameRecording,
} from './recordingsApi';
import {
    cloudtakUrl,
    displayName,
    formatDurationSeconds,
    formatTimestamp,
    isAdministrator,
    KIND_LABELS,
    usagePercent,
} from './recordingsUtils';
import RecordingMap from './RecordingMap';


function errorMessage(err: unknown): string {
    const e = err as { response?: { data?: { error?: string } }; message?: string };
    return e?.response?.data?.error ?? e?.message ?? '';
}

function notifyError(title: string, err: unknown) {
    console.log(err);
    notifications.show({ title, message: errorMessage(err), color: 'red', icon: <IconX /> });
}

export function RecordingPreview({ detail }: { detail: RecordingDetail }) {
    const src = recordingFileUrl(detail.id);
    return (
        <Stack>
            {detail.kind === 'video' && (
                // eslint-disable-next-line jsx-a11y/media-has-caption
                <video controls preload="metadata" src={src} style={{ width: '100%', maxHeight: '60vh' }} data-testid="preview-video" />
            )}
            {detail.kind === 'voice' && (
                // eslint-disable-next-line jsx-a11y/media-has-caption
                <audio controls preload="metadata" src={src} style={{ width: '100%' }} data-testid="preview-audio" />
            )}
            {detail.kind === 'scan' && <Image src={src} alt={displayName(detail, t)} fit="contain" mah="50vh" />}
            {detail.text && (
                <Stack gap={4}>
                    <Textarea label={detail.kind === 'scan' ? t('Recognized text') : t('Transcript')} value={detail.text} readOnly autosize minRows={3} maxRows={12} />
                    <Group justify="flex-end">
                        <CopyButton value={detail.text}>
                            {({ copied, copy }) => (
                                <Button size="xs" variant="light" color={copied ? 'teal' : 'blue'} onClick={copy} leftSection={copied ? <IconCheck size={14} /> : <IconCopy size={14} />}>
                                    {copied ? t('Copied') : t('Copy')}
                                </Button>
                            )}
                        </CopyButton>
                    </Group>
                </Stack>
            )}
            {(detail.lat !== null || detail.track.length > 0) && (
                <RecordingMap lat={detail.lat} lon={detail.lon} track={detail.track} />
            )}
            <Text size="sm" c="dimmed">
                {[
                    detail.callsign ? `${detail.callsign} (${detail.account})` : detail.account,
                    formatTimestamp(detail.started_at),
                    formatDurationSeconds(detail.duration_s),
                    detail.size_bytes ? bytes_formatter(detail.size_bytes) : '',
                ].filter((part) => part !== '').join(' · ')}
            </Text>
        </Stack>
    );
}

export function UsageBar({ usage }: { usage: RecordingUsage }) {
    const percent = usagePercent(usage.usedBytes, usage.limitBytes);
    const color = percent === null ? 'blue' : percent >= 90 ? 'red' : percent >= 70 ? 'yellow' : 'teal';
    return (
        <Paper withBorder p="sm" radius="md" data-testid="usage-bar">
            <Group justify="space-between" mb={4}>
                <Text size="sm" fw={600}>{t('Recordings storage')}</Text>
                <Text size="sm">
                    {bytes_formatter(usage.usedBytes)}
                    {usage.limitBytes ? ` / ${bytes_formatter(usage.limitBytes)}` : ''}
                    {percent !== null ? ` (${Math.round(percent)}%)` : ''}
                </Text>
            </Group>
            {percent !== null && <Progress value={percent} color={color} size="lg" radius="sm" />}
        </Paper>
    );
}

// Shown instead of the page to accounts without the administrator role. It
// makes no API calls: every recordings route answers 403 for them anyway.
export function AdminOnlyNotice() {
    return (
        <Alert color="yellow" icon={<IconLock />} title={t('Recordings')} data-testid="admin-only">
            {t('Recordings are available to the administrator only.')}
        </Alert>
    );
}

function isForbidden(err: unknown): boolean {
    return (err as { response?: { status?: number } })?.response?.status === 403;
}

// User decision 24 XI 2026: the whole page (list, preview, files, ZIP,
// rename, delete) is for the OTS administrator role only.
export default function Recordings() {
    if (!isAdministrator()) return <AdminOnlyNotice />;
    return <RecordingsAdmin />;
}

function RecordingsAdmin() {
    const mapUrl = cloudtakUrl(window.location.hostname);

    const [filters, setFilters] = useState<RecordingFilters>({ kind: '', account: '', from: null, to: null });
    const [applied, setApplied] = useState<RecordingFilters>(filters);
    const [page, setPage] = useState(1);
    const [records, setRecords] = useState<Recording[]>([]);
    const [total, setTotal] = useState(0);
    const [perPage, setPerPage] = useState(10);
    const [loading, setLoading] = useState(false);
    const [usage, setUsage] = useState<RecordingUsage | null>(null);

    const [preview, setPreview] = useState<RecordingDetail | null>(null);
    const [renaming, setRenaming] = useState<Recording | null>(null);
    const [newName, setNewName] = useState('');
    const [deleting, setDeleting] = useState<Recording | null>(null);
    const [selected, setSelected] = useState<Recording[]>([]);
    // The server still says no (role taken away after login): stop asking.
    const [forbidden, setForbidden] = useState(false);

    const load = useCallback(() => {
        setLoading(true);
        listRecordings(applied, page)
            .then((result) => {
                setRecords(result.items);
                setTotal(result.total);
                setPerPage(result.perPage);
            })
            .catch((err) => {
                if (isForbidden(err)) setForbidden(true);
                else notifyError(t('Could not load recordings'), err);
            })
            .finally(() => setLoading(false));
        getUsage().then(setUsage).catch((err) => console.log(err));
    }, [applied, page]);

    useEffect(() => {
        load();
    }, [load]);

    function applyFilters() {
        setPage(1);
        setApplied({ ...filters });
    }

    function clearFilters() {
        const empty: RecordingFilters = { kind: '', account: '', from: null, to: null };
        setFilters(empty);
        setPage(1);
        setApplied(empty);
    }

    function openPreview(recording: Recording) {
        getRecording(recording.id)
            .then(setPreview)
            .catch((err) => notifyError(t('Could not load recording'), err));
    }

    function submitRename() {
        if (!renaming) return;
        const name = newName.trim();
        if (name === '') return;
        renameRecording(renaming.id, name)
            .then(() => {
                notifications.show({ message: t('Recording renamed'), color: 'green' });
                setRenaming(null);
                load();
            })
            .catch((err) => notifyError(t('Could not rename recording'), err));
    }

    function submitDelete() {
        if (!deleting) return;
        deleteRecording(deleting.id)
            .then(() => {
                notifications.show({ message: t('Recording deleted'), color: 'green' });
                setSelected((current) => current.filter((r) => r.id !== deleting.id));
                setDeleting(null);
                load();
            })
            .catch((err) => notifyError(t('Could not delete recording'), err));
    }

    if (forbidden) return <AdminOnlyNotice />;

    const tooMany = selected.length > MAX_ARCHIVE_IDS;
    const selectedUrl = selected.length > 0 && !tooMany ? archiveUrlForIds(selected.map((r) => r.id)) : undefined;
    const allUrl = total > 0 ? archiveUrlForFilters(applied) : undefined;

    const kindOptions = [
        { value: '', label: t('All kinds') },
        ...(Object.keys(KIND_LABELS) as RecordingKind[]).map((kind) => ({ value: kind, label: t(KIND_LABELS[kind]) })),
    ];

    return (
        <>
            <LoadingOverlay visible={loading} zIndex={1000} overlayProps={{ radius: 'sm', blur: 2, fixed: true }} />
            <Stack>
                {usage && <UsageBar usage={usage} />}

                <Paper withBorder p="sm" radius="md">
                    <Group align="flex-end" wrap="wrap">
                        <Select
                            label={t('Kind')}
                            data={kindOptions}
                            value={filters.kind ?? ''}
                            onChange={(value) => setFilters({ ...filters, kind: (value ?? '') as RecordingKind | '' })}
                            allowDeselect={false}
                            w={170}
                        />
                        <TextInput
                            label={t('Account')}
                            value={filters.account ?? ''}
                            onChange={(e) => setFilters({ ...filters, account: e.currentTarget.value })}
                            onKeyDown={(e) => { if (e.key === 'Enter') applyFilters(); }}
                            w={170}
                        />
                        <DateTimePicker
                            label={t('From')}
                            value={filters.from ?? null}
                            onChange={(value) => setFilters({ ...filters, from: value })}
                            valueFormat="YYYY-MM-DD HH:mm"
                            clearable
                            firstDayOfWeek={1}
                            w={190}
                        />
                        <DateTimePicker
                            label={t('To')}
                            value={filters.to ?? null}
                            onChange={(value) => setFilters({ ...filters, to: value })}
                            valueFormat="YYYY-MM-DD HH:mm"
                            clearable
                            firstDayOfWeek={1}
                            w={190}
                        />
                        <Button onClick={applyFilters}>{t('Filter')}</Button>
                        <Button variant="default" onClick={clearFilters}>{t('Clear filters')}</Button>
                        {mapUrl && (
                            <Anchor href={mapUrl} target="_blank" rel="noopener" ml="auto">
                                <Group gap={4}><IconExternalLink size={16} />{t('Show in CloudTAK')}</Group>
                            </Anchor>
                        )}
                    </Group>
                </Paper>

                <Group gap="sm" wrap="wrap" data-testid="archive-bar">
                    <Button
                        component="a"
                        href={selectedUrl}
                        download
                        disabled={selectedUrl === undefined}
                        leftSection={<IconFileZip size={18} />}
                    >
                        {t('Download selected (ZIP)')}
                    </Button>
                    <Button
                        component="a"
                        href={allUrl}
                        download
                        variant="light"
                        disabled={allUrl === undefined}
                        leftSection={<IconFileZip size={18} />}
                    >
                        {t('Download all matching the filters (ZIP)')}
                    </Button>
                    {selected.length > 0 && (
                        <>
                            <Text size="sm" data-testid="selected-count">{`${t('Selected')}: ${selected.length}`}</Text>
                            <Button variant="subtle" size="xs" onClick={() => setSelected([])}>{t('Clear selection')}</Button>
                        </>
                    )}
                    {tooMany && (
                        <Text size="sm" c="red">{t('One archive holds up to 100 selected recordings.')}</Text>
                    )}
                </Group>

                <Table.ScrollContainer minWidth="100%">
                    <DataTable
                        withTableBorder
                        borderRadius="md"
                        shadow="sm"
                        striped
                        highlightOnHover
                        idAccessor="id"
                        records={records}
                        selectedRecords={selected}
                        onSelectedRecordsChange={setSelected}
                        noRecordsText={t('No recordings')}
                        columns={[
                            {
                                accessor: 'kind',
                                title: t('Kind'),
                                render: (r) => <Badge variant="light" color={r.kind === 'video' ? 'blue' : r.kind === 'voice' ? 'grape' : 'orange'}>{t(KIND_LABELS[r.kind] ?? r.kind)}</Badge>,
                            },
                            { accessor: 'name', title: t('Name'), render: (r) => displayName(r, t) },
                            { accessor: 'account', title: t('Account'), render: (r) => (r.callsign ? `${r.callsign} (${r.account})` : r.account) },
                            { accessor: 'started_at', title: t('Start'), render: (r) => formatTimestamp(r.started_at) },
                            { accessor: 'duration_s', title: t('Duration'), render: (r) => formatDurationSeconds(r.duration_s) },
                            { accessor: 'size_bytes', title: t('Size'), render: (r) => (r.size_bytes ? bytes_formatter(r.size_bytes) : '') },
                            {
                                accessor: 'actions',
                                title: '',
                                textAlign: 'right',
                                render: (r) => (
                                    <Group gap={4} justify="flex-end" wrap="nowrap">
                                        <Tooltip label={t('Preview')}>
                                            <ActionIcon variant="subtle" aria-label={t('Preview')} onClick={() => openPreview(r)}><IconEye size={18} /></ActionIcon>
                                        </Tooltip>
                                        <Tooltip label={t('Download')}>
                                            <ActionIcon variant="subtle" aria-label={t('Download')} component="a" href={recordingFileUrl(r.id)} download><IconDownload size={18} /></ActionIcon>
                                        </Tooltip>
                                        <Tooltip label={t('Rename')}>
                                            <ActionIcon variant="subtle" aria-label={t('Rename')} onClick={() => { setRenaming(r); setNewName(r.name ?? ''); }}><IconPencil size={18} /></ActionIcon>
                                        </Tooltip>
                                        <Tooltip label={t('Delete recording')}>
                                            <ActionIcon variant="subtle" color="red" aria-label={t('Delete recording')} onClick={() => setDeleting(r)}><IconTrash size={18} /></ActionIcon>
                                        </Tooltip>
                                    </Group>
                                ),
                            },
                        ]}
                        page={page}
                        onPageChange={setPage}
                        totalRecords={total}
                        recordsPerPage={perPage}
                        fetching={loading}
                        minHeight={180}
                    />
                </Table.ScrollContainer>
            </Stack>

            <Modal opened={preview !== null} onClose={() => setPreview(null)} title={preview ? displayName(preview, t) : ''} size="xl">
                {preview && <RecordingPreview detail={preview} />}
            </Modal>

            <Modal opened={renaming !== null} onClose={() => setRenaming(null)} title={t('Rename recording')}>
                <TextInput
                    label={t('Name')}
                    value={newName}
                    onChange={(e) => setNewName(e.currentTarget.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') submitRename(); }}
                    data-autofocus
                />
                <Group justify="flex-end" mt="md">
                    <Button variant="default" onClick={() => setRenaming(null)}>{t('Cancel')}</Button>
                    <Button onClick={submitRename} disabled={newName.trim() === ''}>{t('Save name')}</Button>
                </Group>
            </Modal>

            <Modal opened={deleting !== null} onClose={() => setDeleting(null)} title={t('Delete recording')}>
                <Text>{deleting ? `${t('Are you sure you want to delete this recording?')} ${displayName(deleting, t)}` : ''}</Text>
                <Group justify="flex-end" mt="md">
                    <Button variant="default" onClick={() => setDeleting(null)}>{t('Cancel')}</Button>
                    <Button color="red" onClick={submitDelete}>{t('Delete recording')}</Button>
                </Group>
            </Modal>
        </>
    );
}
