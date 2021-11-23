<template>
<h3>tiny home<template v-if='loggedIn'> - {{username}}</template></h3>
<router-view />
<Modal
  v-for='(modal, i) of modalList'
  :key='"modal-" + i'
  v-bind='modal'
  @destroy='destroyModal(i)'
  @confirm='modal.onConfirm'
  @cancel='modal.onCancel'
/>
</template>
<script lang='ts'>
import { defineComponent, ref, toRef, watch } from 'vue';
import { useRoute } from 'vue-router';
import Modal from '@/components/modal.vue';
import dataBus from '@/services/data-bus';
import { appSetup } from '@/services/modals';

export default defineComponent({
  components: { Modal },
  setup() {
    const route = useRoute();

    const loggedIn = ref(Boolean(dataBus.session));
    const username = ref(dataBus.user?.username || '');
    const page = toRef(route, 'name');

    watch(() => route.path, (n, o) => {
      if(n !== o) {
        if(!/^\/login/.test(n)) {
          if(!loggedIn.value)
            loggedIn.value = Boolean(dataBus.session);
          if(!username.value)
            username.value = dataBus.user?.username;
        } else {
          if(loggedIn.value)
            loggedIn.value = Boolean(dataBus.session);
          if(username.value)
            username.value = dataBus.user?.username;
        }
      }
    })

    return {
      loggedIn,
      username,

      ...appSetup()
    }
  }
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
