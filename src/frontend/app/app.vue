<template>
<div id='app'>
  <b-dropdown id='account-dropdown' position='is-bottom-left' v-if='loggedIn'>
    <button slot='trigger' id='menu-fab'><b-icon icon='account' /></button>
    <b-dropdown-item @click='changePassword()' class='hover-info'>change password</b-dropdown-item>
    <b-dropdown-item @click='logout()'>logout</b-dropdown-item>
    <b-dropdown-item @click='deleteSelf()' class='hover-danger'><b-icon icon='alert-circle-outline' size='is-small' />&nbsp;delete self</b-dropdown-item>
  </b-dropdown>
  <router-view />
</div>
</template>
<script src='./app.ts'></script>
<style lang='scss'>
div#app {
  div#account-dropdown {
    position: fixed;
    top: 1rem;
    right: 1rem;
    z-index: 20;

    button#menu-fab {
      display: flex;
      align-items: center;
      justify-content: center;

      background-color: hsl(171, 100%, 41%);
      color: white;

      border: none;
      padding: 0.5em;
      box-shadow: 0 1px 5px rgba(0,0,0,0.33);
      border-radius: 50%;

      cursor: pointer;
      user-select: none;
      z-index: 1;
    }
  }
}
</style>
