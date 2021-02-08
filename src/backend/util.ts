import { pbkdf2 } from 'crypto';

export async function hash(salt: string, password: string) {
  return new Promise<string>((res, rej) => {
    pbkdf2(password, salt, 10000, 512, 'sha256', (err, data) => {
      if(err)
        return rej(err);
      else
        return res(data.toString('hex'));
    });
  });
}
