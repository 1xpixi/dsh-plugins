// Inserted inside the existing module factory: reuse its React runtime and CSS.
const CODEX_AUTH_BASE = "/api/codex-auth/";
async function codexAuthRequest(path, body) {
	const response = await fetch(CODEX_AUTH_BASE + path, {
		method: body === undefined ? "GET" : "POST",
		credentials: "same-origin",
		cache: "no-store",
		redirect: "error",
		headers: body === undefined ? { Accept: "application/json" } : { Accept: "application/json", "Content-Type": "application/json" },
		...(body === undefined ? {} : { body: JSON.stringify(body) })
	});
	if (!response.ok) throw new Error("Codex authentication request failed");
	return response.status === 204 ? {} : response.json();
}
function codexAuthorizationUrl(value) {
	if (typeof value !== "string") return undefined;
	try {
		const url = new URL(value);
		return url.protocol === "https:" && url.hostname === "auth.openai.com" && !url.username && !url.password && !url.port ? url.href : undefined;
	} catch { return undefined; }
}
function CodexAuthControls({ onComplete, readOnly, children }) {
	const [status, setStatus] = (0, react.useState)(null);
	const [flow, setFlow] = (0, react.useState)(null);
	const [busy, setBusy] = (0, react.useState)(false);
	const [failure, setFailure] = (0, react.useState)(false);
	const [answer, setAnswer] = (0, react.useState)("");
	const live = (0, react.useRef)(false);
	const current = (0, react.useRef)(null);
	const refresh = async () => {
		const next = await codexAuthRequest("status");
		if (typeof next.configured !== "boolean" || (next.expired !== undefined && typeof next.expired !== "boolean")) throw new Error("Invalid status");
		if (live.current) setStatus({ configured: next.configured, expired: next.expired === true });
	};
	(0, react.useEffect)(() => {
		live.current = true;
		refresh().catch(() => { if (live.current) setFailure(true); });
		return () => {
			live.current = false;
			if (current.current) codexAuthRequest("cancel", { flowId: current.current }).catch(() => {});
			current.current = null;
		};
	}, []);
	(0, react.useEffect)(() => {
		if (!flow) return;
		const id = flow.flowId;
		let stopped = false;
		let timer;
		const poll = async () => {
			try {
				const next = await codexAuthRequest("poll?flowId=" + encodeURIComponent(id));
				if (stopped || current.current !== id) return;
				setFailure(false);
				if (next.state === "complete") {
					current.current = null;
					setFlow(null);
					setAnswer("");
					await refresh();
					if (live.current) onComplete();
					return;
				}
				if (next.state === "cancelled" || next.state === "error") {
					current.current = null;
					setFlow(null);
					setAnswer("");
					setFailure(next.state === "error");
					await refresh();
					return;
				}
				if (!["pending", "prompt"].includes(next.state)) throw new Error("Sign in failed");
				setFlow(previous => ({ ...previous, ...next, flowId: id }));
				timer = setTimeout(poll, 1500);
			} catch {
				if (stopped || !live.current) return;
				setFailure(true);
				// Keep observing a cancellation/commit race even after transient network errors.
				if (current.current === id) timer = setTimeout(poll, 1500);
			}
		};
		poll();
		return () => { stopped = true; clearTimeout(timer); };
	}, [flow?.flowId]);
	(0, react.useEffect)(() => { setAnswer(""); }, [flow?.prompt?.id]);
	const begin = async () => {
		if (busy || current.current || readOnly) return;
		setBusy(true);
		setFailure(false);
		try {
			const next = await codexAuthRequest("begin", {});
			if (typeof next.flowId !== "string" || !next.flowId) throw new Error("Invalid flow");
			if (!live.current) {
				await codexAuthRequest("cancel", { flowId: next.flowId });
				return;
			}
			current.current = next.flowId;
			setFlow(next);
		} catch { if (live.current) setFailure(true); }
		finally { if (live.current) setBusy(false); }
	};
	const cancel = async () => {
		const id = current.current;
		if (!id || busy) return;
		setBusy(true);
		try {
			await codexAuthRequest("cancel", { flowId: id });
			if (live.current) {
				// Cancellation can race a committed login; keep polling for its terminal result.
				setFlow(previous => previous ? { ...previous, cancelling: true } : null);
				setAnswer("");
				setFailure(false);
			}
		} catch { if (live.current) setFailure(true); }
		finally { if (live.current) setBusy(false); }
	};
	const respond = async event => {
		event.preventDefault();
		const promptId = flow?.prompt?.id;
		if (busy || !current.current || !answer.trim() || typeof promptId !== "string") return;
		setBusy(true);
		setFailure(false);
		try {
			await codexAuthRequest("respond", { flowId: current.current, promptId, response: answer });
			if (live.current) { setAnswer(""); setFlow(previous => previous?.prompt?.id === promptId ? { ...previous, prompt: undefined } : previous); }
		} catch { if (live.current) setFailure(true); }
		finally { if (live.current) setBusy(false); }
	};
	const jsx = react_jsx_runtime.jsx;
	const css = ModelsSection_module_css_default;
	const button = (label, onClick, disabled = busy) => jsx("button", { type: "button", className: css.secondaryButton, disabled, onClick, children: label });
	const usable = status?.configured && !status.expired;
	const label = !status ? failure ? "OAuth status unavailable" : "Checking sign-in…" : status.expired ? "OAuth expired" : usable ? "Signed in" : "OAuth not configured";
	const url = codexAuthorizationUrl(flow?.authorizationUrl);
	const prompt = flow?.prompt;
	const statusNode = jsx("span", { className: usable ? css.accountStatus : undefined, style: usable ? undefined : { display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13, lineHeight: "20px", color: "var(--dsw-alias-label-tertiary)" }, role: "status", "aria-live": "polite", title: usable ? "OAuth credentials saved locally; validity is checked when making a request" : undefined, children: [status ? jsx("span", { className: `${css.credentialDot} ${usable ? css.credentialDotConfigured : css.credentialDotMissing}`, "aria-hidden": "true" }) : null, label] });
	const actionsNode = jsx(react.Fragment, {
		children: [
			!flow ? button(busy ? "Starting…" : usable ? "Sign in again" : "Sign in", begin, busy || readOnly) : null,
			flow ? button(flow.cancelling ? "Cancelling…" : "Cancel sign in", cancel, busy || flow.cancelling) : null
		]
	});
	const detailsNode = flow || failure ? jsx("div", {
		style: { display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 6, fontSize: 13, lineHeight: "20px", color: "var(--dsw-alias-label-secondary)" },
		children: [
			!flow && failure ? button("Retry status", () => { setFailure(false); refresh().catch(() => { if (live.current) setFailure(true); }); }) : null,
			flow ? jsx("span", { role: "status", children: "Sign in pending" }) : null,
			typeof flow?.message === "string" ? jsx("span", { role: "status", children: flow.message }) : null,
			url ? jsx("a", { href: url, target: "_blank", rel: "noopener noreferrer", className: css.secondaryButton, children: "Open OpenAI sign in" }) : null,
			prompt && ["text", "secret", "select"].includes(prompt.type) ? jsx("form", {
				onSubmit: respond,
				children: [
					jsx("label", { className: css.field, children: [typeof prompt.message === "string" ? prompt.message : "Sign-in response", prompt.type === "select" ? jsx("select", {
						className: css.input, value: answer, disabled: busy, onChange: event => setAnswer(event.target.value),
						children: [jsx("option", { value: "", children: "Choose…" }), ...(Array.isArray(prompt.options) ? prompt.options.filter(option => typeof option.value === "string" && typeof option.label === "string").map(option => jsx("option", { value: option.value, children: option.label }, option.value)) : [])]
					}) : jsx("input", { className: css.input, type: prompt.type === "secret" ? "password" : "text", autoComplete: "off", spellCheck: false, value: answer, disabled: busy, onChange: event => setAnswer(event.target.value) })] }),
					jsx("button", { type: "submit", className: css.secondaryButton, disabled: busy || !answer.trim() || typeof prompt.id !== "string", children: "Continue" })
				]
			}) : null,
			failure ? jsx("span", { role: "alert", className: css.error, children: "Could not update Codex sign-in status. Retry or cancel." }) : null
		]
	}) : null;
	return children ? children(statusNode, actionsNode, detailsNode) : jsx(react.Fragment, { children: [statusNode, actionsNode, detailsNode] });
}
