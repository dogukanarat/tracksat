<template>
    <div class="sidebar-container">
      <div id="sidebar" :class="{ 'sidebar-hidden': isHidden }" :style="{ width: sidebarWidth + 'px' }" class="bg-light p-3">
        <div class="sidebar-content" :class="{ 'content-hidden': isHidden }">
          <b-input-group class="mb-3 sticky-top pt-2">
          <b-form-input
            id="searchInput"
            v-model="searchQuery"
            @keyup.enter="searchSatellite"
            placeholder="Search NORAD name..."
            class="bg-white text-dark"
          ></b-form-input>
          <b-input-group-append>
            <b-button @click="searchSatellite" variant="primary">Search</b-button>
          </b-input-group-append>
        </b-input-group>

        <div class="tle-list">
          <h4 class="mb-3">Loaded Satellites</h4>
          <b-list-group>
            <b-list-group-item v-for="sat in loadedSatellites" :key="sat.name" class="mb-2">
              <strong>{{ sat.name }}</strong>
              <small class="d-block text-muted">
                {{ sat.tle1 }}
              </small>
              <small class="d-block text-muted">
                {{ sat.tle2 }}
              </small>
            </b-list-group-item>
          </b-list-group>
        </div>
      </div>
      <div class="resize-handle" @mousedown="startResize" v-if="!isHidden"></div>
      </div>
      <button class="toggle-button" @click="toggleSidebar">
        <i class="bi" :class="isHidden ? 'bi-list' : 'bi-x-lg'"></i>
      </button>
    </div>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount, watch } from 'vue';
import L from 'leaflet';
import * as satellite from 'satellite.js';
import * as tleManager from '../modules/TleManager'; // Assuming you have a TLE manager utility

const mapRef = ref(null);
const searchQuery = ref('');
const sidebarWidth = ref(300); // Default width of 300px
const loadedSatellites = ref([]);
let isResizing = false;

const isHidden = ref(false);
const breakpoint = 768; // mobile breakpoint

onMounted(() => {
  loadedSatellites.value = tleManager.tleManager.getAllTles();
  window.addEventListener('resize', checkWidth);
  checkWidth(); // Check initial width
});

async function fetchTLEByName(name) {
  const res = await fetch(`https://celestrak.org/NORAD/elements/gp.php?NAME=${encodeURIComponent(name)}&FORMAT=TLE`);
  const text = await res.text();
  const lines = text.trim().split('\n');
  if (lines.length >= 3) {
    console.log('Fetched TLE:', lines);
    return {
      name: lines[0].trim(),
      tle1: lines[1].trim(),
      tle2: lines[2].trim()
    };
  }
  throw new Error('Satellite not found');
}

async function searchSatellite() {
  const existing = loadedSatellites.value.find(s => s.name.toLowerCase() === searchQuery.value.trim().toLowerCase());
  if (existing) {
    alert('Satellite already loaded.');
    return;
  }

  try {
    const tle = await fetchTLEByName(searchQuery.value);
    tleManager.tleManager.addTle(tle);
    loadedSatellites.value = tleManager.tleManager.getAllTles();
  } catch (err) {
    alert(err.message);
  }
}

function startResize(e) {
  isResizing = true;
  document.addEventListener('mousemove', handleResize);
  document.addEventListener('mouseup', stopResize);
}

function handleResize(e) {
  if (!isResizing) return;
  const newWidth = e.clientX;
  // Set minimum and maximum width constraints
  sidebarWidth.value = Math.min(Math.max(newWidth, 250), 600);
}

function stopResize() {
  isResizing = false;
  document.removeEventListener('mousemove', handleResize);
  document.removeEventListener('mouseup', stopResize);
}

function toggleSidebar() {
  isHidden.value = !isHidden.value;
}

function checkWidth() {
  if (window.innerWidth < breakpoint && !isHidden.value) {
    isHidden.value = true;
  } else if (window.innerWidth >= breakpoint && isHidden.value) {
    isHidden.value = false;
  }
}

onBeforeUnmount(() => {
  document.removeEventListener('mousemove', handleResize);
  document.removeEventListener('mouseup', stopResize);
  window.removeEventListener('resize', checkWidth);
});
</script>

<style scoped>
#sidebar {
  background-color: #f8f9fa;
  color: #212529;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  gap: 10px;
  position: fixed;
  top: 60px;
  left: 20px;
  height: calc(100vh - 80px);
  width: 300px;
  overflow: hidden;
  box-shadow: 0 4px 15px rgba(0,0,0,0.2);
  transition: all 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
  z-index: 1000;
  border-radius: 12px;
  backdrop-filter: blur(10px);
  background-color: rgba(248, 249, 250, 0.95);
}

.sidebar-hidden {
  transform: translateX(calc(-100% - 40px));
  opacity: 0;
  scale: 0.95;
}

.sidebar-hidden ~ .toggle-button {
  opacity: 1;
}

.sidebar-content {
  opacity: 1;
  width: 100%;
  height: 100%;
  overflow-y: auto;
  box-sizing: border-box;
  padding: 20px;
  background: linear-gradient(to bottom, rgba(248, 249, 250, 0.98), rgba(248, 249, 250, 0.95));
}

.content-hidden {
  opacity: 0;
  pointer-events: none;
}

.toggle-button {
  position: fixed;
  left: 20px;
  top: 10px;
  width: 40px;
  height: 40px;
  border: none;
  background-color: #0d6efd;
  color: white;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.2);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
  z-index: 1001;
  font-size: 1.2rem;
}

.toggle-button:hover {
  background-color: #0b5ed7;
  transform: scale(1.1);
}

.toggle-button i {
  transition: transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
}

#sidebar:not(.sidebar-hidden) ~ .toggle-button i {
  transform: rotate(180deg);
}

.tle-list {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  scrollbar-width: thin;
  scrollbar-color: #6c757d transparent;
}

.tle-list::-webkit-scrollbar {
  width: 6px;
}

.tle-list::-webkit-scrollbar-track {
  background: transparent;
}

.tle-list::-webkit-scrollbar-thumb {
  background-color: #6c757d;
  border-radius: 3px;
}

.list-group-item {
  background-color: white;
  border: 1px solid rgba(0,0,0,0.125);
  transition: all 0.2s ease;
  margin-bottom: 0.5rem;
  border-radius: 4px !important;
}

.list-group-item:hover {
  background-color: #f8f9fa;
  transform: translateX(2px);
}

.resize-handle {
  position: absolute;
  right: 0;
  top: 0;
  bottom: 0;
  width: 4px;
  cursor: ew-resize;
  background-color: transparent;
  transition: background-color 0.2s;
}

.resize-handle:hover {
  background-color: #0d6efd;
}

#sidebar {
  position: relative;
  user-select: none;
}
</style>
