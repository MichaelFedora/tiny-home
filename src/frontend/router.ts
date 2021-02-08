import Vue from 'vue';
import VueRouter from 'vue-router';

const HomePage = () => import('./pages/home/home');
const SettingsPage = () => import('./pages/settings/settings');
const LoginPage = () => import('./pages/login/login');
const HandshakePage = () => import('./pages/handshake/handshake');
import NotFoundPage from './pages/not-found/not-found';
import dataBus from './services/data-bus';


Vue.use(VueRouter);

const router = new VueRouter({
  mode: 'history',
  routes: [
    { path: '/', component: HomePage, name: 'home' }, // app shortcuts
    { path: '/settings', component: SettingsPage, name: 'settings' }, // managing connections
    { path: '/login', component: LoginPage, name: 'login' }, // loggin in (obv)
    { path: '/handshake', component: HandshakePage, name: 'handshake' }, // loggin in (obv)
    { path: '**', component: NotFoundPage, name: 'not-found' }
  ]
});

router.beforeEach((to, from, next) => {
  if(to.path !== from.path) {
    if(to.path.length > 1) {

      const sdir = [];
      let buff = '';
      to.path.slice(1).split('/').forEach(v => {
        if(!v) buff += '/';
        else {
          if(buff) sdir.push(buff + v);
          else sdir.push(v);
        }
      });

      document.title = 'tiny home - ' + sdir.join(' - ');
    } else document.title = 'tiny home';
  }

  if(!dataBus.session && !/^\/login/.test(to.path))
    next(`/login?goto=${to.fullPath}`);

  next();
});

export default router;
