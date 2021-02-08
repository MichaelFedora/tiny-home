import { Request } from 'express-serve-static-core';

declare module 'express' {
  interface Request {
    user?: import('./types').User;
    authedApp?: import('./types').App;
    session: import('./types').Session;

    handshake?: import('./types').Handshake;
  }
}

declare module 'express-serve-static-core' {
  interface Request {
    user?: import('./types').User;
    authedApp?: import('./types').App;
    session: import('./types').Session;

    handshake?: import('./types').Handshake;
  }
}
