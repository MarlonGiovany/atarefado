// End-to-end API checks (auth, boards, columns, cards, days, carry-over, access
// control) against the running dev server: `npm run dev`, then `npm run test:api`.
// Creates throwaway users and boards in the development database.
const B = "http://localhost:3333/api";
const stamp = Date.now();
let ok = 0, fail = 0;
const check = (name, cond, extra = "") => {
  cond ? ok++ : fail++;
  console.log(`${cond ? "PASS" : "FAIL"} ${name} ${extra}`);
};
const ORIGIN = "http://localhost:5173";
const PW = "Ventilador-Azul-42";
// `session` is the cookie string returned by register/login (like a browser cookie jar)
async function call(method, path, body, session) {
  const r = await fetch(B + path, {
    method,
    headers: { "content-type": "application/json", origin: ORIGIN, ...(session && { cookie: session }) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await r.text();
  const setCookie = r.headers.get("set-cookie") ?? "";
  const cookie = setCookie.match(/atarefado_session=[^;]+/)?.[0];
  return { status: r.status, data: text ? JSON.parse(text) : null, cookie };
}

for (let i = 0; i < 20; i++) {
  try { await fetch(B + "/health"); break; } catch { await new Promise(r => setTimeout(r, 500)); }
}

const a = await call("POST", "/auth/register", { name: "Ana", email: `ana${stamp}@t.com`, password: PW });
check("register", a.status === 201, a.status);
const b = await call("POST", "/auth/register", { name: "Bruno", email: `bruno${stamp}@t.com`, password: PW });
const c = await call("POST", "/auth/register", { name: "Carla", email: `carla${stamp}@t.com`, password: PW });
const dup = await call("POST", "/auth/register", { name: "X", email: `ana${stamp}@t.com`, password: PW });
check("duplicate email -> 409", dup.status === 409);
const bad = await call("POST", "/auth/register", { name: "", email: "nope", password: "1" });
check("validation -> 400", bad.status === 400);
const login = await call("POST", "/auth/login", { email: `ANA${stamp}@t.com`, password: PW });
check("login (case-insensitive email)", login.status === 200);
const wrong = await call("POST", "/auth/login", { email: `ana${stamp}@t.com`, password: "wrongpass" });
check("wrong password -> 401", wrong.status === 401);
const ta = login.cookie, tb = b.cookie, tc = c.cookie;
check("me", (await call("GET", "/auth/me", null, ta)).data.user.name === "Ana");
check("no session -> 401", (await call("GET", "/boards")).status === 401);

const board = (await call("POST", "/boards", { title: "Portfolio" }, ta)).data.board;
let full = (await call("GET", `/boards/${board.id}`, null, ta)).data.board;
check("default columns", full.columns.map(c => c.title).join() === "A fazer,Em andamento,Concluído");
check("non-member -> 404", (await call("GET", `/boards/${board.id}`, null, tb)).status === 404);

const [todo, doing] = full.columns;
const c1 = (await call("POST", `/columns/${todo.id}/cards`, { title: "Card 1", date: "2026-09-20" }, ta)).data.card;
const c2 = (await call("POST", `/columns/${todo.id}/cards`, { title: "Card 2", date: "2026-09-20" }, ta)).data.card;
const c3 = (await call("POST", `/columns/${todo.id}/cards`, { title: "Card 3", date: "2026-09-21" }, ta)).data.card;
const c4 = (await call("POST", `/columns/${todo.id}/cards`, { title: "No date" }, ta)).data.card;
check("card positions increment", c2.position > c1.position);
check("card stores its day", c1.date.startsWith("2026-09-20T00:00:00"), c1.date);
check("card without date defaults to today (UTC)", c4.date.slice(0, 10) === new Date().toISOString().slice(0, 10), c4.date);
check("bad date -> 400", (await call("POST", `/columns/${todo.id}/cards`, { title: "x", date: "2026-13-45" }, ta)).status === 400);
const day1 = (await call("GET", `/boards/${board.id}?date=2026-09-20`, null, ta)).data.board;
check("filter by day", day1.columns[0].cards.map(c => c.title).join() === "Card 1,Card 2", day1.columns[0].cards.map(c => c.title).join());
const day2 = (await call("GET", `/boards/${board.id}?date=2026-09-21`, null, ta)).data.board;
check("other day only has its cards", day2.columns[0].cards.map(c => c.title).join() === "Card 3");
check("bad filter date -> 400", (await call("GET", `/boards/${board.id}?date=ontem`, null, ta)).status === 400);
const days = (await call("GET", `/boards/${board.id}/days?from=2026-09-14&to=2026-09-21`, null, ta)).data.days;
check("day counts", days["2026-09-20"] === 2 && days["2026-09-21"] === 1, JSON.stringify(days));
check("days outsider -> 404", (await call("GET", `/boards/${board.id}/days?from=2026-09-14&to=2026-09-21`, null, tc)).status === 404);
const resched = await call("PATCH", `/cards/${c3.id}`, { date: "2026-10-05" }, ta);
check("reschedule card", resched.data.card?.date.startsWith("2026-10-05"));
check("outsider can't delete card -> 404", (await call("DELETE", `/cards/${c3.id}`, null, tc)).status === 404);
check("delete card", (await call("DELETE", `/cards/${c3.id}`, null, ta)).status === 204);
check("deleted card is gone", (await call("PATCH", `/cards/${c3.id}`, { title: "x" }, ta)).status === 404);

const inv = await call("POST", `/boards/${board.id}/members`, { email: `bruno${stamp}@t.com` }, ta);
check("invite member", inv.status === 201);
check("member can't invite -> 403", (await call("POST", `/boards/${board.id}/members`, { email: `carla${stamp}@t.com` }, tb)).status === 403);
check("member sees board", (await call("GET", `/boards/${board.id}`, null, tb)).status === 200);

const assign = await call("PATCH", `/cards/${c1.id}`, { assigneeId: b.data.user.id }, tb);
check("assign card to member", assign.data.card?.assignee?.name === "Bruno");
check("assign non-member -> 400", (await call("PATCH", `/cards/${c1.id}`, { assigneeId: c.data.user.id }, ta)).status === 400);

const mv = await call("POST", `/cards/${c2.id}/move`, { columnId: doing.id, position: 1 }, tb);
check("move card", mv.data.card?.columnId === doing.id);

const other = (await call("POST", "/boards", { title: "Other" }, tc)).data.board;
const otherCol = (await call("GET", `/boards/${other.id}`, null, tc)).data.board.columns[0];
check("move to foreign board -> 400", (await call("POST", `/cards/${c1.id}/move`, { columnId: otherCol.id, position: 1 }, ta)).status === 400);
check("outsider can't edit card -> 404", (await call("PATCH", `/cards/${c1.id}`, { title: "hack" }, tc)).status === 404);

check("remove member", (await call("DELETE", `/boards/${board.id}/members/${b.data.user.id}`, null, ta)).status === 204);
full = (await call("GET", `/boards/${board.id}`, null, ta)).data.board;
check("removed member's cards unassigned", full.columns[0].cards.every(c => c.assigneeId === null));
check("member can't delete board -> 404 after removal", (await call("DELETE", `/boards/${board.id}`, null, tb)).status === 404);
// --- Pending carry-over ---
const pb = (await call("POST", "/boards", { title: "Pending" }, ta)).data.board;
const [ptodo, pdoing, pdone] = (await call("GET", `/boards/${pb.id}`, null, ta)).data.board.columns;
const p1 = (await call("POST", `/columns/${ptodo.id}/cards`, { title: "old todo", date: "2026-09-10" }, ta)).data.card;
const p2 = (await call("POST", `/columns/${pdoing.id}/cards`, { title: "old doing", date: "2026-09-11" }, ta)).data.card;
await call("POST", `/columns/${pdone.id}/cards`, { title: "old done", date: "2026-09-10" }, ta);
await call("POST", `/columns/${ptodo.id}/cards`, { title: "on the day", date: "2026-09-15" }, ta);
await call("POST", `/columns/${ptodo.id}/cards`, { title: "future", date: "2026-09-20" }, ta);
const pendingCount = async () => (await call("GET", `/boards/${pb.id}/pending?before=2026-09-15`, null, ta)).data.count;
check("pending ignores done column, same day and future", (await pendingCount()) === 2);
check("pending outsider -> 404", (await call("GET", `/boards/${pb.id}/pending?before=2026-09-15`, null, tc)).status === 404);
check("pending bad date -> 400", (await call("GET", `/boards/${pb.id}/pending?before=amanha`, null, ta)).status === 400);
check("carry-over outsider -> 404", (await call("POST", `/boards/${pb.id}/pending/move`, { to: "2026-09-15" }, tc)).status === 404);
const carried = (await call("POST", `/boards/${pb.id}/pending/move`, { to: "2026-09-15" }, ta)).data;
check("carry-over returns previous days",
  carried.moved.length === 2 &&
  carried.moved.some((m) => m.id === p1.id && m.date === "2026-09-10") &&
  carried.moved.some((m) => m.id === p2.id && m.date === "2026-09-11"), JSON.stringify(carried));
const day15 = (await call("GET", `/boards/${pb.id}?date=2026-09-15`, null, ta)).data.board;
check("carried cards land on the target day, columns kept",
  day15.columns[0].cards.map((c) => c.title).sort().join() === "old todo,on the day" &&
  day15.columns[1].cards.map((c) => c.title).join() === "old doing");
check("nothing pending after carry-over", (await pendingCount()) === 0);
check("carry-over with nothing pending", (await call("POST", `/boards/${pb.id}/pending/move`, { to: "2026-09-15" }, ta)).data.moved.length === 0);
check("undo carry-over", (await call("POST", `/boards/${pb.id}/cards/reschedule`, { cards: carried.moved }, ta)).status === 200 && (await pendingCount()) === 2);
check("reschedule card from another board -> 404", (await call("POST", `/boards/${pb.id}/cards/reschedule`, { cards: [{ id: c1.id, date: "2026-09-01" }] }, ta)).status === 404);
check("reschedule empty list -> 400", (await call("POST", `/boards/${pb.id}/cards/reschedule`, { cards: [] }, ta)).status === 400);
await call("DELETE", `/boards/${pb.id}`, null, ta);

check("owner deletes board",(await call("DELETE", `/boards/${board.id}`, null, ta)).status === 204);

console.log(`\n${ok} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
