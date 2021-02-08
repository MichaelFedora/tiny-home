export interface Session {
  id?: string;
  user?: string;
  app?: string;
  readonly created: number;
}

export interface User {
  id?: string;
  readonly username: string;
  pass: string;
  salt: string;
}

export interface App {
  id?: string;
  readonly app: string;
  readonly secret: string; // hashed with app
  readonly user: string;
  readonly store: { type: 'local', url: string } | { type: 'custom', url: string, token: string }
  readonly db: { type: 'local', url: string } | { type: 'custom', url: string, token: string }
  readonly fileScopes: readonly string[];
}

export interface Handshake {
  id?: string;

  code?: string;
  user?: string;
  store?: { type: 'local', url: string } | { type: 'custom', url: string, token: string }
  db?: { type: 'local', url: string } | { type: 'custom', url: string, token: string }

  readonly app: string; // id
  readonly redirect: string;
  readonly scopes: string;
  readonly fileScopes?: readonly string[];
  readonly created: number;
}

export interface Config {
  readonly ip: string;
  readonly port: number;
  readonly serverName: string;

  readonly sessionExpTime: number;
  readonly handshakeExpTime: number;
  readonly whitelist?: string[];

  readonly dbName: string;

  readonly dbs: { [name: string]: string };
  readonly stores: { [name: string]: string };
}
