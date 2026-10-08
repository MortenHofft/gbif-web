import React from 'react';

// MAP view is disabled by default everywhere. Wrap a subtree in
// <MapChartsEnabledContext.Provider value={true}> to opt in (e.g. the
// occurrence search dashboard). PUBLIC_DEFAULT_ENABLE_MAP_CHARTS acts as a master kill-switch.
// Its own module so providers can import it without pulling highcharts into their chunk.
export const MapChartsEnabledContext = React.createContext<boolean>(false);
