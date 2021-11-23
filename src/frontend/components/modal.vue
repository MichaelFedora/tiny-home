<template>
<teleport to='body'>
  <transition name='fade'>
  <div v-if='active'
    class='modal is-active'
    :class='classes'
    role='dialog'
    aria-modal='true'
    v-bind='$attrs'>
    <div class='modal-background' @click='cancel()' />
    <div class='modal-card'>
      <header v-show='title'>
        <span>{{title}}</span>
      </header>
      <section>
        <slot>
          <p>{{message}}</p>
          <div class='field' v-if='input'>
            <input ref='inputEl' :class='{ [type]: true }'
              :type='input.type'
              :placeholder='input.placeholder'
              :required='input.required'
              :readonly='input.readonly'
              v-model='text' />
            <span class='error'>{{ input.required && text === '' ? 'required' : '' }}</span>
          </div>
        </slot>
      </section>
      <footer>
        <button v-if='!alert' @click='cancel'>cancel</button>
        <button :class='{ [type]: true }' ref='submitEl' :disabled='(input && input.required && !text) || !valid' @click='confirm' @keydown.esc='cancel'>{{ alert ? 'ok' : 'confirm' }}</button>
      </footer>
    </div>
  </div>
  </transition>
</teleport>
</template>
<script lang='ts' setup>
import { onMounted, onUnmounted, computed, ref, nextTick } from '@vue/runtime-core';

const props = defineProps({
  title: String,
  message: String,
  type: { type: String, default: 'primary' },
  alert: Boolean,
  prompt: { type: Object, default: () => null },
  valid: { type: Boolean, default: true }
});

const emits = defineEmits<{
  (e: 'confirm', value: string | true): void
  (e: 'cancel'): void
  (e: 'destroy'): void
}>();

const active = ref(false);
const text = ref<string>(undefined);

const inputEl = ref<HTMLInputElement>(null);
const submitEl = ref<HTMLButtonElement>(null);

const classes = computed(() => ({ [props.type]: true }));

const input = computed(() => {
  if(!props.prompt)
    return null;

  return Object.assign({
    type: 'text',
    placeholder: '',
    required: false,
    readonly: Boolean(props.alert)
  }, props.prompt);
});

onMounted(() => {
  active.value = true;
  nextTick(() => input.value ? inputEl.value?.focus() : submitEl.value?.focus());
  window.addEventListener('keyup', onKey);
  if(props.prompt?.value)
    text.value = props.prompt.value;
});

onUnmounted(() => {
  window.removeEventListener('keyup', onKey)
});

function confirm() {
  if(!active.value) return;

  emits('confirm', input.value ? text.value : true);
  close();
}

function cancel() {
  if(!active.value) return;

  emits('cancel');
  close();
}

function close() {
  if(!active.value) return;

  active.value = false;
  emits('destroy');
}

function onKey(ev: KeyboardEvent) {
  if(!active.value) return;

  if(ev.key === 'Enter')
    confirm();
  else if(ev.key === 'Escape')
    cancel();
}
</script>
<style lang='scss'>
</style>
