declare module 'express' {
  interface Request {
    appsession?: import('./types').AppSession;
    authedApp?: import('./types').App;
    handshake?: import('./types').Handshake;
  }
}

declare module 'express-serve-static-core' {
  interface Request {
    appsession?: import('./types').AppSession;
    authedApp?: import('./types').App;
    handshake?: import('./types').Handshake;
  }
}

import { HomeApi } from './home-api';
import { HomeDB } from './home-db';
import { validateAppSession, validateUserOrAppSession } from './middleware';
import { App, Handshake, Config as HomeConfig } from './types';

export {
  HomeApi,
  HomeDB,
  App,
  Handshake,
  HomeConfig,
  validateAppSession,
  validateUserOrAppSession
}
