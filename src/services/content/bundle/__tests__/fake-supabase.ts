/** In-memory fake Supabase client — cukup untuk menguji pipeline import bundle. */
type Row = Record<string, any>;

let seq = 0;
const uid = () => `id-${(seq += 1)}`;

export const db: Record<string, Row[]> = {};

function table(name: string) {
  db[name] ??= [];
  return db[name]!;
}

type Filter = (row: Row) => boolean;

class Query implements PromiseLike<{ data: any; error: any }> {
  private filters: Filter[] = [];
  private mode: "select" | "insert" | "update" | "delete" = "select";
  private payload: Row[] = [];
  private returning = false;

  constructor(private name: string) {}

  select() {
    if (this.mode === "select") this.mode = "select";
    this.returning = true;
    return this;
  }
  insert(values: Row | Row[]) {
    this.mode = "insert";
    this.payload = Array.isArray(values) ? values : [values];
    return this;
  }
  update(values: Row) {
    this.mode = "update";
    this.payload = [values];
    return this;
  }
  delete() {
    this.mode = "delete";
    return this;
  }
  eq(column: string, value: unknown) {
    this.filters.push((row) => row[column] === value);
    return this;
  }
  in(column: string, values: unknown[]) {
    this.filters.push((row) => values.includes(row[column]));
    return this;
  }
  ilike(column: string, value: string) {
    this.filters.push(
      (row) => String(row[column] ?? "").toLowerCase() === value.toLowerCase(),
    );
    return this;
  }
  order() {
    return this;
  }

  private run() {
    const rows = table(this.name);
    const match = (row: Row) => this.filters.every((f) => f(row));
    if (this.mode === "insert") {
      const created = this.payload.map((values) => ({ id: uid(), ...values }));
      rows.push(...created);
      return created;
    }
    if (this.mode === "update") {
      const hit = rows.filter(match);
      for (const row of hit) Object.assign(row, this.payload[0]);
      return hit;
    }
    if (this.mode === "delete") {
      const keep = rows.filter((row) => !match(row));
      const removed = rows.filter(match);
      table(this.name).length = 0;
      table(this.name).push(...keep);
      return removed;
    }
    return rows.filter(match).map((row) => ({ ...row }));
  }

  async single() {
    const rows = this.run();
    return rows[0]
      ? { data: rows[0], error: null }
      : { data: null, error: { message: "not found" } };
  }
  async maybeSingle() {
    const rows = this.run();
    return { data: rows[0] ?? null, error: null };
  }
  then<T1, T2 = never>(
    onfulfilled?: ((value: { data: any; error: any }) => T1 | PromiseLike<T1>) | null,
    onrejected?: ((reason: unknown) => T2 | PromiseLike<T2>) | null,
  ): PromiseLike<T1 | T2> {
    return Promise.resolve({ data: this.run(), error: null }).then(onfulfilled, onrejected);
  }
}

export const supabase = {
  from: (name: string) => new Query(name),
  auth: { getUser: async () => ({ data: { user: { id: "user-1" } } }) },
};

export function resetDb() {
  for (const key of Object.keys(db)) delete db[key];
  seq = 0;
}
