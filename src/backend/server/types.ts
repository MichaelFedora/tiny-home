
import { AuthConfig } from 'tiny-host-common';
import { DiskConfig } from 'tiny-disk-host';
import { HomeConfig } from '../lib';

export interface Config extends AuthConfig, DiskConfig, HomeConfig {
  readonly ip: string;
  readonly port: number;

  readonly dbName: string;
  readonly big: boolean;

  readonly dbs: { [name: string]: string };
  readonly stores: { [name: string]: string };
}
