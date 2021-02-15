import { randomBytes } from 'crypto';
import { json, Request, Response, NextFunction, Router } from 'express';

import { wrapAsync, handleError, MalformedError, NotFoundError, User, AuthDB, NotAllowedError } from 'tiny-host-common';

import { Handshake, Config } from './types';
import { hash } from './util';
import { validateAppSession } from './middleware';
import { HomeDB } from './home-db';

export class HomeApi {

  private _router: Router;
  public get router() { return this._router; }

  constructor(config: Config & {
      stores: readonly { name: string, url: string }[],
      dbs: readonly { name: string, url: string }[]
    },
    db: HomeDB,
    getUser: (id: string) => Promise<User>,
    getToken: (type: 'store' | 'db', url: string, user: User, scopes: readonly string[], appToken: string) => Promise<string>,
    userSessionValidator: (req: Request, res: Response, next: NextFunction) => void,
    router = Router(),
    errorHandler = handleError) {

    this._router = router;

    router.get('/info', (_, res) => res.json({ type: 'home' }));

    const authApp = validateAppSession(db, getUser);
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

    authRouter.post('/token', json(), wrapAsync(async (req, res) => {
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

      let app = await db.getAppFromCombo(handshake.app, secret);
      if(!app) {
        const info = {
          app: handshake.app,
          secret,
          user: handshake.user,
          store: null,
          db: null
        };

        if(handshake.store)
          info.store = handshake.store;
        if(handshake.db)
          info.db = handshake.db;

        app = await db.getApp(await db.addApp(info));
      }

      const user = await getUser(handshake.user);

      const tokens: {
        home?: { url: string, token: string },
        store?: { type: string, url: string, token: string },
        db?: { type: string, url: string, token: string }
      } = { };

      const token = await db.addAppSession(app.id, user.id, {
        fileScopes: scopes.includes('store') ? handshake.fileScopes || ['/appdata/' + handshake.app + '/' + secret] : [],
        dbScopes: scopes.includes('db') ? handshake.dbScopes || ['appdata.' + app.app + '.' + app.secret] : []
      });

      if(scopes.includes('home'))
        tokens.home = { url: config.serverOrigin, token };

      if(scopes.includes('store')) {
        if(!app.store)
          tokens.store = null;
        else if(app.store.type === 'custom')
          tokens.store = app.store;
        else {
          tokens.store = {
            type: 'local',
            url: app.store.url,
            token: await getToken('store', app.store.url, user, handshake.fileScopes, token)
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
            token: await getToken('db', app.store.url, user, handshake.dbScopes, token)
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

      const hsId = await db.addAppHandshake(info);

      res.redirect(`/handshake?handshake=${hsId}${req.query.username ? '&username=' + String(req.query.username) : ''}`);
    }))

    handshakeRouter.use('/:id', userSessionValidator, wrapAsync(async (req, res, next) => {
      if(!req.user)
        throw new MalformedError('Can only access handshakes as a user!');

      req.apphandshake = await db.getAppHandshake(req.params.id);
      if(!req.apphandshake)
        throw new NotFoundError('No handshake found with id "' + req.params.id + '"!');


      if(req.apphandshake.created + config.handshakeExpTime < Date.now()) {
        await db.delAppHandshake(req.apphandshake.id);
        throw new NotFoundError('Handshake expired!');
      }

      next();
    }));

    handshakeRouter.get('/:id', wrapAsync(async (req, res) => {
      res.json({
        app: req.apphandshake.app,
        scopes: req.apphandshake.scopes,
        fileScopes: req.apphandshake.fileScopes || undefined,

        stores: config.stores,
        dbs: config.dbs,
      });
    }));

    handshakeRouter.get('/:id/approve', wrapAsync(async (req, res) => {

      const scopes = req.apphandshake.scopes.split(',');
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
          const entry = config.stores.find(({ name }) => name === storeType);
          if(!entry)
            throw new NotFoundError('Local store not found: ' + storeType);
          storeInfo = { type: 'local', url: entry.url };
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
          const entry = config.dbs.find(({ name }) => name === dbType);
          if(!entry)
            throw new NotFoundError('Local db not found: ' + dbType);
          dbInfo = { type: 'local', url: entry.url };
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

      await db.putAppHandshake(req.apphandshake.id, Object.assign(req.apphandshake, info));

      res.redirect(req.apphandshake.redirect + '?code=' + code);
    }));

    handshakeRouter.get('/:id/cancel', wrapAsync(async (req, res) => {
      await db.delAppHandshake(req.apphandshake.id);
      res.redirect(req.apphandshake.redirect + '?error=access_denied');
    }));

    authRouter.use('/handshake', handshakeRouter, errorHandler('home-auth-handshake'));

    router.use('/auth', authRouter, errorHandler('home-auth'));

    router.get('/self', optAuthApp, wrapAsync(async (req, res, next) => {
      if(!req.appsession)
        return next();
      res.json({ id: req.user.id, username: req.user.username });
    }), handleError('home-get-self'));

    router.delete('/self', optAuthApp, wrapAsync(async (req, res, next) => {
      if(!req.appsession)
        return next();

      await db.delApp(req.authedApp.app);
      res.sendStatus(204);
    }), handleError('home-delete-self'));
  }
}
