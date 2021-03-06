import { Router, static as serveStatic } from 'express';
import * as path from 'path';
import axios from 'axios';

import { AuthApi, handleError, NotFoundError, validateUserSession } from 'tiny-host-common';
import { DiskApi } from 'tiny-disk-host';
import { LevelApi } from 'tiny-level-host';
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

  private _diskApi?: DiskApi;
  public get diskApi() { return this._diskApi; }

  private _levelApi?: LevelApi;
  public get levelApi() { return this._levelApi; }


  constructor() { }

  init(config: Config) {

    this._router = Router();

    const getUser = (id: string) => db.auth.getUser(id);
    const userSessionValidator = validateUserSession(db.auth);

    this.router.get('/type', (_, res) => res.send('home'));

    // takes place of auth api
    this._homeApi = new HomeApi(Object.assign({ }, config, {
      dbs: [{ name: 'local', url: config.serverOrigin }],
      stores: [{ name: 'local', url: config.serverOrigin }]
    }), db.home, getUser, async (type, url, user, scopes, session) => {
      if(config.big) return session;
      const key = user[type + 'Keys'][url];
      if(!key)
        throw new NotFoundError('No key found for ' + type + ' ' + url + ' !');
      return await axios.post(`${url}/auth/generate-session?key=${key}&scopes=${JSON.stringify(scopes)}`).then(res => String(res.data));
    }, userSessionValidator, this.router);
    this._authApi = new AuthApi({
      whitelist: config.whitelist,
      handshakeExpTime: 0,
      requireScopes: false,
      allowHandshakes: false,
      allowMasterKeys: false
    }, db.auth, this.router);

    if(config.big) {
      const getSession = (sid: string) => db.auth.getSession(sid);
      const storeSessionValidator = validateUserOrAppSession(db.home, getUser, getSession, 'file');
      const dbSessionValidator = validateUserOrAppSession(db.home, getUser, getSession, 'db');

      this._diskApi = new DiskApi(config, db.disk, storeSessionValidator, this.router);
      this._levelApi = new LevelApi(db.level, dbSessionValidator, this.router);
    }

    this.router.use(serveStatic(path.resolve(__dirname, '../../frontend')));
    this.router.get('*', (_, res) => res.sendFile(path.resolve(__dirname, '../../frontend/index.html')));

    this.router.use(handleError('api'));
  }
}

export default new Api();
