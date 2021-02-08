import { CreateElement } from 'vue';
import { DialogProgrammatic } from 'buefy';
import { AxiosError } from 'axios';

export function makeCenterStyle() {
  return {
    display: 'flex',
    flexFlow: 'column',
    flexWrap: 'nowrap',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'fixed',
    top: '0',
    left: '0',
    height: '100%',
    width: '100%',
    backgroundColor: 'transparent'
  };
}

export function makeInitializerComponent(h: CreateElement, loadingComponent: any) {
  return h('div', { staticStyle: makeCenterStyle() }, [h(loadingComponent)]);
}

export async function handleError(e: Error, action?: string) {

  const message = (e as AxiosError).response?.data?.message || e.message || String(e);

   return new Promise<void>(res => DialogProgrammatic.alert({
    title: action ? 'Error ' + action : 'Error',
    message,
    type: 'is-danger',
    hasIcon: true,
    onConfirm: () => res(),
    onCancel: () => res()
  }));
}
