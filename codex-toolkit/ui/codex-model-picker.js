// Inserted inside the Models UI factory; changes stay in ProviderEditor's draft until Apply.
function CodexModelPicker({ models, overridden, onChange, onReset, operations, settingsNs, disabled, blocked }) {
	const [catalog, setCatalog] = (0, react.useState)(null);
	const [failed, setFailed] = (0, react.useState)(false);
	const [query, setQuery] = (0, react.useState)("");
	const [retry, setRetry] = (0, react.useState)(0);
	const savedModels = (0, react.useRef)(new Map());
	const ordering = (0, react.useRef)(null);
	for (const model of models) savedModels.current.set(model.id, model);
	const locked = disabled || blocked;
	(0, react.useEffect)(() => {
		let current = true;
		setCatalog(null);
		setFailed(false);
		(async () => {
			try {
				const answer = await operations.discoverModels(settingsNs, { provider: "openai-codex" });
				if (!current) return;
				if (answer.kind !== "found" || !Array.isArray(answer.models) || answer.models.some(model => !model || typeof model.id !== "string" || !model.id.trim())) throw new Error();
				setCatalog(answer.models);
			} catch {
				if (current) { setCatalog([]); setFailed(true); }
			}
		})();
		return () => { current = false; };
	}, [operations, settingsNs, retry]);
	const candidates = new Map((catalog ?? []).map(model => [model.id, { id: model.id, name: typeof model.name === "string" ? model.name : model.id }]));
	for (const model of savedModels.current.values()) {
		if (!candidates.has(model.id)) candidates.set(model.id, { id: model.id, name: typeof model.name === "string" ? model.name : model.id });
	}
	const entries = [...candidates.values()];
	const selected = new Set((models.length ? models : entries).map(model => model.id));
	// Selected models start on top; toggling keeps every row where it is so nothing jumps under the pointer.
	const signature = entries.map(model => model.id).join("|");
	if (ordering.current === null || ordering.current.signature !== signature) {
		ordering.current = { signature, ids: [...entries].sort((a, b) => Number(selected.has(b.id)) - Number(selected.has(a.id))).map(model => model.id) };
	}
	const ordered = ordering.current.ids.map(id => candidates.get(id)).filter(Boolean);
	const search = query.trim().toLowerCase();
	const visible = ordered.filter(model => model.id.toLowerCase().includes(search) || model.name.toLowerCase().includes(search));
	function choose(ids) {
		if (locked || catalog === null || failed || !ids.length) return;
		onChange(ids.map(id => savedModels.current.get(id) ?? { id }));
	}
	function reset() {
		if (locked) return;
		savedModels.current.clear();
		ordering.current = null;
		onReset();
	}
	return (0, react_jsx_runtime.jsxs)("section", { className: ModelsSection_module_css_default.modelCatalog + " codex-model-picker", "aria-label": "Models in picker", children: [
		(0, react_jsx_runtime.jsx)("style", { children: `
.codex-model-picker { --codex-accent:var(--dsw-static-blue-450,#4d93f8); display:block; margin:0; }
.codex-model-picker .codex-model-head { display:flex; align-items:center; justify-content:space-between; gap:12px; margin-bottom:8px; }
.codex-model-picker .codex-model-title { display:inline-flex; align-items:center; gap:8px; font-size:13px; font-weight:600; line-height:20px; }
.codex-model-picker .codex-model-count { padding:1px 8px; border-radius:99px; background:color-mix(in srgb,var(--codex-accent) 12%,transparent); color:var(--codex-accent); font-size:11px; font-weight:500; line-height:16px; font-variant-numeric:tabular-nums; }
.codex-model-picker .codex-model-actions { display:inline-flex; align-items:center; gap:2px; }
.codex-model-picker .codex-model-actions .linkButton { color:var(--dsw-alias-label-secondary); }
.codex-model-picker .codex-model-actions .linkButton:hover:not(:disabled) { color:var(--dsw-alias-label-primary); }
.codex-model-picker .codex-model-search-wrap { position:relative; margin-bottom:10px; }
.codex-model-picker .codex-model-search-icon { position:absolute; left:11px; top:50%; width:14px; height:14px; transform:translateY(-50%); color:var(--dsw-alias-label-tertiary); pointer-events:none; }
.codex-model-picker .codex-model-search { box-sizing:border-box; width:100%; height:32px; padding-left:32px; }
.codex-model-picker .codex-model-search:focus, .codex-model-picker .codex-model-search:focus-visible { outline:none; border-color:color-mix(in srgb,var(--codex-accent) 55%,transparent); box-shadow:0 0 0 3px color-mix(in srgb,var(--codex-accent) 14%,transparent); }
.codex-model-picker .codex-model-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(196px,1fr)); gap:8px; max-height:360px; overflow-y:auto; scrollbar-width:thin; padding:2px; margin:0 -2px; }
.codex-model-picker .codex-model-option { position:relative; display:flex; align-items:center; gap:9px; box-sizing:border-box; height:52px; overflow:hidden; min-width:0; padding:0 10px; border:1px solid color-mix(in srgb,currentColor 9%,transparent); border-radius:10px; background:transparent; cursor:pointer; transition:border-color .16s, background .16s; }
.codex-model-picker .codex-model-option:hover { border-color:color-mix(in srgb,currentColor 18%,transparent); background:color-mix(in srgb,currentColor 4%,transparent); }
.codex-model-picker .codex-model-option[data-selected="true"] { border-color:color-mix(in srgb,var(--codex-accent) 55%,transparent); background:color-mix(in srgb,var(--codex-accent) 8%,transparent); }
.codex-model-picker .codex-model-input { position:absolute; width:1px; height:1px; opacity:0; margin:0; pointer-events:none; }
.codex-model-picker .codex-model-box { display:inline-flex; flex:none; align-items:center; justify-content:center; width:17px; height:17px; border:1.5px solid var(--dsw-alias-border-l3); border-radius:5px; color:transparent; background:transparent; transition:background .16s, border-color .16s, color .16s; }
.codex-model-picker .codex-model-box svg { width:11px; height:11px; transform:scale(.65); transition:transform .16s; }
.codex-model-picker .codex-model-input:checked + .codex-model-box svg { transform:scale(1); }
.codex-model-picker .codex-model-input:checked + .codex-model-box { border-color:var(--codex-accent); background:var(--codex-accent); color:var(--dsw-static-neutral-bluish-1000,#0f1115); }
.codex-model-picker .codex-model-input:focus-visible + .codex-model-box { outline:2px solid var(--dsw-focus-ring-color,var(--dsw-alias-state-business-primary)); outline-offset:2px; }
.codex-model-picker .codex-model-input:disabled + .codex-model-box { opacity:.5; }
.codex-model-picker .codex-model-copy { display:flex; flex-direction:column; min-width:0; line-height:1.3; }
.codex-model-picker .codex-model-name { font-size:13px; font-weight:500; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.codex-model-picker .codex-model-id { font-size:11px; color:var(--dsw-alias-label-tertiary); opacity:.8; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.codex-model-picker .codex-model-note { margin:10px 0 0; font-size:12px; line-height:18px; color:var(--dsw-alias-label-tertiary); }
.codex-provider-editor { background:transparent; padding:0; gap:12px; }
.codex-provider-editor > details { border-top:1px solid color-mix(in srgb,currentColor 8%,transparent); padding-top:8px; }
@media (prefers-reduced-motion:reduce) { .codex-model-picker .codex-model-option, .codex-model-picker .codex-model-box, .codex-model-picker .codex-model-box svg { transition:none; } }
` }),
		(0, react_jsx_runtime.jsxs)("div", { className: "codex-model-head", children: [
			(0, react_jsx_runtime.jsxs)("strong", { className: "codex-model-title", children: ["Models in picker", catalog !== null && !failed ? (0, react_jsx_runtime.jsx)("span", { className: "codex-model-count", children: selected.size + " of " + entries.length }) : null] }),
			(0, react_jsx_runtime.jsxs)("div", { className: "codex-model-actions", children: [
				(0, react_jsx_runtime.jsx)("button", { type: "button", className: ModelsSection_module_css_default.linkButton, disabled: locked || catalog === null || failed || !entries.length || entries.every(model => selected.has(model.id)), onClick: () => choose(entries.map(model => model.id)), title: "Show every model in the installed catalog", children: "Show all" }),
				(0, react_jsx_runtime.jsx)("button", { type: "button", className: ModelsSection_module_css_default.linkButton, disabled: locked || !overridden, onClick: reset, title: "Restore the profile's inherited model list", children: "Reset" })
			] })
		] }),
		blocked ? (0, react_jsx_runtime.jsx)("p", { className: ModelsSection_module_css_default.notice, role: "note", children: "This profile uses advanced modelOverrides. Clear those overrides in the configuration before changing model visibility." }) : null,
		catalog === null ? (0, react_jsx_runtime.jsx)("p", { role: "status", children: "Loading available models…" }) : null,
		failed ? (0, react_jsx_runtime.jsxs)("div", { role: "alert", className: "codex-model-note", children: ["Could not load the model catalog. ", (0, react_jsx_runtime.jsx)("button", { type: "button", className: ModelsSection_module_css_default.linkButton, onClick: () => setRetry(value => value + 1), children: "Retry" })] }) : null,
		entries.length > 6 || query ? (0, react_jsx_runtime.jsxs)("div", { className: "codex-model-search-wrap", children: [
			(0, react_jsx_runtime.jsxs)("svg", { className: "codex-model-search-icon", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round", "aria-hidden": true, children: [
				(0, react_jsx_runtime.jsx)("circle", { cx: 11, cy: 11, r: 6.5 }),
				(0, react_jsx_runtime.jsx)("path", { d: "m16 16 4 4" })
			] }),
			(0, react_jsx_runtime.jsx)("input", { type: "search", className: ModelsSection_module_css_default.input + " codex-model-search", "aria-label": "Search Codex models", placeholder: "Search models…", value: query, onChange: event => setQuery(event.target.value) })
		] }) : null,
		entries.length ? (0, react_jsx_runtime.jsxs)(react.Fragment, { children: [
			(0, react_jsx_runtime.jsx)("div", { className: "codex-model-grid", children: visible.map(model => {
				const last = selected.size === 1 && selected.has(model.id);
				return (0, react_jsx_runtime.jsxs)("label", { className: "codex-model-option", "data-selected": selected.has(model.id) ? "true" : "false", title: last ? "At least one model is required" : undefined, children: [
					(0, react_jsx_runtime.jsx)("input", { className: "codex-model-input", type: "checkbox", value: model.id, checked: selected.has(model.id), disabled: locked || failed || catalog === null || last, onChange: event => {
						if (catalog === null) return;
						const next = new Set(selected);
						if (event.target.checked) next.add(model.id); else next.delete(model.id);
						choose([...next]);
					} }),
					(0, react_jsx_runtime.jsx)("span", { className: "codex-model-box", "aria-hidden": true, children:
						(0, react_jsx_runtime.jsx)("svg", { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 3.2, strokeLinecap: "round", strokeLinejoin: "round", children:
							(0, react_jsx_runtime.jsx)("path", { d: "M4 12.5 9 17.5 20 6.5" }) }) }),
					(0, react_jsx_runtime.jsxs)("span", { className: "codex-model-copy", children: [
						(0, react_jsx_runtime.jsx)("span", { className: "codex-model-name", children: model.name }),
						model.name !== model.id ? (0, react_jsx_runtime.jsx)("span", { className: "codex-model-id", children: model.id }) : null
					] })
				] }, model.id);
			}) }),
			!visible.length ? (0, react_jsx_runtime.jsx)("p", { className: "codex-model-note", children: "No matching models." }) : null
		] }) : catalog !== null && !failed ? (0, react_jsx_runtime.jsx)("p", { className: "codex-model-note", children: "No Codex models are available in the installed catalog." }) : null
	] });
}
