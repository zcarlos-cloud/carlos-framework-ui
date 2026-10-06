import { createApp } from 'vue';
import './plugins/assets';
import { setupAppVersionNotification, setupDayjs, setupIconifyOffline, setupLoading, setupNProgress } from './plugins';
import { setupStore } from './store';
import { setupRouter } from './router';
import { setupI18n } from './locales';
import authDirective from './directives/auth';
import App from './App.vue';

async function setupApp() {
  setupLoading();

  setupNProgress();

  setupIconifyOffline();

  setupDayjs();

  const app = createApp(App);

  setupStore(app);

  // 注册 v-auth 指令
  app.directive('auth', authDirective);

  await setupRouter(app);

  await setupI18n(app);

  setupAppVersionNotification();

  app.mount('#app');
}

setupApp();
