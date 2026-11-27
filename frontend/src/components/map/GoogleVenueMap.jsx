import { useEffect, useMemo, useRef, useState } from 'react';
import { hasGoogleMapsKey, loadMaps, MAP_ID } from './GoogleLocationPicker';
import { EmptyState, ErrorState, LoadingState } from '../common';
import LocationMap from './LocationMap';
import VenueMapDetails from './VenueMapDetails';
import styles from './VenueMap.module.css';

function venuePoints(venues) {
  return venues.flatMap((venue) => {
    if (venue.latitude == null || venue.longitude == null ||
        String(venue.latitude).trim() === '' || String(venue.longitude).trim() === '') return [];
    const lat = Number(venue.latitude);
    const lng = Number(venue.longitude);
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) return [];
    return [{ venue, position: { lat, lng } }];
  });
}

function VenueMarkers({ points, onSelect, fallback, activeVenueId, onRetry }) {
  const container = useRef(null);
  const markerRefs = useRef([]);
  const [map, setMap] = useState(null);
  const [failed, setFailed] = useState(false);
  const [selectedId, setSelectedId] = useState(null);
  const selected = points.find(({ venue }) => venue.facility_id === selectedId)?.venue;

  useEffect(() => {
    let active = true;
    const previousAuthFailure = window.gm_authFailure;
    const onError = () => { if (active) setFailed(true); };
    loadMaps()
      .then(async (maps) => {
        const [{ Map }, { AdvancedMarkerElement }, { LatLngBounds }] = await Promise.all([
          maps.importLibrary('maps'), maps.importLibrary('marker'), maps.importLibrary('core'),
        ]);
        if (!active) return;
        window.gm_authFailure = onError;
        const instance = new Map(container.current, {
          mapId: MAP_ID, mapTypeControl: false, streetViewControl: false, clickableIcons: false,
        });
        setMap({ instance, AdvancedMarkerElement, LatLngBounds });
      })
      .catch(onError);
    return () => {
      active = false;
      if (window.gm_authFailure === onError) window.gm_authFailure = previousAuthFailure;
    };
  }, []);

  useEffect(() => {
    if (!map || failed) return undefined;
    const { instance, AdvancedMarkerElement, LatLngBounds } = map;
    const bounds = new LatLngBounds();
    markerRefs.current = points.map(({ venue, position }) => {
      bounds.extend(position);
      const content = document.createElement('span');
      content.className = styles.pin;
      const marker = new AdvancedMarkerElement({ map: instance, position, title: venue.facility_name, content });
      const listener = marker.addListener('click', () => setSelectedId(venue.facility_id));
      const setActive = (active) => {
        content.classList.toggle(styles.pinActive, active);
        marker.zIndex = active ? 1000 : 0;
      };
      const focus = () => {
        const target = content.closest('[tabindex], button') || content;
        if (target === content) target.tabIndex = -1;
        target.focus();
      };
      return { marker, listener, id: venue.facility_id, setActive, focus };
    });
    if (points.length === 1 || bounds.getNorthEast().equals(bounds.getSouthWest())) {
      instance.setCenter(points[0].position);
      instance.setZoom(15);
    } else instance.fitBounds(bounds, 44);
    return () => {
      for (const { marker, listener } of markerRefs.current) {
        listener.remove();
        marker.map = null;
      }
      markerRefs.current = [];
    };
  }, [map, points, failed]);

  useEffect(() => {
    for (const { id, setActive } of markerRefs.current) {
      const active = String(id) === String(activeVenueId) || id === selectedId;
      setActive(active);
    }
  }, [activeVenueId, selectedId, map, points]);

  if (failed) return <>
    <div className={styles.notice}><ErrorState message="Google Maps chưa tải được. Bạn có thể dùng bản đồ dự phòng hoặc chọn địa điểm trong danh sách." onRetry={onRetry} /></div>
    {fallback}
  </>;

  return <section aria-label="Bản đồ sân cầu lông" className={styles.frame}>
    {!map && <div className={styles.loading}><LoadingState message="Đang tải bản đồ…" /></div>}
    <div ref={container} className={styles.canvas} />
    {selected && <VenueMapDetails venue={selected} onSelect={onSelect} onClose={() => {
      const marker = markerRefs.current.find(({ id }) => id === selectedId);
      setSelectedId(null);
      marker?.focus();
    }} />}
  </section>;
}

export default function GoogleVenueMap({ venues, onSelect, activeVenueId }) {
  const points = useMemo(() => venuePoints(venues), [venues]);
  const [attempt, setAttempt] = useState(0);
  if (!points.length) return <EmptyState title="Địa điểm chưa có tọa độ" description="Bạn vẫn có thể chọn địa điểm và xem lịch sân trong danh sách." />;
  const fallback = <LocationMap venues={venues} onSelect={onSelect} activeVenueId={activeVenueId} />;
  if (!hasGoogleMapsKey) return fallback;
  return <VenueMarkers key={attempt} points={points} onSelect={onSelect} fallback={fallback} activeVenueId={activeVenueId} onRetry={() => setAttempt((value) => value + 1)} />;
}
