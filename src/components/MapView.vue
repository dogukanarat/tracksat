<template>
  <div id="map" ref="mapRef" :style="{ height: '100vh' }"></div>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount } from 'vue';
import L from 'leaflet';
import * as satellite from 'satellite.js';
import * as tleManager from '../modules/TleManager'; // Assuming you have a TLE manager utility

const mapRef = ref(null);
let map;
const markers = [];
const tracks = [];

const canvasRenderer = L.canvas({ padding: 0.5 });

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

onMounted(() => {
  map = L.map(mapRef.value, {
    center: [0, 0],
    zoom: 3,
    minZoom: 2,
    maxZoom: 8,
    inertia: true,
    inertiaDeceleration: 3000,
    maxBoundsViscosity: 0,
    worldCopyJump: true,
    zoomControl: false  // Disable default zoom control
  });

  // Add zoom control to the right side
  L.control.zoom({
    position: 'topright'
  }).addTo(map);

  // map.on('zoomend', () => {
  //   if (map.getZoom() === 2) {
  //     map.setZoom(3); // bounce back to 3 if user zooms out to 2
  //   }
  // });

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

  updateSatellitePositions();
  setInterval(updateSatellitePositions, 1000);
});

onBeforeUnmount(() => {
  window.removeEventListener('resize', adjustMapToFitHeight);
});

function getDurationInMinutes(duration, unit) {
  const units = {
    minute: 1,
    hour: 60,
    day: 1440
  };
  return duration * (units[unit] || 60);
}

function drawOrbitPath(satrec, now, duration = 3, unit = 'hour', step = 60, color = 'black') {
  const durationMin = getDurationInMinutes(duration, unit);
  const orbitSegments = [];
  let currentSegment = [];

  for (let i = 0; i <= durationMin; i++) {
    const time = new Date(now.getTime() + i * step * 1000);
    const posVel = satellite.propagate(satrec, time);
    if (!posVel.position) continue;

    const gmst = satellite.gstime(time);
    const geo = satellite.eciToGeodetic(posVel.position, gmst);
    const lat = satellite.degreesLat(geo.latitude);
    let lon = satellite.degreesLong(geo.longitude);

    if (lon > 180) lon -= 360;
    if (lon < -180) lon += 360;

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
      weight: 2,
      opacity: 0.2,
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
      markers[index] = L.marker([lat, lon])
        .addTo(map)
        .bindPopup(sat.name);
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
</style>
