import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { MapContainer, Marker, Popup, TileLayer, useMap } from 'react-leaflet'
import L from 'leaflet'
import {
  ArrowUpRight,
  Clock3,
  Crosshair,
  ListFilter,
  LocateFixed,
  MapPinned,
  Play,
  RefreshCw,
  Search,
  SlidersHorizontal,
  X,
} from 'lucide-react'
import type { Deal, DealLocation, DealsPayload } from './types'
import './App.css'

type DealPin = { deal: Deal; location: DealLocation }
type SortMode = 'distance' | 'discount' | 'price'

const PUERTO_RICO_CENTER: [number, number] = [18.2208, -66.5901]

async function fetchDeals(bypassCache = false) {
  const cacheBuster = bypassCache ? `?refresh=${Date.now()}` : ''
  const response = await fetch(`${import.meta.env.BASE_URL}data/deals.json${cacheBuster}`, {
    cache: bypassCache ? 'no-store' : 'default',
  })
  if (!response.ok) throw new Error('No se pudieron cargar las ofertas')
  return response.json() as Promise<DealsPayload>
}

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
    html: `<span class="deal-marker deal-marker--${deal.source}${selected ? ' is-selected' : ''}">${label}</span>`,
    iconSize: [64, 36],
    iconAnchor: [32, 34],
    popupAnchor: [0, -35],
  })
}

function sourceName(deal: Deal) {
  return deal.source === 'gustazos' ? 'Gustazos' : 'Oferta del Día'
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

function formatSyncTime(value: string) {
  return new Intl.DateTimeFormat('es-PR', {
    hour: 'numeric',
    minute: '2-digit',
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
          <span className={`source-badge source-badge--${deal.source}`}>{sourceName(deal)}</span>
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

function googleMapsDeepLink(location: DealLocation) {
  const coordinates = `${location.latitude},${location.longitude}`
  if (/iPad|iPhone|iPod/.test(navigator.userAgent)) {
    return `comgooglemaps://?q=${coordinates}&center=${coordinates}&zoom=17`
  }
  if (/Android/.test(navigator.userAgent)) {
    return `geo:${coordinates}?q=${coordinates}`
  }
  return `https://www.google.com/maps/search/?api=1&query=${coordinates}`
}

function DealPanel({ deal, selectedLocationId, onClose }: { deal: Deal; selectedLocationId: string | null; onClose: () => void }) {
  const selectedLocation =
    deal.locations.find((location) => location.id === selectedLocationId) ?? deal.locations[0]

  return (
    <section className="deal-panel" aria-label="Detalle de la oferta">
      <button className="icon-button deal-panel__close" onClick={onClose} aria-label="Cerrar detalle">
        <X size={19} />
      </button>
      <img className="deal-panel__hero" src={deal.image} alt="" />
      <div className="deal-panel__content">
        <div className="deal-panel__badges">
          <span className={`source-badge source-badge--${deal.source}`}>{sourceName(deal)}</span>
          {deal.price != null && <span className="price-badge">${deal.price}</span>}
          {deal.discount != null && <span className="saving-badge">Ahorra {deal.discount}%</span>}
        </div>
        <h2>{deal.restaurant}</h2>
        <p className="deal-panel__offer">{deal.offer}</p>
        {deal.redemptionHours.length > 0 && (
          <div className="redemption-hours">
            <div className="redemption-hours__title"><Clock3 size={16} /> Horario de redención</div>
            <ul>
              {deal.redemptionHours.map((hours) => <li key={hours}>{hours}</li>)}
            </ul>
          </div>
        )}
        <div className="location-list">
          {selectedLocation && (
            <div className="location-group is-selected">
              <span className="selected-location-label">Ubicación seleccionada</span>
              <a
                className="location-link location-link--google"
                href={googleMapsDeepLink(selectedLocation)}
                rel="noreferrer"
              >
                <MapPinned size={17} />
                <span className="location-link__details"><strong>Google Maps app</strong><span>{selectedLocation.address}</span></span>
                <ArrowUpRight size={15} />
              </a>
              <a
                className="location-link"
                href={`https://www.openstreetmap.org/?mlat=${selectedLocation.latitude}&mlon=${selectedLocation.longitude}#map=17/${selectedLocation.latitude}/${selectedLocation.longitude}`}
                target="_blank"
                rel="noreferrer"
              >
                <MapPinned size={17} />
                <span className="location-link__details"><strong>OpenStreetMap</strong><span>{selectedLocation.address}</span></span>
                <ArrowUpRight size={15} />
              </a>
            </div>
          )}
        </div>
        <a className="primary-button" href={deal.url} target="_blank" rel="noreferrer">
          Ver y comprar en {sourceName(deal)} <ArrowUpRight size={18} />
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
  const [selectedLocationId, setSelectedLocationId] = useState<string | null>(null)
  const [mapTarget, setMapTarget] = useState<[number, number] | null>(null)
  const [userLocation, setUserLocation] = useState<[number, number] | null>(null)
  const [locationError, setLocationError] = useState('')
  const [refreshing, setRefreshing] = useState(false)

  const refreshDeals = useCallback(async () => {
    setRefreshing(true)
    setError('')
    try {
      setPayload(await fetchDeals(true))
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'No se pudieron cargar las ofertas')
    } finally {
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    fetchDeals()
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
    setSelectedLocationId(location.id)
    setMapTarget([location.latitude, location.longitude])
  }

  const closeDeal = () => {
    setSelectedId(null)
    setSelectedLocationId(null)
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
    return <main className="status-screen"><div className="loader" /><p>Cargando ofertas…</p></main>
  }

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <header className="brand-row">
          <div className="brand-mark"><MapPinned size={22} /></div>
          <div>
            <h1>Ofertas cerca de ti</h1>
            <p>Gustazos + Oferta del Día</p>
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
          <span>Fuentes:</span>
          {payload.sources.map((source, index) => (
            <span key={source.id}>
              {index > 0 && ' · '}
              <a href={source.url} target="_blank" rel="noreferrer">{source.name}</a>
            </span>
          ))}
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
              icon={markerIcon(deal, location.id === selectedLocationId)}
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
        {selectedDeal && <DealPanel deal={selectedDeal} selectedLocationId={selectedLocationId} onClose={closeDeal} />}
      </section>

      <div className="mobile-topbar">
        <div className="brand-mark"><MapPinned size={20} /></div>
        <div><strong>Ofertas cerca de ti</strong><span>{visibleDeals.length} ofertas · Actualizado {formatSyncTime(payload.updatedAt)}</span></div>
        <div className="mobile-topbar__actions">
          <a
            className="icon-button run-workflow-button"
            href="https://github.com/leovazquezz1/gustazos-map-pr/actions/workflows/refresh-deals.yml"
            target="_blank"
            rel="noreferrer"
            aria-label="Ejecutar actualización de restaurantes"
          >
            <Play size={17} fill="currentColor" />
          </a>
          <button className="icon-button" onClick={() => void refreshDeals()} disabled={refreshing} aria-label="Actualizar ofertas">
            <RefreshCw size={18} className={refreshing ? 'is-spinning' : ''} />
          </button>
          <button className="icon-button" onClick={requestLocation} aria-label="Usar mi ubicación"><LocateFixed size={18} /></button>
        </div>
      </div>
      <div className="mobile-search">
        <Search size={18} />
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Busca restaurante o pueblo" />
        <button onClick={() => setFiltersOpen(!filtersOpen)}><ListFilter size={18} /></button>
      </div>
      {filtersOpen && (
        <div className="mobile-filters">
          <label>
            <span>Descuento mínimo <strong>{minDiscount}%</strong></span>
            <input type="range" min="0" max="70" step="10" value={minDiscount} onChange={(event) => setMinDiscount(Number(event.target.value))} />
          </label>
          <label>
            <span>Ordenar</span>
            <select value={sortMode} onChange={(event) => setSortMode(event.target.value as SortMode)}>
              <option value="discount">Mayor descuento</option>
              <option value="price">Menor precio</option>
              <option value="distance" disabled={!userLocation}>Más cerca</option>
            </select>
          </label>
        </div>
      )}
      {!selectedDeal && (
        <div className="mobile-deal-strip">
          {visibleDeals.slice(0, 12).map((deal) => (
            <DealCard key={deal.id} deal={deal} distance={null} selected={false} onSelect={() => selectDeal(deal)} />
          ))}
        </div>
      )}
    </main>
  )
}
