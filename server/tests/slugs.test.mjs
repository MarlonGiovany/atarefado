// Readable board addresses (/quadros/<slug>): creation, repeated names, rename,
// access control. Run from the server folder with `npm run dev` active:
// `npm run test:slugs`. Creates throwaway users and boards.
const B = "http://localhost:3333/api";
const ORIGIN = "http://localhost:5173";
const stamp = Date.now();
const PW = "Ventilador-Azul-42";
let ok = 0, fail = 0;
const check = (name, cond, extra = "") => {
  cond ? ok++ : fail++;
  console.log(`${cond ? "PASS" : "FAIL"} ${name} ${extra}`);
};

async function call(method, path, body, session) {
  const r = await fetch(B + path, {
    method,
    headers: { "content-type": "application/json", origin: ORIGIN, ...(session && { cookie: session }) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await r.text();
  return {
    status: r.status,
    data: text ? JSON.parse(text) : null,
    cookie: (r.headers.get("set-cookie") ?? "").match(/atarefado_session=[^;]+/)?.[0],
  };
}
const register = async (name) =>
  (await call("POST", "/auth/register", { name, email: `${name.toLowerCase()}-${stamp}@t.com`, password: PW })).cookie;
const create = async (title, session) => (await call("POST", "/boards", { title }, session)).data.board;

const ana = await register("Ana");
const bia = await register("Bia");
// A title unique to this run, so slugs from earlier runs never collide
const tag = `t${stamp}`;

// --- Creation
const first = await create(`Tarefas Diárias ${tag}`, ana);
check("slug from title: accents and spaces removed", first.slug === `tarefas-diarias-${tag}`, first.slug);
const messy = await create(`  Ação & Reação!! ${tag} `, ana);
check("symbols and edges trimmed", messy.slug === `acao-reacao-${tag}`, messy.slug);
const emoji = await create("🎯🔥", ana);
check("title without letters -> 'quadro' (+ number if taken)", /^quadro(-\d+)?$/.test(emoji.slug), emoji.slug);
const long = await create("x".repeat(100), ana);
// The name part is capped at 60; "-2" etc. is added only if an earlier test run left the same one
check("slug name capped at 60 characters", /^x{60}(-\d+)?$/.test(long.slug), long.slug);

// --- Same name twice (also across users: slugs are global)
const dup = await create(`Tarefas Diárias ${tag}`, ana);
const dupOther = await create(`Tarefas Diárias ${tag}`, bia);
check("repeated name -> -2", dup.slug === `tarefas-diarias-${tag}-2`, dup.slug);
check("repeated name by another user -> -3", dupOther.slug === `tarefas-diarias-${tag}-3`, dupOther.slug);

// --- Lookup
const found = await call("GET", `/boards/slug/${first.slug}`, null, ana);
check("slug resolves to the board id", found.status === 200 && found.data.board.id === first.id);
const asOutsider = await call("GET", `/boards/slug/${first.slug}`, null, bia);
const missing = await call("GET", `/boards/slug/nao-existe-${tag}`, null, ana);
check("not a member -> 404", asOutsider.status === 404, String(asOutsider.status));
check("unknown slug -> same 404 and message (can't probe which boards exist)",
  missing.status === 404 && missing.data.error === asOutsider.data.error, missing.data?.error);
check("lookup needs a session", (await call("GET", `/boards/slug/${first.slug}`)).status === 401);
check("old id address still works", (await call("GET", `/boards/${first.id}`, null, ana)).data.board.slug === first.slug);
check("slug is not accepted as an id", (await call("GET", `/boards/${first.slug}`, null, ana)).status === 404);

// --- Rename
const renamed = await call("PATCH", `/boards/${first.id}`, { title: `Estudos ${tag}` }, ana);
check("rename updates the slug", renamed.data.board.slug === `estudos-${tag}`, renamed.data.board.slug);
check("new slug resolves", (await call("GET", `/boards/slug/estudos-${tag}`, null, ana)).data?.board?.id === first.id);
check("old slug stops resolving", (await call("GET", `/boards/slug/${first.slug}`, null, ana)).status === 404);
const same = await call("PATCH", `/boards/${first.id}`, { title: `Estudos ${tag}` }, ana);
check("renaming to the same title keeps the slug", same.data.board.slug === `estudos-${tag}`);
const caseOnly = await call("PATCH", `/boards/${first.id}`, { title: `ESTUDOS ${tag}` }, ana);
check("only capitalization changes -> slug unchanged", caseOnly.data.board.slug === `estudos-${tag}`);
const toTaken = await call("PATCH", `/boards/${messy.id}`, { title: `estudos ${tag}` }, ana);
check("renaming to a taken name -> -2", toTaken.data.board.slug === `estudos-${tag}-2`, toTaken.data.board.slug);
const keep = await call("PATCH", `/boards/${toTaken.data.board.id}`, { title: `Estudos ${tag}` }, ana);
check("numbered slug that still fits the title is kept", keep.data.board.slug === `estudos-${tag}-2`, keep.data.board.slug);
const memberRename = await call("PATCH", `/boards/${dupOther.id}`, { title: `Outro ${tag}` }, bia);
check("owner of the other board can rename it", memberRename.data.board.slug === `outro-${tag}`);

// --- Many at once: unique indexes must not produce errors or repeated slugs
const racers = await Promise.all(Array.from({ length: 6 }, () => call("POST", "/boards", { title: `Corrida ${tag}` }, ana)));
const slugs = racers.map((r) => r.data?.board?.slug);
check("6 simultaneous creations all succeed", racers.every((r) => r.status === 201), racers.map((r) => r.status).join());
check("simultaneous creations get distinct slugs", new Set(slugs).size === 6, slugs.join());

console.log(`\n${ok} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
