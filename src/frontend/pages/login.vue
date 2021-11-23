<template>
<div id='tiny-login'>
  <h1>{{ registering ? "register" : "login" }}</h1>
  <div class='form'>
    <div class='field'>
      <input placeholder='username' ref='usernameEl' v-model='username' />
    </div>
    <div class='field'>
      <input placeholder='password' type='password' v-model='password' :pattern='registering ? "\\w{4,}" : null' @keyup.enter='registering ? null : login()' />
      <span class='error' v-if='registering'>{{ (username || password) && password.length < 4 ? "At least 4 characters." : "" }}</span>
    </div>
    <div v-if='registering' class='field'>
      <input placeholder='confirm password' type='password' v-model='confirmpass' :pattern='password' @keyup.enter='register()'/>
      <span class='error'>{{ password && password !== confirmpass ? "this != password" : "" }}</span>
    </div>
  </div>
  <div id='buttons'>
    <template v-if='!registering'>
      <a v-if='canRegister' @click='registering = true'>register</a>
      <div style='flex-grow: 1'/>
      <button class='primary' :disabled='!valid || working' @click='login'>login</button>
    </template>
    <template v-else>
      <button @click='registering = false'>cancel</button>
      <button class='primary' @click='register()' :disabled='!valid || working'>register</button>
    </template>
  </div>
</div>
</template>
<script lang='ts'>
import { defineComponent, reactive, toRefs, watch, ref, computed, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import localApi from '@/services/local-api';
import dataBus from '@/services/data-bus';
import modals from '@/services/modals';

export default defineComponent({
  name: 'tiny-login',

  setup(args, context) {
    const route = useRoute();
    const router = useRouter();

    const data = reactive({
      registering: false,
      canRegister: true,
      working: false,

      username: '',
      password: '',
      confirmpass: ''
    });

    const usernameEl = ref<HTMLInputElement>(null);

    watch(() => data.registering, (n, o) => {
      if(!n === !o) return;
      data.username = '';
      data.password = '';
      data.confirmpass = '';
    });

    const valid = computed(() => Boolean(
      data.username &&
      data.password &&
      /\w{4,}/.test(data.password) &&
      (!data.registering ||
        data.confirmpass === data.password)
    ));

    onMounted(() => {
      if(route.query.username)
        data.username = '' + route.query.username;
      usernameEl.value?.focus();
    });

    async function register() {
      if(data.working || !valid.value) return;
      data.working = true;

      const success = await localApi.auth.register(data.username, data.password).then(() => true, () => false);
      if(success) {
        await modals.open({
          title: 'Registered',
          message: 'Registered as "' + data.username + '"!',
          type: 'success',
          alert: true
        });

        data.registering = false;
      }

      data.working = false;
    };

    async function login() {
      if(data.working || !data.username || !data.password) return;
      data.working = true;

      let success = await localApi.auth.login(data.username, data.password).then(() => true, e => false);

      if(!success)
        (usernameEl.value as HTMLInputElement)?.focus();

      if(success)
        success = await localApi.getSelf().then(() => true, () => false);

      if(success) {
        if(route.query.goto && !(route.query.goto instanceof Array)) {
          router.push(route.query.goto);
        } else
          router.push('/');
      } else
        dataBus.clear();

      data.working = false;
    }

    return {
      ...toRefs(data),
      valid,
      register,
      login
    }
  }
});
</script>
<style lang='scss'>
#tiny-login {
  display: flex;
  flex-flow: column nowrap;
  flex-grow: 1;
  align-self: center;
  align-content: center;
  justify-content: center;

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
