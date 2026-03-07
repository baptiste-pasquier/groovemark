import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import './assets/tailwind.css'
import i18n from './i18n'
import { initializeLocale } from './services/locale'

initializeLocale()

const app = createApp(App)

app.use(createPinia())
app.use(i18n)

app.mount('#app')
