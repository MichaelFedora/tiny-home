import Vue from 'vue';

import 'normalize.css';
import './styles.scss';

import { makeInitializerComponent, openModal, UtilityPlugin } from 'utility';

// @ts-ignore
import AppComponent from './app.vue';
//@ts-ignore
import LoadingComponent from 'components/loading.vue';

import router from 'router';
import localApi from 'services/local-api';
import dataBus from 'services/data-bus';

Vue.use(UtilityPlugin);

console.log('Environment: ', process.env.NODE_ENV);

declare const docs: boolean;
if(docs) {
  const [_, path, query, hash] = location.href.match(/^([^#?]+)([^#]+)?(#.+)?$/);
  if(query) {
    if(!hash)
      location.href = path + '#' + query;
    else
      location.href = path + hash + (!hash.includes('?') ? query : '&' + query.slice(1));
  }
}

const v = new Vue({
  router,
  el: '#app',
  components: { AppComponent },
  data: { loaded: false },
  render(h) {
    if(this.loaded) {
      return h(AppComponent, { key: 'app' });
    } else return makeInitializerComponent(h, LoadingComponent);
  }
});

(async () => {
  if(v.$route.query.sid) {
    dataBus.session = String(v.$route.query.sid || dataBus.session || '');
    v.$router.replace(v.$route.path);
  }

  if(dataBus.session)
    await localApi.getSelf().catch(() => { });

})().then(() => {
  console.log('Initialized Main!');
  v.loaded = true;
}, e => {
  console.error('Error initializing main: ', e.stack || e.message || e);
  openModal({
    title: 'Error',
    message: 'Error initializing main: ' + String(e.message || e),
    type: 'danger'
  });
});
