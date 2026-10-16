"use strict";

const { app, BrowserWindow } = require("electron");
const fs = require("node:fs/promises");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const pass = String(process.argv[2] || "after").replace(/[^a-z0-9-]/gi, "-");
const output = path.join(root, "output", "body-map-review", pass);
const delay = (ms = 180) => new Promise((resolve) => setTimeout(resolve, ms));
app.commandLine.appendSwitch("disable-gpu");
app.commandLine.appendSwitch("force-device-scale-factor", "1");

async function main() {
  await fs.mkdir(output, { recursive: true });
  const window = new BrowserWindow({ show: false, width: 1440, height: 1100, webPreferences: {
    contextIsolation: true, nodeIntegration: false, sandbox: true, offscreen: true,
    backgroundThrottling: false, partition: `body-refinement-${process.pid}-${Date.now()}`
  } });
  const errors = [];
  window.webContents.on("console-message", (event) => { if (event.level >= 2) errors.push(event.message); });
  const run = (source) => window.webContents.executeJavaScript(source);
  const click = async (selector) => {
    await run(`document.querySelector(${JSON.stringify(selector)}).dispatchEvent(new MouseEvent('click',{bubbles:true}))`);
    await delay(30);
  };
  const capture = async (name, selector = ".body-selector-layout") => {
    await delay();
    const bounds = await run(`(() => { const b=document.querySelector(${JSON.stringify(selector)}).getBoundingClientRect(); return {x:Math.max(0,Math.floor(b.x)),y:Math.max(0,Math.floor(b.y)),width:Math.ceil(b.width),height:Math.min(Math.ceil(b.height),innerHeight-Math.max(0,Math.floor(b.y)))}; })()`);
    await fs.writeFile(path.join(output, name + ".png"), (await window.webContents.capturePage(bounds)).toPNG());
  };
  const auditTouch = (view) => run(`(() => {
    const buttons=[...document.querySelectorAll('.body-map-card button')];
    const small=buttons.filter(button=>{const b=button.getBoundingClientRect();return b.width<43.9||b.height<43.9;}).map(button=>button.textContent.trim());
    const overlapping=[];
    buttons.forEach((a,i)=>buttons.slice(i+1).forEach(b=>{const x=a.getBoundingClientRect(),y=b.getBoundingClientRect();if(Math.min(x.right,y.right)-Math.max(x.left,y.left)>1&&Math.min(x.bottom,y.bottom)-Math.max(x.top,y.top)>1)overlapping.push([a.textContent.trim(),b.textContent.trim()]);}));
    return {width:innerWidth,view:'${view}',buttons:buttons.length,small,overlapping,overflow:document.documentElement.scrollWidth>innerWidth+1};
  })()`);
  const report = { errors, views: [], anatomy: [], pointer: [], touch: [], themes: [] };
  try {
    await window.loadFile(path.join(root, "devis-portable", "index.html"));
    await run("document.fonts.ready");
    await run(`document.querySelector('#releaseNotesLayer:not([hidden]) [data-initial-focus]')?.click()`);
    await click("#settingsButton");
    await run(`const f=document.querySelector('#settingsForm'); f.elements.catalogMode.value='body'; f.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));`);
    for (const model of ["male", "female"]) {
      await click(`[data-body-model-choice="${model}"]`);
      for (const side of ["front", "back"]) {
        await click(`button[data-body-side="${side}"]`);
        report.anatomy.push(await run(`(() => { const g=window.BCDEVIS_BODY_ANATOMY.${model}.${side}; const svg=document.querySelector('.interactive-body-map'); const ns='http://www.w3.org/2000/svg'; return {model:'${model}',side:'${side}',regions:Object.fromEntries(Object.entries(g.regions).map(([key,segments])=>[key,Object.fromEntries(Object.entries(segments).map(([slug,paths])=>{const p=document.createElementNS(ns,'g');for(const d of paths){const part=document.createElementNS(ns,'path');part.setAttribute('d',d);p.append(part);}svg.append(p);const b=p.getBBox();p.remove();return [slug,{x:b.x,y:b.y,width:b.width,height:b.height}];}))]))}; })()`));
        const ids = side === "front" ? ["front-torse", "front-bras", "front-maillot", "front-jambes"] : ["back-dos", "back-bras", "back-jambes", "back-sif"];
        for (const region of ids) {
          await click(`[data-body-region="${region}"]`);
          await capture(`${model}-${region}`);
          report.views.push(await run(`(() => { const map=document.querySelector('.interactive-body-map'); return {model:'${model}',region:'${region}',title:document.querySelector('.body-results').dataset.bodyResultsTitle,zones:document.querySelectorAll('.body-zone-trail button').length,overflow:document.documentElement.scrollWidth>innerWidth+1}; })()`));
        }
        const zones = await run(`window.QUOTE_BODY_ZONES.filter(zone=>zone.regionId.startsWith('${side}-')).map(zone=>({id:zone.id,serviceIds:zone.serviceIds}))`);
        for (const zone of zones) {
          await run(`document.querySelector('svg [data-body-zone="${zone.id}"]').scrollIntoView({block:'center',inline:'nearest',behavior:'instant'})`);
          await delay(190);
          const point = await run(`(() => {
            const target=document.querySelector('svg [data-body-zone="${zone.id}"]');
            const shapes=[...target.querySelectorAll('.body-region-shape')].sort((a,b)=>{const x=a.getBBox(),y=b.getBBox();return y.width*y.height-x.width*x.height;});
            for(const shape of shapes){const b=shape.getBoundingClientRect();for(let iy=1;iy<9;iy++)for(let ix=1;ix<9;ix++){const x=Math.round(b.left+b.width*ix/9),y=Math.round(b.top+b.height*iy/9);if(document.elementFromPoint(x,y)?.closest('[data-body-zone]')===target)return {x,y};}}
            return null;
          })()`);
          if (!point) throw new Error(`Sous-zone impossible à pointer : ${model}/${zone.id}`);
          window.webContents.sendInputEvent({ type: "mouseMove", ...point });
          window.webContents.sendInputEvent({ type: "mouseDown", button: "left", clickCount: 1, ...point });
          window.webContents.sendInputEvent({ type: "mouseUp", button: "left", clickCount: 1, ...point });
          await delay(35);
          const result = await run(`(() => {
            const map=document.querySelector('.interactive-body-map');const v=map.viewBox.baseVal;
            const invalidLocators=[...document.querySelectorAll('.zone-locator-zone')].filter(zone=>{const b=zone.getBBox();return b.x<v.x-2||b.y<v.y-2||b.x+b.width>v.x+v.width+2||b.y+b.height>v.y+v.height+2;}).length;
            return {model:'${model}',zone:'${zone.id}',active:document.querySelector('svg .body-zone.active')?.dataset.bodyZone,ids:[...document.querySelectorAll('.body-service-options [data-family-service-id]')].map(e=>Number(e.dataset.familyServiceId)),invalidLocators};
          })()`);
          report.pointer.push(result);
          if (result.active !== zone.id || result.ids.join(',') !== zone.serviceIds.join(',') || result.invalidLocators) throw new Error(`Sélection invalide : ${JSON.stringify(result)}`);
        }
      }
    }
    await click('button[data-body-side="front"]');
    await click('[data-body-region="front-visage"]');
    for (const face of ["face-upper-lip", "face-beard", "face-neck"]) {
      await click(`[data-face-region="${face}"]`);
      await capture(face);
    }
    await click('[data-body-detail="body"]');
    for (const theme of ["white", "light", "night", "forest", "bordeaux"]) {
      await run(`document.documentElement.dataset.theme='${theme}'`);
      await click('svg [data-body-zone="front-bras-aisselles"]');
      if (await run(`!document.querySelector('svg [data-body-zone="front-bras-aisselles"]').classList.contains('active')`)) await click('svg [data-body-zone="front-bras-aisselles"]');
      await capture('aisselles-' + theme);
      report.themes.push(await run(`(() => {const active=getComputedStyle(document.querySelector('.body-zone.active .body-region-shape')),neutral=getComputedStyle(document.querySelector('[data-body-zone="front-jambes-cuisses"] .body-region-shape'));return {theme:'${theme}',activeFill:active.fill,neutralFill:neutral.fill,neutralStroke:neutral.stroke};})()`));
    }
    await run(`document.documentElement.dataset.theme='white'`);
    await click('[data-body-region="front-visage"]');
    for (const width of [1440, 768, 390]) {
      window.setContentSize(width, 1100);
      await delay();
      const faceTouch = await auditTouch('face');
      report.touch.push(faceTouch);
      await click('[data-face-choice="face-upper-lip"]');
      await delay();
      const focused = await run(`({selected:document.querySelector('[data-face-choice="face-upper-lip"]').getAttribute('aria-pressed'),focus:document.activeElement.dataset.faceChoice,ids:[...document.querySelectorAll('.body-service-options [data-family-service-id]')].map(e=>Number(e.dataset.familyServiceId))})`);
      if (focused.selected !== "true" || focused.focus !== "face-upper-lip" || focused.ids.join(',') !== "19") throw new Error(`Pastille faciale invalide : ${JSON.stringify(focused)}`);
      if (width === 390) await capture('mobile-visage', '.body-map-card');
      await click('[data-body-detail="body"]');
      await click('[data-body-region="front-bras"]');
      report.touch.push(await auditTouch('body'));
      if (width === 390) await capture('mobile-corps', '.body-map-card');
      await click('[data-body-region="front-visage"]');
    }
    await fs.writeFile(path.join(output, "verification.json"), JSON.stringify(report, null, 2));
    const invalidViews = [...report.views, ...report.touch].filter(view=>view.overflow || view.small?.length || view.overlapping?.length);
    if (errors.length || invalidViews.length) throw new Error(JSON.stringify({errors, invalidViews}));
    console.log(`BODY_REFINEMENT_VISUAL_OK ${output}`);
  } catch (error) {
    await fs.writeFile(path.join(output, "failure.json"), JSON.stringify({message:error.message, ...report}, null, 2));
    throw error;
  } finally { window.destroy(); }
}
app.whenReady().then(main).then(() => app.quit()).catch((error) => { console.error(error); app.exit(1); });
