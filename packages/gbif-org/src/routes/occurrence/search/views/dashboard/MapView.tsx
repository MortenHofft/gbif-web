// Renders a GeoJSON FeatureCollection (with optional simplestyle-spec
// properties) on a simple OpenLayers map. Used by the Custom chart card when
// the agent emits kind=geojson.
//
// Scope: smallest map that handles the simplestyle subset our jq snippets
// produce — marker-color for points, stroke/stroke-width/stroke-opacity and
// fill/fill-opacity for lines/polygons. OSM basemap. Auto-fits to the
// feature extent.
import { useEffect, useRef } from 'react';
import Feature from 'ol/Feature';
import Map from 'ol/Map';
import View from 'ol/View';
import GeoJSON from 'ol/format/GeoJSON';
import TileLayer from 'ol/layer/Tile';
import VectorLayer from 'ol/layer/Vector';
import OSM from 'ol/source/OSM';
import VectorSource from 'ol/source/Vector';
import { Circle, Fill, Stroke, Style } from 'ol/style';
import 'ol/ol.css';

type Props = {
  geojson: object;
  className?: string;
};

const DEFAULT_POINT_COLOR = '#3388ff';
const DEFAULT_STROKE_COLOR = '#3388ff';
const DEFAULT_STROKE_WIDTH = 2;
const DEFAULT_FILL_COLOR = 'rgba(51, 136, 255, 0.2)';

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

export default function MapView({ geojson, className }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<Map | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

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

    const map = new Map({
      target: containerRef.current,
      layers: [new TileLayer({ source: new OSM() }), layer],
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

    mapRef.current = map;
    return () => {
      map.setTarget(undefined);
      mapRef.current = null;
    };
  }, [geojson]);

  return <div ref={containerRef} className={className ?? 'g-w-full g-h-96'} />;
}
