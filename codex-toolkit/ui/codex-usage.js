// Inserted verbatim inside the Account UI module factory.
function codexResetLabel(resetsAt, now) {
	if (!Number.isFinite(resetsAt)) return "Reset unknown";
	const minutes = Math.ceil((resetsAt * 1000 - now) / 60000);
	if (minutes <= 0) return "Reset due";
	if (minutes < 60) return "Resets in " + minutes + "m";
	const hours = Math.floor(minutes / 60);
	if (hours < 24) return "Resets in " + hours + "h" + (minutes % 60 ? " " + minutes % 60 + "m" : "");
	return "Resets in " + Math.floor(hours / 24) + "d" + (hours % 24 ? " " + hours % 24 + "h" : "");
}
let codexUsageDitherUrl;
function codexUsageDither() {
	if (codexUsageDitherUrl) return codexUsageDitherUrl;
	const fallback = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='128' height='6'/%3E";
	try {
		const width = 128;
		const height = 6;
		const canvas = document.createElement("canvas");
		canvas.width = width;
		canvas.height = height;
		const context = canvas.getContext("2d");
		if (context === null) throw new Error("Canvas unavailable");
		const pixels = context.createImageData(width, height);
		const matrix = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
		const tau = Math.PI * 2;
		for (let y = 0; y < height; y++) {
			const v = y / height;
			for (let x = 0; x < width; x++) {
				const u = x / width;
				const waveA = 0.5 + 0.5 * Math.sin(tau * (2 * u + 0.35 * Math.sin(tau * v)));
				const waveB = 0.5 + 0.5 * Math.cos(tau * (5 * u + v) + 0.3 * Math.sin(tau * (u - v)));
				const coverage = 0.18 + 0.42 * waveA + 0.12 * waveB;
				if (coverage <= (matrix[(y & 3) * 4 + (x & 3)] + 0.5) / 16) continue;
				const index = (y * width + x) * 4;
				pixels.data[index] = 255;
				pixels.data[index + 1] = 255;
				pixels.data[index + 2] = 255;
				pixels.data[index + 3] = 110;
			}
		}
		context.putImageData(pixels, 0, 0);
		const url = canvas.toDataURL("image/png");
		codexUsageDitherUrl = url.startsWith("data:image/png") ? url : fallback;
	} catch {
		codexUsageDitherUrl = fallback;
	}
	return codexUsageDitherUrl;
}
function CodexUsageCard() {
	const [now, setNow] = (0, react.useState)(Date.now());
	(0, react.useEffect)(() => {
		const timer = setInterval(() => setNow(Date.now()), 30000);
		return () => clearInterval(timer);
	}, []);
	const [configured, setConfigured] = (0, react.useState)(null);
	const [usage, setUsage] = (0, react.useState)(null);
	const [loading, setLoading] = (0, react.useState)(true);
	const [failed, setFailed] = (0, react.useState)(false);
	const request = (0, react.useRef)(null);
	const mounted = (0, react.useRef)(true);
	async function refresh() {
		request.current?.abort();
		const controller = new AbortController();
		request.current = controller;
		setLoading(true);
		setFailed(false);
		const current = () => mounted.current && request.current === controller && !controller.signal.aborted;
		try {
			const options = { credentials: "same-origin", cache: "no-store", redirect: "error", headers: { Accept: "application/json" }, signal: controller.signal };
			const statusResponse = await fetch("/api/codex-auth/status", options);
			if (!current()) return;
			if (!statusResponse.ok) throw new Error();
			const status = await statusResponse.json();
			if (!current()) return;
			if (typeof status.configured !== "boolean") throw new Error();
			if (!status.configured) {
				setConfigured(false); setUsage(null);
				return;
			}
			const usageResponse = await fetch("/api/codex-auth/usage", options);
			if (!current()) return;
			if (!usageResponse.ok) throw new Error();
			const data = await usageResponse.json();
			if (!current()) return;
			setConfigured(true); setUsage(data);
		} catch {
			if (current()) { setConfigured(true); setFailed(true); }
		} finally {
			if (current()) setLoading(false);
		}
	}
	(0, react.useEffect)(() => {
		mounted.current = true;
		refresh();
		return () => { mounted.current = false; request.current?.abort(); };
	}, []);
	if (configured === false) return null;
	function limitRow(label, value) {
		const percent = value && Number.isFinite(value.usedPercent) ? Math.max(0, Math.min(100, value.usedPercent)) : null;
		const reset = value && Number.isFinite(value.resetsAt) ? new Date(value.resetsAt * 1000).toLocaleString() : null;
		const tone = percent === null ? "unknown" : percent >= 95 ? "critical" : percent >= 80 ? "warning" : "normal";
		return (0, react_jsx_runtime.jsxs)("div", { className: "codex-limit", "data-tone": tone, children: [
			(0, react_jsx_runtime.jsxs)("div", { className: "codex-limit-heading", children: [
				(0, react_jsx_runtime.jsxs)("span", { className: "codex-limit-label", children: [
					(0, react_jsx_runtime.jsx)("span", { className: "codex-limit-icon", "aria-hidden": true, children:
						(0, react_jsx_runtime.jsxs)("svg", { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.6, strokeLinecap: "round", strokeLinejoin: "round", children: label === "5-hour limit" ? [
							(0, react_jsx_runtime.jsx)("circle", { cx: 12, cy: 12, r: 8 }),
							(0, react_jsx_runtime.jsx)("path", { d: "M12 7v5l3 2" })
						] : [
							(0, react_jsx_runtime.jsx)("rect", { x: 4, y: 5, width: 16, height: 15, rx: 3 }),
							(0, react_jsx_runtime.jsx)("path", { d: "M8 3v4m8-4v4M4 10h16m-12 4h3" })
						] }) }),
					label
				] }),
				(0, react_jsx_runtime.jsxs)("span", { className: "codex-limit-value", children: [
					percent === null ? "—" : percent + "%",
					(0, react_jsx_runtime.jsx)("span", { children: percent === null ? " unknown" : " used" })
				] })
			] }),
			(0, react_jsx_runtime.jsx)("div", { className: "codex-meter", role: "progressbar", "aria-label": label, "aria-valuemin": 0, "aria-valuemax": 100,
				...(percent === null ? { "aria-valuetext": "Usage unknown" } : { "aria-valuenow": percent, "aria-valuetext": percent + "% used · " + (100 - percent) + "% remaining" }),
				style: percent === null ? undefined : { "--codex-fill-cutoff": (100 - percent) + "%" },
				children: percent === null ? null : (0, react_jsx_runtime.jsx)("div", { className: "codex-meter-fill", style: { "--codex-fill": percent / 100 } }) }),
			(0, react_jsx_runtime.jsxs)("div", { className: "codex-limit-details", children: [
				(0, react_jsx_runtime.jsx)("span", { children: percent === null ? "Unknown" : (100 - percent) + "% remaining" }),
				(0, react_jsx_runtime.jsx)("span", { title: reset || undefined, "aria-label": reset ? codexResetLabel(value.resetsAt, now) + ". " + reset : "Reset unknown", children: codexResetLabel(value?.resetsAt, now) })
			] })
		] });
	}
	return (0, react_jsx_runtime.jsxs)("div", { className: AccountSection_module_css_default.balanceCard + " codex-usage-card", "aria-busy": loading, children: [
		(0, react_jsx_runtime.jsx)("style", { children: `
.codex-usage-card { gap:0; padding:18px 20px; animation: codex-card-in .3s ease-out both; }
.codex-usage-card .codex-heading { display:flex; align-items:center; justify-content:space-between; gap:16px; margin-bottom:18px; }
.codex-usage-card .codex-title { display:flex; align-items:center; gap:9px; font-size:14px; }
.codex-usage-card .codex-refresh { display:inline-flex; width:132px; align-items:center; justify-content:center; gap:7px; transition:background .2s, opacity .2s; }
.codex-usage-card .codex-refresh:disabled { opacity:.6; cursor:wait; }
.codex-usage-card .codex-refresh svg { width:14px; height:14px; }
.codex-usage-card[aria-busy="true"] .codex-refresh svg { animation:codex-spin 1s linear infinite; }
.codex-usage-card .codex-limit { --codex-color:var(--dsw-static-blue-450,#4d93f8); --codex-end:var(--dsw-static-blue-300,#93c5fd); padding:0 0 16px; }
.codex-usage-card .codex-limit[data-tone="warning"] { --codex-color:#e5ad55; --codex-end:#f3cd85; }
.codex-usage-card .codex-limit[data-tone="critical"] { --codex-color:#ec7e86; --codex-end:#f5a3a4; }
.codex-usage-card .codex-limit + .codex-limit::before { content:""; display:block; height:1px; margin:0 0 16px 42px; background:color-mix(in srgb,currentColor 10%,transparent); }
.codex-usage-card .codex-limit:last-child { padding-bottom:2px; }
.codex-usage-card .codex-limit-heading { display:flex; align-items:center; justify-content:space-between; gap:12px; margin-bottom:8px; }
.codex-usage-card .codex-limit-label { display:inline-flex; align-items:center; gap:10px; font-weight:500; }
.codex-usage-card .codex-limit-icon { display:inline-flex; align-items:center; justify-content:center; width:30px; height:30px; flex:none; border:1px solid color-mix(in srgb,var(--codex-color) 24%,transparent); border-radius:50%; corner-shape:round; color:var(--codex-color); background:color-mix(in srgb,var(--codex-color) 7%,transparent); }
.codex-usage-card .codex-limit-icon svg { width:17px; height:17px; }
.codex-usage-card .codex-meter, .codex-usage-card .codex-limit-details { margin-left:42px; }
.codex-usage-card .codex-limit-value { font-size:21px; font-weight:600; font-variant-numeric:tabular-nums; letter-spacing:-.7px; line-height:1.2; }
.codex-usage-card .codex-limit-value > span { font-size:12px; font-weight:400; letter-spacing:0; opacity:.6; }
.codex-usage-card .codex-meter { position:relative; height:6px; overflow:hidden; border-radius:99px; corner-shape:round; background:color-mix(in srgb,currentColor 9%,transparent); }
.codex-usage-card .codex-meter-fill { height:100%; border-radius:inherit; background:linear-gradient(90deg,var(--codex-color),var(--codex-end)); transform-origin:left; transform:scaleX(var(--codex-fill)); transition:transform .65s cubic-bezier(.22,1,.36,1); animation:codex-fill-in .9s cubic-bezier(.22,1,.36,1) both; }
.codex-usage-card .codex-limit:not([data-tone="unknown"]) .codex-meter::after { content:""; position:absolute; z-index:1; inset:0; background-image:url("${codexUsageDither()}"); background-size:128px 100%; background-repeat:repeat-x; background-position:0 0; clip-path:inset(0 var(--codex-fill-cutoff) 0 0); pointer-events:none; transition:clip-path .65s cubic-bezier(.22,1,.36,1); animation:codex-dither-in .9s cubic-bezier(.22,1,.36,1) both, codex-dither-shimmer 4.2s linear infinite; }
.codex-usage-card .codex-limit:last-child .codex-meter-fill { animation-delay:.1s; }
.codex-usage-card .codex-limit-details { display:flex; flex-wrap:wrap; justify-content:space-between; gap:5px 12px; margin-top:10px; font-size:12px; line-height:1.5; color:color-mix(in srgb,currentColor 65%,transparent); font-variant-numeric:tabular-nums; }
.codex-usage-card .codex-loading-status { position:absolute; width:1px; height:1px; padding:0; margin:-1px; overflow:hidden; clip-path:inset(50%); white-space:nowrap; border:0; }
.codex-usage-card [role="alert"] { margin-bottom:16px; }
@keyframes codex-fill-in { from { transform:scaleX(0); } }
@keyframes codex-dither-in { from { clip-path:inset(0 100% 0 0); } }
@keyframes codex-dither-shimmer { from { background-position:0 0; } to { background-position:-128px 0; } }
@keyframes codex-card-in { from { opacity:0; transform:translateY(4px); } to { opacity:1; transform:translateY(0); } }
@keyframes codex-spin { to { transform:rotate(360deg); } }
@media (prefers-reduced-motion:reduce) { .codex-usage-card, .codex-usage-card *, .codex-usage-card .codex-meter::after { animation:none !important; transition:none !important; } }
` }),
		(0, react_jsx_runtime.jsxs)("div", { className: "codex-heading", children: [
			(0, react_jsx_runtime.jsx)("strong", { className: "codex-title", children: "Codex usage" }),
			(0, react_jsx_runtime.jsxs)("button", { type: "button", className: AccountSection_module_css_default.linkButton + " codex-refresh", disabled: loading, onClick: refresh, children: [
				(0, react_jsx_runtime.jsx)("svg", { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.7, strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": true, children:
					(0, react_jsx_runtime.jsx)("path", { d: "M20 7v5h-5 M4 17v-5h5 M6.1 7a7 7 0 0 1 11.6-1L20 12 M4 12l2.3 6A7 7 0 0 0 17.9 17" }) }),
				loading ? "Refreshing…" : "Refresh"
			] })
		] }),
		(0, react_jsx_runtime.jsx)("div", { className: "codex-loading-status", role: "status", children: loading ? "Refreshing Codex usage…" : failed ? "" : usage ? "Codex usage updated." : "" }),
		failed ? (0, react_jsx_runtime.jsx)("div", { className: AccountSection_module_css_default.secondary, role: "alert", children: "Codex usage unavailable. Try again." }) : null,
		limitRow("5-hour limit", usage?.primary),
		limitRow("Weekly limit", usage?.secondary)
	] });
}
