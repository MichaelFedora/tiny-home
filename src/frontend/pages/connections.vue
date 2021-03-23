<template>
<div id='tiny-connections'>
  <h1>
    <router-link class='button icon info' to='/'>
      <svg-icon type='mdi' :path='mdiArrowLeft' />
    </router-link>
    <span>connections</span>
  </h1>
  <template v-if='masterkeys'>
  <h2 class='sub'>
    <span>remote nodes</span>
    <button class='icon success' @click='addKey'><svg-icon type='mdi' :path='mdiPlus' /></button>
  </h2>
  <div class='masterkeys'>
    <span class='h4 sub'>id</span>
    <span class='h4 sub'>name / url</span>
    <span class='h4 sub'>type</span>
    <span class='h4 sub'>options</span>

    <template v-for='(mk, i) of masterkeys'>
      <span :key='"mk-id-" + i'>{{ mk.id }}</span>
      <span :key='"mk-url-" + i'>{{ mk.name || mk.url }}</span>
      <span :key='"mk-type-" + i'>{{ mk.type }}</span>
      <div :key='"mk-opts-" + i'>
        <button class='danger' @click='remove("mk", mk)'>remove</button>
      </div>
    </template>

    <span v-if='!masterkeys.length' style='grid-column: 1 / 5'>Nothing here...</span>
  </div>
  </template>
  <h2 class='sub'>apps</h2>
  <div class='sessions'>
    <span class='h4 sub'>app</span>
    <span class='h4 sub'>file store (scopes)</span>
    <span class='h4 sub'>db (scopes)</span>
    <span class='h4 sub'>options</span>

    <template v-for='(app, i) of apps'>
      <span :key='"app-app-" + i'>{{ app.app }}</span>
      <span :key='"app-store-" + i'>{{ app.store ? app.store.type + (app.db.type !== 'local' ? ':' + (app.store.url || app.store.key) : '') : 'n/a' }}</span>
      <span :key='"app-db-" + i'>{{ app.db ? app.db.type + (app.db.type !== 'local' ? ':' + (app.db.url || app.db.key) : '') : 'n/a' }}</span>
      <div :key='"app-opts-" + i'>
        <button class='danger' @click='remove("app", app)'>remove</button>
      </div>
      <template v-for='(appsess, j) of app.sessions'>
        <span :key='"app-sess-created-" + i + "-" + j'>{{ (new Date(appsess.created)).toLocaleString() }}</span>
        <div class='scopes' :key='"app-sess-file-scopes-" + i + "-" + j'>
          <template v-if='appsess.fileScopes'>
          <span v-for='(scope, j) of appsess.fileScopes' :key='"app-sess-file-scope-" + i + "-" + j' class='tag'>{{scope}}</span>
          </template>
        </div>
        <div class='scopes' :key='"app-sess-db-scopes-" + i + "-" + j'>
          <template v-if='appsess.dbScopes'>
          <span v-for='(scope, j) of appsess.dbScopes' :key='"app-sess-db-scope-" + i + "-" + j' class='tag'>{{scope}}</span>
          </template>
        </div>
        <div :key='"app-sess-opts-" + i + "-" + j'>
          <button class='danger' @click='revoke("as", appsess.id)'>revoke</button>
        </div>
      </template>
    </template>
    <template v-if='looseAppSessions.length'>
      <span style='grid-column: 1 / 5'>app-less "loose" sessions</span>
      <template v-for='(appsess, j) of looseAppSessions'>
        <span :key='"app-sess-created-loose-" + j'>{{ (new Date(appsess.created)).toLocaleString() }}</span>
        <div class='scopes' :key='"app-sess-file-scopes-loose-" + j'>
          <template v-if='appsess.fileScopes'>
          <span v-for='(scope, j) of appsess.fileScopes' :key='"app-sess-file-scope-loose-" + j' class='tag'>{{scope}}</span>
          </template>
        </div>
        <div class='scopes' :key='"app-sess-db-scopes-loose-" + j'>
          <template v-if='appsess.dbScopes'>
          <span v-for='(scope, j) of appsess.dbScopes' :key='"app-sess-db-scope-loose-" + j' class='tag'>{{scope}}</span>
          </template>
        </div>
        <div :key='"app-sess-opts-loose-" + j'>
          <button class='danger' @click='revoke("as", appsess.id)'>revoke</button>
        </div>
      </template>
    </template>

    <span v-if='!apps.length' style='grid-column: 1 / 5'>Nothing here...</span>
  </div>
  <h2 class='sub'>sessions</h2>
  <div class='sessions'>
    <span class='h4 sub'>id</span>
    <span class='h4 sub'>scopes</span>
    <span class='h4 sub'>created</span>
    <span class='h4 sub'>options</span>

    <template v-for='(sess, i) of sessions'>
      <span :key='"sess-id-" + i'>{{ sess.id }}</span>
      <div class='scopes' :key='"sess-scopes-" + i'>
        <span v-for='(scope, j) of sess.scopes' :key='"sess-scope-" + i + "-" + j' class='tag'>{{scope}}</span>
      </div>
      <span :key='"sess-created-" + i'>{{ (new Date(sess.created)).toLocaleString() }}</span>
      <div :key='"sess-opts-" + i'>
        <button class='danger' @click='revoke("s", sess.id)'>revoke</button>
      </div>
    </template>

    <span v-if='!sessions.length' style='grid-column: 1 / 5'>Nothing here...</span>
  </div>
</div>
</template>
<script lang='ts'>
import Vue from 'vue';
//@ts-ignore
import SvgIcon from '@jamescoyle/vue-icon';
import { mdiArrowLeft, mdiPlus } from '@mdi/js';

import dataBus from 'services/data-bus';
import localApi from 'services/local-api';

import { openModal } from 'utility';

import { MasterKey } from 'tiny-host-common'

export default Vue.extend({
  name: 'tiny-connections',
  components: { SvgIcon },
  data() { return {
    working: false,
    username: dataBus.user?.username || '???',
    mdiArrowLeft, mdiPlus,
    masterkeys: [],
    apps: [],
    looseAppSessions: [],
    sessions: [],
  }; },
  mounted() { this.refresh(); },
  methods: {
    async refresh() {
      if(this.working) return;
      this.working = true;

      await localApi.auth.getMasterKeys().then(res => this.masterkeys = res, () => this.masterkeys = null);
      await localApi.auth.getSessions().then(res => this.sessions = res, () => { });

      let apps: {
        id: string;
        app: string;
        store?: any;
        db?: any;
        sessions?: any[];
      }[] = [];
      await localApi.home.getApps().then(res => apps = res, () => { });
      const appsessions: {
        id: string;
        app: string;
        dbScopes: string[];
        fileScopes: string[];
        created: number;
      }[] = (await localApi.home.getAppSessions().catch(() => null)) || [];

      const looseSessions = [];

      for(const sess of appsessions) {
        const app = apps.find(a => a.id === sess.app);

        if(!app) {
          looseSessions.push(sess);
          continue;
        }

        if(!app.sessions)
          app.sessions = [];

        app.sessions.push(sess);
      }

      this.apps = apps;
      this.looseAppSessions = looseSessions;

      this.working = false;
    },
    async addKey() {
      // name it
      const key = await openModal({
        title: 'Add Remote Node',
        message: 'A remote file/db node can be added via a master key, so that '
        + 'you can use it when authorizing with apps. Be careful -- this key '
        + 'can be used to access all of your data!',
        type: 'warning',
        prompt: { required: true, placeholder: 'share key' }
      });

      if(!key)
        return;

      // parse it
      let parsed: { key: string, url: string, type: string };
      try {
        parsed = JSON.parse(atob(key));
      } catch(e) {
        openModal({
          title: 'Failed to Parse',
          message: 'Failed to parse the given share key. It should be a (sometimes long) '
          + 'string of alphanumeric characters.',
          type: 'danger',
          alert: true
        });
      }

      // add it
      const mk = await localApi.auth.addMasterKey(parsed).catch(() => null);
      if(!mk)
        return;

      //show it
      openModal({
        title: 'Remote Node Added',
        message: 'This node can now be used with authorizing apps. It can be '
        + 'removed at any time.',
        type: 'success',
        alert: true
      });

      this.refresh();
    },
    async remove(type: 'mk' | 'app', item: Partial<MasterKey & { id: string, app: string }>) {
      if(type === 'mk') {
        const choice = await openModal({
          title: 'Remove Remote Node',
          message: 'This cannot be undone. It could also break any apps that currently use this node. Are you sure?',
          type: 'danger'
        });
        if(!choice)
          return;

        await localApi.auth.delMasterKey(item.id);

        this.refresh();
      } else if(type === 'app') {
        const choice = await openModal({
          title: 'Remove App "' + item.app + '"',
          message: 'This removes any preferences and permissions you have saved for this applications, including storage scopes. Are you sure?',
          type: 'danger'
        });
        if(!choice)
          return;

        await localApi.home.delApp(item.id);

        this.refresh();
      }
    },
    async revoke(type: 's' | 'as', id: string) {
      switch(type) {
        case 's':
          await localApi.auth.delSession(id).catch(() => { });
        case 'as':
          await localApi.home.delAppSession(id).catch(() => { });
      }
      return this.refresh();
    }
  }
});
</script>
<style lang='scss'>
@import '~tiny-host-common/src/web/colors.scss';

#tiny-connections {

  > h1 { margin-bottom: 1em; }

  > h1, h2 {
    display: flex;
    align-items: baseline;
    > :not(:last-child) { margin-right: 0.33em; }
  }

  > div {
    display: grid;

    grid-template-columns: auto auto auto 1fr;

    grid-auto-rows: auto;
    gap: 1.5em;
    align-items: baseline;

    margin-bottom: 2rem;

    > * { margin: 0; }

    > div.scopes {
      display: flex;
      > span:not(:last-child) { margin-right: 0.67em; }
    }
  }
}
</style>
