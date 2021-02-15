
declare module 'express' {
  interface Request {
    appsession?: import('./types').AppSession;
    authedApp?: import('./types').App;
    apphandshake?: import('./types').AppHandshake;
  }
}

declare module 'express-serve-static-core' {
  interface Request {
    appsession?: import('./types').AppSession;
    authedApp?: import('./types').App;
    apphandshake?: import('./types').AppHandshake;
  }
}

import { HomeApi } from './home-api';
import { HomeDB } from './home-db';
import { validateAppSession, validateUserOrAppSession } from './middleware';
import { App, AppHandshake, Config as HomeConfig } from './types';

export {
  HomeApi,
  HomeDB,
  App,
  AppHandshake as Handshake,
  HomeConfig,
  validateAppSession,
  validateUserOrAppSession
}
