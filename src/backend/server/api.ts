import { Router, static as serveStatic } from 'express';
import * as path from 'path';
import axios from 'axios';

import { AuthApi, handleError, validateUserSession } from 'tiny-host-common';
import { StoreApi } from 'tiny-disk-host';
import { DataApi } from 'tiny-level-host';
import { HomeApi, validateUserOrAppSession } from '../lib';

import { Config } from './types';

import db from './db';

class Api {

  private _router: Router;
  public get router() { return this._router; }

  private _authApi: AuthApi;
  public get authApi() { return this._authApi; }

  private _homeApi: HomeApi;
  public get homeApi() { return this._homeApi; }

  private _storeApi?: StoreApi;
  public get storeApi() { return this._storeApi; }

  private _dataApi?: DataApi;
  public get dataApi() { return this._dataApi; }


  constructor() { }

  init(config: Config) {

    this._router = Router();

    const getUser = (id: string) => db.auth.getUser(id);
    const userSessionValidator = validateUserSession(db.auth);

    // takes place of auth api
    this._homeApi = new HomeApi(Object.assign({ }, config, {
      dbs: [{ name: 'local', url: config.serverOrigin }],
      stores: [{ name: 'local', url: config.serverOrigin }]
    }), db.home, getUser, async (type, url, user, scopes, token) => {
      return config.big ? token : await axios.post(`${url}/auth/login`, { username: user.username, password: user.pass, scopes }).then(res => String(res.data));
    }, userSessionValidator, this.router);
    this._authApi = new AuthApi({ requireScopes: false, whitelist: config.whitelist }, db.auth, this.router);

    if(config.big) {
      const getSession = (sid: string) => db.auth.getSession(sid);
      const storeSessionValidator = validateUserOrAppSession(db.home, getUser, getSession, 'file');
      const dbSessionValidator = validateUserOrAppSession(db.home, getUser, getSession, 'db');

      this._storeApi = new StoreApi(config, db.store, storeSessionValidator, this.router);
      this._dataApi = new DataApi(db.data, dbSessionValidator, this.router);
    }

    this.router.use(serveStatic(path.resolve(__dirname, '../../frontend')));
    this.router.get('*', (_, res) => res.sendFile(path.resolve(__dirname, '../../frontend/index.html')));

    this.router.use(handleError('api'));
  }
}

export default new Api();
