
import { AuthConfig } from 'tiny-host-common';
import { StoreConfig } from 'tiny-disk-host';
import { HomeConfig } from '../lib';

export interface Config extends AuthConfig, StoreConfig, HomeConfig {
  readonly ip: string;
  readonly port: number;
  readonly serverName: string;

  readonly dbName: string;

  readonly dbs: { [name: string]: string };
  readonly stores: { [name: string]: string };
}
