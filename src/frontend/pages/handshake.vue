<template>
<div id='tiny-handshake'>
  <h1>handshake</h1>
  <h2 class='sub'>{{ app }}</h2>
  <p id='tag-list'>
    <span>tokens:</span>
    <span v-for='(scope, i) of scopes' :key='"scope-" + i' class='tag'>{{scope}}</span>
  </p>
  <p>
    file scopes:<br>
    <ul>
      <li v-for='(scope, i) of fileScopes' :key='"filescope-" + i'>{{scope}}</li>
    </ul>
  </p>
  <p>
    db scopes:<br>
    <ul>
      <li v-for='(scope, i) of dbScopes' :key='"dbscope-" + i'>{{scope}}</li>
    </ul>
  </p>
  <p id='dropdowns'>
    <select v-if='scopes.includes("store")' v-model='store'>
      <option v-if='!store' disabled :value='null'>???</option>
      <option v-for='(s, i) of stores' :key='"store-" + i' :value='s'>{{ s.name }}</option>
    </select>
    <select v-if='scopes.includes("db")' v-model='db'>
      <option v-if='!db' disabled :value='null'>???</option>
      <option v-for='(d, i) of dbs' :key='"db-" + i' :value='d'>{{ d.name }}</option>
    </select>
  </p>
  <hr>
  <div id='buttons'>
    <button @click='cancel'>cancel</button>
    <button class='primary' @click='approve'>approve</button>
  </div>
</div>
</template>
<script lang='ts'>
import Vue from 'vue';
import localApi from 'services/local-api';

export default Vue.extend({
  name: 'tiny-handshake',
  data() { return {
    working: false,

    app: '',
    scopes: [] as string[],
    fileScopes: [] as string[],
    dbScopes: [] as string[],

    stores: [] as  { name: string, url: string }[],
    dbs: [] as { name: string, url: string }[],

    store: null as { name: string, url: string },
    db: null as { name: string, url: string }
  }; },
  computed: {
    handshake() { return String(this.$route.query.handshake); },
  },
  async mounted() {
    if(!this.handshake)
      return;

    this.working = true;

    const appInfo = await localApi.auth.getHandshakeInfo(this.handshake).catch(() => null) || { };
    this.app = appInfo.app || '{broken}';
    this.scopes = appInfo.scopes ? appInfo.scopes.split(',') : [];
    this.fileScopes = appInfo.fileScopes || [];
    this.fileScopes = appInfo.dbScopes || [];
    this.stores = appInfo.stores || [];
    this.dbs = appInfo.dbs || [];

    this.store = this.stores[0] || null;
    this.db = this.dbs[0] || null;

    this.working = false;
  },
  methods: {
    cancel() {
      localApi.auth.cancelHandshake(this.handshake);
    },
    approve() {
      if(this.handshake && this.app && (!this.scopes.includes('store') || this.store) && (!this.scopes.includes('db') || this.db)) {
        const info = { } as { store?: string, db?: string };

        if(this.scopes.includes('store'))
          info.store = this.store.name;
        if(this.scopes.includes('db'))
          info.db = this.db.name;

        localApi.auth.approveHandshake(this.handshake, info);
      }
    }
  }
});
</script>
<style lang='scss'>
#tiny-handshake {
  display: flex;
  flex-flow: column nowrap;
  flex-grow: 1;
  align-self: center;
  align-content: center;
  justify-content: center;

  > p#tag-list {
    display: flex;
    align-items: baseline;

    > :not(:last-child) {
      margin-right: 0.5rem;
    }
  }

  > p#dropdowns {
    display: flex;
    flex-wrap: wrap;
    margin-right: -0.5rem;

    > * {
      margin-right: 0.5rem;
      margin-bottom: 0.5rem;
      margin-left: 0;
    }
  }

  > div#buttons {
    display: flex;
    justify-content: flex-end;
    margin-top: 0.5rem;
    margin-bottom: 1.5rem;

    > button:not(:last-child) {
      margin-right: 0.5rem;
    }

    > a {
      font-size: 0.8rem;
    }
  }
}
</style>
