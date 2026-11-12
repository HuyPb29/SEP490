import { useContext } from 'react';
import { LocationContext } from '../contexts/locationContextStore';
import { useAuth } from './useAuth';

export function useLocationContext() {
  const ctx = useContext(LocationContext);
  const { selectedLocationId, setSelectedVenue } = useAuth();
  if (!ctx) {
    return {
      locations: [],
      locationId: selectedLocationId || '',
      currentLocation: null,
      setLocationId: setSelectedVenue,
    };
  }
  return ctx;
}

export default useLocationContext;
