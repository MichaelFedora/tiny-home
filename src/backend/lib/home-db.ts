import { LevelUp } from 'levelup';
import { v4 } from 'uuid';

import { App, AppSession, Handshake } from './types';
import { hash } from './util';

export class HomeDB {

  private sessionExpTime = 604800000; // 7d
  private handshakeExpTime = 300000; // 5m

  public get db(): LevelUp { return this._db; }

  public async safeGet(key: string) { return this.db.get(key).catch(e => { if(e.notFound) return null; else throw e; }); }

  constructor(config: { handshakeExpTime: number, sessionExpTime: number },
    private checkSessionCollision: (sid: string) => Promise<Boolean>,
    private _db: LevelUp,
    private scope = '') {
    if(config.handshakeExpTime)
      this.handshakeExpTime = config.handshakeExpTime;
    if(config.sessionExpTime)
      this.sessionExpTime = config.sessionExpTime;

    if(scope && !scope.endsWith('!!'))
      this.scope = scope + '!!';
  }

  // app sessions

  async addAppSession(app: string, user: string): Promise<string> {
    let id: string;
    do {
      id = v4();
    } while(await this.getAppSession(id) != null && !await this.checkSessionCollision(id));
    await this.db.put(this.scope + 'appsession!!' + id, { app, user, created: Date.now() });
    return id;
  }

  async getAppSession(session: string): Promise<AppSession> {
    const s = await this.safeGet(this.scope + 'appsession!!' + session);
    if(s) s.id = session;
    return s;
  }

  async delAppSession(session: string): Promise<void> {
    return await this.db.del(this.scope + 'appsession!!' + session);
  }

  async delManyAppSessions(sessions: readonly string[]): Promise<void> {
    let batch = this.db.batch();
    for(const sess of sessions)
      batch = batch.del(this.scope + 'appsession!!' + sess);
    await batch.write();
  }

  async cleanAppSessions(): Promise<void> {
    const sessions: string[] = [];
    const start = this.scope + 'appsession!!';
    const end = this.scope + 'appsession!"'
    await new Promise<void>(res => {
      const stream = this.db.createReadStream({ gt: start, lt: end });
      stream.on('data', ({ key, value }: { key: string, value: AppSession }) => {
        if((value.created + this.sessionExpTime) > Date.now())
          sessions.push(key.slice(0, start.length));
      }).on('close', () => res());
    });
    await this.delManyAppSessions(sessions);
  }

  async getAppSessionsForUser(user: string): Promise<string[]> {
    const sessions: string[] = [];
    const start = this.scope + 'appsession!!';
    const end = this.scope + 'appsession!"'
    await new Promise<void>(res => {
      const stream = this.db.createReadStream({ gt: start, lt: end });
      stream.on('data', ({ key, value }: { key: string, value: AppSession }) => {
        if(value.user === user)
          sessions.push(key.slice(0, start.length));
      }).on('close', () => res());
    });
    return sessions;
  }

  async getAppSessionsForApp(app: string): Promise<string[]> {
    const sessions: string[] = [];
    const start = this.scope + 'appsession!!';
    const end = this.scope + 'appsession!"'
    await new Promise<void>(res => {
      const stream = this.db.createReadStream({ gt: start, lt: end });
      stream.on('data', ({ key, value }: { key: string, value: AppSession }) => {
        if(value.app === app)
          sessions.push(key.slice(0, start.length));
      }).on('close', () => res());
    });
    return sessions;
  }

  // apps

  async addApp(app: App): Promise<string> {
    delete app.id;

    let id: string;
    do {
      id = v4();
    } while(await this.getApp(id) != null);
    await this.db.put(this.scope + 'app!!' + id, app);
    return id;
  }

  async putApp(id: string, app: App): Promise<void> {
    delete app.id;

    await this.db.put(this.scope + 'app!!' + id, app);
  }

  async getApp(id: string): Promise<App> {
    const u = await this.safeGet(this.scope + 'app!!' + id);
    if(u) u.id = id;
    return u;
  }

  async delApp(id: string): Promise<void> {
    return await this.db.del(this.scope + 'app!!' + id);
  }

  async getAppFromCombo(app: string, secret: string, hashed = false): Promise<App> {
    if(!hashed)
      secret = await hash(app, secret);

    let destroyed = false;
    const start = this.scope + 'app!!';
    const end = this.scope + 'app!"'
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

    const start = this.scope + 'app!!';
    const end = this.scope + 'app!"'
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
      batch = batch.del(this.scope + 'app!!' + app);
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

    await this.db.put(this.scope + 'handshake!!' + id, hs);
    return id;
  }

  async putHandshake(id: string, hs: Handshake): Promise<void> {
    delete hs.id;

    await this.db.put(this.scope + 'handshake!!' + id, hs);
  }

  async getHandshake(id: string): Promise<Handshake> {
    const u = await this.safeGet(this.scope + 'handshake!!' + id);
    if(u) u.id = id;
    return u;
  }

  async delHandshake(id: string): Promise<void> {
    return await this.db.del(this.scope + 'handshake!!' + id);
  }

  async getHandshakeFromCode(code: string): Promise<Handshake> {
    let destroyed = false;
    const start = this.scope + 'handshake!!';
    const end = this.scope + 'handshake!"'
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
    const start = this.scope + 'handshake!!';
    const end = this.scope + 'handshake!"'
    await new Promise<void>(res => {
      const stream = this.db.createReadStream({ gt: start, lt: end });
      stream.on('data', ({ key, value }: { key: string, value: Handshake }) => {
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
