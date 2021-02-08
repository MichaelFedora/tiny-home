<template>
<div id='tiny-login' class='content'>
  <h1>login</h1>
  <div class='form'>
    <b-field>
      <b-input placeholder='username' v-model='username' icon-right='account' />
    </b-field>
    <b-field>
      <b-input placeholder='password' type='password' password-reveal v-model='password' :pattern='registering ? "\\w{4,}" : null' :validation-message='(registering && password.length < 4) ? "At least 4 characters." : ""' @keyup.native.enter='registering ? null : login()' />
    </b-field>
    <b-field v-if='registering'>
      <b-input placeholder='confirm password' type='password' v-model='confirmpass' :pattern='password' validation-message='this != password' @keyup.native.enter='register()'/>
    </b-field>
  </div>
  <div id='buttons'>
    <template v-if='!registering'>
      <a v-if='canRegister' @click='registering = true'>register</a>
      <div style='flex-grow: 1'/>
      <b-button type='is-primary' :disabled='!valid' @click='login' :loading='working'>login</b-button>
    </template>
    <template v-else>
      <b-button @click='registering = false'>cancel</b-button>
      <b-button type='is-primary' @click='register()' :disabled='!valid' :loading='working'>register</b-button>
    </template>
  </div>
</div>
</template>
<script src='./login.ts'></script>
<style lang='scss'>
#tiny-login {
  display: inline-block;
  left: 50%;
  top: 50%;
  position: absolute;
  transform: translate(-50%, -50%);

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
