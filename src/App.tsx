import { useEffect, useMemo, useRef, useState } from 'react'
import { MapContainer, Marker, Popup, TileLayer, useMap } from 'react-leaflet'
import L from 'leaflet'
import {
  ArrowUpRight,
  Clock3,
  Crosshair,
  ListFilter,
  LocateFixed,
  MapPinned,
  Search,
  SlidersHorizontal,
  X,
} from 'lucide-react'
import type { Deal, DealLocation, DealsPayload } from './types'
import './App.css'

type DealPin = { deal: Deal; location: DealLocation }
type SortMode = 'distance' | 'discount' | 'price'

const PUERTO_RICO_CENTER: [number, number] = [18.2208, -66.5901]

function kilometersBetween(a: [number, number], b: [number, number]) {
  const radius = 6371
  const toRadians = (value: number) => (value * Math.PI) / 180
  const dLat = toRadians(b[0] - a[0])
  const dLon = toRadians(b[1] - a[1])
  const lat1 = toRadians(a[0])
  const lat2 = toRadians(b[0])
  const h =
    Math.sin(dLat / 2) ** 2 + Math.sin(dLon / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2)
  return radius * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h))
}

function markerIcon(deal: Deal, selected: boolean) {
  const label = deal.price == null ? 'Oferta' : `$${deal.price}`
  return L.divIcon({
    className: 'deal-marker-shell',
    html: `<span class="deal-marker${selected ? ' is-selected' : ''}">${label}</span>`,
    iconSize: [64, 36],
    iconAnchor: [32, 34],
    popupAnchor: [0, -35],
  })
}

function RecenterMap({ target, zoom = 14 }: { target: [number, number] | null; zoom?: number }) {
  const map = useMap()
  useEffect(() => {
    if (target) map.flyTo(target, zoom, { duration: 0.9 })
  }, [map, target, zoom])
  return null
}

function FitPuertoRico({ pins }: { pins: DealPin[] }) {
  const map = useMap()
  const fitted = useRef(false)
  useEffect(() => {
    if (!fitted.current && pins.length) {
      const bounds = L.latLngBounds(pins.map(({ location }) => [location.latitude, location.longitude]))
      map.fitBounds(bounds, { padding: [36, 36], maxZoom: 10 })
      fitted.current = true
    }
  }, [map, pins])
  return null
}

function formatSyncDate(value: string) {
  return new Intl.DateTimeFormat('es-PR', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'America/Puerto_Rico',
  }).format(new Date(value))
}

function DealCard({
  deal,
  distance,
  selected,
  onSelect,
}: {
  deal: Deal
  distance: number | null
  selected: boolean
  onSelect: () => void
}) {
  return (
    <button className={`deal-card${selected ? ' is-selected' : ''}`} onClick={onSelect}>
      <div className="deal-card__image-wrap">
        <img className="deal-card__image" src={deal.image} alt="" loading="lazy" />
        {deal.discount != null && <span className="discount-pill">-{deal.discount}%</span>}
      </div>
      <div className="deal-card__body">
        <div className="deal-card__eyebrow">
          {deal.price != null && <strong>${deal.price}</strong>}
          {distance != null && <span>{distance.toFixed(distance < 10 ? 1 : 0)} km</span>}
          <span>{deal.locations.length} {deal.locations.length === 1 ? 'localidad' : 'localidades'}</span>
        </div>
        <h3>{deal.restaurant}</h3>
        <p>{deal.offer}</p>
      </div>
    </button>
  )
}

function DealPanel({ deal, onClose }: { deal: Deal; onClose: () => void }) {
  return (
    <section className="deal-panel" aria-label="Detalle de la oferta">
      <button className="icon-button deal-panel__close" onClick={onClose} aria-label="Cerrar detalle">
        <X size={19} />
      </button>
      <img className="deal-panel__hero" src={deal.image} alt="" />
      <div className="deal-panel__content">
        <div className="deal-panel__badges">
          {deal.price != null && <span className="price-badge">${deal.price}</span>}
          {deal.discount != null && <span className="saving-badge">Ahorra {deal.discount}%</span>}
        </div>
        <h2>{deal.restaurant}</h2>
        <p className="deal-panel__offer">{deal.offer}</p>
        <div className="location-list">
          {deal.locations.map((location) => (
            <a
              key={location.id}
              href={`https://www.openstreetmap.org/?mlat=${location.latitude}&mlon=${location.longitude}#map=17/${location.latitude}/${location.longitude}`}
              target="_blank"
              rel="noreferrer"
            >
              <MapPinned size={17} />
              <span>{location.address}</span>
              <ArrowUpRight size={15} />
            </a>
          ))}
        </div>
        <a className="primary-button" href={deal.url} target="_blank" rel="noreferrer">
          Ver y comprar en Gustazos <ArrowUpRight size={18} />
        </a>
      </div>
    </section>
  )
}

export default function App() {
  const [payload, setPayload] = useState<DealsPayload | null>(null)
  const [error, setError] = useState('')
  const [query, setQuery] = useState('')
  const [minDiscount, setMinDiscount] = useState(0)
  const [sortMode, setSortMode] = useState<SortMode>('discount')
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [mapTarget, setMapTarget] = useState<[number, number] | null>(null)
  const [userLocation, setUserLocation] = useState<[number, number] | null>(null)
  const [locationError, setLocationError] = useState('')

  useEffect(() => {
    fetch(`${import.meta.env.BASE_URL}data/deals.json`)
      .then((response) => {
        if (!response.ok) throw new Error('No se pudieron cargar las ofertas')
        return response.json() as Promise<DealsPayload>
      })
      .then(setPayload)
      .catch((reason: Error) => setError(reason.message))
  }, [])

  const pins = useMemo<DealPin[]>(
    () => payload?.deals.flatMap((deal) => deal.locations.map((location) => ({ deal, location }))) ?? [],
    [payload],
  )

  const visibleDeals = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase('es')
    const deals = (payload?.deals ?? []).filter((deal) => {
      const matchesText =
        !normalizedQuery ||
        `${deal.restaurant} ${deal.offer} ${deal.locations.map((item) => item.address).join(' ')}`
          .toLocaleLowerCase('es')
          .includes(normalizedQuery)
      return matchesText && (deal.discount ?? 0) >= minDiscount
    })

    const nearestDistance = (deal: Deal) => {
      if (!userLocation) return Number.POSITIVE_INFINITY
      return Math.min(
        ...deal.locations.map((location) =>
          kilometersBetween(userLocation, [location.latitude, location.longitude]),
        ),
      )
    }

    return deals.sort((a, b) => {
      if (sortMode === 'distance') return nearestDistance(a) - nearestDistance(b)
      if (sortMode === 'price') return (a.price ?? Number.POSITIVE_INFINITY) - (b.price ?? Number.POSITIVE_INFINITY)
      return (b.discount ?? 0) - (a.discount ?? 0)
    })
  }, [payload, query, minDiscount, sortMode, userLocation])

  const visibleIds = useMemo(() => new Set(visibleDeals.map((deal) => deal.id)), [visibleDeals])
  const visiblePins = useMemo(() => pins.filter(({ deal }) => visibleIds.has(deal.id)), [pins, visibleIds])
  const selectedDeal = payload?.deals.find((deal) => deal.id === selectedId) ?? null

  const selectDeal = (deal: Deal, location = deal.locations[0]) => {
    setSelectedId(deal.id)
    setMapTarget([location.latitude, location.longitude])
  }

  const requestLocation = () => {
    setLocationError('')
    navigator.geolocation?.getCurrentPosition(
      ({ coords }) => {
        const next: [number, number] = [coords.latitude, coords.longitude]
        setUserLocation(next)
        setMapTarget(next)
        setSortMode('distance')
      },
      () => setLocationError('No pudimos acceder a tu ubicación.'),
      { enableHighAccuracy: true, timeout: 10_000 },
    )
  }

  if (error) {
    return <main className="status-screen"><h1>No pudimos abrir el mapa</h1><p>{error}</p></main>
  }

  if (!payload) {
    return <main className="status-screen"><div className="loader" /><p>Cargando Gustazos…</p></main>
  }

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <header className="brand-row">
          <div className="brand-mark"><MapPinned size={22} /></div>
          <div>
            <h1>Gustazos cerca de ti</h1>
            <p>Ofertas de restaurantes en el mapa</p>
          </div>
          <span className="live-pill"><span /> EN VIVO</span>
        </header>

        <div className="controls">
          <label className="search-box">
            <Search size={19} />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Restaurante, pueblo o antojo…"
            />
            {query && <button onClick={() => setQuery('')} aria-label="Limpiar búsqueda"><X size={17} /></button>}
          </label>
          <div className="control-actions">
            <button className="secondary-button" onClick={requestLocation}>
              <LocateFixed size={17} /> Cerca de mí
            </button>
            <button className={`secondary-button${filtersOpen ? ' is-active' : ''}`} onClick={() => setFiltersOpen(!filtersOpen)}>
              <SlidersHorizontal size={17} /> Filtros
            </button>
          </div>
          {locationError && <p className="inline-error">{locationError}</p>}
          {filtersOpen && (
            <div className="filter-panel">
              <label>
                <span>Descuento mínimo <strong>{minDiscount}%</strong></span>
                <input type="range" min="0" max="70" step="10" value={minDiscount} onChange={(event) => setMinDiscount(Number(event.target.value))} />
              </label>
              <label>
                <span>Ordenar por</span>
                <select value={sortMode} onChange={(event) => setSortMode(event.target.value as SortMode)}>
                  <option value="discount">Mayor descuento</option>
                  <option value="price">Menor precio</option>
                  <option value="distance" disabled={!userLocation}>Más cerca</option>
                </select>
              </label>
            </div>
          )}
        </div>

        <div className="results-heading">
          <span><ListFilter size={16} /> {visibleDeals.length} ofertas</span>
          <span>{visiblePins.length} pines</span>
        </div>
        <div className="deal-list">
          {visibleDeals.map((deal) => {
            const distance = userLocation
              ? Math.min(...deal.locations.map((location) => kilometersBetween(userLocation, [location.latitude, location.longitude])))
              : null
            return (
              <DealCard
                key={deal.id}
                deal={deal}
                distance={distance}
                selected={deal.id === selectedId}
                onSelect={() => selectDeal(deal)}
              />
            )
          })}
          {visibleDeals.length === 0 && (
            <div className="empty-state"><Search size={28} /><h3>No encontramos ofertas</h3><p>Prueba con otro pueblo o baja el descuento mínimo.</p></div>
          )}
        </div>
        <footer className="sidebar-footer">
          <Clock3 size={14} /> Actualizado {formatSyncDate(payload.updatedAt)}
          <span>·</span>
          <a href={payload.source} target="_blank" rel="noreferrer">Fuente: Gustazos</a>
        </footer>
      </aside>

      <section className="map-stage" aria-label="Mapa de ofertas">
        <MapContainer center={PUERTO_RICO_CENTER} zoom={9} zoomControl={false}>
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <FitPuertoRico pins={pins} />
          <RecenterMap target={mapTarget} zoom={userLocation && mapTarget === userLocation ? 13 : 15} />
          {visiblePins.map(({ deal, location }) => (
            <Marker
              key={location.id}
              position={[location.latitude, location.longitude]}
              icon={markerIcon(deal, deal.id === selectedId)}
              eventHandlers={{ click: () => selectDeal(deal, location) }}
            >
              <Popup>
                <strong>{deal.restaurant}</strong><br />
                <span>{location.address}</span>
              </Popup>
            </Marker>
          ))}
          {userLocation && (
            <Marker
              position={userLocation}
              icon={L.divIcon({ className: 'user-marker-shell', html: '<span class="user-marker"></span>', iconSize: [24, 24], iconAnchor: [12, 12] })}
            />
          )}
        </MapContainer>
        <button className="map-locate-button" onClick={requestLocation} aria-label="Usar mi ubicación">
          <Crosshair size={20} />
        </button>
        <div className="map-summary"><MapPinned size={15} /> Puerto Rico · {visiblePins.length} lugares</div>
        {selectedDeal && <DealPanel deal={selectedDeal} onClose={() => setSelectedId(null)} />}
      </section>

      <div className="mobile-topbar">
        <div className="brand-mark"><MapPinned size={20} /></div>
        <div><strong>Gustazos cerca de ti</strong><span>{visibleDeals.length} ofertas</span></div>
        <button className="icon-button" onClick={requestLocation}><LocateFixed size={20} /></button>
      </div>
      <div className="mobile-search">
        <Search size={18} />
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Busca restaurante o pueblo" />
        <button onClick={() => setFiltersOpen(!filtersOpen)}><ListFilter size={18} /></button>
      </div>
      <div className="mobile-deal-strip">
        {visibleDeals.slice(0, 12).map((deal) => (
          <DealCard key={deal.id} deal={deal} distance={null} selected={deal.id === selectedId} onSelect={() => selectDeal(deal)} />
        ))}
      </div>
    </main>
  )
}
