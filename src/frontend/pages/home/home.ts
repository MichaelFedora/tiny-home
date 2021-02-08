import Vue from 'vue';

export default Vue.component('tiny-home', {
  data() { return {
    working: false,

    stores: [],
    dbs: [],
    apps: []
  }; },
  mounted() { this.refresh(); },
  methods: {
    async refresh() {
      if(this.working) return;
      this.working = true;

      // get stores, dbs, apps, to show their information

      this.working = false;
    }
  }
});
