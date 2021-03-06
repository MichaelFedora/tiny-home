<template>
<div id='app'>
  <h3>tiny home<template v-if='loggedIn'> - {{username}}</template></h3>
  <router-view />
</div>
</template>
<script lang='ts'>
import Vue from 'vue';
import dataBus from 'services/data-bus';

export default Vue.extend({
  name: 'app',
  data() { return {
    loggedIn: Boolean(dataBus.session),
    username: dataBus.user?.username || '',
    page: this.$route.name || ''
  }; },
  watch: {
    $route(n, o) {
      if(n.path !== o.path) {
        if(!/^\/login/.test(n.path)) {
          if(!this.loggedIn)
            this.loggedIn = Boolean(dataBus.session);
          if(!this.username)
            this.username = dataBus.user?.username;
        } else {
          if(this.loggedIn)
            this.loggedIn = Boolean(dataBus.session);
          if(this.username)
            this.username = dataBus.user?.username;
        }

        this.page = n.name;
      }
    }
  },
});
</script>
<style lang='scss'>
#app {
  padding: 1rem;
  padding-top: 1.5rem;

  display: flex;
  flex-flow: column;
  min-height: 100vh;
}
</style>
