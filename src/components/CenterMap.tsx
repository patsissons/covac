import 'leaflet/dist/leaflet.css'
import { CircleMarker, MapContainer, TileLayer, Tooltip } from 'react-leaflet'
import type { SnapshotIndex } from '@/data/index'

interface CenterMapProps {
  index: SnapshotIndex
  /** Matching sessions per centre for the visible week. */
  counts: Map<number, number>
  selectedCenterIds: number[]
  onToggleCenter: (centerId: number) => void
}

const VANCOUVER: [number, number] = [49.2527, -123.1207]

export function CenterMap({ index, counts, selectedCenterIds, onToggleCenter }: CenterMapProps) {
  const selected = new Set(selectedCenterIds)
  const centers = index.snapshot.centers.filter((c) => c.lat != null && c.lng != null)
  const max = Math.max(1, ...counts.values())

  return (
    <div className="h-80 overflow-hidden rounded-lg border" data-testid="center-map">
      <MapContainer center={VANCOUVER} zoom={12} scrollWheelZoom={false} className="h-full w-full">
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {centers.map((center) => {
          const count = counts.get(center.id) ?? 0
          const isSelected = selected.has(center.id)
          const dimmed = selected.size > 0 && !isSelected
          return (
            <CircleMarker
              key={center.id}
              center={[center.lat!, center.lng!]}
              radius={6 + 10 * Math.sqrt(count / max)}
              pathOptions={{
                color: isSelected ? '#0f172a' : '#0ea5e9',
                weight: isSelected ? 3 : 1.5,
                fillColor: count > 0 ? '#0ea5e9' : '#94a3b8',
                fillOpacity: dimmed ? 0.2 : 0.6,
              }}
              eventHandlers={{ click: () => onToggleCenter(center.id) }}
            >
              <Tooltip>
                <strong>{center.name}</strong>
                <br />
                {count} {count === 1 ? 'session' : 'sessions'} this week
              </Tooltip>
            </CircleMarker>
          )
        })}
      </MapContainer>
    </div>
  )
}
