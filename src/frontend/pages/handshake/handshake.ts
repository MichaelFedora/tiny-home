import localApi from 'frontend/services/local-api';
import Vue from 'vue';

export default Vue.component('tiny-handshake', {
  data() { return {
    working: false,

    app: '',
    scopes: [] as string[],
    fileScopes: [] as string[],

    stores: [] as { name: string, url: string }[],
    dbs: [] as { name: string, url: string }[],

    store: null as { name: string, url: string },
    db: null as { name: string, url: string }
  }; },
  computed: {
    handshake(): string { return String(this.$route.query.handshake); },
  },
  async mounted() {
    if(!this.handshake)
      return;

    this.working = true;

    const appInfo = await localApi.auth.getHandshakeInfo(this.handshake);

    this.app = appInfo.app || '{broken}';
    this.scopes = appInfo.scopes ? appInfo.scopes.split(',') : [];
    this.fileScopes = appInfo.fileScopes || [];
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
        const info: { store?: string, db?: string } = { };

        if(this.scopes.includes('store'))
          info.store = this.store.name;
        if(this.scopes.includes('db'))
          info.db = this.db.name;

        localApi.auth.approveHandshake(this.handshake, info);
      }
    }
  }
});
