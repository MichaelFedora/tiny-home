
class DataBus {

  public get session(): string { return localStorage.getItem('sid'); }
  public set session(sid: string) { localStorage.setItem('sid', sid); }

  user?: { id: string, username: string } = null;

  public clear() {
    localStorage.clear();
    this.user = null;
  }
};

export default new DataBus();
