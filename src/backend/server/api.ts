import { Router, static as serveStatic } from 'express';
import * as path from 'path';

import { AuthApi, handleError, validateUserSession } from 'tiny-host-common';
import { StoreApi } from 'tiny-disk-host';
import { DataApi } from 'tiny-level-host';
import { HomeApi } from '../lib';

import { Config } from './types';

import db from './db';
import { validateUserOrAppSession } from '../lib/middleware';

class Api {

  private _router: Router;
  public get router() { return this._router; }

  private _authApi: AuthApi;
  public get authApi() { return this._authApi; }

  private _storeApi: StoreApi;
  public get storeApi() { return this._storeApi; }

  private _dataApi: DataApi;
  public get dataApi() { return this._dataApi; }

  private _homeApi: HomeApi;
  public get homeApi() { return this._homeApi; }

  constructor() { }

  init(config: Config) {

    this._router = Router();

    const userSessionValidator = validateUserSession(db.auth);
    const sessionValidator = validateUserOrAppSession(db.home, db.auth);

    this._authApi = new AuthApi(config, db.auth);
    this.router.use('/user', this.authApi.router);
    this._storeApi = new StoreApi(config, db.store, sessionValidator, this.router);
    this._dataApi = new DataApi(db.data, sessionValidator, this.router);
    this._homeApi = new HomeApi(Object.assign({ }, config, {
      dbs: [{ name: 'local', url: config.serverName }],
      stores: [{ name: 'local', url: config.serverName }]
    }), db.home, id => db.auth.getUser(id), (type, url, user, scopes) => {
      return null;
    }, userSessionValidator);

    this.router.use('/app', this.homeApi.router);

    this.router.use(serveStatic(path.resolve(__dirname, '../frontend')));
    this.router.get('*', (_, res) => res.sendFile(path.resolve(__dirname, '../frontend/index.html')));

    this.router.use(handleError('api'));
  }
}

export default new Api();
