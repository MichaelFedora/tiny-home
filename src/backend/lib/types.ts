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
  readonly store: { type: 'local', url: string } | { type: 'custom', url: string, token: string };
  readonly db: { type: 'local', url: string } | { type: 'custom', url: string, token: string };
}

export interface Handshake {
  id?: string;

  code?: string;
  user?: string;
  store?: { type: 'local', url: string } | { type: 'custom', url: string, token: string };
  db?: { type: 'local', url: string } | { type: 'custom', url: string, token: string };

  readonly app: string; // id
  readonly redirect: string;
  readonly scopes: string;
  readonly dbScopes?: readonly string[];
  readonly fileScopes?: readonly string[];
  readonly created: number;
}

export interface Config {
  readonly handshakeExpTime: number;
  readonly serverOrigin: string;
}
