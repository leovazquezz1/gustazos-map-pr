# Gustazos cerca de ti

Mapa independiente de las ofertas activas de restaurantes publicadas por Gustazos en Puerto Rico.

## Qué incluye

- Mapa interactivo de OpenStreetMap sin API pagada.
- Un pin por localidad de redención, usando las coordenadas publicadas por Gustazos.
- Búsqueda por restaurante, oferta, dirección o pueblo.
- Filtros por descuento, precio y distancia.
- Geolocalización opcional en el navegador.
- Enlaces directos a Gustazos para ver los términos y comprar.
- Actualización automática cada seis horas mediante GitHub Actions.

## Desarrollo

```bash
npm install
npm run refresh-data
npm run dev
```

## Verificación

```bash
npm run lint
npm run build
```

## Datos y atribución

Las ofertas, imágenes y coordenadas se obtienen de páginas públicas de
[Gustazos](https://www.gustazos.com/c/restaurants1). El mapa usa teselas de
[OpenStreetMap](https://www.openstreetmap.org/copyright). Este proyecto no está
afiliado, patrocinado ni operado por Gustazos. La disponibilidad y los términos
de cada oferta deben confirmarse en la página original antes de comprar.
