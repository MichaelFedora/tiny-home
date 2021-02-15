# Tiny Home

A tiny software to host a home for users.

This app servers as an authentication server for "tiny apps" to
build against and store/retrieve file storage and database locations.

Think of it as a cross-platform cookie for applications to store their
storage configurations per the user. The workflow is as such:

- Sign in with tiny-home
- Tiny-home, upon recognizing a new app, asks you where to store said apps
data, and what database for it to use.
- Tiny-home redirects you back to the app (via an oauth flow) with the
storage and database info.
- When signing into the application again, tiny-home will recognize it
and give the configuration back to the app once more.

When authing with tiny-home, you need a clientID (called `app`) and client
secret (called `secret`), as per tradition. The difference is this
`app`/`secret` combination may be unique per user -- but it must be the
same for that user, every time they log in, on every device they own. It may
not, however, be predictable if the app would like to defend against of
spoofing attacks -- but this is impossible if the app is hosted without an
API to run the auth calls through.

If another `app`/`secret` tries to access a fileScope that has been previously
claimed, an alert will be raised when "handshaking" for the user to see, but
it can be ignored.

The `app` is recommended to be the app domain (i.e. "test.app" or
"myapp.io"), but can be anything; the client secret is recommended to be
a hex string of at least 24 characters.


## Config

in `config.json`, with the following (annotated) schema:

```typescript
interface Config {
  ip: string; // api ip
  port: number; // api port

  sessionExpTime: number; // how much time (in ms) for the sessions to expire
  whitelist?: string[]; // a white list of usernames to allow

  dbName: string; // level db folder name

  fileHosts: { // list of supplied tiny-stores for the users
    [name: string]: string; // url
  };

  dbHosts: { // list of supplied tiny-dbs for the users
    [name: string]: string; // url
  };
}
```

## API Walkthrough

### Authentication

To authenticate with an application:

Go to `{origin}/api/v1/auth/handshake/start?app="{app}"&redirect="https://{app}{url}"&scopes=home,store,db`
Be redirect back to the redirect with the query `?code={code}`
Get session via `POST {origin}/api/v1/auth/session` with the body
`{ app, redirect: "https://{app}{url}", code, scope: "home,store,db" }`
and recieve the following response schema:

```typescript
interface SessionResponse {
  home?: { url: string; session: string; }
  storage?: { type: "local" | "custom"; url: string; session: string; fileScopes?: string[] }
  db?: { type: "local" | "custom"; url: string; session: string; }
}
```

Obviously, you can have or not have different scopes. The "home" scope provides identity
and the ability to set custom storage or db types; "storage" gives you your storage
information, "db" gives you your db information. If your app doesn't need a
database, then don't request the "db" scope; if your app doesn't need a storage location,
then don't request the "storage" scope. It is always recommended to get the "home" scope,
but maybe you don't need that for your particular situation.

Storage/db types can be "local" or "custom". The "custom" type is for custom entries; like
a firebase/mongo url & session, or a dropbox/icloud url & session. Tiny-home only stores
minimal information about these, and only has the ability to natively provide tiny-storage
and tiny-db services from the as specified in the `config.json`.

A "local" storage scope may have file scopes; if these aren't specified, data will be stored
in "/appdata/{app-id}", where "app-id" is a pbkdf2 hash of "{app}:{secret}".

A typical registration workflow may be to authenticate, and then ask the user if they want
to use a different database or storage option that you have the interface for within your
app; if so, then update your tiny-home entry, otherwise, use what's provided.

**Example: Authenticate for just storage**

- Redirect to `https://my-home.example.com/api/v1/auth/handshake/start?app="myapp.io"&redirect="https://myapp.io/auth"&scopes="home,store"&fileScopes=["/programs/myapp.io", "/public/myapp.io"]`
- Redirected back (after authenticating) to `https://myapp.io/auth?code=a1b2c3d4e5f6`
- Make request `POST https://my-home.example.com/api/v1/auth/session` with the following body to get the sessions:
```json
{
  "app": "myapp.io",
  "redirect": "https://myapp.io/auth",
  "scopes": "home,store",
  "fileScopes": ["/programs/myapp.io", "/public/myapp.io"],
  "code": "a1b2c3d4e5f6",
  "secret": "{my-secret}"
}
```
- Result (notice how `fileScopes[1]` was modified):
```json
{
  "home": { "url": "https://my-home.example.com/", "session": "abcdef.ghijklmn.opqrs" },
  "storage": { "type": "local", "url": "https://my-store.example.com/", "session": "abcdef.ghijklmn.opqrs", "fileScopes": ["/programs/myapp.io", "/public/programs/myapp.io"] }
}
```

**Example: Authenticate with an already registered user which has a custom storage option**

- Redirect to `https://my-home.example.com/api/v1/auth/handshake/start?app="myapp.io"&redirect="https://myapp.io/auth"&scopes="home,store,db"`
- Redirected back (after authenticating) to `https://myapp.io/auth?code=a1b2c3d4e5f6`
- Make request `POST https://my-home.example.com/api/v1/auth/session` with the following body to get the sessions:
```json
{
  "app": "myapp.io",
  "redirect": "https://myapp.io/auth",
  "scopes": "home,store,db",
  "code": "a1b2c3d4e5f6",
  "secret": "{my-secret}"
}
```
- Result:
```json
{
  "home": { "url": "https://my-home.example.com/", "session": "abcdef.ghijklmn.opqrs" },
  "storage": { "type": "custom", "url": "https://dropbox.com/", "session": "abcdef.ghijklmn.opqrs" },
  "db": { "type": "local", "url": "https://my-db.example.com/", "session": "abcdef.tuvwxyz.qwert" }
}
```

## Api Reference

SubSession Interface:
```typescript
interface SubSessionInterface {
  type: string;
  url: string;
  session: string;
}
```

session Interface:
```typescript
interface SessionInterface {
  home?: { url: string; session: string };
  store?: Interface & { fileScopes?: string[] };
  db?: SubSessionInterface;
}
```

User Auth Interface:
```typescript
interface UserAuthInterface {
  username: string;
  password: string;
}
```

App session Request Interface:
```typescript
interface AppsessionReqInterface {
  app: string;
  redirect: string;
  scopes: string;
  code: string;
  secret: string;
}
```

### API v1

Namespace: `/api/v1`.
`*GET`, `*PUT`, etc: TODO v2

**Authentication `/auth`:**

HandshakeQuery:
- `?app={app}` - the app(domain)
- `&redirect={app}{url}` - what tiny-home should redirect to once it is done
- `&scopes=home,file,db` - what sessions it wants
- `&fileScopes=["path","path2",...]` - i.e. `&fileScopes=["/programs/my-app","/documents","/public/my-app"]`;
the paths the app wants, particularly for tiny-file-hosts; these may come back different than requested

|Type|Auth |Path                     |Query           |Request Body          |Return Body     |Description             |
|----|-----|-------------------------|----------------|----------------------|----------------|------------------------|
|GET |None |/auth/handshake/start    |`HandshakeQuery`|                      |                |App Auth route          |
|GET |None |/auth/handshake/:id      |                |                      |                |TinyHome handshaking    |
|GET |None |/auth/handshake/:id/approve|              |                      |                |TinyHome handshaking    |
|GET |None |/auth/handshake/:id/cancel|               |                      |                |TinyHome handshaking    |
|POST|None |/auth/login              |                |`UserAuthInterface`   |`"session"`       |User auth route         |
|POST|None |/auth/register           |                |`UserAuthInterface`   |                |User registration       |
|GET |None |/auth/can-register       |                |                      |`true|false`    |User registration active|
|POST|None |/auth/session              |                |`AppsessionReqInterface`|`sessionInterface`|App session requesting    |
|GET |session|/auth/refresh            |                |                      |`"session"`       |App/user session refresh  |
|POST|session|/auth/logout             |                |                      |                |App/user logout         |

**App `/app`:**

Requires an app session.

|Type|Path        |Query|Request Body                |Return Body        |Description           |
|----|------------|-----|----------------------------|-------------------|----------------------|
|*PUT |/app/storage|     |`Partial<SubSessionInterface>`|`SubSessionInterface`|App storage info      |
|*PUT |/app/db     |     |`Partial<SubSessionInterface>`|`SubSessionInterface`|App db info           |

**User `/user`:**

Requires a user session.

App Info Interface:
```typescript
interface AppInfo {
  id: string; // const
  domain: string; // const
  storage?: SubSessionInterface // modifiable
  db?: SubSessionInterface; // modifiable
}
```

Tiny Info Interface
```typescript
interface TinyInfo {
  id: string; // const
  type: 'store' | 'db';
  url: string;
  auth: { session?: string; username?: string; password?: string; } |
    /* user-added */ { session: string } | 
    /* natively-provided */ { username: string; password: string; };
  // note: the username/password are generated randomly
}
```

|Type|Path             |Query|Request Body       |Return Body    |Description            |
|----|-----------------|-----|-------------------|---------------|-----------------------|
|*GET|/user            |     |                   |               |Gets the self.         |
|*PUT|/user            |     |                   |               |Updates self (profile).|
|*DEL|/user            |     |                   |               |Deletes the user.      |
|*GET|/user/gpdr       |     |                   |Big `json` doc.|Gets all userdata.     |
|*GET|/user/apps       |     |                   |`AppInfo[]`    |Get all apps' info.    |
|*GET|/user/apps/:id   |     |                   |`AppInfo`      |Get one app's info.    |
|*PUT|/user/apps/:id   |     |`Partial<AppInfo>` |`AppInfo`      |Update an app's info.  |
|*DEL|/user/apps/:id   |     |                   |               |Delete an app.         |
|*GET|/user/dbs        |     |                   |`TinyInfo[]`   |Get all dbs' info.     |
|*GET|/user/dbs/:id    |     |                   |`TinyInfo`     |Get one db's info.     |
|*PUT|/user/dbs/:id    |     |`Partial<TinyInfo>`|`TinyInfo`     |Update a db's info.    |
|*DEL|/user/dbs/:id    |     |                   |               |Delete a db.           |
|*GET|/user/stores     |     |                   |`TinyInfo[]`   |Get all stores' info.  |
|*GET|/user/stores/:id |     |                   |`TinyInfo`     |Get one store's info.  |
|*PUT|/user/stores/:id |     |`Partial<TinyInfo>`|`TinyInfo`     |Update a store's info. |
|*DEL|/user/stores/:id |     |                   |               |Delete a store.        |

## License

MIT
