
class DataBus {

  public get session(): string { return localStorage.getItem('sid'); }
  public set session(sid: string) { localStorage.setItem('sid', sid); }

  public clear() {
    localStorage.clear();
  }
};

export default new DataBus();
