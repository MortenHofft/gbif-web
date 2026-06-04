/* eslint-env mocha */
import assert from 'assert';
import { RESTDataSource } from '@/RESTDataSource';
import QueuedRESTDataSource from '@/QueuedRESTDataSource';

// An error shaped like the one node-fetch throws when an in-flight request is
// aborted via its signal.
function abortError() {
  const e = new Error('The user aborted a request.');
  e.name = 'AbortError';
  return e;
}

// Let microtasks/timers settle so p-queue can start/advance queued work.
const flush = () => new Promise((r) => setTimeout(r, 5));

describe('QueuedRESTDataSource', () => {
  let originalGet;
  let calls; // every call that reached the underlying get
  let pending; // calls currently held (not yet released/aborted)
  let active; // currently in-flight
  let peak; // max concurrent in-flight

  beforeEach(() => {
    originalGet = RESTDataSource.prototype.get;
    calls = [];
    pending = [];
    active = 0;
    peak = 0;

    // Stub the underlying (Apollo-shim) get: it records the init it receives and
    // the concurrency, holds until explicitly released, and — like node-fetch —
    // rejects if the forwarded signal aborts. `super.get` in QueuedRESTDataSource
    // resolves to this prototype method.
    RESTDataSource.prototype.get = function stubGet(path, params, init) {
      active += 1;
      peak = Math.max(peak, active);
      return new Promise((resolve, reject) => {
        let settled = false;
        const settle = (fn) => {
          if (settled) return;
          settled = true;
          active -= 1;
          const i = pending.indexOf(rec);
          if (i >= 0) pending.splice(i, 1);
          fn();
        };
        const rec = {
          path,
          params,
          init,
          release: () => settle(() => resolve('ok')),
        };
        const sig = init && init.signal;
        if (sig) {
          if (sig.aborted) {
            settle(() => reject(abortError()));
            return;
          }
          sig.addEventListener('abort', () => settle(() => reject(abortError())), {
            once: true,
          });
        }
        calls.push(rec);
        pending.push(rec);
      });
    };
  });

  afterEach(() => {
    RESTDataSource.prototype.get = originalGet;
  });

  it('passes non-enQueued requests straight through to the underlying get', async () => {
    const ds = new QueuedRESTDataSource({ pool: 'testpool' });
    const p = ds.get('/plain', null, {});
    await flush();
    assert.strictEqual(calls.length, 1);
    assert.strictEqual(calls[0].path, '/plain');
    calls[0].release();
    assert.strictEqual(await p, 'ok');
  });

  it('caps concurrency per GraphQL request (per-instance queue)', async () => {
    const ds = new QueuedRESTDataSource({ pool: 'testpool', concurrency: 2 });
    const ps = Array.from({ length: 5 }, (_, i) =>
      ds.get(`/x${i}`, null, { enQueue: true }),
    );
    await flush();

    // Only `concurrency` may be in flight at once.
    assert.strictEqual(active, 2, `expected 2 in flight, got ${active}`);
    assert.strictEqual(peak, 2);

    // Drain: release the oldest in-flight call until all five have run.
    let guard = 0;
    while (active > 0 && guard < 50) {
      guard += 1;
      if (pending.length) pending[0].release();
      // eslint-disable-next-line no-await-in-loop
      await flush();
    }
    await Promise.all(ps);
    assert.strictEqual(calls.length, 5);
    assert.strictEqual(peak, 2, 'concurrency cap must hold for the whole run');
  });

  it('does NOT hit upstream for a request cancelled while still queued', async () => {
    const ds = new QueuedRESTDataSource({ pool: 'testpool', concurrency: 1 });
    const ac = new AbortController();

    const pA = ds.get('/A', null, { enQueue: true }); // takes the single slot
    const pB = ds.get('/B', null, { enQueue: true, signal: ac.signal }); // waits
    await flush();

    // Only A reached upstream; B is waiting in the queue.
    assert.strictEqual(calls.length, 1);
    assert.strictEqual(calls[0].path, '/A');

    // Client navigates away -> B's signal aborts while B is still queued.
    ac.abort();
    // Free the slot so B would get its turn.
    calls[0].release();

    await assert.rejects(pB, 'cancelled-while-queued request should reject');
    await pA;

    // The crucial assertion: B was skipped, never sent to es-api.
    assert.strictEqual(calls.length, 1, 'B must not reach upstream');
    assert.ok(!calls.some((c) => c.path === '/B'));
  });

  it('forwards an aborting signal to upstream (in-flight cancellation)', async () => {
    const ds = new QueuedRESTDataSource({ pool: 'testpool' });
    const ac = new AbortController();

    const pA = ds.get('/A', null, { enQueue: true, signal: ac.signal });
    await flush();
    assert.strictEqual(calls.length, 1);

    // A signal must be forwarded to the underlying request, and it must reflect
    // the client's abort (so node-fetch tears down the es-api connection).
    const forwarded = calls[0].init && calls[0].init.signal;
    assert.ok(forwarded, 'a signal should be forwarded to the underlying get');
    assert.strictEqual(forwarded.aborted, false);

    ac.abort();

    assert.strictEqual(
      forwarded.aborted,
      true,
      'forwarded signal must abort when the client aborts',
    );
    await assert.rejects(pA, 'in-flight request should reject when aborted');
  });

  it('still runs an enQueued request whose signal never aborts', async () => {
    const ds = new QueuedRESTDataSource({ pool: 'testpool' });
    const ac = new AbortController();
    const p = ds.get('/ok', null, { enQueue: true, signal: ac.signal });
    await flush();
    assert.strictEqual(calls.length, 1);
    calls[0].release();
    assert.strictEqual(await p, 'ok');
  });
});
