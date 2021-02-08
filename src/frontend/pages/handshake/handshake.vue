<template>
<div id='tiny-handshake' class='content'>
  <h1>tiny handshake</h1>
  <h4>{{ app }}</h4>
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
  <p id='dropdowns'>
    <b-dropdown v-if='scopes.includes("store")' v-model='store'>
      <b-button type='input' icon-right='chevron-down' slot='trigger'>Store: {{ (store && store.name) || '???' }}</b-button>
      <b-dropdown-item v-for='(s, i) of stores' :key='"store-" + i' :value='s'>{{ s.name }}</b-dropdown-item>
    </b-dropdown>
    <b-dropdown v-if='scopes.includes("db")' v-model='db'>
      <b-button type='input' icon-right='chevron-down' slot='trigger'>DB: {{ (db && db.name) || '???' }}</b-button>
      <b-dropdown-item v-for='(d, i) of dbs' :key='"db-" + i' :value='d'>{{ d.name }}</b-dropdown-item>
    </b-dropdown>
  </p>
  <hr>
  <div id='buttons'>
    <b-button @click='cancel'>cancel</b-button>
    <b-button type='is-primary' @click='approve()'>approve</b-button>
  </div>
</div>
</template>
<script src='./handshake.ts'></script>
<style lang='scss'>
div#tiny-handshake {
  display: inline-block;
  left: 50%;
  top: 50%;
  position: absolute;
  transform: translate(-50%, -50%);

  > p#tag-list {
    display: flex;
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
