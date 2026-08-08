import { createApp } from 'vue';
import { createPinia } from 'pinia';
import App from './App.vue';
import './css/variables.css'; // 変数用のCSSファイル
import './css/reset.css'; // グローバルスタイル用のCSSファイル
import './css/base.css'; // グローバルスタイル用のCSSファイル
import './css/utility.css'; // グローバルスタイル用のCSSファイル

const pinia = createPinia();

createApp(App).use(pinia).mount('#app');
