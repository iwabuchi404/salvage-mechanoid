import { createApp } from 'vue';
import { createPinia } from 'pinia';
import App from './App.vue';
import router from './router';
import './css/variables.css'; // 変数用のCSSファイル
import './css/reset.css'; // グローバルスタイル用のCSSファイル
import './css/base.css'; // グローバルスタイル用のCSSファイル

const pinia = createPinia();

createApp(App).use(router).use(pinia).mount('#app');
