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
import { defineComponent, reactive, computed, toRefs, onMounted } from 'vue';
import { useRoute } from 'vue-router';

import localApi from '@/services/local-api';

export default defineComponent({
  name: 'tiny-handshake',
  setup(args, context) {
    const route = useRoute();
    const handshake = computed(() => route.query.handshake as string);

    const data = reactive({
      working: false,

      app: '',
      scopes: [] as string[],
      fileScopes: [] as string[],
      dbScopes: [] as string[],

      stores: [] as  { id: string, name: string, url: string }[],
      dbs: [] as { id: string, name: string, url: string }[],

      store: null as { id: string, name: string, url: string },
      db: null as { id: string, name: string, url: string }
    });

    onMounted(async () => {
      if(!handshake.value)
        return;

      data.working = true;

      const appInfo = await localApi.auth.getHandshakeInfo(handshake.value).catch(() => null) || { };
      data.app = appInfo.app || '{broken}';
      data.scopes = appInfo.scopes ? appInfo.scopes.split(',') : [];
      data.fileScopes = appInfo.fileScopes || [];
      data.dbScopes = appInfo.dbScopes || [];
      data.stores = appInfo.stores || [];
      data.dbs = appInfo.dbs || [];

      data.store = data.stores[0] || null;
      data.db = data.dbs[0] || null;

      data.working = false;
    });

    return {
      handshake,
      ...toRefs(data),

      cancel() {
        localApi.auth.cancelHandshake(handshake.value);
      },
      approve() {
        if(handshake.value && data.app && (!data.scopes.includes('store') || data.store) && (!data.scopes.includes('db') || data.db)) {
          const info = { } as { store?: string, db?: string };

          if(data.scopes.includes('store'))
            info.store = data.store.id;
          if(data.scopes.includes('db'))
            info.db = data.db.id;

          localApi.auth.approveHandshake(handshake.value, info);
        }
      }
    }
  },
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
