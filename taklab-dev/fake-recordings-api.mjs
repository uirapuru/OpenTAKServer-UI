#!/usr/bin/env node
// TakLab: local stand-in for the OTS recordings API, for developing and
// screenshotting the Recordings page without a server.
//
//   node taklab-dev/fake-recordings-api.mjs [dist-dir] [port]
//
// Serves the built UI from dist-dir (default ./dist) and fakes
// /api/taklab/recordings* per the contract in ~/taklab
// docs/superpowers/specs/2026-11-24-recordings-design.md. The current user is
// taken from the cookie "fake_user" (default "operator"); "administrator" is
// the admin. As in the OTS fork (branch taklab/recordings-admin, decision of
// 24 XI 2026) every route answers 403 to anyone else. The archive route
// GET /api/taklab/recordings/archive?ids=a,b or ?all=1&kind=&account=&from=&to=
// returns a small stored (uncompressed) ZIP. Sample media are generated with
// ffmpeg on first start.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execFileSync } from 'node:child_process';
import zlib from 'node:zlib';

const dist = path.resolve(process.argv[2] ?? 'dist');
const port = Number(process.argv[3] ?? 8099);
const mediaDir = path.join(os.tmpdir(), 'taklab-fake-recordings-media');

function makeMedia() {
    fs.mkdirSync(mediaDir, { recursive: true });
    const jobs = [
        ['video.mp4', ['-f', 'lavfi', '-i', 'testsrc2=size=640x360:rate=25', '-f', 'lavfi', '-i', 'sine=frequency=440', '-t', '8', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-movflags', '+faststart']],
        ['voice.ogg', ['-f', 'lavfi', '-i', 'sine=frequency=330', '-t', '5', '-c:a', 'libopus']],
        ['scan.jpg', ['-f', 'lavfi', '-i', 'color=c=white:size=800x560', '-vf', "drawtext=text='ROZKAZ BOJOWY NR 3':x=60:y=80:fontsize=40:fontcolor=black,drawtext=text='Pluton 1 - rejon Bielany':x=60:y=160:fontsize=30:fontcolor=black,drawtext=text='Godz. 06.00 wymarsz':x=60:y=220:fontsize=30:fontcolor=black", '-frames:v', '1']],
    ];
    for (const [name, args] of jobs) {
        const out = path.join(mediaDir, name);
        if (fs.existsSync(out)) continue;
        try {
            execFileSync('ffmpeg', ['-y', '-loglevel', 'error', ...args, out]);
        } catch (err) {
            console.error(`ffmpeg failed for ${name}: ${err.message}`);
        }
    }
}

const track = (lat, lon, n) => Array.from({ length: n }, (_, i) => [lat + i * 0.0006, lon + Math.sin(i / 3) * 0.0008, `2026-11-24T10:0${Math.min(i, 9)}:00Z`]);

let recordings = [
    { id: 101, kind: 'video', account: 'operator', callsign: 'ALFA', uid: 'ANDROID-a1', name: 'Patrol Bielany', started_at: '2026-11-24T09:12:00Z', ended_at: '2026-11-24T09:26:30Z', duration_s: 870, lat: 51.1189, lon: 17.0355, size_bytes: 108_000_000, has_text: false, track: track(51.1189, 17.0355, 14), text: null, file: 'video.mp4', type: 'video/mp4' },
    { id: 102, kind: 'voice', account: 'biali', callsign: 'ROZJEMCA', uid: 'ANDROID-b2', name: null, started_at: '2026-11-24T09:40:05Z', ended_at: '2026-11-24T09:40:17Z', duration_s: 12, lat: 51.1101, lon: 17.0322, size_bytes: 48_200, has_text: true, track: [], text: 'Pluton 1, zatrzymać się na skraju lasu i czekać na rozkaz.', file: 'voice.ogg', type: 'audio/ogg' },
    { id: 103, kind: 'scan', account: 'operator', callsign: 'ALFA', uid: 'ANDROID-a1', name: 'Rozkaz bojowy nr 3', started_at: '2026-11-24T10:02:00Z', ended_at: null, duration_s: null, lat: 51.1123, lon: 17.0401, size_bytes: 412_000, has_text: true, track: [], text: 'ROZKAZ BOJOWY NR 3\nPluton 1 - rejon Bielany\nGodz. 06.00 wymarsz', file: 'scan.jpg', type: 'image/jpeg' },
    { id: 104, kind: 'video', account: 'niebiescy2', callsign: 'NIEBIESKI-1', uid: 'ANDROID-c3', name: null, started_at: '2026-11-24T11:30:00Z', ended_at: '2026-11-24T11:31:10Z', duration_s: 70, lat: null, lon: null, size_bytes: 8_700_000, has_text: false, track: [], text: null, file: 'video.mp4', type: 'video/mp4' },
    { id: 105, kind: 'voice', account: 'operator', callsign: 'ALFA', uid: 'ANDROID-a1', name: 'Meldunek o kontakcie', started_at: '2026-11-24T12:01:00Z', ended_at: '2026-11-24T12:01:09Z', duration_s: 9, lat: 51.1150, lon: 17.0280, size_bytes: 36_400, has_text: true, track: [], text: 'Kontakt z przeciwnikiem, kierunek północny wschód, odległość trzysta.', file: 'voice.ogg', type: 'audio/ogg' },
];

const PER_PAGE = 10;
const LIMIT = 50 * 2 ** 30;

const publicFields = ({ track: _t, text: _x, file: _f, type: _y, ...rest }) => rest;

function user(req) {
    const m = /(?:^|;\s*)fake_user=([^;]+)/.exec(req.headers.cookie ?? '');
    return m ? decodeURIComponent(m[1]) : 'operator';
}

function send(res, status, body, headers = {}) {
    const data = typeof body === 'string' || Buffer.isBuffer(body) ? body : JSON.stringify(body);
    res.writeHead(status, { 'Content-Type': 'application/json', ...headers });
    res.end(data);
}

function readBody(req) {
    return new Promise((resolve) => {
        let raw = '';
        req.on('data', (c) => { raw += c; });
        req.on('end', () => { try { resolve(raw ? JSON.parse(raw) : {}); } catch { resolve({}); } });
    });
}

function serveFile(req, res, file, type) {
    const stat = fs.statSync(file);
    const range = /bytes=(\d*)-(\d*)/.exec(req.headers.range ?? '');
    if (range) {
        const start = range[1] ? Number(range[1]) : 0;
        const end = range[2] ? Number(range[2]) : stat.size - 1;
        res.writeHead(206, { 'Content-Type': type, 'Accept-Ranges': 'bytes', 'Content-Range': `bytes ${start}-${end}/${stat.size}`, 'Content-Length': end - start + 1 });
        fs.createReadStream(file, { start, end }).pipe(res);
        return;
    }
    res.writeHead(200, { 'Content-Type': type, 'Accept-Ranges': 'bytes', 'Content-Length': stat.size });
    fs.createReadStream(file).pipe(res);
}

function filtered(q) {
    let rows = recordings;
    if (q.get('kind')) rows = rows.filter((r) => r.kind === q.get('kind'));
    if (q.get('account')) rows = rows.filter((r) => r.account === q.get('account'));
    if (q.get('from')) rows = rows.filter((r) => new Date(r.started_at) >= new Date(q.get('from')));
    if (q.get('to')) rows = rows.filter((r) => new Date(r.started_at) <= new Date(q.get('to')));
    return rows;
}

// Minimal ZIP writer (stored entries, no zip64): enough for a few sample files.
function zipStored(entries) {
    const locals = [];
    const centrals = [];
    let offset = 0;
    for (const { name, data } of entries) {
        const nameBuf = Buffer.from(name, 'utf8');
        const crc = zlib.crc32(data);
        const local = Buffer.alloc(30);
        local.writeUInt32LE(0x04034b50, 0); local.writeUInt16LE(20, 4); local.writeUInt16LE(0x0800, 6); local.writeUInt16LE(33, 12);
        local.writeUInt32LE(crc, 14); local.writeUInt32LE(data.length, 18); local.writeUInt32LE(data.length, 22);
        local.writeUInt16LE(nameBuf.length, 26);
        const central = Buffer.alloc(46);
        central.writeUInt32LE(0x02014b50, 0); central.writeUInt16LE(20, 4); central.writeUInt16LE(20, 6); central.writeUInt16LE(0x0800, 8); central.writeUInt16LE(33, 14);
        central.writeUInt32LE(crc, 16); central.writeUInt32LE(data.length, 20); central.writeUInt32LE(data.length, 24);
        central.writeUInt16LE(nameBuf.length, 28); central.writeUInt32LE(offset, 42);
        locals.push(local, nameBuf, data);
        centrals.push(central, nameBuf);
        offset += 30 + nameBuf.length + data.length;
    }
    const centralSize = centrals.reduce((n, b) => n + b.length, 0);
    const end = Buffer.alloc(22);
    end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(entries.length, 8); end.writeUInt16LE(entries.length, 10);
    end.writeUInt32LE(centralSize, 12); end.writeUInt32LE(offset, 16);
    return Buffer.concat([...locals, ...centrals, end]);
}

function archiveName(rec, taken) {
    const stamp = rec.started_at.replace(/[-:]/g, '').replace('T', '-').slice(0, 15);
    const base = (rec.name || rec.kind).replace(/[\x00-\x1f\x7f/\\:*?"<>|]+/g, '_');
    const ext = path.extname(rec.file);
    let name = `${base}_${stamp}${ext}`;
    for (let n = 2; taken.has(name.toLowerCase()); n += 1) name = `${base}_${stamp} (${n})${ext}`;
    taken.add(name.toLowerCase());
    return name;
}

function archive(res, q) {
    let rows;
    const ids = (q.get('ids') ?? '').split(',').map((s) => s.trim()).filter(Boolean);
    if (ids.length > 100) return send(res, 400, { error: 'Za dużo nagrań w jednym archiwum.' });
    if (ids.length > 0) rows = recordings.filter((r) => ids.includes(String(r.id)));
    else if (['1', 'true'].includes(q.get('all'))) rows = filtered(q);
    else return send(res, 400, { error: 'Wybierz nagrania albo wszystkie.' });
    const taken = new Set(['pominiete.txt']);
    const entries = [];
    for (const rec of rows.sort((a, b) => a.started_at.localeCompare(b.started_at))) {
        const file = path.join(mediaDir, rec.file);
        if (fs.existsSync(file)) entries.push({ name: archiveName(rec, taken), data: fs.readFileSync(file) });
    }
    if (entries.length === 0) return send(res, 404, { error: 'Nie ma plików do pobrania.' });
    const body = zipStored(entries);
    const stamp = new Date().toISOString().replace(/[-:]/g, '').replace('T', '-').slice(0, 15);
    res.writeHead(200, {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="nagrania-${stamp}.zip"`,
        'Cache-Control': 'private, no-store',
        'Content-Length': body.length,
    });
    res.end(body);
}

async function recordingsApi(req, res, url) {
    const who = user(req);
    if (who !== 'administrator') return send(res, 403, { error: 'Nagrania są dostępne tylko dla administratora.' });
    const parts = url.pathname.replace(/^\/api\/taklab\/recordings\/?/, '').split('/').filter(Boolean);

    if (parts[0] === 'archive' && req.method === 'GET') return archive(res, url.searchParams);
    if (parts.length === 0 && req.method === 'GET') {
        const q = url.searchParams;
        const rows = filtered(q).sort((a, b) => b.started_at.localeCompare(a.started_at));
        const page = Math.max(1, Number(q.get('page') ?? 1));
        return send(res, 200, {
            results: rows.slice((page - 1) * PER_PAGE, page * PER_PAGE).map(publicFields),
            total: rows.length, current_page: page, per_page: PER_PAGE, total_pages: Math.max(1, Math.ceil(rows.length / PER_PAGE)),
        });
    }
    if (parts[0] === 'usage' && req.method === 'GET') {
        return send(res, 200, { used_bytes: Math.round(LIMIT * 0.72), limit_bytes: LIMIT });
    }
    const rec = recordings.find((r) => String(r.id) === parts[0]);
    if (!rec) return send(res, 404, { error: 'Nie ma takiego nagrania' });
    if (parts[1] === 'file') {
        const file = path.join(mediaDir, rec.file);
        if (!fs.existsSync(file)) return send(res, 404, { error: 'Brak pliku' });
        return serveFile(req, res, file, rec.type);
    }
    if (req.method === 'GET') return send(res, 200, { ...publicFields(rec), track: rec.track, text: rec.text });
    if (req.method === 'PATCH') {
        const body = await readBody(req);
        if (typeof body.name !== 'string' || body.name.trim() === '') return send(res, 400, { error: 'Pusta nazwa' });
        rec.name = body.name.trim();
        return send(res, 200, publicFields(rec));
    }
    if (req.method === 'DELETE') {
        recordings = recordings.filter((r) => r !== rec);
        return send(res, 200, { success: true });
    }
    return send(res, 405, { error: 'Method not allowed' });
}

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.mp3': 'audio/mpeg', '.webmanifest': 'application/manifest+json' };

makeMedia();
http.createServer(async (req, res) => {
    const url = new URL(req.url, `http://${req.headers.host}`);
    if (url.pathname.startsWith('/api/taklab/recordings')) return recordingsApi(req, res, url);
    if (url.pathname === '/api/plugins') return send(res, 200, { plugins: [] });
    if (url.pathname.startsWith('/api/')) return send(res, 200, {});
    if (url.pathname.startsWith('/socket.io')) return send(res, 404, '');
    let file = path.join(dist, decodeURIComponent(url.pathname));
    if (!file.startsWith(dist) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.join(dist, 'index.html');
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] ?? 'application/octet-stream' });
    fs.createReadStream(file).pipe(res);
}).listen(port, '127.0.0.1', () => console.log(`fake recordings API on http://127.0.0.1:${port}/recordings (dist ${dist})`));
