import { randomUUID } from 'node:crypto';

const KEY = 'llm-pi-ai/openai-codex';
const HEADERS = { 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' };
const json = (value, status = 200) => Response.json(value, { status, headers: HEADERS });
class RequestError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}
const failure = (status, message) => new RequestError(status, message);

// Mount only through Connection: its shared carrier enforces cookie, Host/Origin and owner admission.
export function mountCodexAuth(ctx, {
  fetchUsage = globalThis.fetch,
  loadOAuth = async () => (await import('@earendil-works/pi-ai/providers/openai-codex')).openaiCodexProvider().auth.oauth
} = {}) {
  let current;
  const register = (name, method, run) => ctx.connection.fetch.register({
    path: `/api/codex-auth/${name}`, methods: [method], requestBody: 'buffered',
    async fetch(request) {
      try {
        let body;
        if (method === 'POST') {
          if (request.headers.get('content-type')?.split(';')[0].trim().toLowerCase() !== 'application/json') throw failure(415, 'Expected JSON');
          const text = await request.text();
          if (Buffer.byteLength(text) > 16384) throw failure(413, 'Request too large');
          try { body = JSON.parse(text); } catch { throw failure(400, 'Invalid JSON'); }
          if (!body || typeof body !== 'object' || Array.isArray(body)) throw failure(400, 'Expected object');
        }
        return json(await run(request, body));
      } catch (error) {
        // Provider exceptions may contain credentials or callback codes. Never serialize them.
        return json({ error: error instanceof RequestError ? error.message : 'Authorization operation failed' }, error instanceof RequestError ? error.status : 500);
      }
    }
  });
  const lookup = (id) => {
    if (typeof id !== 'string' || !current || id !== current.id) throw failure(404, 'Unknown sign-in attempt');
    return current;
  };
  const clearPrompt = (flow, reason) => {
    const pending = flow.pending;
    if (!pending) return;
    flow.pending = undefined;
    pending.cleanup();
    pending.reject(reason);
  };
  const view = (flow) => ({
    state: flow.state,
    ...(flow.url ? { authorizationUrl: flow.url } : {}),
    ...(flow.message || flow.code ? { message: [flow.message, flow.code].filter(Boolean).join('\n') } : {}),
    ...(flow.pending ? { prompt: flow.pending.view } : {}),
    ...(flow.error ? { error: flow.error } : {})
  });
  register('status', 'GET', async () => {
    const info = await ctx.credentials.describeRecord(KEY);
    return { configured: info.configured === true };
  });
  register('usage', 'GET', async request => {
    const abort = new AbortController();
    const signal = AbortSignal.any([abort.signal, request.signal]);
    let timer;
    const timeout = new Promise((_, reject) => {
      timer = setTimeout(() => { abort.abort(); reject(failure(504, 'Usage request timed out')); }, 10000);
    });
    const operation = async () => {
      const oauthRecord = record => record?.kind === 'grant' && record.payload?.type === 'oauth' ? record.payload : undefined;
      const needsRefresh = credential => !Number.isFinite(credential.expires) || credential.expires <= Date.now() + 300000;
      let record = await ctx.credentials.readRecord(KEY);
      let credential = oauthRecord(record);
      if (!credential) throw failure(409, 'Codex is not connected');
      if (needsRefresh(credential)) {
        const oauth = await loadOAuth();
        // Recheck under the shared store lock; persist an admitted rotation even if this request times out.
        record = await ctx.credentials.modifyRecord(KEY, async current => {
          signal.throwIfAborted();
          const latest = oauthRecord(current);
          if (!latest || !needsRefresh(latest)) return undefined;
          const refreshed = await oauth.refresh(latest, AbortSignal.timeout(15000));
          return { kind: 'grant', payload: JSON.parse(JSON.stringify(refreshed)) };
        });
        credential = oauthRecord(record);
      }
      signal.throwIfAborted();
      if (!credential) throw failure(409, 'Codex is not connected');
      if (typeof credential.access !== 'string' || !credential.access.trim()) throw failure(502, 'Codex usage is unavailable');
      const headers = { authorization: `Bearer ${credential.access}`, accept: 'application/json' };
      if (typeof credential.accountId === 'string' && credential.accountId) headers['ChatGPT-Account-Id'] = credential.accountId;
      const response = await fetchUsage('https://chatgpt.com/backend-api/wham/usage', { headers, signal, redirect: 'error' });
      if (!response.ok) {
        await response.body?.cancel();
        throw failure(502, 'Codex usage is unavailable');
      }
      const data = await response.json();
      const windows = [data?.rate_limit?.primary_window, data?.rate_limit?.secondary_window];
      const windowFor = seconds => {
        const window = windows.find(value => value?.limit_window_seconds === seconds);
        if (!window || !Number.isFinite(window.used_percent) || window.used_percent < 0 || window.used_percent > 100) return null;
        return { usedPercent: window.used_percent, resetsAt: Number.isSafeInteger(window.reset_at) && window.reset_at >= 0 && window.reset_at <= 8640000000000 ? window.reset_at : null };
      };
      return { primary: windowFor(18000), secondary: windowFor(604800) };
    };
    try { return await Promise.race([operation(), timeout]); }
    catch (error) { throw error instanceof RequestError ? error : failure(502, 'Codex usage is unavailable'); }
    finally { clearTimeout(timer); }
  });
  register('begin', 'POST', () => {
    if (current && ['pending', 'prompt'].includes(current.state)) throw failure(409, 'A sign-in attempt is already running');
    const entry = ctx.authorization.describe(KEY);
    if (!entry?.methods.some(method => method.id === 'oauth')) throw failure(503, 'Codex OAuth is unavailable');
    if (entry.inFlight) throw failure(409, 'A sign-in attempt is already running');
    const flow = { id: randomUUID(), state: 'pending', abort: new AbortController() };
    current = flow;
    const timer = setTimeout(() => flow.abort.abort(), 10 * 60 * 1000);
    timer.unref?.();
    const interaction = {
      notify(notice) {
        if (flow.abort.signal.aborted || !['pending', 'prompt'].includes(flow.state)) return;
        if (typeof notice.message === 'string') flow.message = notice.message;
        // Notice.code is the user-facing device code, never a stored access/refresh token.
        if (typeof notice.code === 'string') flow.code = notice.code;
        if (typeof notice.url === 'string') {
          try {
            const url = new URL(notice.url);
            if (url.protocol === 'https:' && !url.username && !url.password) flow.url = url.href;
          } catch { /* Ignore a malformed provider notice. */ }
        }
      },
      prompt(prompt) {
        if (flow.pending) return Promise.reject(new Error('Concurrent prompts are unsupported'));
        return new Promise((resolve, reject) => {
          const id = randomUUID();
          const withdrawn = () => {
            clearPrompt(flow, new Error('Prompt withdrawn'));
            if (flow.state === 'prompt') flow.state = 'pending';
          };
          const cleanup = () => {
            prompt.signal?.removeEventListener('abort', withdrawn);
            flow.abort.signal.removeEventListener('abort', withdrawn);
          };
          const projected = { id, type: prompt.kind, message: prompt.message };
          if (prompt.kind === 'select') projected.options = prompt.options.map(option => ({ value: option.id, label: option.label }));
          flow.pending = { view: projected, resolve, reject, cleanup };
          flow.state = 'prompt';
          prompt.signal?.addEventListener('abort', withdrawn, { once: true });
          flow.abort.signal.addEventListener('abort', withdrawn, { once: true });
          if (prompt.signal?.aborted || flow.abort.signal.aborted) withdrawn();
        });
      }
    };
    // Do not await the human interaction in the begin HTTP request.
    flow.done = Promise.resolve().then(() => ctx.authorization.begin({ key: KEY, method: 'oauth', interaction, signal: flow.abort.signal }))
      .then(outcome => { flow.state = outcome.status === 'authorized' ? 'complete' : 'cancelled'; })
      .catch(() => { flow.state = 'error'; flow.error = 'Sign-in failed. Please try again.'; })
      .finally(() => {
        clearTimeout(timer);
        clearPrompt(flow, new Error('Attempt settled'));
        flow.url = undefined;
        flow.message = undefined;
        flow.code = undefined;
      });
    return { flowId: flow.id };
  });
  register('poll', 'GET', request => view(lookup(new URL(request.url).searchParams.get('flowId'))));
  register('respond', 'POST', (_request, body) => {
    const flow = lookup(body.flowId), pending = flow.pending;
    if (!pending || body.promptId !== pending.view.id) throw failure(409, 'Prompt is no longer active');
    if (typeof body.response !== 'string' || body.response.length > 8192) throw failure(400, 'Invalid response');
    if (pending.view.type === 'select' && !pending.view.options.some(option => option.value === body.response)) throw failure(400, 'Invalid option');
    flow.pending = undefined;
    pending.cleanup();
    flow.state = 'pending';
    pending.resolve(body.response);
    return { accepted: true };
  });
  register('cancel', 'POST', (_request, body) => {
    const flow = lookup(body.flowId);
    // The authorization seam itself arbitrates cancellation versus admitted persistence.
    flow.abort.abort();
    return { accepted: true };
  });
  ctx.on('dispose', () => { current?.abort.abort(); });
}

export function installCodexAuth(ctx) {
  return ctx.inject(['connection', 'authorization', 'credentials'], mountCodexAuth);
}
