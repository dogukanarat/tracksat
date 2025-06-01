<template>
  <div class="sidebar-container">
    <div id="sidebar" :class="{ 'sidebar-hidden': isHidden }" :style="{ width: sidebarWidth + 'px' }" class="bg-light p-3">
      <div class="sidebar-content" :class="{ 'content-hidden': isHidden }">
        <b-input-group class="mb-3 sticky-top pt-2">
        <b-form-input
          id="searchInput"
          v-model="searchQuery"
          @keyup.enter="searchSatellite"
          placeholder="Search NORAD name"
          class="bg-white text-dark"
        ></b-form-input>
        <b-input-group-append>
          <b-button @click="searchSatellite" variant="primary">Search</b-button>
        </b-input-group-append>
        </b-input-group>

        <div class="tle-list">
          <div class="section mb-4">
            <h4 class="mb-3">Observers</h4>
            <b-list-group>
              <b-list-group-item class="mb-2">
                <b-form @submit.prevent="addObserver" class="observer-form">
                  <b-form-input
                    v-model="newObserver.name"
                    placeholder="Location name"
                    class="mb-2"
                    size="sm"
                  ></b-form-input>
                  <div class="d-flex gap-2 mb-2">
                    <b-form-input
                      v-model="newObserver.latitude"
                      placeholder="Latitude"
                      type="number"
                      step="0.000001"
                      size="sm"
                    ></b-form-input>
                    <b-form-input
                      v-model="newObserver.longitude"
                      placeholder="Longitude"
                      type="number"
                      step="0.000001"
                      size="sm"
                    ></b-form-input>
                  </div>
                  <b-button type="submit" variant="primary" size="sm" class="w-100">Add Location</b-button>
                </b-form>
              </b-list-group-item>
              <b-list-group-item
                v-for="observer in observers"
                :key="observer.name"
                class="mb-2 d-flex justify-content-between align-items-center"
              >
                <div>
                  <strong>{{ observer.name }}</strong>
                  <small class="d-block text-muted">
                    {{ observer.latitude }}°, {{ observer.longitude }}°
                  </small>
                </div>
                <b-button 
                  variant="danger" 
                  size="sm"
                  @click="removeObserver(observer.name)"
                >
                  <i class="bi bi-trash"></i>
                </b-button>
              </b-list-group-item>
            </b-list-group>
          </div>

          <div class="section mb-4">
            <h4 class="mb-3">Satellites</h4>
            <b-list-group>
              <b-list-group-item
                v-for="sat in loadedSatellites"
                :key="sat.name"
                class="mb-2 satellite-item"
                @click="sat.isExpanded = !sat.isExpanded"
            >
              <div class="d-flex justify-content-between align-items-center">
                <strong>{{ sat.name }}</strong>
                <i class="bi" :class="sat.isExpanded ? 'bi-chevron-up' : 'bi-chevron-down'"></i>
              </div>
              <b-collapse v-model="sat.isExpanded">
                <div class="mt-2 satellite-details">
                  <small class="d-block text-muted mb-1">
                    <span class="text-primary">TLE Line 1:</span><br/>
                    {{ sat.tle1 }}
                  </small>
                  <small class="d-block text-muted">
                    <span class="text-primary">TLE Line 2:</span><br/>
                    {{ sat.tle2 }}
                  </small>
                </div>
              </b-collapse>
            </b-list-group-item>
          </b-list-group>
        </div>
        </div>
        <div class="resize-handle" @mousedown="startResize" v-if="!isHidden"></div>
      </div>
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
import * as tleManager from '../modules/TleManager';
import { observerManager } from '../modules/ObserverManager';

const mapRef = ref(null);
const searchQuery = ref('');
const sidebarWidth = ref(300);
const loadedSatellites = ref([]);
const observers = ref([]);
const newObserver = ref({
  name: '',
  latitude: '',
  longitude: ''
});
let isResizing = false;

const isHidden = ref(false);
const breakpoint = 768;

onMounted(() => {
  const satellites = tleManager.tleManager.getAllTles();
  loadedSatellites.value = satellites.map(sat => ({
    ...sat,
    isExpanded: false
  }));
  observers.value = observerManager.getAllObservers();
  window.addEventListener('resize', checkWidth);
  checkWidth();
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
    const satellites = tleManager.tleManager.getAllTles();
    loadedSatellites.value = satellites.map(sat => ({
      ...sat,
      isExpanded: false
    }));
  } catch (err) {
    alert(err.message);
  }
}

function addObserver() {
  try {
    observerManager.addObserver({
      name: newObserver.value.name,
      latitude: parseFloat(newObserver.value.latitude),
      longitude: parseFloat(newObserver.value.longitude)
    });
    observers.value = observerManager.getAllObservers();
    // Reset form
    newObserver.value = { name: '', latitude: '', longitude: '' };
  } catch (err) {
    alert(err.message);
  }
}

function removeObserver(name) {
  observerManager.removeObserver(name);
  observers.value = observerManager.getAllObservers();
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

.list-group-item.satellite-item {
  background-color: white;
  border: 1px solid rgba(0,0,0,0.125);
  transition: all 0.2s ease;
  margin-bottom: 0.5rem;
  border-radius: 4px !important;
  cursor: pointer;
  padding: 0.75rem;
}

.list-group-item.satellite-item:hover {
  background-color: #f8f9fa;
  transform: translateX(2px);
}

.satellite-details {
  padding: 0.5rem;
  background-color: rgba(0,0,0,0.02);
  border-radius: 4px;
}

.satellite-item i {
  transition: transform 0.3s ease;
}

.satellite-item i.bi-chevron-up {
  transform: rotate(0deg);
}

.satellite-item i.bi-chevron-down {
  transform: rotate(0deg);
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

.observer-form {
  padding: 0.5rem;
  background-color: rgba(0,0,0,0.02);
  border-radius: 4px;
}

.section {
  background-color: white;
  border-radius: 8px;
  padding: 1rem;
  box-shadow: 0 2px 4px rgba(0,0,0,0.05);
}

.gap-2 {
  gap: 0.5rem;
}
</style>
