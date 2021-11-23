import axios, { AxiosError } from 'axios';
import { handleError as modalHandleError } from '@/utility';
import dataBus from '@/services/data-bus';
import router from '@/router';

const envApiUrl = import.meta.env.VITE_API_URL;
const url = envApiUrl || location.origin;

function handleError(e: AxiosError) {
  if(!e)
    return;

  if(e.response?.status === 403 && e.response?.data?.message === 'No session found!')
    dataBus.clear();

  if(!dataBus.session && !/^\/login/.test(router.currentRoute.value.path))
    router.push(`/login?goto=${router.currentRoute.value.fullPath}`);

  return modalHandleError(e);
}

class LocalApi {

  private _auth = Object.freeze({
    async login(username: string, password: string): Promise<void> {
      await axios.post(`${url}/auth/login`, { username, password })
        .then(res => dataBus.session = String(res.data), e => { handleError(e); throw e; });
    },

    async register(username: string, password: string): Promise<void> {
      return axios.post(`${url}/auth/register`, { username, password }).then(() => null, e => { handleError(e); throw e; });
    },

    async refresh(): Promise<void> {
      await axios.get(`${url}/auth/refresh?sid=${dataBus.session}`)
        .then(res => dataBus.session = String(res.data), handleError);
    },

    async getSessions(): Promise<{ id: string, scopes: string, created: number }[]> {
      return axios.get(`${url}/auth/sessions?sid=${dataBus.session}`)
        .then(res => res.data).catch(e => { handleError(e); throw e; });
    },

    async delSession(id: string): Promise<void> {
      await axios.delete(`${url}/auth/sessions/${id}?sid=${dataBus.session}`).catch(handleError);
    },

    async clearSessions(): Promise<void> {
      await axios.delete(`${url}/auth/sessions?sid=${dataBus.session}`).catch(handleError);
    },

    async logout(): Promise<void> {
      await axios.post(`${url}/auth/logout?sid=${dataBus.session}`).catch(handleError);
      dataBus.clear();
    },

    async changePass(password: string, newpass: string): Promise<void> {
      await axios.post(`${url}/auth/change-pass?sid=${dataBus.session}`, { password, newpass }).catch(e => { handleError(e); throw e; });
    },

    async getHandshakeInfo(handshake: string): Promise<{ app: string; scopes: string; fileScopes?: string[]; dbScopes?: string[]; stores: {id: string, name: string, url: string }[]; dbs: { id: string, name: string, url: string }[] }> {
      return axios.get(`${url}/auth/handshake/${handshake}?sid=${dataBus.session}`).then(res => res.data, handleError);
    },

    approveHandshake(handshake: string, { store, db }: { store?: string, db?: string }): void {
      location.href = `${url}/auth/handshake/${handshake}/approve?sid=${dataBus.session}${store ? '&store=' + store : ''}${db ? '&db=' + db : ''}`;
    },

    cancelHandshake(handshake: string): void {
      location.href = `${url}/auth/handshake/${handshake}/cancel?sid=${dataBus.session}`
    },

    async getMasterKeys(): Promise<{ id: string, name: string }[]> {
      return axios.get(`${url}/auth/master-key?sid=${dataBus.session}`).then(res => res.data, e => { handleError(e); throw e; });
    },

    async addMasterKey(info: { key: string, url: string, type: string }): Promise<string> {
      return axios.post(`${url}/auth/master-key?sid=${dataBus.session}`, info).then(
        res => res.data,
        e => { handleError(e); throw e; });
    },

    async updateMasterKey(id: string, name: string) {
      await axios.put(`${url}/auth/master-key/${id}?sid=${dataBus.session}`, { name });
    },

    async delMasterKey(id: string) {
      await axios.delete(`${url}/auth/master-key/${id}?sid=${dataBus.session}`);
    }
  });

  public get auth() { return this._auth; }

  async getSelf(): Promise<{ id: string, username: string }> {
    const self = await axios.get(`${url}/self?sid=${dataBus.session}`).then(res => res.data).catch(e => { handleError(e); throw e; });
    dataBus.user = self;
    return self;
  }

  async deleteSelf(password: string): Promise<void> {
    await axios.delete(`${url}/self?sid=${dataBus.session}&pass=${password}`).catch(e => { handleError(e); throw e; });
    dataBus.clear();
  }

  private _home = Object.freeze({

    async getApps(): Promise<{ id: string, app: string, store?: any, db?: any }[]> {
      return axios.get(`${url}/apps?sid=${dataBus.session}`).then(
        res => res.data,
        e => {
          handleError(e);
          throw e;
      });
    },

    async delApp(id: string): Promise<void> {
      await axios.delete(`${url}/apps/${id}?sid=${dataBus.session}`).catch(e => { handleError(e); throw e; });
    },

    async getAppSessions(): Promise<{ id: string, app: string, dbScopes: string[], fileScopes: string[], created: number }[]> {
      return axios.get(`${url}/appsessions?sid=${dataBus.session}`).then(
        res => res.data,
        e => {
          handleError(e);
          throw e;
      });
    },

    async delAppSession(id: string): Promise<void> {
      await axios.delete(`${url}/appsessions/${id}?sid=${dataBus.session}`).catch(e => { handleError(e); throw e; });
    },
  });

  public get home() { return this._home; }
};

export default new LocalApi();
