<template>
  <div id="map" ref="mapRef" :style="{ height: '100vh' }"></div>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount, watch, computed } from 'vue';
import L from 'leaflet';
import * as satellite from 'satellite.js';
import * as tleManager from '../modules/TleManager';
import { observerManager } from '../modules/ObserverManager';

const mapRef = ref(null);
let map;
const markers = [];
const tracks = [];
const observerMarkers = new Map();
const observers = ref(observerManager.getAllObservers());

const canvasRenderer = L.canvas({ padding: 0.5 });

function formatCoordinates(lat, lng) {
  return `${lat.toFixed(6)}°, ${lng.toFixed(6)}°`;
}

function createObserverMarker(observer) {
  const marker = L.marker([observer.latitude, observer.longitude], {
    icon: L.icon({
      iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
      shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
      iconSize: [25, 41],
      iconAnchor: [12, 41],
      popupAnchor: [1, -34],
      shadowSize: [41, 41]
    })
  });
  
  // Create a popup with observer information
  const popupContent = `
    <div class="observer-popup">
      <h6>${observer.name}</h6>
      <p class="coordinates">${formatCoordinates(observer.latitude, observer.longitude)}</p>
      <button class="btn btn-danger btn-sm w-100" onclick="window.removeObserverFromMap('${observer.name}')">
        <i class="bi bi-trash"></i> Remove
      </button>
    </div>
  `;
  
  marker.bindPopup(popupContent);
  marker.addTo(map);
  observerMarkers.set(observer.name, marker);
}

function updateObserverMarkers() {
  // Clear existing markers
  observerMarkers.forEach(marker => marker.remove());
  observerMarkers.clear();
  
  // Add markers for all observers from the reactive computed property
  observers.value.forEach(createObserverMarker);
}

function handleMapContextMenu(e) {
  const { lat, lng } = e.latlng;
  
  // Create a popup with a form
  const popupContent = `
    <div class="context-popup">
      <h6>Add Observer Location</h6>
      <p class="coordinates">${formatCoordinates(lat, lng)}</p>
      <div class="input-group mb-2">
        <input type="text" id="observerName" class="form-control form-control-sm" placeholder="Location name">
      </div>
      <button class="btn btn-primary btn-sm w-100" onclick="window.addObserverFromMap('${lat}', '${lng}')">
        Add Location
      </button>
    </div>
  `;
  
  L.popup()
    .setLatLng(e.latlng)
    .setContent(popupContent)
    .openOn(map);
}

// Add observer from map context menu
window.addObserverFromMap = (lat, lng) => {
  const nameInput = document.getElementById('observerName');
  const name = nameInput.value.trim();
  
  if (!name) {
    alert('Please enter a location name');
    return;
  }
  
  try {
    observerManager.addObserver({
      name,
      latitude: parseFloat(lat),
      longitude: parseFloat(lng)
    });
    
    // Only need to close the popup as the event system will handle updates
    map.closePopup();
  } catch (err) {
    alert(err.message);
  }
};

// Add observer removal from map
window.removeObserverFromMap = (name) => {
  try {
    observerManager.removeObserver(name);
    // Only need to close the popup as the event system will handle updates
    map.closePopup();
  } catch (err) {
    alert(err.message);
  }
};

function adjustMapToFitHeight() {
  if (!map) return;
  
  const bounds = map.getBounds();
  const height = window.innerHeight;
  const width = mapRef.value.clientWidth;
  
  // Calculate the ideal zoom level based on the viewport height
  const latRatio = height / 256; // 256 is the default tile size
  const idealZoom = Math.floor(Math.log2(latRatio));
  
  // Update the map's zoom constraints
  map.setMinZoom(Math.max(2, idealZoom - 1));
  map.setMaxZoom(Math.min(8, idealZoom + 2));
  
  // Adjust current zoom if needed
  if (map.getZoom() < idealZoom - 1 || map.getZoom() > idealZoom + 2) {
    map.setZoom(idealZoom);
  }
  
  map.invalidateSize();
}

let updateInterval;

onMounted(() => {
  // Subscribe to observer events first
  unsubscribeObservers = observerManager.on('observers-updated', (newObservers) => {
    observers.value = newObservers;
    updateObserverMarkers();
  });

  map = L.map(mapRef.value, {
    center: [0, 0],
    zoom: 3,
    inertia: true,
    inertiaDeceleration: 3000,
    maxBoundsViscosity: 0,
    worldCopyJump: true,
    zoomControl: false,  // Disable default zoom control
    contextmenu: true
  });

  // Add zoom control to the right side
  L.control.zoom({
    position: 'topright'
  }).addTo(map);

  map.on('zoomstart', () => {
    // Disable inertia when zooming
    map.options.inertia = false;
  });

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 8,
    minZoom: 2,
    keepBuffer: 5,
    detectRetina: true,
    crossOrigin: true
  }).addTo(map);

  // Add resize handler
  window.addEventListener('resize', adjustMapToFitHeight);
  
  // Initial adjustment
  setTimeout(() => {
    adjustMapToFitHeight();
    map.invalidateSize();
  }, 100);

  // Add context menu event listener
  map.on('contextmenu', handleMapContextMenu);

  // Initialize observer markers
  updateObserverMarkers();

  updateSatellitePositions();
  updateInterval = setInterval(updateSatellitePositions, 1000);

  // Handle right-click context menu
  map.on('contextmenu', handleMapContextMenu);
});

let unsubscribeObservers;

onBeforeUnmount(() => {
  window.removeEventListener('resize', adjustMapToFitHeight);
  // Clean up observer markers
  observerMarkers.forEach(marker => marker.remove());
  observerMarkers.clear();
  // Unsubscribe from observer events
  if (unsubscribeObservers) {
    unsubscribeObservers();
  }
  // Clear update interval
  if (updateInterval) {
    clearInterval(updateInterval);
  }
});

function getDurationInMinutes(duration, unit) {
  const units = {
    minute: 1,
    hour: 60,
    day: 1440
  };
  return duration * (units[unit] || 60);
}

function drawOrbitPath(satrec, now, duration = 3, unit = 'hour', step = 5, color = 'black') {
  const durationMin = getDurationInMinutes(duration, unit);
  const orbitSegments = [];
  let currentSegment = [];

  for (let i = 0; i <= durationMin * (60 / step); i++) {
    const time = new Date(now.getTime() + i * step * 1000);
    const posVel = satellite.propagate(satrec, time);
    if (!posVel.position) continue;

    const gmst = satellite.gstime(time);
    const geo = satellite.eciToGeodetic(posVel.position, gmst);
    const lat = satellite.degreesLat(geo.latitude);
    let lon = satellite.degreesLong(geo.longitude);

    if (lon > 180) lon -= 360;
    if (lon < -180) lon += 360;

    // Check for date line crossing
    if (
      currentSegment.length > 0 &&
      Math.abs(currentSegment[currentSegment.length - 1][1] - lon) > 180
    ) {
      orbitSegments.push(currentSegment);
      currentSegment = [];
    }

    currentSegment.push([lat, lon]);
  }

  if (currentSegment.length) {
    orbitSegments.push(currentSegment);
  }

  const polyGroup = L.layerGroup();
  orbitSegments.forEach(segment => {
    L.polyline(segment, {
      color: color,
      weight: 2.5,
      opacity: 0.6,
      smoothFactor: 1.5,
      lineJoin: 'round',
      lineCap: 'round',
      renderer: canvasRenderer
    }).addTo(polyGroup);
  });

  return polyGroup;
}

function colorGenerator() {
  const hue = Math.floor(Math.random() * 360);
  return `hsl(${hue}, 100%, 50%)`;
}

function updateSatellitePositions() {
  const now = new Date();
  const tleData = tleManager.tleManager.getAllTles();
  if (!tleData || tleData.length === 0) return;

  tleData.forEach((sat, index) => {
    const satrec = satellite.twoline2satrec(sat.tle1, sat.tle2);
    const positionAndVelocity = satellite.propagate(satrec, now);

    if (!positionAndVelocity.position) return;

    const gmst = satellite.gstime(now);
    const positionGd = satellite.eciToGeodetic(positionAndVelocity.position, gmst);
    const lat = satellite.degreesLat(positionGd.latitude);
    const lon = satellite.degreesLong(positionGd.longitude);

    // Create or update satellite marker
    if (!markers[index]) {
      markers[index] = L.marker([lat, lon], {
        icon: L.divIcon({
          className: 'satellite-marker',
          html: `
            <div class="satellite-marker-container">
              <i class="bi bi-satellite"></i>
              <div class="satellite-name">${sat.name}</div>
            </div>
          `,
          iconSize: [40, 40],
          iconAnchor: [20, 20]
        })
      }).addTo(map);
    } else {
      markers[index].setLatLng([lat, lon]);
    }

    // Draw orbit path only once
    if (!tracks[index]) {
      tracks[index] = drawOrbitPath(satrec, now, 2, 'hour', 60, colorGenerator()).addTo(map);
    }
  });
}

</script>

<style scoped>
#map {
  width: 100vw;
  height: 100vh;
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  overflow: hidden;
}

.context-popup {
  padding: 8px;
  min-width: 200px;
}

.context-popup h6 {
  margin: 0 0 8px 0;
  font-size: 14px;
}

.context-popup .coordinates {
  font-size: 12px;
  color: #666;
  margin-bottom: 8px;
}

.satellite-marker {
  pointer-events: none;
}

.satellite-marker-container {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
}

.satellite-marker i {
  font-size: 24px;
  color: #007bff;
  text-shadow: 0 0 10px rgba(0, 123, 255, 0.5);
  animation: satellitePulse 2s infinite;
}

.satellite-name {
  position: absolute;
  top: 100%;
  left: 50%;
  transform: translateX(-50%);
  white-space: nowrap;
  background-color: rgba(0, 123, 255, 0.9);
  color: white;
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 11px;
  font-weight: bold;
  margin-top: 4px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
}

@keyframes satellitePulse {
  0% {
    transform: scale(1) rotate(0deg);
    opacity: 1;
  }
  50% {
    transform: scale(1.2) rotate(180deg);
    opacity: 0.8;
  }
  100% {
    transform: scale(1) rotate(360deg);
    opacity: 1;
  }
}

@keyframes pulse {
  0% {
    transform: scale(1);
    opacity: 1;
  }
  50% {
    transform: scale(1.2);
    opacity: 0.8;
  }
  100% {
    transform: scale(1);
    opacity: 1;
  }
}

:deep(.leaflet-popup-content) {
  margin: 8px;
}

:deep(.leaflet-popup-content-wrapper) {
  border-radius: 8px;
}

.observer-popup {
  text-align: center;
  min-width: 180px;
}

.observer-popup h6 {
  margin: 0 0 8px 0;
  font-size: 14px;
  font-weight: bold;
}

.observer-popup .coordinates {
  font-size: 12px;
  color: #666;
  margin-bottom: 8px;
}

.observer-popup .btn-danger {
  font-size: 12px;
}

.observer-popup i {
  margin-right: 4px;
}
</style>
