import { useCallback, useEffect, useMemo, useState } from 'react';
import api from '../api';
import { loadOwnerLocations } from '../api/ownerApi';
import { useAuth } from '../hooks/useAuth';
import { LocationContext } from './locationContextStore';

export function LocationProvider({ children }) {
  const { isAuthenticated, role, selectedLocationId, setSelectedVenue, token } = useAuth();
  const [locationsState, setLocationsState] = useState({ key: '', items: [], loading: false });

  const scopeKey = isAuthenticated && (role === 'owner' || role === 'staff') ? `${role}:${token ?? ''}` : '';

  useEffect(() => {
    if (!scopeKey) return undefined;
    const controller = new AbortController();
    const { signal } = controller;

    if (role === 'owner') {
      loadOwnerLocations(signal)
        .then((items) => {
          if (signal.aborted) return;
          const list = Array.isArray(items) ? items : [];
          setLocationsState({ key: scopeKey, items: list, loading: false });
          if (list.length > 0) {
            const exists = list.some((loc) => String(loc.id) === String(selectedLocationId));
            if (!exists) {
              const preferred = list.find((loc) => loc.status === 'ACTIVE') || list[0];
              if (preferred?.id != null) {
                setSelectedVenue(preferred.id);
              }
            }
          }
        })
        .catch(() => {
          if (!signal.aborted) {
            setLocationsState({ key: scopeKey, items: [], loading: false });
          }
        });
    } else if (role === 'staff') {
      api
        .get('/staff/dashboards/me', { signal })
        .then((res) => {
          if (signal.aborted) return;
          const dash = res?.data?.data;
          const list = dash?.locationId
            ? [{ id: dash.locationId, name: dash.locationName || `Cơ sở #${dash.locationId}`, status: 'ACTIVE' }]
            : [];
          setLocationsState({ key: scopeKey, items: list, loading: false });
          if (dash?.locationId && String(selectedLocationId) !== String(dash.locationId)) {
            setSelectedVenue(dash.locationId);
          }
        })
        .catch(() => {
          if (!signal.aborted) {
            setLocationsState({ key: scopeKey, items: [], loading: false });
          }
        });
    }

    return () => controller.abort();
  }, [scopeKey, role, selectedLocationId, setSelectedVenue]);

  const setLocationId = useCallback(
    (nextId) => {
      setSelectedVenue(nextId);
    },
    [setSelectedVenue]
  );

  const locations = useMemo(
    () => (locationsState.key === scopeKey ? locationsState.items : []),
    [locationsState, scopeKey]
  );

  const currentLocation = useMemo(
    () => locations.find((item) => String(item.id) === String(selectedLocationId)) || locations[0] || null,
    [locations, selectedLocationId]
  );

  const value = useMemo(
    () => ({
      locations,
      locationId: selectedLocationId ?? (currentLocation?.id != null ? String(currentLocation.id) : ''),
      currentLocation,
      setLocationId,
    }),
    [locations, selectedLocationId, currentLocation, setLocationId]
  );

  return <LocationContext.Provider value={value}>{children}</LocationContext.Provider>;
}

export default LocationProvider;
