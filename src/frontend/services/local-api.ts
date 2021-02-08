import axios from 'axios';
import dataBus from './data-bus';
import { handleError } from '../util';

const url = location.origin;

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

    async logout(): Promise<void> {
      await axios.post(`${url}/auth/logout?sid=${dataBus.session}`).catch(handleError);
      dataBus.clear();
    },

    async canRegister(): Promise<boolean> {
      return axios.get(`${url}/auth/can-register`).then(res => Boolean(res.data), e => { handleError(e); return false; });
    },

    async getHandshakeInfo(handshake: string): Promise<{ app: string; scopes: string; fileScopes?: string[]; stores: { name: string, url: string }[]; dbs: { name: string, url: string }[] }> {
      return axios.get(`${url}/auth/handshake/${handshake}?sid=${dataBus.session}`).then(res => res.data, handleError);
    },

    approveHandshake(handshake: string, { store, db }: { store?: string, db?: string }): void {
      location.href = `${url}/auth/handshake/${handshake}/approve?sid=${dataBus.session}${store ? '&store=' + store : ''}${db ? '&db=' + db : ''}`;
    },

    cancelHandshake(handshake: string): void {
      location.href = `${url}/auth/handshake/${handshake}/cancel?sid=${dataBus.session}`
    }
  });

  public get auth() { return this._auth; }

  async deleteSelf(): Promise<void> {
    await axios.delete(`${url}/self?sid=${dataBus.session}`);
    dataBus.clear();
  }
};

export default new LocalApi();
