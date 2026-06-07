// ── Dashboard 2 – Interactive Film Poster Editor ──
const JSON_URL =
  "https://gist.githubusercontent.com/saniyusuf/406b843afdfb9c6a86e25753fe2761f4/raw/075b6aaba5ee43554ecd55006e5d080a8acf08fe/Film.JSON";

const MAX_POSTER_SIZE = 500;

let allFilms = [];
let currentPosterImg = null;
let originalPosterPixels = null;
let activeTool = "none";
let posterGraphics = null;
let canvasContainer;

let brushSize = 30;
let brushOpacity = 100;
let brushHardness = 100;
let isBlurColor = true;
let isNoiseColor = true;

let filterType = "invert";
let strokeSnapshot = null;       // snapshot for Filter AND all brush tools

let colorHue = 0, colorSat = 0, colorExp = 0, colorContrast = 0;
let colorBasePixels = null;

function setup() {
  canvasContainer = document.getElementById("canvas-container");
  const w = canvasContainer.clientWidth || 600;
  const h = canvasContainer.clientHeight || 500;
  const canvas = createCanvas(w, h);
  canvas.parent("canvas-container");
  pixelDensity(1);
  noLoop();
  drawPlaceholder();

  fetch(JSON_URL).then(r => r.json()).then(films => {
    allFilms = films;
    populateYearDropdown(films);
    renderFilmList(films);
    select("#yearSelect").changed(() => {
      const s = select("#yearSelect").value();
      renderFilmList(s === "all" ? films : films.filter(f => f.Year === s));
    });
  }).catch(e => console.error(e));

  select("#searchBtn").mousePressed(() => {
    const q = select("#searchInput").value().trim().toLowerCase();
    renderFilmList(q.length === 0 ? allFilms : allFilms.filter(f => f.Title.toLowerCase().includes(q)));
  });
  select("#searchInput").elt.addEventListener("keydown", e => { if (e.key === "Enter") select("#searchBtn").elt.click(); });

  document.querySelectorAll(".tool-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      const prev = activeTool;
      document.querySelectorAll(".tool-btn").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      activeTool = btn.dataset.tool;

      if (prev === "color" && activeTool !== "color") colorBasePixels = null;

      if (activeTool === "color" && posterGraphics) {
        colorBasePixels = getPosterImageData();
        colorHue = 0; colorSat = 0; colorExp = 0; colorContrast = 0;
        updateColorSliderUI();
        applyColorAdjustment();
      }
      strokeSnapshot = null;

      if (activeTool === "reset") {
        resetImage();
        activeTool = "none";
        document.querySelectorAll(".tool-btn").forEach(b => b.classList.remove("active"));
        document.querySelector('[data-tool="none"]')?.classList.add("active");
      }
      updateDynamicControls();
      redraw();
    });
  });

  setupSliders();
  updateDynamicControls();
}

function draw() {
  if (!currentPosterImg || !posterGraphics) { drawPlaceholder(); return; }
  background(20, 25, 35);
  const sf = min(width / posterGraphics.width, height / posterGraphics.height);
  const iw = posterGraphics.width * sf, ih = posterGraphics.height * sf;
  image(posterGraphics, (width - iw) / 2, (height - ih) / 2, iw, ih);
}

function drawPlaceholder() {
  background(20, 25, 35);
  fill(100); textAlign(CENTER, CENTER); textSize(14);
  text("Search a movie to load its poster", width / 2, height / 2);
}

function getPosterImageData() {
  if (!posterGraphics) return null;
  const tmp = document.createElement("canvas");
  tmp.width = posterGraphics.width;
  tmp.height = posterGraphics.height;
  const ctx = tmp.getContext("2d");
  ctx.drawImage(posterGraphics.elt, 0, 0);
  return ctx.getImageData(0, 0, tmp.width, tmp.height);
}

function writeImageDataToPoster(imgData) {
  if (!posterGraphics) return;
  const tmp = document.createElement("canvas");
  tmp.width = imgData.width;
  tmp.height = imgData.height;
  tmp.getContext("2d").putImageData(imgData, 0, 0);
  posterGraphics.drawingContext.clearRect(0, 0, posterGraphics.width, posterGraphics.height);
  posterGraphics.drawingContext.drawImage(tmp, 0, 0, posterGraphics.width, posterGraphics.height);
  posterGraphics._pInst._setProperty('drawingContext', posterGraphics.drawingContext);
}

function posterBounds() {
  if (!posterGraphics) return { x: 0, y: 0, w: 0, h: 0 };
  const sf = min(width / posterGraphics.width, height / posterGraphics.height);
  return {
    x: (width - posterGraphics.width * sf) / 2,
    y: (height - posterGraphics.height * sf) / 2,
    w: posterGraphics.width * sf,
    h: posterGraphics.height * sf
  };
}
function isMouseOnPoster() {
  if (!posterGraphics) return false;
  const b = posterBounds();
  return mouseX > b.x && mouseX < b.x + b.w && mouseY > b.y && mouseY < b.y + b.h;
}
function getLocalCoords() {
  const b = posterBounds();
  return {
    x: floor(map(mouseX - b.x, 0, b.w, 0, posterGraphics.width)),
    y: floor(map(mouseY - b.y, 0, b.h, 0, posterGraphics.height))
  };
}

// ── Mouse handlers ──
function mousePressed() {
  if (!isMouseOnPoster()) return;
  const loc = getLocalCoords();
  const snapshotTools = ["filter", "warp", "edges"];
  if (snapshotTools.includes(activeTool)) {
    strokeSnapshot = getPosterImageData();
  }
  if (activeTool === "filter") {
    strokeSnapshot = getPosterImageData();
    applyFilterBrush(loc.x, loc.y);
    redraw(); return;
  }
  if (activeTool !== "none" && activeTool !== "color") {
    applyBrushTool(activeTool, loc.x, loc.y);
    redraw();
  }
}

function mouseDragged() {
  if (activeTool === "color" || activeTool === "none" || activeTool === "reset") return;
  if (!isMouseOnPoster()) return;
  const loc = getLocalCoords();
  if (activeTool === "filter") applyFilterBrush(loc.x, loc.y);
  else applyBrushTool(activeTool, loc.x, loc.y);
  redraw();
  return false;
}

function mouseReleased() {
  strokeSnapshot = null;
}

function hardnessFactor(dist, r) {
  if (brushHardness >= 100) return 1;
  const h = brushHardness / 100, t = dist / r;
  if (t <= h) return 1; if (t >= 1) return 0;
  return 1 - (t - h) / (1 - h);
}

// ── applyBrushTool ──
function applyBrushTool(tool, cx, cy) {
  const imgData = getPosterImageData();
  if (!imgData) return;
  const px = imgData.data;
  const orig = new Uint8ClampedArray(px);
  const r = brushSize, w = posterGraphics.width, h = posterGraphics.height;
  switch (tool) {
    case "blur": applyBlurBrush(px, orig, cx, cy, r, w, h); break;
    case "pixelate": applyPixelateBrush(px, cx, cy, r, w, h); break;
    case "glitch": applyGlitchBrush(px, cx, cy, r, w, h); break;
    case "noise": applyNoiseBrush(px, orig, cx, cy, r, w, h); break;
    case "edges": applyEdgesBrush(px, cx, cy, r, w, h); break;
    case "warp": applyWarpBrush(px, cx, cy, r, w, h); break;
    case "erase": applyEraseBrush(px, cx, cy, r, w, h); break;
  }
  writeImageDataToPoster(imgData);
}

// ── Blur ──
function applyBlurBrush(px, orig, cx, cy, r, w, h) {
  const ks = max(2, floor(r / 4));
  for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
    const dist = sqrt(dx*dx+dy*dy); if (dist > r) continue;
    const tx=cx+dx, ty=cy+dy; if (tx<0||tx>=w||ty<0||ty>=h) continue;
    const hf=hardnessFactor(dist,r); if (hf<=0) continue;
    let sr=0,sg=0,sb=0,c=0;
    for (let ky=-ks; ky<=ks; ky++) for (let kx=-ks; kx<=ks; kx++) {
      const si=4*(constrain(ty+ky,0,h-1)*w+constrain(tx+kx,0,w-1));
      sr+=orig[si]; sg+=orig[si+1]; sb+=orig[si+2]; c++;
    }
    let ar=sr/c, ag=sg/c, ab=sb/c;
    if(!isBlurColor){const g=0.299*ar+0.587*ag+0.114*ab; ar=ag=ab=g;}
    const di=4*(ty*w+tx), a=(brushOpacity/100)*hf;
    px[di]=orig[di]*(1-a)+ar*a; px[di+1]=orig[di+1]*(1-a)+ag*a; px[di+2]=orig[di+2]*(1-a)+ab*a;
  }
}

// ── Pixelate ──
function applyPixelateBrush(px, cx, cy, r, w, h) {
  const bs=max(3,floor(r/5));
  for (let y=max(cy-r,0); y<min(cy+r,h); y+=bs) for (let x=max(cx-r,0); x<min(cx+r,w); x+=bs) {
    const dist=sqrt((x+bs/2-cx)**2+(y+bs/2-cy)**2); if(dist>r) continue;
    const hf=hardnessFactor(dist,r); if(hf<=0) continue;
    let sr=0,sg=0,sb=0,c=0;
    for (let dy=0; dy<bs; dy++) for (let dx=0; dx<bs; dx++) {
      const si=4*(constrain(y+dy,0,h-1)*w+constrain(x+dx,0,w-1));
      sr+=px[si]; sg+=px[si+1]; sb+=px[si+2]; c++;
    }
    const ar=sr/c, ag=sg/c, ab=sb/c, a=(brushOpacity/100)*hf;
    for (let dy=0; dy<bs; dy++) for (let dx=0; dx<bs; dx++) {
      const si=4*(constrain(y+dy,0,h-1)*w+constrain(x+dx,0,w-1));
      px[si]=px[si]*(1-a)+ar*a; px[si+1]=px[si+1]*(1-a)+ag*a; px[si+2]=px[si+2]*(1-a)+ab*a;
    }
  }
}

// ── Glitch (from snapshot, no compounding) ──
function applyGlitchBrush(px, cx, cy, r, w, h) {
  const shift=max(2,floor(r/8));
  for (let dy=-r; dy<=r; dy++) for (let dx=-r; dx<=r; dx++) {
    const dist=sqrt(dx*dx+dy*dy); if(dist>r) continue;
    const tx=cx+dx, ty=cy+dy; if(tx<0||tx>=w||ty<0||ty>=h) continue;
    const hf=hardnessFactor(dist,r); if(hf<=0) continue;
    const di=4*(ty*w+tx), ri=4*(ty*w+constrain(tx-shift,0,w-1)), bi=4*(ty*w+constrain(tx+shift,0,w-1));
    const a=(brushOpacity/100)*hf;
    px[di]=px[di]*(1-a)+px[ri]*a;
    px[di+2]=px[di+2]*(1-a)+px[bi+2]*a;
  }
}

// ── Noise ──
function applyNoiseBrush(px, orig, cx, cy, r, w, h) {
  const half=max(1,floor(r/2));
  for (let dy=-r; dy<=r; dy++) for (let dx=-r; dx<=r; dx++) {
    const dist=sqrt(dx*dx+dy*dy); if(dist>r) continue;
    const tx=cx+dx, ty=cy+dy; if(tx<0||tx>=w||ty<0||ty>=h) continue;
    const hf=hardnessFactor(dist,r); if(hf<=0) continue;
    const sx=constrain(tx+floor((random()*2-1)*half),0,w-1), sy=constrain(ty+floor((random()*2-1)*half),0,h-1);
    const si=4*(sy*w+sx); let rv=orig[si], gv=orig[si+1], bv=orig[si+2];
    if(!isNoiseColor){const gy=0.299*rv+0.587*gv+0.114*bv; rv=gv=bv=gy;}
    const di=4*(ty*w+tx), a=(brushOpacity/100)*hf;
    px[di]=orig[di]*(1-a)+rv*a; px[di+1]=orig[di+1]*(1-a)+gv*a; px[di+2]=orig[di+2]*(1-a)+bv*a;
  }
}

// ── Edges ──
function applyEdgesBrush(px, cx, cy, r, w, h) {
  // Use frozen snapshot as source, live poster (px) as destination
  const copy = strokeSnapshot ? strokeSnapshot.data : new Uint8ClampedArray(px);
  for (let dy = -r + 1; dy <= r - 1; dy++) for (let dx = -r + 1; dx <= r - 1; dx++) {
    const dist = sqrt(dx*dx + dy*dy); if (dist > r) continue;
    const tx = cx + dx, ty = cy + dy; if (tx < 1 || tx >= w-1 || ty < 1 || ty >= h-1) continue;
    const t = 4*((ty-1)*w+tx), l = 4*(ty*w+(tx-1)), b = 4*((ty+1)*w+tx), rt = 4*(ty*w+(tx+1));
    const gx = copy[rt] - copy[l], gy = copy[b] - copy[t];
    const mag = constrain(sqrt(gx*gx + gy*gy), 0, 255);
    const di = 4*(ty*w+tx);
    px[di] = mag;
    px[di+1] = mag;
    px[di+2] = mag;
  }
}

// ── Warp ──
function applyWarpBrush(px, cx, cy, r, w, h) {
  // Use frozen snapshot as source, live poster (px) as destination
  const copy = strokeSnapshot ? strokeSnapshot.data : new Uint8ClampedArray(px);
  const strength = 15;
  for (let dy=-r; dy<=r; dy++) for (let dx=-r; dx<=r; dx++) {
    const dist=sqrt(dx*dx+dy*dy); if(dist>r||dist===0) continue;
    const tx=cx+dx, ty=cy+dy; if(tx<0||tx>=w||ty<0||ty>=h) continue;
    const angle=atan2(dy,dx)+(strength/dist)*2;
    const sx=constrain(floor(cx+cos(angle)*dist),0,w-1), sy=constrain(floor(cy+sin(angle)*dist),0,h-1);
    const si=4*(sy*w+sx), di=4*(ty*w+tx), a=(brushOpacity/100)*1;
    px[di]=px[di]*(1-a)+copy[si]*a;
    px[di+1]=px[di+1]*(1-a)+copy[si+1]*a;
    px[di+2]=px[di+2]*(1-a)+copy[si+2]*a;
  }
}

// ── Erase ──
function applyEraseBrush(px, cx, cy, r, w, h) {
  if(!originalPosterPixels) return;
  const orig=originalPosterPixels.data;
  for (let dy=-r; dy<=r; dy++) for (let dx=-r; dx<=r; dx++) {
    const dist=sqrt(dx*dx+dy*dy); if(dist>r) continue;
    const tx=cx+dx, ty=cy+dy; if(tx<0||tx>=w||ty<0||ty>=h) continue;
    const hf=hardnessFactor(dist,r); if(hf<=0) continue;
    const i=4*(ty*w+tx), a=(brushOpacity/100)*hf;
    px[i]=px[i]*(1-a)+orig[i]*a; px[i+1]=px[i+1]*(1-a)+orig[i+1]*a; px[i+2]=px[i+2]*(1-a)+orig[i+2]*a;
  }
}

// ── Filter brush ──
function applyFilterBrush(cx, cy) {
  if(!strokeSnapshot) return;
  const imgData = getPosterImageData(); if(!imgData) return;
  const px = imgData.data, src = strokeSnapshot.data, r = brushSize, w = posterGraphics.width, h = posterGraphics.height;
  for (let dy=-r; dy<=r; dy++) for (let dx=-r; dx<=r; dx++) {
    const dist=sqrt(dx*dx+dy*dy); if(dist>r) continue;
    const tx=cx+dx, ty=cy+dy; if(tx<0||tx>=w||ty<0||ty>=h) continue;
    const si=4*(ty*w+tx); let fr=src[si], fg=src[si+1], fb=src[si+2];
    if(filterType==="invert"){fr=255-fr; fg=255-fg; fb=255-fb;}
    else if(filterType==="sepia"){
      fr=min(255,fr*0.393+fg*0.769+fb*0.189); fg=min(255,fr*0.349+fg*0.686+fb*0.168); fb=min(255,fr*0.272+fg*0.534+fb*0.131);
    } else if(filterType==="bw"){const gy=0.299*fr+0.587*fg+0.114*fb; fr=fg=fb=gy;}
    px[si]=fr; px[si+1]=fg; px[si+2]=fb;
  }
  writeImageDataToPoster(imgData);
}

// ── Color adjustment ──
function applyColorAdjustment() {
  if(!colorBasePixels||!posterGraphics) return;
  const src=colorBasePixels.data, dst=new Uint8ClampedArray(src);
  const hs=colorHue, sm=1+colorSat/100, em=1+colorExp/100; let cf=(100+colorContrast)/100; cf*=cf;
  for(let i=0;i<src.length;i+=4){
    let r=src[i]/255,g=src[i+1]/255,b=src[i+2]/255;
    if(hs!==0){const hsl=rgbToHsl(r,g,b); hsl.h=((hsl.h+hs/360)%1+1)%1; const rgb=hslToRgb(hsl.h,hsl.s,hsl.l); r=rgb.r;g=rgb.g;b=rgb.b;}
    if(colorSat!==0){const hsl=rgbToHsl(r,g,b); hsl.s=constrain(hsl.s*sm,0,1); const rgb=hslToRgb(hsl.h,hsl.s,hsl.l); r=rgb.r;g=rgb.g;b=rgb.b;}
    if(colorExp!==0){const hsl=rgbToHsl(r,g,b); hsl.l=constrain(hsl.l*em,0,1); const rgb=hslToRgb(hsl.h,hsl.s,hsl.l); r=rgb.r;g=rgb.g;b=rgb.b;}
    if(colorContrast!==0){const hsl=rgbToHsl(r,g,b); hsl.l=constrain((hsl.l-.5)*cf+.5,0,1); const rgb=hslToRgb(hsl.h,hsl.s,hsl.l); r=rgb.r;g=rgb.g;b=rgb.b;}
    dst[i]=Math.round(r*255); dst[i+1]=Math.round(g*255); dst[i+2]=Math.round(b*255);
  }
  writeImageDataToPoster(new ImageData(dst, posterGraphics.width, posterGraphics.height));
  redraw();
}

function rgbToHsl(r,g,b){
  const mx=Math.max(r,g,b),mn=Math.min(r,g,b); let h=0,s=0,l=(mx+mn)/2;
  if(mx!==mn){const d=mx-mn; s=l>.5?d/(2-mx-mn):d/(mx+mn); switch(mx){case r:h=((g-b)/d+(g<b?6:0))/6;break;case g:h=((b-r)/d+2)/6;break;case b:h=((r-g)/d+4)/6;break;}}
  return{h,s,l};
}
function hslToRgb(h,s,l){
  if(s===0)return{r:l,g:l,b:l};
  const q=l<.5?l*(1+s):l+s-l*s, p=2*l-q;
  const h2=(p,q,t)=>{if(t<0)t+=1;if(t>1)t-=1;if(t<1/6)return p+(q-p)*6*t;if(t<.5)return q;if(t<2/3)return p+(q-p)*(2/3-t)*6;return p;};
  return{r:h2(p,q,h+1/3),g:h2(p,q,h),b:h2(p,q,h-1/3)};
}

function setupSliders(){
  document.getElementById("brushSizeSlider")?.addEventListener("input",function(){brushSize=parseInt(this.value);document.getElementById("sizeVal").textContent=brushSize;});
  document.getElementById("brushOpacitySlider")?.addEventListener("input",function(){brushOpacity=parseInt(this.value);document.getElementById("opacityVal").textContent=brushOpacity;});
  document.getElementById("brushHardnessSlider")?.addEventListener("input",function(){brushHardness=parseInt(this.value);document.getElementById("hardnessVal").textContent=brushHardness;});
  document.getElementById("hueSlider")?.addEventListener("input",function(){colorHue=parseInt(this.value);updateColorSliderUI();applyColorAdjustment();});
  document.getElementById("satSlider")?.addEventListener("input",function(){colorSat=parseInt(this.value);updateColorSliderUI();applyColorAdjustment();});
  document.getElementById("expSlider")?.addEventListener("input",function(){colorExp=parseInt(this.value);updateColorSliderUI();applyColorAdjustment();});
  document.getElementById("contrastSlider")?.addEventListener("input",function(){colorContrast=parseInt(this.value);updateColorSliderUI();applyColorAdjustment();});
  document.querySelectorAll('input[name="filterType"]').forEach(r=>r.addEventListener("change",function(){if(this.checked)filterType=this.value;}));
}
function updateColorSliderUI(){
  document.getElementById("hueVal")&&(document.getElementById("hueVal").textContent=colorHue);
  document.getElementById("satVal")&&(document.getElementById("satVal").textContent=colorSat);
  document.getElementById("expVal")&&(document.getElementById("expVal").textContent=colorExp);
  document.getElementById("contrastVal")&&(document.getElementById("contrastVal").textContent=colorContrast);
}
function updateDynamicControls(){
  const bs=document.getElementById("brushSliders"),cs=document.getElementById("colorSliders"),
        fo=document.getElementById("filterOptions"),bt=document.getElementById("blurToggle"),
        nt=document.getElementById("noiseToggle"),ol=document.getElementById("opacityLabel"),
        hl=document.getElementById("hardnessLabel");
  if(bs)bs.style.display="none"; if(cs)cs.style.display="none"; if(fo)fo.style.display="none";
  if(bt)bt.style.display="none"; if(nt)nt.style.display="none";
  switch(activeTool){
    case"color":if(cs)cs.style.display="flex";break;
    case"filter":if(fo)fo.style.display="flex";if(bs)bs.style.display="flex";if(ol)ol.style.display="none";if(hl)hl.style.display="none";break;
    case"blur":if(bs)bs.style.display="flex";if(bt)bt.style.display="flex";if(ol)ol.style.display="flex";if(hl)hl.style.display="flex";break;
    case"noise":if(bs)bs.style.display="flex";if(nt)nt.style.display="flex";if(ol)ol.style.display="flex";if(hl)hl.style.display="flex";break;
    case"none":case"reset":break;
    default:if(bs)bs.style.display="flex";if(ol)ol.style.display="flex";if(hl)hl.style.display="flex";break;
  }
}
function resetImage(){
  if(!originalPosterPixels||!posterGraphics)return;
  writeImageDataToPoster(new ImageData(new Uint8ClampedArray(originalPosterPixels.data),posterGraphics.width,posterGraphics.height));
  colorBasePixels=null; colorHue=0;colorSat=0;colorExp=0;colorContrast=0; updateColorSliderUI(); redraw();
}

function populateYearDropdown(films){
  const sel=select("#yearSelect");
  [...new Set(films.map(f=>f.Year))].sort().forEach(y=>{const o=createElement("option",y);o.attribute("value",y);o.parent(sel);});
}
function renderFilmList(films){
  const grid=select("#film-grid");grid.html("");
  if(!films.length){const m=createElement("p","No films found.");m.class("no-results");m.parent(grid);return;}
  films.forEach(f=>{
    const card=createElement("div");card.class("film-card");
    const img=createElement("img");img.attribute("src",f.Poster&&f.Poster!=="N/A"?f.Poster:"https://via.placeholder.com/40x60?text=?");img.parent(card);
    const info=createElement("div");info.class("film-info");
    createElement("h4",f.Title).parent(info); createElement("p",`📅 ${f.Year}`).parent(info);
    const r=createElement("p",`⭐ ${f.imdbRating}`);r.class("rating");r.parent(info);
    info.parent(card); card.mousePressed(()=>loadPoster(f,card)); card.parent(grid);
  });
}

function loadPoster(film, cardElement){
  if(cardElement?.elt){document.querySelectorAll(".film-card").forEach(c=>c.classList.remove("selected"));cardElement.elt.classList.add("selected");}
  document.getElementById("loading")?.classList.add("visible");
  const url=film.Poster&&film.Poster!=="N/A"?film.Poster:"";
  if(!url){loadPlaceholderPoster();return;}

  const nativeImg = new Image();
  nativeImg.crossOrigin = "anonymous";
  nativeImg.onload = function() {
    document.getElementById("loading")?.classList.remove("visible");
    let pw=nativeImg.width, ph=nativeImg.height;
    const maxDim=max(pw,ph);
    if(maxDim>MAX_POSTER_SIZE){const s=MAX_POSTER_SIZE/maxDim; pw=floor(pw*s); ph=floor(ph*s);}
    posterGraphics=createGraphics(pw,ph); posterGraphics.pixelDensity(1);
    posterGraphics.drawingContext.drawImage(nativeImg,0,0,pw,ph);
    currentPosterImg=nativeImg;
    originalPosterPixels=getPosterImageData();
    colorHue=0;colorSat=0;colorExp=0;colorContrast=0;colorBasePixels=null;strokeSnapshot=null;
    updateColorSliderUI();updateDynamicControls(); activeTool="none";
    document.querySelectorAll(".tool-btn").forEach(b=>b.classList.remove("active"));
    document.querySelector('[data-tool="none"]')?.classList.add("active"); redraw();
  };
  nativeImg.onerror = function() {
    document.getElementById("loading")?.classList.remove("visible");
    // Try without CORS as fallback (may taint, but we handle that)
    const fb=new Image();
    fb.onload=function(){
      let pw=fb.width, ph=fb.height;
      const maxDim=max(pw,ph);
      if(maxDim>MAX_POSTER_SIZE){const s=MAX_POSTER_SIZE/maxDim; pw=floor(pw*s); ph=floor(ph*s);}
      posterGraphics=createGraphics(pw,ph); posterGraphics.pixelDensity(1);
      posterGraphics.drawingContext.drawImage(fb,0,0,pw,ph);
      currentPosterImg=fb;
      try{originalPosterPixels=getPosterImageData();}catch(e){originalPosterPixels=null;}
      colorHue=0;colorSat=0;colorExp=0;colorContrast=0;colorBasePixels=null;strokeSnapshot=null;
      updateColorSliderUI();updateDynamicControls(); activeTool="none";
      document.querySelectorAll(".tool-btn").forEach(b=>b.classList.remove("active"));
      document.querySelector('[data-tool="none"]')?.classList.add("active"); redraw();
    };
    fb.onerror=function(){loadPlaceholderPoster();};
    fb.src=url;
  };
  nativeImg.src = url;
}

function loadPlaceholderPoster(){
  document.getElementById("loading")?.classList.remove("visible");
  posterGraphics=createGraphics(300,450); posterGraphics.pixelDensity(1);
  posterGraphics.drawingContext.fillStyle="#333";
  posterGraphics.drawingContext.fillRect(0,0,300,450);
  posterGraphics.drawingContext.fillStyle="#888";
  posterGraphics.drawingContext.font="18px Arial";
  posterGraphics.drawingContext.textAlign="center";
  posterGraphics.drawingContext.fillText("No Poster",150,225);
  const dummyImg=new Image();
  dummyImg.src="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";
  dummyImg.onload=function(){currentPosterImg=dummyImg;};
  currentPosterImg=dummyImg;
  originalPosterPixels=getPosterImageData();
  colorHue=0;colorSat=0;colorExp=0;colorContrast=0;colorBasePixels=null;strokeSnapshot=null;
  updateColorSliderUI();updateDynamicControls(); activeTool="none";
  document.querySelectorAll(".tool-btn").forEach(b=>b.classList.remove("active"));
  document.querySelector('[data-tool="none"]')?.classList.add("active"); redraw();
}

function windowResized(){
  if(canvasContainer){resizeCanvas(canvasContainer.clientWidth||width,canvasContainer.clientHeight||height);redraw();}
}
