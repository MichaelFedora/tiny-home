import { randomBytes } from 'crypto';
import * as level from 'level';
import { LevelUp } from 'levelup';
import { StringDecoder } from 'string_decoder';
import { v4 } from 'uuid';

import { Config, Session, User, App, Handshake } from './types';
import { hash } from './util';

class DB {

  private sessionExpTime = 604800000; // 7d
  private handshakeExpTime = 300000; // 5m

  private _db: LevelUp & { safeGet(key: string): Promise<any> };
  public get db(): LevelUp & { safeGet(key: string): Promise<any> } { return this._db; }

  constructor() { }

  init(config: Config) {
    this._db = level(config.dbName, { valueEncoding: 'json' }) as any;
    this._db.safeGet = (key: string) => this._db.get(key).catch(e => { if(e.notFound) return null; else throw e; });
    this.sessionExpTime = config.sessionExpTime;
    this.handshakeExpTime = config.handshakeExpTime;
  }

  close() { return this.db.close(); }

  // sessions

  async addSession(user: string): Promise<string> {
    if(!user)
      throw new Error('Cannot add a session without a user!');

    let id: string;
    do {
      id = v4();
    } while(await this.getSession(id) != null);
    await this.db.put('session!!' + id, { user, created: Date.now() });
    return id;
  }

  async addAppSession(app: string): Promise<string> {
    let id: string;
    do {
      id = v4();
    } while(await this.getSession(id) != null);
    await this.db.put('session!!' + id, { app, created: Date.now() });
    return id;
  }

  async getSession(session: string): Promise<Session> {
    const s = await this.db.safeGet('session!!' + session);
    if(s) s.id = session;
    return s;
  }

  async delSession(session: string): Promise<void> {
    return await this.db.del('session!!' + session);
  }

  async delManySessions(sessions: readonly string[]): Promise<void> {
    let batch = this.db.batch();
    for(const sess of sessions)
      batch = batch.del('session!!' + sess);
    await batch.write();
  }

  async cleanSessions(): Promise<void> {
    const sessions: string[] = [];
    const start = 'session!!';
    const end = 'session!"'
    await new Promise<void>(res => {
      const stream = this.db.createReadStream({ gt: start, lt: end });
      stream.on('data', ({ key, value }: { key: string, value: Session }) => {
        if((value.created + this.sessionExpTime) > Date.now())
          sessions.push(key.slice(0, start.length));
      }).on('close', () => res());
    });
    await this.delManySessions(sessions);
  }

  async getSessionsForUser(user: string): Promise<string[]> {
    const sessions: string[] = [];
    const start = 'session!!';
    const end = 'session!"'
    await new Promise<void>(res => {
      const stream = this.db.createReadStream({ gt: start, lt: end });
      stream.on('data', ({ key, value }: { key: string, value: Session }) => {
        if(value.user === user)
          sessions.push(key.slice(0, start.length));
      }).on('close', () => res());
    });
    return sessions;
  }

  // users

  async addUser(user: User): Promise<string> {
    delete user.id;

    let id: string;
    do {
      id = v4();
    } while(await this.getUser(id) != null);
    await this.db.put('user!!' + id, user);
    return id;
  }

  async putUser(id: string, user: User): Promise<void> {
    delete user.id;

    await this.db.put('user!!' + id, user);
  }

  async getUser(id: string): Promise<User> {
    const u = await this.db.safeGet('user!!' + id);
    if(u) u.id = id;
    return u;
  }

  async delUser(id: string): Promise<void> {
    return await this.db.del('user!!' + id);
  }

  async getUserFromUsername(username: string): Promise<User> {
    let destroyed = false;
    const start = 'user!!';
    const end = 'user!"'
    return await new Promise<User>(res => {
      const stream = this.db.createReadStream({ gt: start, lt: end });
      stream.on('data', ({ key, value }) => {
        if(!destroyed && value.username === username) {
          destroyed = true;
          res(Object.assign({ id: key.slice(start.length) }, value));
          (stream as any).destroy();
        }
      }).on('close', () => destroyed ? null : res(null));
    });
  }

  // apps

  async addApp(app: App): Promise<string> {
    delete app.id;

    let id: string;
    do {
      id = v4();
    } while(await this.getApp(id) != null);
    await this.db.put('app!!' + id, app);
    return id;
  }

  async putApp(id: string, app: App): Promise<void> {
    delete app.id;

    await this.db.put('app!!' + id, app);
  }

  async getApp(id: string): Promise<App> {
    const u = await this.db.safeGet('app!!' + id);
    if(u) u.id = id;
    return u;
  }

  async delApp(id: string): Promise<void> {
    return await this.db.del('app!!' + id);
  }

  async getAppFromCombo(app: string, secret: string, hashed = false): Promise<App> {
    if(!hashed)
      secret = await hash(app, secret);

    let destroyed = false;
    const start = 'app!!';
    const end = 'app!"'
    return await new Promise<App>(res => {
      const stream = this.db.createReadStream({ gt: start, lt: end });
      stream.on('data', ({ key, value }: { key: string, value: App }) => {
        if(!destroyed && value.app === app && value.secret === secret) {
          destroyed = true;
          res(Object.assign({ id: key.slice(start.length) }, value));
          (stream as any).destroy();
        }
      }).on('close', () => destroyed ? null : res(null));
    });
  }

  async getAppsForUser(user: string): Promise<App[]> {
    const apps: App[] = [];

    const start = 'app!!';
    const end = 'app!"'
    await new Promise<void>(res => {
      const stream = this.db.createValueStream({ gt: start, lt: end });
      stream.on('data', ({ key, value }: { key: string, value: App }) => {
        if(value.user === user)
          apps.push(Object.assign({ id: key.slice(start.length) }, value));
      }).on('close', () => res());
    });

    return apps;
  }



  async delManyApps(apps: readonly string[]): Promise<void> {
    let batch = this.db.batch();
    for(const app of apps)
      batch = batch.del('app!!' + app);
    await batch.write();
  }

  // handshakes

  async addHandshake(hs: Handshake): Promise<string> {
    delete hs.id;

    let id: string;
    do {
      id = v4();
    } while(await this.getHandshake(id) != null);

    delete hs.code;
    delete hs.user;

    await this.db.put('handshake!!' + id, hs);
    return id;
  }

  async putHandshake(id: string, hs: Handshake): Promise<void> {
    delete hs.id;

    await this.db.put('handshake!!' + id, hs);
  }

  async getHandshake(id: string): Promise<Handshake> {
    const u = await this.db.safeGet('handshake!!' + id);
    if(u) u.id = id;
    return u;
  }

  async delHandshake(id: string): Promise<void> {
    return await this.db.del('handshake!!' + id);
  }

  async getHandshakeFromCode(code: string): Promise<Handshake> {
    let destroyed = false;
    const start = 'handshake!!';
    const end = 'handshake!"'
    return await new Promise<Handshake>(res => {
      const stream = this.db.createValueStream({ gt: start, lt: end });
      stream.on('data', (value: Handshake) => {
        if(!destroyed && value.code === code) {
          destroyed = true;
          res(value);
          (stream as any).destroy();
        }
      }).on('close', () => destroyed ? null : res(null));
    });
  }

  async cleanHandshakes(): Promise<void> {
    const handshakes: string[] = [];
    const start = 'handshake!!';
    const end = 'handshake!"'
    await new Promise<void>(res => {
      const stream = this.db.createReadStream({ gt: start, lt: end });
      stream.on('data', ({ key, value }: { key: string, value: Session }) => {
        if((value.created + this.handshakeExpTime) > Date.now())
        handshakes.push(key);
      }).on('close', () => res());
    });
    let batch = this.db.batch();
    for(const hs of handshakes)
      batch = batch.del(hs);
    await batch.write();
  }
}

export default new DB();
