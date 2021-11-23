import { createApp, h, defineComponent, reactive } from 'vue';

import 'normalize.css';
import './styles.scss';

import { makeInitializerComponent } from './utility';

import AppComponent from './app.vue';
import LoadingComponent from '@/components/loading.vue';

import router from './router';
import dataBus from '@/services/data-bus';
import localApi from '@/services/local-api';
import modals from '@/services/modals';

console.log('Environment: ', process.env.NODE_ENV);

const docs = import.meta.env.VITE_DOCS || false;
if(docs) {
  const [_, path, query, hash] = location.href.match(/^([^#?]+)([^#]+)?(#.+)?$/);
  if(query) {
    if(!hash)
      location.href = path + '#' + query;
    else
      location.href = path + hash + (!hash.includes('?') ? query : '&' + query.slice(1));
  }
}

const rootData = reactive({ loaded: false });

const root = defineComponent({
  setup() {
    return () => {
      if(rootData.loaded) {
        return h(AppComponent, { key: 'app' });
      } else return makeInitializerComponent(LoadingComponent);
    }
  }
});

const app = createApp(root);
app.use(router);
app.component('tiny-loading', LoadingComponent);
app.mount('#app');

(async () => {
  const route = router.currentRoute.value;
  if(route.query.sid) {
    dataBus.session = String(route.query.sid || dataBus.session || '');
    router.replace(route.path);
  }

  if(dataBus.session)
    await localApi.getSelf().catch(() => { });

})().then(() => {
  console.log('Initialized Main!');
  rootData.loaded = true;
}, e => {
  console.error('Error initializing main: ', e instanceof Error ? e.stack : e.message || e);
  modals.openRoot({
    title: 'Error',
    message: 'Error initializing main: ' + String(e.message || e),
    type: 'danger',
    alert: true
  });
});

