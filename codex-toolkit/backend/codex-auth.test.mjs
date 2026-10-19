import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mountCodexAuth } from './codex-auth.mjs';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';

function fixture(begin = async () => ({ status: 'authorized' }), options = {}) {
  const routes = new Map(), callbacks = {}, calls = [];
  const ctx = {
    connection: { fetch: { register(route) { routes.set(route.path, route); } } },
    credentials: { async describeRecord(key) { calls.push(key); return { configured: true, payload: 'NEVER_EXPOSE', token: 'NEVER_EXPOSE', writable: true }; } },
    authorization: { describe: () => ({ methods: [{ id: 'oauth' }] }), begin },
    on(event, callback) { callbacks[event] = callback; }
  };
  mountCodexAuth(ctx, options);
  return { ctx, calls, callbacks, routes, async request(name, body, query = '') {
    const route = routes.get('/api/codex-auth/' + name), method = route.methods[0];
    const response = await route.fetch(new Request('http://localhost/api/codex-auth/' + name + query, { method,
      ...(method === 'POST' ? { headers: { 'content-type': 'application/json' }, body: JSON.stringify(body ?? {}) } : {}) }));
    return { status: response.status, data: await response.json(), response };
  } };
}
const tick = () => new Promise(resolve => setImmediate(resolve));

test('status uses describeRecord and projects configured only', async () => {
  const f = fixture(), result = await f.request('status');
  assert.deepEqual(f.calls, ['llm-pi-ai/openai-codex']);
  assert.deepEqual(result.data, { configured: true });
  assert.equal(result.response.headers.get('cache-control'), 'no-store');
  f.ctx.credentials.describeRecord = async () => ({ configured: false });
  assert.deepEqual((await f.request('status')).data, { configured: false });
  f.ctx.credentials.describeRecord = async () => { throw { status: 401, message: 'NEVER_EXPOSE' }; };
  assert.deepEqual((await f.request('status')).data, { error: 'Authorization operation failed' });
});

test('asynchronous notice, prompt, response and committed outcome', async () => {
  let received;
  const f = fixture(async request => {
    assert.equal(request.key, 'llm-pi-ai/openai-codex');
    assert.equal(request.method, 'oauth');
    await tick();
    request.interaction.notify({ message: 'Continue', url: 'https://auth.openai.com/test', code: 'ABCD-EFGH', payload: 'NEVER_EXPOSE' });
    received = await request.interaction.prompt({ kind: 'secret', message: 'Code', payload: 'NEVER_EXPOSE' });
    return { status: 'authorized' };
  });
  const { data: { flowId } } = await f.request('begin');
  await tick(); await tick();
  const { data } = await f.request('poll', null, '?flowId=' + flowId);
  assert.equal(data.state, 'prompt');
  assert.equal(data.authorizationUrl, 'https://auth.openai.com/test');
  assert.equal(data.message, 'Continue\nABCD-EFGH');
  assert.deepEqual(Object.keys(data.prompt).sort(), ['id', 'message', 'type']);
  assert.equal((await f.request('begin')).status, 409);
  assert.equal((await f.request('respond', { flowId, promptId: 'stale', response: 'code' })).status, 409);
  assert.equal((await f.request('respond', { flowId, promptId: data.prompt.id, response: 'code' })).status, 200);
  await tick();
  assert.equal(received, 'code');
  assert.deepEqual((await f.request('poll', null, '?flowId=' + flowId)).data, { state: 'complete' });
});

test('prompt withdrawal rejects stale responses and does not cancel whole attempt', async () => {
  const promptAbort = new AbortController();
  const f = fixture(async request => {
    try { await request.interaction.prompt({ kind: 'text', message: 'Paste code', signal: promptAbort.signal }); } catch {}
    return { status: 'authorized' };
  });
  const { data: { flowId } } = await f.request('begin');
  const { data } = await f.request('poll', null, '?flowId=' + flowId);
  promptAbort.abort(); await tick();
  assert.equal((await f.request('respond', { flowId, promptId: data.prompt.id, response: 'old' })).status, 409);
  assert.equal((await f.request('poll', null, '?flowId=' + flowId)).data.state, 'complete');
});

test('cancel owns only known attempt, removes prompt, and provider errors are redacted', async () => {
  const f = fixture(async request => {
    try { await request.interaction.prompt({ kind: 'text', message: 'Code' }); }
    catch (error) { if (request.signal.aborted) return { status: 'cancelled' }; throw error; }
    return { status: 'authorized' };
  });
  const { data: { flowId } } = await f.request('begin');
  assert.equal((await f.request('cancel', { flowId: 'wrong' })).status, 404);
  await f.request('cancel', { flowId }); await tick();
  assert.equal((await f.request('poll', null, '?flowId=' + flowId)).data.state, 'cancelled');
  const g = fixture(async () => { throw new Error('NEVER_EXPOSE'); });
  const start = await g.request('begin'); await tick();
  const result = await g.request('poll', null, '?flowId=' + start.data.flowId);
  assert.equal(JSON.stringify(result.data).includes('NEVER_EXPOSE'), false);
});

test('installed Codex login offers and dispatches browser and device-code choices', { skip: !process.env.DSH_CODEX_OAUTH_SOURCE && 'Set DSH_CODEX_OAUTH_SOURCE to the upstream openai-codex.js file to test adapter dispatch.' }, async () => {
  const source = readFileSync(process.env.DSH_CODEX_OAUTH_SOURCE, 'utf8');
  const constants = source.match(/^const OPENAI_CODEX_(?:BROWSER|DEVICE_CODE)_LOGIN_METHOD = .*;$/gm);
  assert.equal(constants?.length, 2);
  const entry = source.slice(source.indexOf('export const openaiCodexOAuth =')).replace('export const', 'const');
  for (const selected of ['browser', 'device_code']) {
    let dispatched;
    const provider = runInNewContext(constants.join('\n') + '\n' + entry + '\nopenaiCodexOAuth;', {
      loginOpenAICodex: async () => { dispatched = 'browser'; },
      loginOpenAICodexDeviceCode: async () => { dispatched = 'device_code'; }
    });
    const f = fixture(async request => {
      await provider.login({ prompt: prompt => request.interaction.prompt({ kind: prompt.type, message: prompt.message, options: prompt.options }) });
      return { status: 'authorized' };
    });
    const { data: { flowId } } = await f.request('begin');
    const { data } = await f.request('poll', null, '?flowId=' + flowId);
    assert.deepEqual(data.prompt.options, [
      { value: 'browser', label: 'Browser login (default)' },
      { value: 'device_code', label: 'Device code login (headless)' }
    ]);
    assert.equal((await f.request('respond', { flowId, promptId: data.prompt.id, response: selected })).status, 200);
    await tick();
    assert.equal(dispatched, selected);
    assert.equal((await f.request('poll', null, '?flowId=' + flowId)).data.state, 'complete');
  }
  assert.equal(readFileSync(new URL('./codex-auth.js', import.meta.url), 'utf8'), readFileSync(new URL('./codex-auth.mjs', import.meta.url), 'utf8'));
});

test('usage projects actual windows and never exposes account credentials', async () => {
  const f = fixture(undefined, { fetchUsage: async (url, options) => {
    assert.equal(url, 'https://chatgpt.com/backend-api/wham/usage');
    assert.equal(options.redirect, 'error');
    assert.equal(options.headers.authorization, 'Bearer secret-access');
    assert.equal(options.headers['ChatGPT-Account-Id'], 'secret-account');
    return Response.json({ rate_limit: {
      primary_window: { limit_window_seconds: 18000, used_percent: 42.5, reset_at: 1800000000 },
      secondary_window: { limit_window_seconds: 604800, used_percent: 77, reset_at: 1800000100 }
    }, account_id: 'secret-account', token: 'secret-access' });
  }});
  f.ctx.credentials.readRecord = async () => ({ kind: 'grant', payload: { type: 'oauth', access: 'secret-access', refresh: 'secret-refresh', expires: Date.now() + 3600000, accountId: 'secret-account' } });
  const response = await f.request('usage');
  assert.deepEqual(response.data, { primary: { usedPercent: 42.5, resetsAt: 1800000000 }, secondary: { usedPercent: 77, resetsAt: 1800000100 } });
  assert.equal(JSON.stringify(response.data).includes('secret'), false);
});

test('usage disconnected does not fetch and upstream errors are safe', async () => {
  let fetched = false;
  const f = fixture(undefined, { fetchUsage: async () => { fetched = true; throw new Error('secret upstream failure'); } });
  f.ctx.credentials.readRecord = async () => null;
  assert.equal((await f.request('usage')).status, 409);
  assert.equal(fetched, false);
  f.ctx.credentials.readRecord = async () => ({ kind: 'grant', payload: { type: 'oauth', access: 'access', expires: Date.now() + 3600000 } });
  assert.equal((await f.request('usage')).status, 502);
  assert.equal(JSON.stringify((await f.request('usage')).data).includes('secret upstream failure'), false);
});

test('usage handles upstream statuses, malformed JSON, and invalid windows safely', async () => {
  const credential = { kind: 'grant', payload: { type: 'oauth', access: 'access', expires: Date.now() + 3600000 } };
  for (const [label, fetchUsage] of [
    ['non-ok status', async () => new Response('upstream secret', { status: 401 })],
    ['malformed JSON', async () => new Response('{not-json', { status: 200 })]
  ]) {
    const f = fixture(undefined, { fetchUsage });
    f.ctx.credentials.readRecord = async () => credential;
    const result = await f.request('usage');
    assert.equal(result.status, 502, label);
    assert.equal(JSON.stringify(result.data).includes('upstream secret'), false, label);
  }
  const f = fixture(undefined, { fetchUsage: async () => Response.json({ rate_limit: {
    primary_window: { limit_window_seconds: 18000, used_percent: 101, reset_at: 1800000000 },
    secondary_window: { limit_window_seconds: 604800, used_percent: 0, reset_at: -1 },
    tertiary_window: { limit_window_seconds: 3600, used_percent: 50, reset_at: 1800000000 }
  } }) });
  f.ctx.credentials.readRecord = async () => credential;
  assert.deepEqual((await f.request('usage')).data, { primary: null, secondary: { usedPercent: 0, resetsAt: null } });
  const missing = fixture(undefined, { fetchUsage: async () => Response.json({ rate_limit: {} }) });
  missing.ctx.credentials.readRecord = async () => credential;
  assert.deepEqual((await missing.request('usage')).data, { primary: null, secondary: null });
});

test('usage redacts refresh failures and honors credentials replaced under lock', async () => {
  const expired = { kind: 'grant', payload: { type: 'oauth', access: 'old', refresh: 'refresh', expires: 0 } };
  const failed = fixture(undefined, {
    loadOAuth: async () => ({ refresh: async () => { throw new Error('refresh secret'); } }),
    fetchUsage: async () => { throw new Error('should not fetch'); }
  });
  failed.ctx.credentials.readRecord = async () => expired;
  failed.ctx.credentials.modifyRecord = async (_key, mutate) => mutate(expired);
  const error = await failed.request('usage');
  assert.equal(error.status, 502);
  assert.equal(JSON.stringify(error.data).includes('refresh secret'), false);

  for (const latest of [null, { kind: 'grant', payload: { type: 'oauth', access: 'replacement', expires: Date.now() + 3600000 } }]) {
    let fetchCount = 0;
    const f = fixture(undefined, {
      loadOAuth: async () => ({ refresh: async () => { throw new Error('stale refresh must not run'); } }),
      fetchUsage: async (_url, { headers }) => { fetchCount++; assert.equal(headers.authorization, 'Bearer replacement'); return Response.json({ rate_limit: {} }); }
    });
    f.ctx.credentials.readRecord = async () => expired;
    f.ctx.credentials.modifyRecord = async (_key, mutate) => {
      const next = await mutate(latest);
      return next ?? latest;
    };
    const result = await f.request('usage');
    if (latest) {
      assert.equal(result.status, 200);
      assert.equal(fetchCount, 1);
    } else {
      assert.equal(result.status, 409);
      assert.equal(fetchCount, 0);
    }
  }
});

test('usage atomically refreshes expired credentials before fetching', async () => {
  const persisted = { kind: 'grant', payload: { type: 'oauth', access: 'old', refresh: 'refresh', expires: 0 } };
  let refreshes = 0, accessUsed;
  const f = fixture(undefined, {
    loadOAuth: async () => ({ refresh: async credential => { refreshes++; assert.equal(credential.access, 'old'); return { ...credential, access: 'new', expires: Date.now() + 3600000 }; } }),
    fetchUsage: async (_url, { headers }) => { accessUsed = headers.authorization; return Response.json({ rate_limit: {} }); }
  });
  f.ctx.credentials.readRecord = async () => persisted;
  f.ctx.credentials.modifyRecord = async (_key, mutate) => { const next = await mutate(persisted); if (next) Object.assign(persisted, next); return persisted; };
  assert.deepEqual((await f.request('usage')).data, { primary: null, secondary: null });
  assert.equal(refreshes, 1);
  assert.equal(accessUsed, 'Bearer new');
});

test('select choices and request sizes validated', async () => {
  const f = fixture(async request => {
    await request.interaction.prompt({ kind: 'select', message: 'Account', options: [{ id: 'one', label: 'One', secret: 'NEVER_EXPOSE' }] });
    return { status: 'authorized' };
  });
  const { data: { flowId } } = await f.request('begin');
  const { data } = await f.request('poll', null, '?flowId=' + flowId);
  assert.deepEqual(data.prompt.options, [{ value: 'one', label: 'One' }]);
  assert.equal((await f.request('respond', { flowId, promptId: data.prompt.id, response: 'two' })).status, 400);
  assert.equal((await f.request('respond', { flowId, promptId: data.prompt.id, response: 'x'.repeat(17000) })).status, 413);
  await f.request('respond', { flowId, promptId: data.prompt.id, response: 'one' });
});
