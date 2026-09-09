// Run with Node 22+: node scripts/test-customer-filter.cjs
// Executes the list query against synthetic, in-memory data; no env or network.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');
const ts = require('typescript');

function load(relative, dependencies) {
  const source = fs.readFileSync(path.join(__dirname, '..', relative), 'utf8');
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  });
  const mod = { exports: {} };
  new Function('require', 'module', 'exports', outputText)((name) => {
    assert.ok(Object.hasOwn(dependencies, name), `Unexpected dependency: ${name}`);
    return dependencies[name];
  }, mod, mod.exports);
  return mod.exports;
}

async function main() {
  const db = new DatabaseSync(':memory:');
  db.exec(`
    CREATE TABLE customers (id INTEGER, name TEXT, email TEXT, phone TEXT,
      bookings_count INTEGER, lifetime_paise INTEGER, last_seen_at TEXT);
    CREATE TABLE bookings (id INTEGER, customer_id INTEGER, status TEXT, reference TEXT, created_at TEXT);
    CREATE TABLE tickets (booking_id INTEGER, status TEXT);
    INSERT INTO customers VALUES
      (1,'Pending','pending@example.test','111',0,0,'2026-09-09'),
      (2,'Failed','failed@example.test','222',0,0,'2026-09-08'),
      (3,'Paid','paid@example.test','333',1,100,'2026-09-07'),
      (4,'Mixed','mixed@example.test','444',1,100,'2026-09-06'),
      (5,'Cancelled','cancel@example.test','555',0,0,'2026-09-05'),
      (6,'Issued','issued@example.test','666',0,0,'2026-09-04'),
      (7,'No checkout','none@example.test','777',0,0,'2026-09-03'),
      (8,'Refunded','refund@example.test','888',0,0,'2026-09-02');
    INSERT INTO bookings VALUES
      (10,1,'pending','P1','2026-09-01'), (11,1,'failed','F1','2026-09-02'),
      (20,2,'failed','F2','2026-09-01'), (30,3,'confirmed','C3','2026-09-01'),
      (40,4,'confirmed','C4','2026-09-01'), (41,4,'pending','P4','2026-09-02'),
      (50,5,'cancelled','X5','2026-09-01'), (60,6,'pending','P6','2026-09-01'),
      (80,8,'refunded','R8','2026-09-01');
    INSERT INTO tickets VALUES (30,'valid'),(40,'used'),(60,'void');
  `);
  const customers = load('src/lib/customers.ts', {
    'server-only': {},
    './db': {
      query: async (sql, params) => {
        assert.match(sql.trim(), /^SELECT /);
        // Adapt PostgreSQL casts and JSON constructor only; predicates unchanged.
        const statement = db.prepare(sql.replace(/::(?:text|int)/g, '')
          .replace(/json_build_object/g, 'json_object'));
        const bindings = Object.fromEntries(params.map((value, i) => [`$${i + 1}`, value]));
        return statement.all(bindings).map((row) => ({ ...row,
          unresolved_booking: row.unresolved_booking ? JSON.parse(row.unresolved_booking) : null,
        }));
      },
    },
  });
  const ids = (result) => result.customers.map((row) => row.id);
  let result = await customers.listCustomers({ withoutTicketsOnly: true });
  assert.deepEqual(ids(result), [1, 2, 4]);
  assert.equal(result.total, 3);
  assert.deepEqual(result.customers[0].unresolved_booking, { reference: 'F1', status: 'failed' });
  assert.deepEqual(ids(await customers.listCustomers({ buyersOnly: true })), [3, 4]);
  assert.equal((await customers.listCustomers()).total, 8);
  for (const search of ['MIXED', 'mixed@example.test', '444']) {
    assert.deepEqual(ids(await customers.listCustomers({ withoutTicketsOnly: true, search })), [4]);
  }
  result = await customers.listCustomers({ withoutTicketsOnly: true, limit: 1, offset: 1 });
  assert.deepEqual(ids(result), [2]);
  assert.equal(result.total, 3);
  assert.equal((await customers.listCustomers({ withoutTicketsOnly: true, search: "' OR 1=1 --" })).total, 0);
  // A later successful retry must stop qualifying, even with historical failures.
  db.exec("UPDATE bookings SET status='confirmed' WHERE id=20");
  assert.deepEqual(ids(await customers.listCustomers({ withoutTicketsOnly: true })), [1, 4]);
  db.close();

  let denied = false;
  let calls = 0;
  let received;
  const api = load('src/app/api/admin/customers/route.ts', {
    '@/lib/auth': { requireSession: async (role) => {
      assert.equal(role, 'manager');
      if (denied) throw new Error('forbidden');
    } },
    '@/lib/api': {
      ok: (data) => ({ status: 200, data }),
      fail: () => ({ status: 400 }),
      handleError: () => ({ status: 403 }),
    },
    '@/lib/customers': {
      listCustomers: async (args) => { calls++; received = args; return { customers: [], total: 0 }; },
      customerStats: async () => ({}),
    },
  });
  const get = (query) => api.GET({ url: `https://example.test/api/admin/customers?${query}` });
  assert.equal((await get('tickets=none&q=Mixed&page=2')).status, 200);
  assert.equal(received.withoutTicketsOnly, true);
  assert.equal(received.search, 'Mixed');
  assert.equal(received.offset, 50);
  assert.equal((await get('tickets=invalid')).status, 400);
  assert.equal((await get('tickets=none&buyers=1')).status, 400);
  assert.equal(calls, 1);
  denied = true;
  assert.equal((await get('tickets=none')).status, 403);
  assert.equal(calls, 1);
  console.log('PASS: due matching, deduplication, latest reference, existing buyers/all, search, pagination, successful retry, API validation and manager gate.');
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
