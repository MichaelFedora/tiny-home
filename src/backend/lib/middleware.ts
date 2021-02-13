import { Request, Response, NextFunction } from 'express';
import { AuthError, User, wrapAsync, handleValidationError, Session } from 'tiny-host-common';

import { HomeDB } from './home-db';

export function validateAppSession(homeDB: HomeDB, getUser?: (id: string) => Promise<User>, pass = false) {
  return wrapAsync(async function(req: Request, res: Response, next: NextFunction) {
    try {
      const appsession = await homeDB.getAppSession(String(req.query.sid || '') || '');
      if(!appsession) {
        if(!pass)
          throw new AuthError('No app-session found!');
        else
          return next();
      }

      req.appsession = appsession;

      const app = await homeDB.getApp(appsession.app);
      if(!app)
        throw new AuthError('No app found!');

      req.authedApp = app;

      if(getUser) {
        const user = await getUser(appsession.user);
        if(!user)
          throw new AuthError('No user found!');

        req.user = user;
      }

    } catch(e) {
      return handleValidationError(e, req, res, next);
    }
    next();
  });
}

export function validateUserOrAppSession(homeDB: HomeDB, getUser: (id: string) => Promise<User>, getSession: (sid: string) => Promise<Session>, scope?: 'file' | 'db') {
  return wrapAsync(async function(req: Request, res: Response, next: NextFunction) {
    try {
      const appsession = await homeDB.getAppSession(String(req.query.sid || '') || '');

      if(!appsession) {
        const session = await getSession(String(req.query.sid || '') || '');
        if(!session)
          throw new AuthError('No session found!');

        req.session = session;

        const user = await getUser(session.user);
        if(!user)
          throw new AuthError('No user found!');

        req.user = user;

      } else {
        req.session = appsession;
        req.appsession = appsession;

        const app = await homeDB.getApp(appsession.app);
        if(!app)
          throw new AuthError('No app found!');

        req.authedApp = app;

        if(scope === 'file')
          req.session.scopes = appsession.fileScopes;
        else if(scope === 'db')
          req.session.scopes = appsession.dbScopes;

        const user = await getUser(appsession.user);
        if(!user)
          throw new AuthError('No user found!');

        req.user = user;
      }
    } catch(e) {
      return handleValidationError(e, req, res, next);
    }
    next();
  });
}
