import Vue from 'vue';

// @ts-ignore
import('@mdi/font/css/materialdesignicons.css');

// @ts-ignore
import { Button, Input, Field, Icon, Loading, Dialog, Dropdown, DialogProgrammatic } from 'buefy';
import './buefy.scss';

import './styles.scss';

import { makeInitializerComponent } from './util';
import localApi from './services/local-api';
import dataBus from './services/data-bus';

import AppComponent from './app/app';
import LoadingComponent from './components/loading/loading';

import router from './router';

console.log('Environment:', process.env.NODE_ENV);

Vue.use(Button);
Vue.use(Input);
Vue.use(Field);
Vue.use(Icon);
Vue.use(Loading);
Vue.use(Dialog);
Vue.use(Dropdown);

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
})().then(() => {
  console.log('Initialized Main!');
  v.loaded = true;
}, e => {
  console.error('Error initializing main: ', e.stack || e.message || e);
  DialogProgrammatic.alert({
    title: 'Error',
    message: 'Error initializing main: ' + String(e.message || e),
    type: 'is-danger'
  });
});
