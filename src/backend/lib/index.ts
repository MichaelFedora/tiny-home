
declare module 'express' {
  interface Request {
    appsession?: import('./home-types').AppSession;
    authedApp?: import('./home-types').App;
    apphandshake?: import('./home-types').AppHandshake;
  }
}

declare module 'express-serve-static-core' {
  interface Request {
    appsession?: import('./home-types').AppSession;
    authedApp?: import('./home-types').App;
    apphandshake?: import('./home-types').AppHandshake;
  }
}

import { HomeApi } from './home-api';
import { HomeDB } from './home-db';
import { validateAppSession, validateUserOrAppSession } from './middleware';
import { App, AppHandshake, Config as HomeConfig } from './home-types';

export {
  HomeApi,
  HomeDB,
  App,
  AppHandshake as Handshake,
  HomeConfig,
  validateAppSession,
  validateUserOrAppSession
}
