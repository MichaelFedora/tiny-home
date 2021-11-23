import { createApp, App, ref, Ref } from 'vue';
import Modal from '@/components/modal.vue';

import { Subject } from 'rxjs';

export interface ModalProps {
  title?: string,
  message?: string,
  type?: string;
  alert?: boolean;
  prompt?: Record<string, unknown>,
  valid?: boolean;
}

export interface ModalPropsExtended extends ModalProps {
  onCancel?: () => void;
  onConfirm?: (value: unknown) => void;
}

export const modals = new class ModalBus {
  private _modalRequest = new Subject<ModalPropsExtended>();
  get modalRequest() { return this._modalRequest.asObservable(); }

  private _dismissAllRequest = new Subject<void>();
  get dismissAllRequest() { return this._dismissAllRequest.asObservable(); }

  async open<T = string>(props: ModalProps): Promise<T> {
    let r: (value: T) => void;
    const p = new Promise<T>(res => r = res);
    this._modalRequest.next({ ...props, onCancel: () => r(undefined), onConfirm: v => r(v as T) });
    return p;
  }

  dismissAll() {
    this._dismissAllRequest.next();
  }

  openRoot(props: ModalProps): Promise<string | undefined> {
    return new Promise((res, rej) => {

      let app: App<Element> | null;

      const clean = () => {
        if(app) {
          app.unmount();
          app._container?.remove();
          app = null;
        }
      }

      try {
        app = createApp(Modal, {
          ...props,
          onCancel: () => res(undefined),
          onConfirm: (val: string) => res(val),
          onClose: () => { setTimeout(() => clean(), 150); }
        });

        const div = document.createElement('div');
        document.body.appendChild(div);

        app.mount(div);
      } catch(e) {
        rej(e);
      }
    });
  }
}

export default modals;

/**
 * Place this in your template:
 *
 * ```html
 * <Modal
 *   v-for='(modal, i) of modalList'
 *   :key='"modal-" + i'
 *   v-bind='modal'
 *   @destroy='destroyModal(i)'
 *   @confirm='modal.onConfirm'
 *   @cancel='modal.onCancel'
 * />
 * ```
 *
 * @returns {{ modalList, destroyModal }} - modalList, a ref of the modals, and destroyModal, a callback
 */
export function appSetup(): {
  modalList: Ref<ModalPropsExtended[]>;
  destroyModal: (idx: number) => void
} {
  const modalList = ref([] as ModalPropsExtended[]);

  modals.modalRequest.subscribe(v => {
    modalList.value.push(v);
  });

  const destroyModal = (idx: number) => {
    modalList.value.splice(idx, 1);
  };

  modals.dismissAllRequest.subscribe(() => {
    const v = modalList.value;
    modalList.value = [];
    for(const m of v)
      m.onCancel();
  });

  return {
    modalList,
    destroyModal
  }
}
