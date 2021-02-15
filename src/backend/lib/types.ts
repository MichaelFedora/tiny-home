import { Session } from 'tiny-host-common';

export interface AppSession extends Session {
  app: string;
  dbScopes: readonly string[];
  fileScopes: readonly string[];
}

export interface App {
  id?: string;
  readonly app: string;
  readonly secret: string; // hashed with app
  readonly user: string;
  readonly store: { type: 'local', url: string } | { type: 'custom', url: string, session: string };
  readonly db: { type: 'local', url: string } | { type: 'custom', url: string, session: string };
}

export interface AppHandshake {
  id?: string;

  code?: string;
  user?: string;
  store?: { type: 'local', url: string } | { type: 'custom', url: string, session: string };
  db?: { type: 'local', url: string } | { type: 'custom', url: string, session: string };

  readonly app: string; // id
  readonly redirect: string;
  readonly scopes: string;
  readonly dbScopes?: readonly string[];
  readonly fileScopes?: readonly string[];
  readonly created: number;
}

export interface HomeMasterKey {
  id?: string;

  readonly user: string;
  readonly type: 'file' | 'db';
  readonly url: string;
  readonly key: string;
}

export interface Config {
  readonly handshakeExpTime: number;
  readonly serverOrigin: string;
}
