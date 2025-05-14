<template>
  <div id="app">
    <Sidebar />
    <MapView />
  </div>
</template>

<script setup>
import MapView from './components/MapView.vue';
import Sidebar from './components/Sidebar.vue';
</script>

<style scoped>
#app {
  display: flex;
  height: 100vh;
  width: 100vw;
  overflow: hidden;
}
</style>
