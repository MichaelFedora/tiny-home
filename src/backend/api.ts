import { randomBytes } from 'crypto';
import { json, Router, static as serveStatic } from 'express';
import * as path from 'path';

import { AuthError, MalformedError, NotAllowedError, NotFoundError } from './errors';
import { Config, Handshake, User } from './types';
import { handleError, handleValidationError, validateSession, wrapAsync } from './middleware';
import { hash } from './util';

import db from './db';
import axios from 'axios';

class Api {

  private _router: Router;
  public get router() { return this._router; }

  constructor() { }

  init(config: Config) {

    this._router = Router();

    // auth

    const authRouter = Router();

    authRouter.post('/login', json(), wrapAsync(async (req, res) => {
      if(config.whitelist && !config.whitelist.includes(req.body.username))
        throw new AuthError('Whitelist is active.');

      const user = await db.getUserFromUsername(req.body.username);
      if(!user)
        throw new AuthError('Username / password mismatch.');

      const pass = await hash(user.salt, req.body.password);
      if(user.pass !== pass)
        throw new AuthError('Username / password mismatch.');

      res.send(await db.addSession(user.id));
    }), handleValidationError);

    authRouter.post('/register', json(), wrapAsync(async (req, res) => {
      if(!req.body.username || !req.body.password)
        throw new MalformedError('Must have a username and password!');

      if(config.whitelist && !config.whitelist.includes(req.body.username))
        throw new NotAllowedError('Whitelist is active.');

      if(await db.getUserFromUsername(req.body.username))
        throw new NotAllowedError('Username taken!');

      const salt = randomBytes(128).toString('hex');
      const user: User = {
        username: req.body.username,
        salt,
        pass: await hash(salt, req.body.password)
      };

      await db.addUser(user);

      await Promise.all(Object.entries(config.stores).map<Promise<void>>(([name, url]) => (async () => {
        await axios.post(url + '/auth/register', { username: user.username, password: user.pass } ).then(res => String(res.data));
      })().catch(e => console.error('Error registering for store "' + name + '": ' + e))));

      await Promise.all(Object.entries(config.dbs).map<Promise<void>>(([name, url]) => (async () => {
        await axios.post(url + '/auth/register', { username: user.username, password: user.pass } );
      })().catch(e => console.error('Error regsitering for db "' + name + '": ' + e))));

      res.sendStatus(204);
    }));

    authRouter.post('/change-pass', validateSession(), json(), wrapAsync(async (req, res) => {
      if(!req.user)
        throw new NotAllowedError('Only users can change passwords.');

      if(!req.body.password || !req.body.newpass)
        throw new MalformedError('Body must have a password, and a newpass.');

      if(await hash(req.user.salt, req.body.password) !== req.user.pass)
        throw new NotAllowedError('Password mismatch.');

      const salt = randomBytes(128).toString('hex');
      const pass = hash(salt, req.body.newpass);

      await db.putUser(req.user.id, Object.assign(req.user, { salt, pass }));
      const sessions = await db.getSessionsForUser(req.user.id);
      await db.delManySessions(sessions.filter(a => a !== req.session.id));

      await Promise.all(Object.entries(config.stores).map<Promise<void>>(([name, url]) => (async () => {
        const token = await axios.post(url + '/auth/login', { username: req.user.username, password: req.user.pass } ).then(res => String(res.data));
        await axios.post(url + '/auth/change-pass?sid=' + token, { password: req.user.pass, newpass: pass });
        await axios.post(url + '/auth/logout?sid=' + token);
      })().catch(e => console.error('Error changing store "' + name + '" password: ' + e))));

      await Promise.all(Object.entries(config.dbs).map<Promise<void>>(([name, url]) => (async () => {
        const token = await axios.post(url + '/auth/login', { username: req.user.username, password: req.user.pass } ).then(res => String(res.data));
        await axios.post(url + '/auth/change-pass?sid=' + token, { password: req.user.pass, newpass: pass });
        await axios.post(url + '/auth/logout?sid=' + token);
      })().catch(e => console.error('Error changing db "' + name + '" password: ' + e))));

      res.sendStatus(204);
    }));

    authRouter.post('/logout', validateSession(), wrapAsync(async (req, res) => {
      await db.delSession(req.session.id);
      res.sendStatus(204);
    }));

    authRouter.get('/refresh', validateSession(), wrapAsync(async (req, res) => {
      let sess: string;

      if(req.user)
        sess = await db.addSession(req.user.id);
      else if(req.authedApp)
        sess = await db.addAppSession(req.authedApp.id)

      await db.delSession(req.session.id);
      res.json(sess);
    }));

    authRouter.get('/can-register', (_, res) => res.json(!Boolean(config.whitelist))); // ehhh

    authRouter.post('/token', json(), wrapAsync(async (req, res) => {
      if(!req.body.app || !req.body.redirect || !req.body.scopes || !req.body.code || !req.body.secret)
        throw new MalformedError('Body should contain: { app, redirect, scopes, code, secret }!');

      const handshake = await db.getHandshakeFromCode(req.body.code);
      if(!handshake)
        throw new NotFoundError('Handshake not found with given code!');

      await db.delHandshake(handshake.id);
      if(handshake.app !== req.body.app || handshake.redirect !== req.body.redirect || handshake.scopes !== req.body.scopes)
        throw new MalformedError('Handshake/body mismatch.');

      const secret = await hash(handshake.app, String(req.body.secret));
      const scopes = handshake.scopes.split(',');

      let app = await db.getAppFromCombo(handshake.app, secret);
      if(!app) {
        const info = {
          app: handshake.app,
          secret,
          user: handshake.user,
          store: null,
          db: null,
          fileScopes: ['/appdata/' + handshake.app + '/' + secret]
        };

        if(handshake.store)
          info.store = handshake.store;
        if(handshake.db)
          info.db = handshake.db;
        if(handshake.fileScopes)
          info.fileScopes = handshake.fileScopes.slice();

        app = await db.getApp(await db.addApp(info));
      }

      const user = await db.getUser(handshake.user);

      const tokens: {
        home?: { url: string, token: string },
        store?: { type: string, url: string, token: string },
        db?: { type: string, url: string, token: string }
      } = { };

      if(scopes.includes('home'))
        tokens.home = { url: config.serverName, token: await db.addAppSession(app.id) };

      if(scopes.includes('store')) {
        if(!app.store)
          tokens.store = null;
        else if(app.store.type === 'custom')
          tokens.store = app.store;
        else {
          tokens.store = {
            type: 'local',
            url: app.store.url,
            token: await axios.post(app.store.url + '/auth/login', { username: user.username, password: user.pass, scopes: app.fileScopes }).then(res => String(res.data))
          };
        }
      }

      if(scopes.includes('db')) {
        if(!app.db)
          tokens.db = null;
        else if(app.db.type === 'custom')
          tokens.db = app.db;
        else {
          tokens.db = {
            type: 'local',
            url: app.db.url,
            token: await axios.post(app.db.url + '/auth/login', { username: user.username, password: user.pass, scopes: ['appdata.' + app.app + '.' + app.secret] }).then(res => String(res.data))
          };
        }
      }

      res.json(tokens);
    }));

    const handshakeRouter = Router();

    const validScopes = ['home','store','db'];

    handshakeRouter.get('/start', wrapAsync(async (req, res) => {

      if(!req.query.app || typeof req.query.app !== 'string' ||
        !req.query.redirect || typeof req.query.redirect !== 'string' ||
        // !(new RegExp('^\w+://(\w+\.)*' + req.query.app, 'i').test(req.query.redirect)) ||
        !req.query.scopes || typeof req.query.scopes !== 'string' ||
        !(!req.query.fileScopes || typeof req.query.fileScopes === 'string'))
        throw new MalformedError('Must have ?app={app}&redirect={url}&scopes={scopes}<&fileScopes=["/scopes"]> query.');

      const info = {
        app: req.query.app,
        redirect: req.query.redirect,
        scopes: req.query.scopes.split(',').filter(a => validScopes.includes(a)).join(','),
        fileScopes: null as string[],
        created: Date.now()
      }

      if(req.query.fileScopes) {
        try {
          info.fileScopes = JSON.parse(req.query.fileScopes as string);
        } catch(e) {
          throw new MalformedError('Could not parse fileScopes query; should be a JSON array.')
        }
      } else
        delete info.fileScopes;

      const hsId = await db.addHandshake(info);

      res.redirect(`/handshake?handshake=${hsId}${req.query.username ? '&username=' + String(req.query.username) : ''}`);
    }))

    handshakeRouter.use('/:id', validateSession(), wrapAsync(async (req, res, next) => {
      if(!req.user)
        throw new MalformedError('Can only access handshakes as a user!');

      req.handshake = await db.getHandshake(req.params.id);
      if(!req.handshake)
        throw new NotFoundError('No handshake found with id "' + req.params.id + '"!');


      if(req.handshake.created + config.handshakeExpTime < Date.now()) {
        await db.delHandshake(req.handshake.id);
        throw new NotFoundError('Handshake expired!');
      }

      next();
    }));

    handshakeRouter.get('/:id', wrapAsync(async (req, res) => {
      res.json({
        app: req.handshake.app,
        scopes: req.handshake.scopes,
        fileScopes: req.handshake.fileScopes || undefined,

        stores: Object.entries(config.stores).map(([k, v]) => ({ name: k, url: v })),
        dbs: Object.entries(config.dbs).map(([k, v]) => ({ name: k, url: v })),
      });
    }));

    handshakeRouter.get('/:id/approve', wrapAsync(async (req, res) => {

      const scopes = req.handshake.scopes.split(',');
      if(req.query.store ? typeof req.query.store !== 'string' : scopes.includes('store'))
        throw new MalformedError('Store scope is required (as string) but not provided by query!');
      if(req.query.db ? typeof req.query.db !== 'string' : scopes.includes('db'))
        throw new MalformedError('DB scope is required (as string) but not provided by query!');

      let storeInfo: Handshake['store'] = null;
      let dbInfo: Handshake['db'] = null;

      if(req.query.store) {
        let storeType = String(req.query.store);

        if(storeType === 'custom') {
          if(!req.query.storeUrl || typeof req.query.storeUrl !== 'string' ||
            !req.query.storeToken || typeof req.query.storeToken !== 'string')
            throw new MalformedError('A custom store must also have &storeUrl=.. and &storeToken=.. queries!');
          storeInfo = { type: 'custom', url: req.query.storeUrl, token: req.query.storeToken };
        } else {
          const entry = Object.entries(config.stores).find(([k]) => k === storeType);
          if(!entry)
            throw new NotFoundError('Local store not found: ' + storeType);
          storeInfo = { type: 'local', url: entry[1] };
        }
      }

      if(req.query.db) {
        let dbType = String(req.query.db);

        if(dbType === 'custom') {
          if(!req.query.dbUrl || typeof req.query.dbUrl !== 'string' ||
            !req.query.dbToken || typeof req.query.dbToken !== 'string')
            throw new MalformedError('A custom db must also have &dbUrl=.. and &dbToken=.. queries!');

            dbInfo = { type: 'custom', url: String(req.query.dbUrl), token: req.query.dbToken };
        } else {
          const entry = Object.entries(config.dbs).find(([k]) => k === dbType);
          if(!entry)
            throw new NotFoundError('Local db not found: ' + dbType);
          dbInfo = { type: 'local', url: entry[1] };
        }
      }

      let code: string;
      do {
        code = randomBytes(24).toString('hex');
      } while(await db.getHandshakeFromCode(code) != null);


      const info = {
        user: req.user.id,
        code,
        store: storeInfo,
        db: dbInfo
      };

      await db.putHandshake(req.handshake.id, Object.assign(req.handshake, info));

      res.redirect(req.handshake.redirect + '?code=' + code);
    }));

    handshakeRouter.get('/:id/cancel', validateSession(), wrapAsync(async (req, res) => {
      await db.delHandshake(req.handshake.id);
      res.redirect(req.handshake.redirect + '?error=access_denied');
    }));

    authRouter.use('/handshake', handshakeRouter);

    this.router.use('/auth', authRouter, handleError('auth'));

    this.router.delete('/self', validateSession(), wrapAsync(async (req, res) => {
      if(req.user) {
        await db.delUser(req.user.id);
        const apps = await db.getAppsForUser(req.user.id);
        await db.delManyApps(apps.map(a => a.id));
      } else if(req.authedApp) {
        await db.delApp(req.authedApp.id);
      }
      res.sendStatus(204);
    }));

    this.router.use(serveStatic(path.resolve(__dirname, '../frontend')));
    this.router.get('*', (_, res) => res.sendFile(path.resolve(__dirname, '../frontend/index.html')));

    this.router.use(handleError('api'));
  }
}

export default new Api();
