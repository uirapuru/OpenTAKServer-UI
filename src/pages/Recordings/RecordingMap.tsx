// TakLab: small map with the start position and the track of a recording.
// Same Leaflet stack and OSM layer as the Map page.
import React from 'react';
import { CircleMarker, MapContainer, Polyline, TileLayer } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import type { LatLngTuple } from 'leaflet';
import type { TrackPoint } from './recordingsApi';
import { trackLatLngs } from './recordingsUtils';

interface Props {
    lat: number | null;
    lon: number | null;
    track: TrackPoint[];
}

export default function RecordingMap({ lat, lon, track }: Props) {
    const line = trackLatLngs(track) as LatLngTuple[];
    const start: LatLngTuple | null = lat !== null && lon !== null ? [lat, lon] : (line[0] ?? null);
    if (start === null) return null;
    const bounds = line.length > 1 ? line : undefined;

    return (
        <MapContainer
            center={start}
            zoom={15}
            bounds={bounds}
            boundsOptions={{ padding: [20, 20] }}
            scrollWheelZoom={false}
            style={{ height: 220, width: '100%' }}
            data-testid="recording-map"
        >
            <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                maxZoom={19}
            />
            {line.length > 1 && <Polyline positions={line} pathOptions={{ color: '#1c7ed6', weight: 4 }} />}
            <CircleMarker center={start} radius={7} pathOptions={{ color: '#fff', weight: 2, fillColor: '#e03131', fillOpacity: 1 }} />
        </MapContainer>
    );
}
