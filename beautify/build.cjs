const fs = require('node:fs');
const path = require('node:path');
const root = __dirname;
const css = fs.readFileSync(path.join(root, 'src/polish.css'), 'utf8');
const output = `window.__ModuleLoader__.load({
\tid: "dsh-beautify",
\tfactory: () => {
\t\tconst CSS = ${JSON.stringify(css)};
\t\tconst FALLBACK_BACKGROUND = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='1280' height='720'/%3E";
\t\tfunction createDitherBackground() {
\t\t\ttry {
\t\t\t\tconst width = 1280;
\t\t\t\tconst height = 720;
\t\t\t\tconst pitch = 2;
\t\t\t\tconst canvas = document.createElement("canvas");
\t\t\t\tcanvas.width = width;
\t\t\t\tcanvas.height = height;
\t\t\t\tconst context = canvas.getContext("2d");
\t\t\t\tif (context === null) return FALLBACK_BACKGROUND;
\t\t\t\tconst pixels = context.createImageData(width, height);
\t\t\t\tconst matrix = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
\t\t\t\tconst tau = Math.PI * 2;
\t\t\t\tfor (let y = 0; y < height; y += pitch) {
\t\t\t\t\tconst v = y / height;
\t\t\t\t\tconst sinY = Math.sin(tau * v);
\t\t\t\t\tfor (let x = 0; x < width; x += pitch) {
\t\t\t\t\t\tconst u = x / width;
\t\t\t\t\t\tconst waveA = 0.5 + 0.5 * Math.sin(tau * u + 0.7 * sinY);
\t\t\t\t\t\tconst waveB = 0.5 + 0.5 * Math.cos(tau * (u + v) + 0.4 * Math.sin(tau * (u - v)));
\t\t\t\t\t\tconst coverage = 0.08 + 0.55 * waveA + 0.26 * waveB;
\t\t\t\t\t\tif (coverage <= (matrix[((y >> 1) & 3) * 4 + ((x >> 1) & 3)] + 0.5) / 16) continue;
\t\t\t\t\t\tfor (let py = 0; py < pitch; py++) for (let px = 0; px < pitch; px++) {
\t\t\t\t\t\t\tconst index = ((y + py) * width + x + px) * 4;
\t\t\t\t\t\t\tpixels.data[index] = 77;
\t\t\t\t\t\t\tpixels.data[index + 1] = 147;
\t\t\t\t\t\t\tpixels.data[index + 2] = 248;
\t\t\t\t\t\t\tpixels.data[index + 3] = 52;
\t\t\t\t\t\t}
\t\t\t\t\t}
\t\t\t\t}
\t\t\t\tcontext.putImageData(pixels, 0, 0);
\t\t\t\tconst url = canvas.toDataURL("image/png");
\t\t\t\treturn url.startsWith("data:image/png") ? url : FALLBACK_BACKGROUND;
\t\t\t} catch {
\t\t\t\treturn FALLBACK_BACKGROUND;
\t\t\t}
\t\t}
\t\tfunction apply(ctx) {
\t\t\tctx.effect(() => {
\t\t\t\tif (typeof document === "undefined" || document.getElementById("dsh-beautify") !== null) return;
\t\t\t\tconst style = document.createElement("style");
\t\t\t\tstyle.id = "dsh-beautify";
\t\t\t\tstyle.textContent = CSS.replace("__BEAUTIFY_DITHER_BACKGROUND__", createDitherBackground());
\t\t\t\tdocument.head.appendChild(style);
\t\t\t\tdocument.documentElement.setAttribute("data-dsh-beautify", "");
\t\t\t\treturn () => {
\t\t\t\t\tstyle.remove();
\t\t\t\t\tdocument.documentElement.removeAttribute("data-dsh-beautify");
\t\t\t\t};
\t\t\t});
\t\t}
\t\treturn { apply, inject: [] };
\t}
});
`;
fs.writeFileSync(path.join(root, 'lib/client.js'), output);
console.log('Built dsh-beautify client');
