<template>
<div id='tiny-home'>
  <ChangePassModal v-if='showChangePass' @destroy='showChangePass = false' @confirm='changePass' />
  <div>
    <router-link class='button info' to='/connections'><span>Manage Connections</span></router-link>
    <button class='warning' @click='showChangePass = true'><span>Change Password</span></button>
    <button class='danger' @click='deleteSelf'><span>Delete Account</span></button>
    <button class='primary' @click='logout'><span>Logout</span></button>
  </div>
</div>
</template>
<script lang='ts'>
import { defineComponent, reactive, toRefs } from 'vue';
import { useRouter } from 'vue-router';
import dataBus from '@/services/data-bus';
import localApi from '@/services/local-api';

import modals from '@/services/modals';

import ChangePassModal from 'tiny-host-common/src/web/components/change-pass-modal.vue';

export default defineComponent({
  name: 'tiny-home',
  components: { ChangePassModal },
  setup() {
    const router = useRouter();

    const data = reactive({
      working: false,
      username: dataBus.user?.username ||  '???',
      showChangePass: false
    });

    async function refresh() {
      if(data.working) return;
      data.working = true;

      // just show places to go

      data.working = false;
    }

    async function changePass(choice?: { password: string, newpass: string }) {
      if(choice && typeof choice === 'object')
        await localApi.auth.changePass(choice.password, choice.newpass).catch(() => { });
    }

    async function logout() {
      await localApi.auth.logout();
      router.push('/login');
    }

    async function deleteSelf() {
      const choice = await modals.open({
        title: 'Delete Account',
        type: 'danger',
        message: 'Are you sure you want to delete your account? This cannot be undone.',
        prompt: { type: 'password', placeholder: 'password', required: true }
      });

      if(choice) {
        await localApi.deleteSelf(choice).catch(() => { });
        router.push('/login');
      }
    }

    refresh();

    return {
      ...toRefs(data),
      changePass,
      logout,
      deleteSelf
    }
  }
});
</script>
<style lang='scss'>
#tiny-home {
  position: relative;
  flex-grow: 1;
  display: flex;
  flex-flow: column;
  align-items: center;

  > div {

    flex-grow: 1;
    align-content: center;

    display: grid;
    grid-template-columns: repeat(2, 10em);
    grid-template-rows:    repeat(2, 10em);
    gap: 1.5em;

    > button, > .button {
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: bold;
      min-width: 0;
      width: 100%;
      height: 100%;
    }
  }
}
</style>
