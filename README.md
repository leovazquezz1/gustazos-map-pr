# Ofertas de restaurantes cerca de ti

Mapa independiente de ofertas activas de restaurantes publicadas por
[Gustazos](https://www.gustazos.com/c/restaurants1) y
[Oferta del Día](https://www.ofertadeldia.com/puerto-rico-ofertas/categoria/gastronomia/4d382ad7-9d97-461e-8eef-a553ea9ba33c)
en Puerto Rico.

**Sitio:** https://leovazquezz1.github.io/gustazos-map-pr/

## Qué incluye

- Mapa interactivo de OpenStreetMap sin una API de mapas pagada.
- Un pin por cada localidad donde se puede redimir una oferta.
- Pines azules para Gustazos y pines anaranjados para Oferta del Día.
- Búsqueda por restaurante, oferta, dirección o pueblo.
- Filtros por descuento, precio y distancia.
- Geolocalización opcional en el navegador.
- Precio, descuento, imagen, descripción, dirección y horario de redención.
- Fecha exacta de expiración y días restantes calculados en hora de Puerto Rico.
- Enlaces profundos a Google Maps y enlaces alternos a OpenStreetMap.
- Enlaces directos a la fuente original para consultar los términos y comprar.
- Diseño responsivo para móvil y escritorio.

## Fuentes y filtrado

El recolector consulta las categorías públicas de restaurantes de ambas fuentes:

- **Gustazos:** importa sus ofertas de restaurantes y todas las localidades de
  redención publicadas para cada oferta.
- **Oferta del Día:** su categoría de gastronomía también puede incluir clases,
  talleres y otras actividades. El recolector aplica un filtro estricto para
  conservar solamente ofertas de restaurantes y excluir actividades no
  relacionadas con consumo en un restaurante.

Cada oferta conserva su fuente. La interfaz muestra esa fuente en las tarjetas y
en el detalle, usa el color correspondiente en el mapa y dirige la compra al sitio
original.

## Actualización automática

El workflow [`Refresh restaurant deals`](.github/workflows/refresh-deals.yml) se
ejecuta cada seis horas y también puede iniciarse manualmente desde GitHub
Actions. Cada ejecución:

1. Descarga las ofertas de Gustazos y Oferta del Día.
2. Extrae los detalles, horarios y todas las localidades de redención.
3. Resuelve las coordenadas publicadas por cada fuente.
4. Excluye las ofertas de Oferta del Día que no sean de restaurantes.
5. Excluye ofertas vencidas y páginas de Gustazos marcadas como expiradas o no disponibles.
6. Valida identificadores, fuentes, vigencia, coordenadas y cobertura de localidades.
7. Actualiza [`public/data/deals.json`](public/data/deals.json) y vuelve a
   desplegar GitHub Pages cuando los datos cambian.

La interfaz también vuelve a comprobar la fecha de expiración al cargar los datos,
para que una oferta vencida no aparezca aunque el navegador tenga una copia anterior
del archivo JSON en caché.

La validación falla si cualquiera de las dos fuentes deja de producir ofertas de
restaurantes utilizables. Si una localidad no publica coordenadas resolubles, se
omite solamente esa localidad (o la oferta si no queda ninguna localidad válida),
el resto de la actualización continúa y se envía una advertencia por Telegram.
Los fallos reales del refresh o del build envían una alerta separada con el enlace
del run y las últimas líneas del error.

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

Las ofertas, imágenes, términos, direcciones y coordenadas pertenecen a sus
respectivas fuentes. El mapa usa teselas de
[OpenStreetMap](https://www.openstreetmap.org/copyright). Este proyecto no está
afiliado, patrocinado ni operado por Gustazos ni por Oferta del Día. La
disponibilidad y los términos de cada oferta deben confirmarse en la página
original antes de comprar.
