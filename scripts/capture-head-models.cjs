"use strict";

const { app, BrowserWindow } = require("electron");
const fs = require("node:fs/promises");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const output = path.join(root, "output", "head-review");
const faces = { "face-full": 29, "face-temples": 23, "face-brows": 21, "face-glabella": 22, "face-nose": 25, "face-cheeks": 26, "face-upper-lip": 19, "face-beard": 27, "face-beard-line": 28, "face-chin": 20, "face-ears": 24, "face-neck": 30 };
const delay = (ms = 190) => new Promise(resolve => setTimeout(resolve, ms));
app.commandLine.appendSwitch("disable-gpu");
app.commandLine.appendSwitch("force-device-scale-factor", "1");

async function main() {
  await fs.mkdir(output, { recursive: true });
  const window = new BrowserWindow({ show: false, width: 1440, height: 1180, webPreferences: {
    contextIsolation: true, nodeIntegration: false, sandbox: true, offscreen: true,
    backgroundThrottling: false, partition: `head-models-${process.pid}-${Date.now()}`
  } });
  const report = { errors: [], models: [], pointer: [], mobile: [] };
  window.webContents.on("console-message", event => { if (event.level >= 2) report.errors.push(event.message); });
  const run = source => window.webContents.executeJavaScript(source);
  const click = async selector => {
    await run(`document.querySelector(${JSON.stringify(selector)}).dispatchEvent(new MouseEvent('click',{bubbles:true}))`);
    await delay();
  };
  const capture = async (name, selector) => {
    await run(`document.activeElement?.blur()`);
    await run(`window.scrollTo({top:0,behavior:'instant'});document.querySelector('#familyPanel').scrollTop=0;document.querySelector('#familyList').scrollTop=0;`);
    window.webContents.sendInputEvent({ type: "mouseMove", x: 1, y: 1 });
    await delay();
    await run(`window.scrollTo({top:0,behavior:'instant'});document.querySelector('#familyPanel').scrollTop=0;document.querySelector('#familyList').scrollTop=0;`);
    await delay(35);
    const bounds = await run(`(() => {const b=document.querySelector(${JSON.stringify(selector)}).getBoundingClientRect();return {x:Math.max(0,Math.floor(b.x)),y:Math.max(0,Math.floor(b.y)),width:Math.ceil(b.width),height:Math.min(Math.ceil(b.height),innerHeight-Math.max(0,Math.floor(b.y)))};})()`);
    if (bounds.height < 400) throw new Error(`Capture ${name} tronquée : ${JSON.stringify(bounds)}`);
    await fs.writeFile(path.join(output, name + ".png"), (await window.webContents.capturePage(bounds)).toPNG());
  };
  try {
    await window.loadFile(path.join(root, "devis-portable/index.html"));
    await run("document.fonts.ready");
    await run(`document.querySelector('#releaseNotesLayer:not([hidden]) [data-initial-focus]')?.click()`);
    await click("#settingsButton");
    await run(`const form=document.querySelector('#settingsForm');form.elements.catalogMode.value='body';form.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));`);
    for (const model of ["female", "male"]) {
      await click(`[data-body-model-choice="${model}"]`);
      await click('button[data-body-side="front"]');
      await click('[data-body-region="front-torse"]');
      const body = await run(`(() => {const head=document.querySelector('[data-head-model]'),shape=head.querySelector('.body-anonymous-head'),region=head.closest('[data-body-region]'),b=region.getBBox();return {model:head.dataset.headModel,outline:shape.getAttribute('d'),headCount:document.querySelectorAll('.body-anonymous-head').length,markup:region.outerHTML,viewBox:[b.x-12,b.y-12,b.width+24,b.height+24].join(' ')};})()`);
      await capture(`corps-${model}`, '.body-map-card');
      await click('[data-body-region="front-visage"]');
      const face = await run(`(() => {const svg=document.querySelector('.interactive-face-map');return {model:svg.dataset.bodyModel,outline:svg.querySelector('.face-anatomy-base:not(.face-anatomy-neck-base)').getAttribute('d'),markup:svg.outerHTML,title:document.querySelector('#faceMapTitle').textContent,regions:svg.querySelectorAll('[data-face-region]').length,modelButtons:document.querySelectorAll('[data-body-model-choice]').length};})()`);
      if (body.model !== model || body.headCount !== 1 || face.model !== model || face.regions !== 12 || face.modelButtons !== 2 || body.outline !== face.outline) throw new Error(`Modèle incohérent : ${model}`);
      report.models.push({ body, face });
      await capture(`visage-${model}`, '.body-map-card');
      for (const [id, expected] of Object.entries(faces)) {
        await run(`document.querySelector('[data-face-region="${id}"]').scrollIntoView({block:'center',behavior:'instant'})`);
        await delay();
        const point = await run(`(() => {const target=document.querySelector('[data-face-region="${id}"]');for(const shape of target.querySelectorAll('.face-region-shape,.face-region-stroke')){const b=shape.getBoundingClientRect();for(let iy=1;iy<20;iy++)for(let ix=1;ix<20;ix++){const x=Math.round(b.left+b.width*ix/20),y=Math.round(b.top+b.height*iy/20);if(document.elementFromPoint(x,y)?.closest('[data-face-region]')===target)return {x,y};}}return null;})()`);
        if (!point) throw new Error(`Zone faciale impossible à pointer : ${model}/${id}`);
        window.webContents.sendInputEvent({ type: "mouseMove", ...point });
        window.webContents.sendInputEvent({ type: "mouseDown", button: "left", clickCount: 1, ...point });
        window.webContents.sendInputEvent({ type: "mouseUp", button: "left", clickCount: 1, ...point });
        await delay(35);
        const selected = await run(`({model:document.querySelector('.interactive-face-map').dataset.bodyModel,region:document.querySelector('.face-region.active')?.dataset.faceRegion,ids:[...document.querySelectorAll('.body-service-options [data-family-service-id]')].map(e=>Number(e.dataset.familyServiceId))})`);
        report.pointer.push(selected);
        if (selected.model !== model || selected.region !== id || selected.ids.join(',') !== String(expected)) throw new Error(`Mauvaise sélection : ${JSON.stringify(selected)}`);
      }
      await click('[data-body-detail="body"]');
    }
    if (report.models[0].face.outline === report.models[1].face.outline) throw new Error("Les deux modèles utilisent encore le même visage");
    await click('[data-body-region="front-visage"]');
    await click('[data-face-choice="face-upper-lip"]');
    window.setContentSize(390, 1100);
    for (const model of ["female", "male"]) {
      await click(`[data-body-model-choice="${model}"]`);
      const mobile = await run(`(() => {const buttons=[...document.querySelectorAll('.body-map-card button')];return {model:document.querySelector('.interactive-face-map').dataset.bodyModel,region:document.querySelector('.face-region.active')?.dataset.faceRegion,ids:[...document.querySelectorAll('.body-service-options [data-family-service-id]')].map(e=>Number(e.dataset.familyServiceId)),small:buttons.filter(button=>{const b=button.getBoundingClientRect();return b.width<43.9||b.height<43.9;}).length,overflow:document.documentElement.scrollWidth>innerWidth+1};})()`);
      report.mobile.push(mobile);
      if (mobile.model !== model || mobile.region !== "face-upper-lip" || mobile.ids.join(',') !== "19" || mobile.small || mobile.overflow) throw new Error(`Vue mobile invalide : ${JSON.stringify(mobile)}`);
      await capture(`mobile-${model}`, '.body-map-card');
    }
    window.setContentSize(1100, 960);
    await run(`(() => {
      const models=${JSON.stringify(report.models)};const sprite=document.querySelector('.svg-sprite');
      const main=document.createElement('main');main.className='head-comparison';
      main.innerHTML='<h1>Têtes Femme / Homme</h1><p>Chaque tête du mannequin reprend le contour de son visage détaillé.</p><div class="head-comparison-grid">'+models.map(({body,face})=>'<section><h2>'+({'female':'Femme','male':'Homme'}[face.model])+'</h2><div class="head-comparison-head"><svg class="interactive-body-map" viewBox="'+body.viewBox+'">'+body.markup+'</svg></div><div class="head-comparison-face">'+face.markup+'</div></section>').join('')+'</div>';
      main.querySelectorAll('[id]').forEach(el=>el.removeAttribute('id'));
      const style=document.createElement('style');style.textContent='html,body{margin:0!important;overflow:hidden!important;background:#fff!important}.head-comparison{padding:24px;color:#29251e;font:14px Arial}.head-comparison h1{margin:0 0 8px;font-size:25px}.head-comparison p{margin:0 0 18px;color:#746d63}.head-comparison-grid{display:grid;grid-template-columns:1fr 1fr;gap:20px}.head-comparison section{padding:18px;border:1px solid #ded7cc;border-radius:14px;text-align:center}.head-comparison h2{margin:0 0 8px;font-size:20px}.head-comparison-head{height:150px}.head-comparison-head svg{margin:auto;width:110px;height:145px;max-width:none;animation:none}.head-comparison-face svg{width:100%;height:570px;max-width:none}.head-comparison .body-region-shape{fill:#e8e5df}.head-comparison .body-region-detail{stroke:#716b63;stroke-width:.8}';document.head.append(style);
      document.body.replaceChildren(sprite,main);
    })()`);
    await delay();
    await fs.writeFile(path.join(output, "comparaison-femme-homme.png"), (await window.webContents.capturePage()).toPNG());
    const summary = { ...report, models: report.models.map(({body,face})=>({model:face.model,headCount:body.headCount,matchingOutline:body.outline===face.outline,title:face.title,regions:face.regions})) };
    await fs.writeFile(path.join(output, "verification.json"), JSON.stringify(summary, null, 2));
    if (report.errors.length) throw new Error(JSON.stringify(report.errors));
    console.log(`HEAD_MODELS_VISUAL_OK ${output} — ${report.pointer.length} clics`);
  } catch (error) {
    await fs.writeFile(path.join(output, "failure.json"), JSON.stringify({error:error.message,...report},null,2));
    throw error;
  } finally { window.destroy(); }
}
app.whenReady().then(main).then(()=>app.quit()).catch(error=>{console.error(error);app.exit(1)});
