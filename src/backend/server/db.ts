import * as level from 'level';
import { LevelUp } from 'levelup';

import { AuthDB } from 'tiny-host-common';
import { DiskDB } from 'tiny-disk-host';
import { LevelDB } from 'tiny-level-host';
import { HomeDB } from '../lib';

import { Config } from './types';

class DB {

  private _db: LevelUp & { safeGet(key: string): Promise<any> };
  public get db(): LevelUp & { safeGet(key: string): Promise<any> } { return this._db; }

  private _auth: AuthDB;
  public get auth() { return this._auth; }

  private _home: HomeDB;
  public get home() { return this._home; }

  private _disk?: DiskDB;
  public get disk() { return this._disk; }

  private _level?: LevelDB;
  public get level() { return this._level; }

  constructor() { }

  init(config: Config) {
    this._db = level(config.dbName, { valueEncoding: 'json' }) as any;
    this._db.safeGet = (key: string) => this._db.get(key).catch(e => { if(e.notFound) return null; else throw e; });

    this._auth = new AuthDB(config, this._db);
    this._home = new HomeDB(config, sid => this.auth.getSession(sid).then(r => Boolean(r)), this._db);

    if(config.big) {
      const getUserFromUsername = (username: string) => this._auth.getUserFromUsername(username);
      this._disk = new DiskDB(this._db, getUserFromUsername);
      this._level = new LevelDB(this._db, getUserFromUsername);
    }
  }

  close() { return this.db.close(); }
}

export default new DB();
