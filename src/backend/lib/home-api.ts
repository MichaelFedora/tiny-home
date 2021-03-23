import { randomBytes } from 'crypto';
import { json, Request, Response, NextFunction, Router } from 'express';

import { wrapAsync, handleError, MalformedError, NotFoundError, User, AuthDB, NotAllowedError, validateUserSession } from 'tiny-host-common';

import { AppHandshake, Config } from './home-types';
import { hash } from './util';
import { validateAppSession } from './middleware';
import { HomeDB } from './home-db';
import axios from 'axios';

export class HomeApi {

  private _router: Router;
  public get router() { return this._router; }

  constructor(config: Config,
    db: HomeDB,
    getUser: (id: string) => Promise<User>,
    userSessionValidator: (req: Request, res: Response, next: NextFunction) => void,
    router = Router(),
    errorHandler = handleError) {

    this._router = router;

    router.get('/info', (_, res) => res.json({ type: 'home' }));

    // const authApp = validateAppSession(db, getUser);
    const optAuthApp = validateAppSession(db, getUser, true);

    const authRouter = Router();

    authRouter.get('/refresh', optAuthApp, wrapAsync(async (req, res, next) => {
      if(!req.appsession)
        return next();

      await db.delAppSession(req.appsession.id);
      res.json(await db.addAppSession(req.appsession.app, req.appsession.user));
    }));

    authRouter.post('/logout', optAuthApp, wrapAsync(async (req, res, next) => {
      if(!req.appsession)
        return next();

      await db.delAppSession(req.appsession.id);
      res.sendStatus(204);
    }));

    authRouter.post('/session', json(), wrapAsync(async (req, res) => {
      if(!req.body.app || !req.body.redirect || !req.body.scopes || !req.body.code || !req.body.secret)
        throw new MalformedError('Body should contain: { app, redirect, scopes, code, secret }!');

      const handshake = await db.getAppHandshakeFromCode(req.body.code);
      if(!handshake)
        throw new NotFoundError('Handshake not found with given code!');

      await db.delAppHandshake(handshake.id);
      if(handshake.app !== req.body.app || handshake.redirect !== req.body.redirect || handshake.scopes !== req.body.scopes)
        throw new MalformedError('Handshake/body mismatch.');

      const secret = await hash(handshake.app, String(req.body.secret));
      const scopes = handshake.scopes.split(',');

      let app = await db.getAppFromCombo(handshake.user, handshake.app, secret, true);
      if(!app) {
        const info = {
          app: handshake.app,
          secret,
          user: handshake.user,
          store: null,
          db: null
        };

        if(handshake.store)
          info.store = { ...handshake.store, scopes: handshake.fileScopes || undefined };
        if(handshake.db)
          info.db = { ...handshake.db, scopes: handshake.dbScopes || undefined };

        app = await db.getApp(await db.addApp(info));
      } else if(
        (Boolean(app.store) !== Boolean(handshake.store) || JSON.stringify(app.store) !== JSON.stringify({ ...handshake.store, scopes: handshake.fileScopes || undefined })) ||
        (Boolean(app.db) !== Boolean(handshake.db) || JSON.stringify(app.db) !== JSON.stringify({ ...handshake.db, scopes: handshake.dbScopes || undefined }))) {

        app = {
          ...app,
          store: handshake.store ? { ...handshake.store, scopes: handshake.fileScopes || undefined } as any : null,
          db: handshake.db ? { ...handshake.db, scopes: handshake.dbScopes || undefined } as any : null
        };

        await db.putApp(app.id, app);
      }

      const user = await getUser(handshake.user);

      const sessions: {
        home?: { url: string, session: string },
        store?: { type: string, url: string, session: string },
        db?: { type: string, url: string, session: string }
      } = { };

      const session = await db.addAppSession(app.id, user.id, {
        fileScopes: scopes.includes('store') ? handshake.fileScopes || ['/appdata/' + handshake.app + '/' + secret] : [],
        dbScopes: scopes.includes('db') ? handshake.dbScopes || ['appdata.' + app.app + '.' + app.secret] : []
      });

      if(scopes.includes('home'))
        sessions.home = { url: config.serverOrigin, session };

      if(scopes.includes('store')) {
        if(!app.store)
          sessions.store = null;
        else if(app.store.type === 'local') {
          sessions.store = {
            type: 'local',
            url: config.serverOrigin,
            session
          }
        } else if(app.store.type === 'custom')
          sessions.store = app.store;
        else { // key
          const masterkey = await db.getMasterKey(app.store.key);
          if(!masterkey)
            throw new NotFoundError('No masterkey found for id ' + app.store.key + '!');

          const sess = await axios.post(masterkey.url + '/auth/generate-session?key=' + masterkey.key + '&scopes=' + JSON.stringify(app.store.scopes)).then(res => res.data).catch(e => { throw new Error('Error getting session: ' + String(e.message || e)); });
          sessions.store = {
            type: 'key',
            url: masterkey.url,
            session: sess
          }
        }
      }

      if(scopes.includes('db')) {
        if(!app.db)
          sessions.db = null;
        else if(app.db.type === 'local') {
          sessions.db = {
            type: 'local',
            url: config.serverOrigin,
            session
          }
        } else if(app.db.type === 'custom')
          sessions.db = app.db;
        else {
          const masterkey = await db.getMasterKey(app.db.key);
          if(!masterkey)
            throw new NotFoundError('No masterkey found for id ' + app.db.key + '!');

          const sess = await axios.post(masterkey.url + '/auth/generate-session?key=' + masterkey.key + '&scopes=' + JSON.stringify(app.db.scopes)).then(res => res.data).catch(e => { throw new Error('Error getting session: ' + String(e.message || e)); });
          sessions.db = {
            type: 'key',
            url: masterkey.url,
            session: sess
          }
        }
      }

      res.json(sessions);
    }));

    const handshakeRouter = Router();

    const validScopes = ['home','store','db'];

    handshakeRouter.get('/start', wrapAsync(async (req, res) => {

      if(!req.query.app || typeof req.query.app !== 'string' ||
        !req.query.redirect || typeof req.query.redirect !== 'string' ||
        // !(new RegExp('^\w+://(\w+\.)*' + req.query.app, 'i').test(req.query.redirect)) ||
        !req.query.scopes || typeof req.query.scopes !== 'string' ||
        !(!req.query.fileScopes || typeof req.query.fileScopes === 'string') ||
        !(!req.query.dbScopes || typeof req.query.dbScopes === 'string'))
        throw new MalformedError('Must have ?app={app}&redirect={url}&scopes={scopes}<&fileScopes=["/scopes"]><&dbScopes=["scope.scopes"]> query.');

      const info = {
        app: req.query.app,
        redirect: req.query.redirect,
        scopes: req.query.scopes.split(',').filter(a => validScopes.includes(a)).join(','),
        fileScopes: null as string[],
        dbScopes: null as string[],
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

      if(req.query.dbScopes) {
        try {
          info.dbScopes = JSON.parse(req.query.dbScopes as string);
        } catch(e) {
          throw new MalformedError('Could not parse dbScopes query; should be a JSON array.')
        }
      } else
        delete info.dbScopes;

      const hsId = await db.addAppHandshake(info);

      res.redirect(`/handshake?handshake=${hsId}${req.query.username ? '&username=' + String(req.query.username) : ''}`);
    }));

    handshakeRouter.use('/:id', userSessionValidator, wrapAsync(async (req, res, next) => {
      if(!req.user)
        throw new MalformedError('Can only access handshakes as a user!');

      req.apphandshake = await db.getAppHandshake(req.params.id);
      if(!req.apphandshake)
        throw new NotFoundError('No handshake found with id "' + req.params.id + '"!');


      if((req.apphandshake.created + config.handshakeExpTime) < Date.now()) {
        await db.delAppHandshake(req.apphandshake.id);
        throw new NotFoundError('Handshake expired!');
      }

      next();
    }));

    handshakeRouter.get('/:id', wrapAsync(async (req, res) => {
      const masterKeys = await db.getMasterKeysForUser(req.user.id);
      const stores = masterKeys.filter(k => k.type === 'file').map(k => ({ id: k.id, name: k.name || k.url.replace(/^https?:\/\//, ''), url: k.url }));
      const dbs = masterKeys.filter(k => k.type === 'db').map(k => ({ id: k.id, name: k.name || k.url.replace(/^https?:\/\//, ''), url: k.url }));
      if(config.big) {
        stores.unshift({ id: 'local', name: 'local', url: config.serverOrigin });
        dbs.unshift({ id: 'local', name: 'local', url: config.serverOrigin });
      }

      res.json({
        app: req.apphandshake.app,
        scopes: req.apphandshake.scopes,
        fileScopes: req.apphandshake.fileScopes || undefined,
        dbScopes: req.apphandshake.dbScopes || undefined,

        stores,
        dbs
      })
    }));

    handshakeRouter.get('/:id/approve', wrapAsync(async (req, res) => {

      const scopes = req.apphandshake.scopes.split(',');
      if(req.query.store ? typeof req.query.store !== 'string' : scopes.includes('store'))
        throw new MalformedError('Store scope is required (as string) but not provided by query!');
      if(req.query.db ? typeof req.query.db !== 'string' : scopes.includes('db'))
        throw new MalformedError('DB scope is required (as string) but not provided by query!');

      let storeInfo: AppHandshake['store'] = null;
      let dbInfo: AppHandshake['db'] = null;

      if(req.query.store) {
        let queryStore = String(req.query.store);

        if(queryStore === 'local') {
          storeInfo = { type: 'local' };

        } else if(queryStore === 'custom') {
          if(!req.query.storeUrl || typeof req.query.storeUrl !== 'string' ||
            !req.query.storeSession || typeof req.query.storeSession !== 'string')
            throw new MalformedError('A custom store must also have &storeUrl=.. and &storeSession=.. queries!');

          storeInfo = { type: 'custom', url: req.query.storeUrl, session: req.query.storeSession };

        } else {
          const key = await db.getMasterKey(queryStore);
          if(!key || key.user !== req.user.id || key.type !== 'file')
            throw new NotFoundError('Master key not found for store: ' + queryStore);
          storeInfo = { type: 'key', key: key.id };
        }
      }

      if(req.query.db) {
        let queryDb = String(req.query.db);

        if(queryDb === 'local') {
          dbInfo = { type: 'local' };

        } else if(queryDb === 'custom') {
          if(!req.query.dbUrl || typeof req.query.dbUrl !== 'string' ||
            !req.query.dbSession || typeof req.query.dbSession !== 'string')
            throw new MalformedError('A custom db must also have &dbUrl=.. and &dbSession=.. queries!');

            dbInfo = { type: 'custom', url: String(req.query.dbUrl), session: req.query.dbSession };

        } else {
          const key = await db.getMasterKey(queryDb);
          if(!key || key.user !== req.user.id || key.type !== 'db')
            throw new NotFoundError('Master key not found for db: ' + db);
          dbInfo = { type: 'key', key: key.id };
        }
      }

      let code: string;
      do {
        code = randomBytes(24).toString('hex');
      } while(await db.getAppHandshakeFromCode(code) != null);


      const info = {
        user: req.user.id,
        code,
        store: storeInfo,
        db: dbInfo
      };

      await db.putAppHandshake(req.apphandshake.id, { ...req.apphandshake, ...info });

      res.redirect(req.apphandshake.redirect + '?code=' + code);
    }));

    handshakeRouter.get('/:id/cancel', wrapAsync(async (req, res) => {
      await db.delAppHandshake(req.apphandshake.id);
      res.redirect(req.apphandshake.redirect + '?error=access_denied');
    }));

    authRouter.use('/handshake', handshakeRouter, errorHandler('home-auth-handshake'));

    const masterKeyRouter = Router();

    masterKeyRouter.use(userSessionValidator);

    masterKeyRouter.get('', wrapAsync(async (req, res) => {
      const keys = await db.getMasterKeysForUser(req.user.id);
      res.json(keys.map(key => ({ id: key.id, url: key.url, type: key.type })));
    }));

    masterKeyRouter.get('/:id', wrapAsync(async (req, res) => {
      const mk = await db.getMasterKey(req.params.id);
      if(mk.user !== req.user.id)
        res.json(null);
      else
        res.json(mk);
    }));

    masterKeyRouter.post('', json(), wrapAsync(async (req, res) => {
      if(!req.body.url || typeof req.body.url !== 'string' ||
        !req.body.key || typeof req.body.key !== 'string' ||
        !req.body.type || typeof req.body.type !== 'string' ||
        !['file', 'db'].includes(req.body.type))
        throw new MalformedError('Body should be like so: { url, key, type }');

      // verify?

      const name = req.body.name || req.body.url.replace(/^https?:\/\//, '');
      const id = await db.addMasterKey({ user: req.user.id, url: req.body.url, name, key: req.body.key, type: req.body.type });

      res.json(id);
    }));

    masterKeyRouter.put('/:id', wrapAsync(async (req, res) => {
      if(!req.body.name)
        throw new MalformedError('Body should be like so: { name: string }');

      const mk = await db.getMasterKey(req.params.id);
      if(!mk || mk.user !== req.user.id)
        throw new NotFoundError('No master key with id ' + req.params.id + ' found!');

      await db.putMasterKey(req.params.id, { ...mk, name: req.body.name });

      res.sendStatus(204);
    }))

    masterKeyRouter.delete('/:id', wrapAsync(async (req, res) => {
      const mk = await db.getMasterKey(req.params.id);
      if(!mk || mk.user !== req.user.id)
        return res.sendStatus(204);

      await db.delMasterKey(req.params.id);

      res.sendStatus(204);
    }));

    authRouter.use('/master-key', masterKeyRouter, errorHandler('home-auth-master-key'));

    router.use('/auth', authRouter, errorHandler('home-auth'));

    router.get('/self', optAuthApp, wrapAsync(async (req, res, next) => {
      if(!req.appsession)
        return next();
      res.json({ id: req.user.id, username: req.user.username });
    }), errorHandler('home-get-self'));

    router.delete('/self', optAuthApp, wrapAsync(async (req, res, next) => {
      if(!req.appsession)
        return next();

      await db.delApp(req.authedApp.app);
      res.sendStatus(204);
    }), errorHandler('home-delete-self'));

    router.get('/apps', optAuthApp, wrapAsync(async (req, res, next) => {
      if(!req.appsession)
        return next();

      res.json({ id: req.authedApp.id, app: req.authedApp.app, store: req.authedApp.store, db: req.authedApp.db });
    }), userSessionValidator, wrapAsync(async (req, res) => {
      const apps = await db.getAppsForUser(req.user.id);

      res.json(apps.map(app => ({ id: app.id, app: app.app, store: app.store, db: app.db })));
    }), errorHandler('home-apps'));

    router.delete('/apps/:id', userSessionValidator, wrapAsync(async (req, res) => {
      const app = await db.getApp(req.params.id);
      if(!app || app.user !== req.user.id)
        throw new NotAllowedError('Cannot delete an app that is not yours, or is nonexistant!');

      await db.delApp(req.params.id);

      res.sendStatus(204);
    }), errorHandler('home-apps'));

    router.get('/appsessions', optAuthApp, wrapAsync(async (req, res, next) => {
      if(!req.appsession)
        return next();

      const appsesses = await db.getAppSessionsForApp(req.authedApp.id);

      res.json(appsesses.map(sess => ({ id: sess.id, app: sess.app, created: sess.created, fileScopes: sess.fileScopes, dbScopes: sess.dbScopes })));
    }), userSessionValidator, wrapAsync(async (req, res) => {
      const appsesses = await db.getAppSessionsForUser(req.user.id);

      res.json(appsesses.map(sess => ({ id: sess.id, app: sess.app, created: sess.created, fileScopes: sess.fileScopes, dbScopes: sess.dbScopes })));
    }), errorHandler('home-appsessions'));

    router.delete('/appsessions/:id', userSessionValidator, wrapAsync(async (req, res) => {
      const appsess = await db.getAppSession(req.params.id);
      if(!appsess || appsess.user !== req.user.id)
        throw new NotAllowedError('Cannot delete an appsession that is not yours, or is nonexistant!');

      await db.delAppSession(req.params.id);

      res.sendStatus(204);
    }), errorHandler('home-appsessions'));
  }
}
