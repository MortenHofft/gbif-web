// Renders a GeoJSON FeatureCollection (with optional simplestyle-spec
// properties) on a simple OpenLayers map. Used by the Custom chart card when
// the agent emits kind=geojson.
//
// Scope: smallest map that handles the simplestyle subset our jq snippets
// produce — marker-color for points, stroke/stroke-width/stroke-opacity and
// fill/fill-opacity for lines/polygons. OSM basemap. Auto-fits to the
// feature extent. If the FeatureCollection carries a top-level `legend`
// foreign member (RFC 7946 §6.1) we render it as a small overlay so users
// can read what the colours encode.
//
// Interaction: clicking a feature that carries non-styling properties opens
// a popup listing them. If the feature carries `occurrenceKey` (or `gbifID`)
// the popup also fetches a brief occurrence summary and offers an "Open
// occurrence" button that opens the existing slide-in entity drawer (the
// same one the result table uses).
import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { FormattedMessage } from 'react-intl';
import Feature from 'ol/Feature';
import Map from 'ol/Map';
import Overlay from 'ol/Overlay';
import View from 'ol/View';
import GeoJSON from 'ol/format/GeoJSON';
import { Point } from 'ol/geom';
import TileLayer from 'ol/layer/Tile';
import VectorLayer from 'ol/layer/Vector';
import OSM from 'ol/source/OSM';
import VectorSource from 'ol/source/Vector';
import { Circle, Fill, Stroke, Style } from 'ol/style';
import 'ol/ol.css';
import useQuery from '@/hooks/useQuery';
import {
  MapPopup,
  type PopupAnchor,
} from '@/routes/institution/search/map/mapPopup';
import { useEntityDrawer } from '@/routes/occurrence/search/views/browseList/useEntityDrawer';

type LegendItem = { label: string; color: string };
type Legend = {
  title?: string;
  type?: 'categorical' | 'gradient';
  items: LegendItem[];
};

type FeatureCollectionLike = {
  type: 'FeatureCollection';
  features: unknown[];
  legend?: Legend;
};

type Props = {
  geojson: FeatureCollectionLike | object;
  className?: string;
};

const DEFAULT_POINT_COLOR = '#3388ff';
const DEFAULT_STROKE_COLOR = '#3388ff';
const DEFAULT_STROKE_WIDTH = 2;
const DEFAULT_FILL_COLOR = 'rgba(51, 136, 255, 0.2)';

// Simplestyle-spec keys we strip when deciding whether a feature has popup
// content. Anything not in this set (and not OL's own `geometry`) is treated
// as content.
const STYLE_KEYS = new Set([
  'marker-color',
  'marker-size',
  'marker-symbol',
  'stroke',
  'stroke-opacity',
  'stroke-width',
  'fill',
  'fill-opacity',
]);

function contentProperties(feature: Feature): Record<string, unknown> {
  const all = feature.getProperties();
  const out: Record<string, unknown> = {};
  for (const k of Object.keys(all)) {
    if (k === 'geometry') continue;
    if (STYLE_KEYS.has(k)) continue;
    out[k] = all[k];
  }
  return out;
}

function styleFor(feature: Feature): Style {
  const p = feature.getProperties();
  const markerColor =
    typeof p['marker-color'] === 'string' ? p['marker-color'] : DEFAULT_POINT_COLOR;
  const strokeColor =
    typeof p['stroke'] === 'string' ? p['stroke'] : DEFAULT_STROKE_COLOR;
  const strokeWidth =
    typeof p['stroke-width'] === 'number'
      ? p['stroke-width']
      : DEFAULT_STROKE_WIDTH;
  const fillColor =
    typeof p['fill'] === 'string' ? p['fill'] : DEFAULT_FILL_COLOR;

  return new Style({
    image: new Circle({
      radius: 5,
      fill: new Fill({ color: markerColor }),
      stroke: new Stroke({ color: 'rgba(255,255,255,0.9)', width: 1 }),
    }),
    stroke: new Stroke({ color: strokeColor, width: strokeWidth }),
    fill: new Fill({ color: fillColor }),
  });
}

function isLegend(value: unknown): value is Legend {
  if (!value || typeof value !== 'object') return false;
  const l = value as Record<string, unknown>;
  return Array.isArray(l.items);
}

export default function MapView({ geojson, className }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const popupRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<Overlay | null>(null);
  const mapRef = useRef<Map | null>(null);
  const popupAnchorRef = useRef<PopupAnchor>('bottom');
  const [popupContent, setPopupContent] = useState<ReactNode>(null);
  const [popupAnchor, setPopupAnchor] = useState<PopupAnchor>('bottom');

  const closePopup = () => {
    overlayRef.current?.setPosition(undefined);
    setPopupContent(null);
  };

  useEffect(() => {
    if (!containerRef.current || !popupRef.current) return;

    const source = new VectorSource({
      features: new GeoJSON().readFeatures(geojson, {
        // GeoJSON is WGS84 (EPSG:4326); OL's web mercator default needs the
        // explicit projection mapping.
        dataProjection: 'EPSG:4326',
        featureProjection: 'EPSG:3857',
      }),
    });

    const layer = new VectorLayer({
      source,
      style: (feature) => styleFor(feature as Feature),
    });

    const overlay = new Overlay({
      element: popupRef.current,
      autoPan: false,
      stopEvent: true,
      positioning: 'bottom-center',
      offset: [0, 0],
    });
    overlayRef.current = overlay;

    const map = new Map({
      target: containerRef.current,
      layers: [new TileLayer({ source: new OSM() }), layer],
      overlays: [overlay],
      view: new View({ center: [0, 0], zoom: 1 }),
      controls: [],
    });

    const extent = source.getExtent();
    // OL returns [Infinity, Infinity, -Infinity, -Infinity] for empty sources;
    // skip the fit so the default world view shows.
    if (extent && Number.isFinite(extent[0])) {
      map.getView().fit(extent, {
        padding: [20, 20, 20, 20],
        maxZoom: 10,
      });
    }

    // Recompute the popup arrow side every render frame so it flips as the
    // anchored point approaches a viewport edge (matches the institution map's
    // behaviour — see geoJsonMapOpenlayers.tsx).
    const EDGE_THRESHOLD = 0.25;
    const updatePopupAnchor = (forceUpdate = false) => {
      const coord = overlay.getPosition();
      if (!coord) return;
      const pixel = map.getPixelFromCoordinate(coord);
      const mapSize = map.getSize();
      if (!pixel || !mapSize) return;

      const nearTop = pixel[1] < mapSize[1] * EDGE_THRESHOLD;
      const nearBottom = pixel[1] > mapSize[1] * (1 - EDGE_THRESHOLD);
      const nearLeft = pixel[0] < mapSize[0] * EDGE_THRESHOLD;
      const nearRight = pixel[0] > mapSize[0] * (1 - EDGE_THRESHOLD);

      let newAnchor: PopupAnchor;
      let positioning: string;
      if (nearTop && nearLeft) {
        newAnchor = 'top-left';
        positioning = 'top-left';
      } else if (nearTop && nearRight) {
        newAnchor = 'top-right';
        positioning = 'top-right';
      } else if (nearBottom && nearLeft) {
        newAnchor = 'bottom-left';
        positioning = 'bottom-left';
      } else if (nearBottom && nearRight) {
        newAnchor = 'bottom-right';
        positioning = 'bottom-right';
      } else if (nearTop) {
        newAnchor = 'top';
        positioning = 'top-center';
      } else if (nearBottom) {
        newAnchor = 'bottom';
        positioning = 'bottom-center';
      } else if (nearLeft) {
        newAnchor = 'left';
        positioning = 'center-left';
      } else if (nearRight) {
        newAnchor = 'right';
        positioning = 'center-right';
      } else {
        newAnchor = 'bottom';
        positioning = 'bottom-center';
      }

      if (newAnchor !== popupAnchorRef.current || forceUpdate) {
        popupAnchorRef.current = newAnchor;
        overlay.setPositioning(positioning as Parameters<typeof overlay.setPositioning>[0]);
        setPopupAnchor(newAnchor);
      }
    };
    map.on('postrender', () => updatePopupAnchor(false));

    map.on('click', (evt) => {
      let hit: Feature | null = null;
      map.forEachFeatureAtPixel(evt.pixel, (feature) => {
        const f = feature as Feature;
        if (Object.keys(contentProperties(f)).length === 0) return;
        hit = f;
        return true;
      });

      if (!hit) {
        overlay.setPosition(undefined);
        setPopupContent(null);
        return;
      }

      const f: Feature = hit;
      const geometry = f.getGeometry();
      if (!geometry) return;
      const coordinate =
        geometry instanceof Point
          ? geometry.getCoordinates()
          : geometry.getExtent().slice(0, 2);

      overlay.setPosition(coordinate);
      updatePopupAnchor(true);
      setPopupContent(<MapPopupContent properties={contentProperties(f)} />);
    });

    map.on('pointermove', (evt) => {
      const target = map.getTargetElement();
      if (!target) return;
      if (evt.dragging) {
        target.style.cursor = 'grabbing';
        return;
      }
      let interactive = false;
      map.forEachFeatureAtPixel(evt.pixel, (feature) => {
        if (Object.keys(contentProperties(feature as Feature)).length > 0) {
          interactive = true;
          return true;
        }
      });
      target.style.cursor = interactive ? 'pointer' : '';
    });

    mapRef.current = map;
    return () => {
      map.setTarget(undefined);
      mapRef.current = null;
      overlayRef.current = null;
      setPopupContent(null);
    };
  }, [geojson]);

  const fc = geojson as FeatureCollectionLike;
  const legend = fc?.legend;
  const showLegend = isLegend(legend) && legend.items.length > 0;
  // Count of features actually rendered after the LLM's select() filter.
  // The LLM is instructed to use documents(size: N, shuffle: <seed>); this is
  // the size of the random sample after dropping records with missing
  // coordinates.
  const renderedCount = Array.isArray(fc?.features) ? fc.features.length : 0;

  return (
    <div className={`g-relative ${className ?? 'g-w-full g-h-96'}`}>
      <div ref={containerRef} className="g-w-full g-h-full" />
      {renderedCount > 0 && (
        <div className="g-absolute g-top-2 g-left-2 g-bg-white/90 g-rounded g-shadow g-px-2 g-py-1 g-text-xs g-text-slate-600 g-pointer-events-none">
          Random sample of {renderedCount.toLocaleString()} points
        </div>
      )}
      {showLegend && (
        <div className="g-absolute g-bottom-2 g-right-2 g-bg-white/90 g-rounded g-shadow g-p-2 g-text-xs g-max-w-[40%] g-pointer-events-none">
          {legend.title && (
            <div className="g-font-semibold g-mb-1">{legend.title}</div>
          )}
          <ul className="g-space-y-0.5">
            {legend.items.map((item, i) => (
              <li key={i} className="g-flex g-items-center g-gap-1.5">
                <span
                  className="g-inline-block g-w-3 g-h-3 g-rounded g-flex-none g-border g-border-solid g-border-slate-200"
                  style={{ backgroundColor: item.color }}
                />
                <span className="g-truncate">{item.label}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      <div
        ref={popupRef}
        style={{ display: popupContent ? undefined : 'none', cursor: 'auto' }}
      >
        <MapPopup anchor={popupAnchor} onClose={closePopup}>
          {popupContent}
        </MapPopup>
      </div>
    </div>
  );
}

// ---------- popup content ----------

const SPECIAL_KEYS = new Set(['title', 'description', 'occurrenceKey', 'gbifID']);
const MAX_VALUE_CHARS = 120;

function stringOrNull(v: unknown): string | null {
  if (v == null) return null;
  if (typeof v === 'string') return v.length > 0 ? v : null;
  if (typeof v === 'number' && Number.isFinite(v)) return String(v);
  return null;
}

function formatValue(v: unknown): string {
  if (v == null) return '';
  if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') {
    return String(v);
  }
  let s: string;
  try {
    s = JSON.stringify(v);
  } catch {
    s = String(v);
  }
  return s.length > MAX_VALUE_CHARS ? s.slice(0, MAX_VALUE_CHARS - 1) + '…' : s;
}

function MapPopupContent({ properties }: { properties: Record<string, unknown> }) {
  const title = typeof properties.title === 'string' ? properties.title : null;
  const description =
    typeof properties.description === 'string' ? properties.description : null;
  const occurrenceKey = stringOrNull(properties.occurrenceKey ?? properties.gbifID);
  const extraEntries = Object.entries(properties).filter(
    ([k, v]) => !SPECIAL_KEYS.has(k) && v != null && v !== '',
  );

  return (
    <div>
      {title && <div className="g-font-semibold g-mb-1">{title}</div>}
      {description && (
        <div className="g-text-slate-600 g-mb-2">{description}</div>
      )}
      {extraEntries.length > 0 && (
        <dl className="g-grid g-grid-cols-[auto_1fr] g-gap-x-2 g-gap-y-0.5">
          {extraEntries.map(([k, v]) => (
            <div key={k} className="g-contents">
              <dt className="g-text-slate-500">{k}</dt>
              <dd className="g-text-slate-800 g-break-words">{formatValue(v)}</dd>
            </div>
          ))}
        </dl>
      )}
      {occurrenceKey && (
        <div className="g-mt-2 g-pt-2 g-border-t g-border-solid g-border-slate-200">
          <OccurrenceLink occurrenceKey={occurrenceKey} />
        </div>
      )}
    </div>
  );
}

// ---------- occurrence preview + drawer link ----------

const OCCURRENCE_PREVIEW = /* GraphQL */ `
  query CustomChartOccurrencePreview($key: ID!) {
    occurrence(key: $key) {
      key
      scientificName
      eventDate
      countryCode
      basisOfRecord
    }
  }
`;

type OccurrencePreviewResult = {
  occurrence: {
    key?: string | number | null;
    scientificName?: string | null;
    eventDate?: string | null;
    countryCode?: string | null;
    basisOfRecord?: string | null;
  } | null;
};

function OccurrenceLink({ occurrenceKey }: { occurrenceKey: string }) {
  const [, setPreviewKey] = useEntityDrawer();
  const { data, loading } = useQuery<OccurrencePreviewResult, { key: string }>(
    OCCURRENCE_PREVIEW,
    { variables: { key: occurrenceKey } },
  );

  const occ = data?.occurrence;
  const entries: [string, string][] = [];
  if (occ?.scientificName) entries.push(['scientificName', occ.scientificName]);
  if (occ?.eventDate) entries.push(['eventDate', occ.eventDate]);
  if (occ?.countryCode) entries.push(['countryCode', occ.countryCode]);
  if (occ?.basisOfRecord) entries.push(['basisOfRecord', occ.basisOfRecord]);

  return (
    <div>
      {loading && (
        <div className="g-text-slate-400 g-mb-1">
          <FormattedMessage
            id="dashboard.customChart.popup.loading"
            defaultMessage="Loading occurrence…"
          />
        </div>
      )}
      {entries.length > 0 && (
        <dl className="g-grid g-grid-cols-[auto_1fr] g-gap-x-2 g-gap-y-0.5 g-mb-2">
          {entries.map(([k, v]) => (
            <div key={k} className="g-contents">
              <dt className="g-text-slate-500">{k}</dt>
              <dd className="g-text-slate-800 g-break-words">{v}</dd>
            </div>
          ))}
        </dl>
      )}
      <button
        type="button"
        onClick={() => setPreviewKey(`o_${occurrenceKey}`)}
        className="g-text-primary-500 hover:g-underline g-cursor-pointer g-text-left"
      >
        <FormattedMessage
          id="dashboard.customChart.popup.openOccurrence"
          defaultMessage="Open occurrence"
        />
      </button>
    </div>
  );
}
