/* engine.js — ゲーム状態・落下/回転/消去の仕組みと盤面描画、テーマ */
/* ============================================================
   ゲーム状態
   ============================================================ */
var mode = "free"; // free | train | skill
var selectedTpl = TEMPLATES[0];
var G = null;

function emptyGrid(){ var g=[]; for(var y=0;y<ROWS;y++){ g.push(new Array(COLS).fill(null)); } return g; }
function newBag(){
  var b=["I","O","T","S","Z","J","L"];
  for(var i=b.length-1;i>0;i--){ var j=Math.floor(Math.random()*(i+1)); var t=b[i]; b[i]=b[j]; b[j]=t; }
  return b;
}
function gravityMs(level){
  var sec = Math.pow(0.8 - (level-1)*0.007, level-1);
  return Math.max(8, sec*1000);
}

function makeGame(opts){
  return {
    grid: emptyGrid(),
    queue: opts.queue ? opts.queue.slice() : [],
    bag: [],
    hold: null, canHold: true, holdUses: 0,
    cur: null, dropAcc: 0, lockAcc: 0, lockResets: 0, grounded: false,
    lastRotate: false, lastKickIdx: 0,
    score: 0, lines: 0, level: 1, pieces: 0, combo: -1, maxCombo: 0, b2b: false,
    startTime: null, elapsed: 0, running: false, paused: false, over: false, finished: false,
    fixedQueue: !!opts.queue, noClear: !!opts.noClear, target: opts.target || null,
    placedKeys: [], startStamp: 0, endStamp: 0
  };
}
function nextType(g){
  if(g.fixedQueue){ return g.queue.length ? g.queue.shift() : null; }
  if(g.queue.length < 7){ g.bag = newBag(); for(var i=0;i<g.bag.length;i++) g.queue.push(g.bag[i]); }
  return g.queue.shift();
}
function peekQueue(g,n){
  var out = g.queue.slice(0,n);
  if(!g.fixedQueue){
    var tmp = g.queue.slice(); var bag = g.bag;
    while(out.length < n){ bag = newBag(); for(var i=0;i<bag.length;i++){ tmp.push(bag[i]); } out = tmp.slice(0,n); break; }
  }
  return out;
}
function cellsOf(type, rot, ox, oy){
  return SHAPES[type][rot].map(function(c){ return [ox+c[0], oy+c[1]]; });
}
function collide(g, type, rot, ox, oy){
  var cs = cellsOf(type, rot, ox, oy);
  for(var i=0;i<cs.length;i++){
    var x=cs[i][0], y=cs[i][1];
    if(x<0 || x>=COLS || y>=ROWS) return true;
    if(y>=0 && g.grid[y][x]) return true;
  }
  return false;
}
function spawn(g){
  var t = nextType(g);
  if(!t){ finishTrain(); return; }
  var p = { type:t, rot:0, x: t==="O" ? 3 : 3, y: HIDDEN-2 };
  if(t==="I") p.y = HIDDEN-2;
  if(collide(g, p.type, p.rot, p.x, p.y)){
    p.y -= 1;
    if(collide(g, p.type, p.rot, p.x, p.y)){ gameOver(); return; }
  }
  g.cur = p; g.canHold = true; g.lockAcc = 0; g.lockResets = 0; g.dropAcc = 0; g.lastRotate = false;
  if(!g.startTime && g.running){ g.startTime = performance.now(); g.startStamp = g.startTime; }
}
function ghostY(g){
  if(!g.cur) return 0;
  var y = g.cur.y;
  while(!collide(g, g.cur.type, g.cur.rot, g.cur.x, y+1)) y++;
  return y;
}
function tryMove(g, dx){
  if(!g.cur || g.paused || g.over || g.finished) return false;
  if(!collide(g, g.cur.type, g.cur.rot, g.cur.x+dx, g.cur.y)){
    g.cur.x += dx; g.lastRotate = false; onSuccessfulShift(g); return true;
  }
  return false;
}
function onSuccessfulShift(g){
  if(g.grounded && g.lockResets < 15){ g.lockAcc = 0; g.lockResets++; }
}
function tryRotate(g, dir){
  if(!g.cur || g.paused || g.over || g.finished) return;
  var from = g.cur.rot, to = (from + dir + 4) % 4;
  if(g.cur.type === "O"){ g.cur.rot = to; g.lastRotate = true; return; }
  var table = g.cur.type === "I" ? KICK_I : KICK_JLSTZ;
  var kicks = table[from+">"+to] || [[0,0]];
  for(var i=0;i<kicks.length;i++){
    var nx = g.cur.x + kicks[i][0], ny = g.cur.y + kicks[i][1];
    if(!collide(g, g.cur.type, to, nx, ny)){
      g.cur.x = nx; g.cur.y = ny; g.cur.rot = to;
      g.lastRotate = true; g.lastKickIdx = i;
      onSuccessfulShift(g);
      return;
    }
  }
}
function tryRotate180(g){
  if(!g.cur || g.paused || g.over || g.finished) return;
  if(g.cur.type === "O") return;
  var from = g.cur.rot, to = (from + 2) % 4;
  var offs = [[0,0],[-1,0],[1,0],[0,1],[-2,0],[2,0],[-1,1],[1,1],[0,-1]];
  for(var i=0;i<offs.length;i++){
    var nx = g.cur.x + offs[i][0], ny = g.cur.y + offs[i][1];
    if(!collide(g, g.cur.type, to, nx, ny)){
      g.cur.x = nx; g.cur.y = ny; g.cur.rot = to;
      g.lastRotate = true; g.lastKickIdx = 0;
      onSuccessfulShift(g);
      return;
    }
  }
}
function softStep(g){
  if(!g.cur) return false;
  if(!collide(g, g.cur.type, g.cur.rot, g.cur.x, g.cur.y+1)){
    g.cur.y++; g.lastRotate = false; return true;
  }
  return false;
}
function hardDrop(g){
  if(!g.cur || g.paused || g.over || g.finished) return;
  var gy = ghostY(g);
  var dist = gy - g.cur.y;
  g.cur.y = gy;
  if(mode === "free") g.score += dist * 2;
  lockPiece(g);
}
function doHold(g){
  if(!g.cur || !g.canHold || g.paused || g.over || g.finished) return;
  var cur = g.cur.type;
  if(g.hold){
    var t = g.hold; g.hold = cur;
    g.cur = { type:t, rot:0, x:3, y:HIDDEN-2 };
    if(collide(g, t, 0, g.cur.x, g.cur.y)){ g.cur.y -= 1; if(collide(g,t,0,g.cur.x,g.cur.y)){ gameOver(); return; } }
  } else {
    g.hold = cur;
    var nt = nextType(g);
    if(!nt){ finishTrain(); return; }
    g.cur = { type:nt, rot:0, x:3, y:HIDDEN-2 };
    if(collide(g, nt, 0, g.cur.x, g.cur.y)){ g.cur.y -= 1; if(collide(g,nt,0,g.cur.x,g.cur.y)){ gameOver(); return; } }
  }
  g.canHold = false; g.holdUses++; g.lockAcc = 0; g.lockResets = 0; g.lastRotate = false;
  beep(660, 0.04);
}
function isTSpin(g){
  if(!g.cur || g.cur.type !== "T" || !g.lastRotate) return false;
  var cx = g.cur.x + 1, cy = g.cur.y + 1;
  var corners = [[cx-1,cy-1],[cx+1,cy-1],[cx-1,cy+1],[cx+1,cy+1]];
  var filled = 0;
  corners.forEach(function(c){
    var x=c[0], y=c[1];
    if(x<0 || x>=COLS || y>=ROWS || (y>=0 && g.grid[y][x])) filled++;
  });
  return filled >= 3;
}
function lockPiece(g){
  var p = g.cur; if(!p) return;
  var tspin = isTSpin(g);
  var cs = cellsOf(p.type, p.rot, p.x, p.y);
  cs.forEach(function(c){
    if(c[1] >= 0) g.grid[c[1]][c[0]] = p.type;
    g.placedKeys.push(c[0] + "," + (c[1]-HIDDEN));
  });
  g.pieces++;
  beep(180, 0.05);
  var lockOut = cs.every(function(c){ return c[1] < HIDDEN; });

  if(g.noClear){
    // テンプレ練習: 消去せず形だけ記録
    g.cur = null;
    if(g.pieces >= 7){ finishTrain(); }
    else spawn(g);
    updateStats(); drawAll();
    return;
  }

  // line clear (free)
  var cleared = [];
  for(var y=0;y<ROWS;y++){ if(g.grid[y].every(function(v){ return v; })) cleared.push(y); }
  var n = cleared.length;
  if(n > 0){
    cleared.sort(function(a,b){ return a-b; });
    for(var i=cleared.length-1;i>=0;i--){ g.grid.splice(cleared[i],1); g.grid.unshift(new Array(COLS).fill(null)); }
    g.lines += n;
    g.combo++;
    g.maxCombo = Math.max(g.maxCombo, g.combo);
  } else { g.combo = -1; }

  var label = "", pts = 0;
  var difficult = false;
  if(tspin){
    difficult = true;
    if(n===0){ pts = 400; label = "T-SPIN"; }
    else if(n===1){ pts = 800; label = "T-SPIN SINGLE"; }
    else if(n===2){ pts = 1200; label = "T-SPIN DOUBLE"; }
    else if(n===3){ pts = 1600; label = "T-SPIN TRIPLE"; }
  } else {
    if(n===1){ pts = 100; label = "SINGLE"; }
    else if(n===2){ pts = 300; label = "DOUBLE"; }
    else if(n===3){ pts = 500; label = "TRIPLE"; }
    else if(n===4){ pts = 800; label = "TETRIS"; difficult = true; }
  }
  if(n > 0){
    if(difficult && g.b2b){ pts = Math.floor(pts * 1.5); label += " (B2B)"; }
    if(difficult) g.b2b = true; else if(n>0) g.b2b = false;
    pts *= g.level;
    if(g.combo > 0) pts += 50 * g.combo * g.level;
    var isPC = g.grid.every(function(row){ return row.every(function(v){ return !v; }); });
    if(isPC){
      var pcPts = [0,800,1200,1800,2000][n] * g.level;
      pts += pcPts; label += " + PERFECT CLEAR!";
    }
    g.score += pts;
    showAction(label + "  +" + pts);
    if(n>=4 || tspin) beep(880, 0.09);
  }
  g.level = Math.floor(g.lines / 10) + 1;
  g.cur = null;
  if(lockOut){ gameOver(); return; }
  spawn(g);
  updateStats(); drawAll();
}

/* ============================================================
   描画
   ============================================================ */
var boardCv = document.getElementById("board");
function cssVar(name){
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}
var THEME_LS = "tetris-trainer-theme-v1";
var curTheme = "light";
try{ curTheme = localStorage.getItem(THEME_LS) || "light"; }catch(e){}
function applyTheme(t){
  curTheme = t;
  document.documentElement.setAttribute("data-theme", t);
  try{ localStorage.setItem(THEME_LS, t); }catch(e){}
  var label = "テーマ：" + (t === "dark" ? "ダーク" : "ライト");
  var b = document.getElementById("themeBtn"); if(b) b.textContent = label;
  var sb = document.getElementById("startThemeBtn"); if(sb) sb.textContent = label;
  if(typeof drawAll === "function" && typeof G !== "undefined" && G) drawAll();
}
function toggleTheme(){ applyTheme(curTheme === "dark" ? "light" : "dark"); }
var bctx = boardCv.getContext("2d");
var CELL = 30;
(function fitDpr(){
  var dpr = Math.min(2, window.devicePixelRatio || 1);
  boardCv.width = 300 * dpr; boardCv.height = 600 * dpr;
  bctx.setTransform(dpr,0,0,dpr,0,0);
})();
function drawCell(ctx, x, y, size, color, alpha){
  ctx.globalAlpha = alpha == null ? 1 : alpha;
  ctx.fillStyle = color;
  var r = Math.max(2, size*0.14);
  var px = x*size, py = y*size;
  ctx.beginPath();
  ctx.moveTo(px+1+r, py+1);
  ctx.lineTo(px+size-1-r, py+1); ctx.arcTo(px+size-1, py+1, px+size-1, py+1+r, r);
  ctx.lineTo(px+size-1, py+size-1-r); ctx.arcTo(px+size-1, py+size-1, px+size-1-r, py+size-1, r);
  ctx.lineTo(px+1+r, py+size-1); ctx.arcTo(px+1, py+size-1, px+1, py+size-1-r, r);
  ctx.lineTo(px+1, py+1+r); ctx.arcTo(px+1, py+1, px+1+r, py+1, r);
  ctx.closePath(); ctx.fill();
  ctx.globalAlpha = 1;
}
function evalColors(){
  // returns map key-> 'good'|'bad' for placed cells after finish, and missing set
  if(!G || !G.target || !G.finished) return null;
  var placed = new Set(G.placedKeys);
  var good = new Set(), bad = new Set();
  placed.forEach(function(k){ if(G.target.targetSet.has(k)) good.add(k); else bad.add(k); });
  var missing = new Set();
  G.target.targetSet.forEach(function(k){ if(!placed.has(k)) missing.add(k); });
  return { good:good, bad:bad, missing:missing };
}
function drawBoard(){
  var ctx = bctx;
  ctx.clearRect(0,0,300,600);
  ctx.fillStyle = cssVar("--board-bg"); ctx.fillRect(0,0,300,600);
  // grid lines
  ctx.strokeStyle = cssVar("--grid-line"); ctx.lineWidth = 1;
  for(var x=1;x<COLS;x++){ ctx.beginPath(); ctx.moveTo(x*CELL+.5,0); ctx.lineTo(x*CELL+.5,600); ctx.stroke(); }
  for(var y=1;y<VROWS;y++){ ctx.beginPath(); ctx.moveTo(0,y*CELL+.5); ctx.lineTo(300,y*CELL+.5); ctx.stroke(); }
  if(!G) return;
  var ec = evalColors();

  // guide silhouette (training)
  if(G.target && (mode==="train" || mode==="skill")){
    G.target.targetSet.forEach(function(k){
      var parts = k.split(","); var gx=+parts[0], gy=+parts[1];
      var filledHere = G.grid[gy+HIDDEN] && G.grid[gy+HIDDEN][gx];
      if(G.finished && ec && ec.missing.has(k)){
        ctx.strokeStyle = "#f87171"; ctx.lineWidth = 2;
        ctx.setLineDash([4,3]);
        ctx.strokeRect(gx*CELL+3, gy*CELL+3, CELL-6, CELL-6);
        ctx.setLineDash([]);
      } else if(!filledHere){
        ctx.fillStyle = cssVar("--guide-fill");
        ctx.fillRect(gx*CELL+2, gy*CELL+2, CELL-4, CELL-4);
        ctx.strokeStyle = cssVar("--guide-stroke"); ctx.lineWidth = 1;
        ctx.strokeRect(gx*CELL+2.5, gy*CELL+2.5, CELL-5, CELL-5);
      }
    });
  }
  // locked cells
  for(var ry=HIDDEN; ry<ROWS; ry++){
    for(var cx=0; cx<COLS; cx++){
      var v = G.grid[ry][cx]; if(!v) continue;
      var key = cx+","+(ry-HIDDEN);
      var color = COLORS[v];
      if(G.finished && ec){
        if(ec.bad.has(key)) color = "#ef4444";
        else if(ec.good.has(key)) color = "#34d399";
      }
      drawCell(ctx, cx, ry-HIDDEN, CELL, color);
      ctx.fillStyle = "rgba(255,255,255,0.20)";
      ctx.fillRect(cx*CELL+3, (ry-HIDDEN)*CELL+3, CELL-6, 4);
    }
  }
  if(!G.cur || G.over || G.finished) return;
  // ghost
  var gy = ghostY(G);
  if(gy !== G.cur.y){
    cellsOf(G.cur.type, G.cur.rot, G.cur.x, gy).forEach(function(c){
      if(c[1] < HIDDEN) return;
      ctx.strokeStyle = COLORS[G.cur.type]; ctx.globalAlpha = 0.45; ctx.lineWidth = 1.5;
      ctx.strokeRect(c[0]*CELL+2, (c[1]-HIDDEN)*CELL+2, CELL-4, CELL-4);
      ctx.globalAlpha = 1;
    });
  }
  // current
  cellsOf(G.cur.type, G.cur.rot, G.cur.x, G.cur.y).forEach(function(c){
    if(c[1] < HIDDEN) return;
    drawCell(ctx, c[0], c[1]-HIDDEN, CELL, COLORS[G.cur.type]);
    ctx.fillStyle = "rgba(255,255,255,0.25)";
    ctx.fillRect(c[0]*CELL+3, (c[1]-HIDDEN)*CELL+3, CELL-6, 4);
  });
}
function drawMini(cv, type, dim){
  var ctx = cv.getContext("2d");
  var dpr = Math.min(2, window.devicePixelRatio || 1);
  var W = cv.width, H = cv.height;
  ctx.setTransform(1,0,0,1,0,0); ctx.clearRect(0,0,W,H);
  if(!type) return;
  var cs = SHAPES[type][0];
  var size = type === "I" ? 15 : 17;
  var xs = cs.map(function(c){return c[0];}), ys = cs.map(function(c){return c[1];});
  var minX = Math.min.apply(null,xs), maxX = Math.max.apply(null,xs);
  var minY = Math.min.apply(null,ys), maxY = Math.max.apply(null,ys);
  var w = (maxX-minX+1)*size, h = (maxY-minY+1)*size;
  var ox = (W - w)/2, oy = (H - h)/2;
  cs.forEach(function(c){
    var px = ox + (c[0]-minX)*size, py = oy + (c[1]-minY)*size;
    ctx.globalAlpha = dim ? 0.35 : 1;
    ctx.fillStyle = COLORS[type];
    ctx.fillRect(px+1, py+1, size-2, size-2);
    ctx.globalAlpha = 1;
  });
}
var nextCanvases = [];
(function buildNext(){
  var wrap = document.getElementById("nextStack");
  for(var i=0;i<5;i++){
    var c = document.createElement("canvas");
    c.width = 88; c.height = i===0 ? 64 : 52;
    wrap.appendChild(c); nextCanvases.push(c);
  }
})();
function drawAll(){
  drawBoard();
  drawMini(document.getElementById("holdCanvas"), G ? G.hold : null, G ? !G.canHold : false);
  var q = G ? peekQueue(G, 5) : [];
  nextCanvases.forEach(function(c, i){ drawMini(c, q[i] || null, false); });
  updateLiveMatch();
}
function updateLiveMatch(){
  var el = document.getElementById("liveMatch");
  if(!G || !G.target){ el.textContent = "—"; return; }
  var placed = new Set(G.placedKeys);
  var hit = 0;
  placed.forEach(function(k){ if(G.target.targetSet.has(k)) hit++; });
  var pct = Math.round(hit / 28 * 100);
  el.textContent = hit + "/28 (" + pct + "%)";
  el.style.color = pct >= 80 ? "var(--green)" : pct >= 50 ? "var(--amber)" : "var(--text)";
}
