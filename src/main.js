import { createApp } from 'vue'
import './style.css'
import App from './App.vue'
import 'leaflet/dist/leaflet.css';
import 'bootstrap/dist/css/bootstrap.css'
import 'bootstrap-vue-3/dist/bootstrap-vue-3.css'
import 'bootstrap-icons/font/bootstrap-icons.css'
import { BootstrapVue3 } from 'bootstrap-vue-3'

const app = createApp(App)
app.use(BootstrapVue3)
app.mount('#app')
