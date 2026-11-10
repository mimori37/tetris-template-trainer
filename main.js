"use strict";
/* ============================================================
   テトリス本体（SRS / 7-bag / DAS・ARR / ロックディレイ）
   ============================================================ */
var COLS = 10, VROWS = 20, HIDDEN = 4, ROWS = VROWS + HIDDEN;
var COLORS = { I:"#22d3ee", O:"#facc15", T:"#c084fc", S:"#4ade80", Z:"#f87171", J:"#60a5fa", L:"#fb923c" };
var DARKEN = { I:"#0e7d94", O:"#a18007", T:"#7e3fbf", S:"#1f7a3d", Z:"#a52a2a", J:"#2f5cb8", L:"#b85c14" };

/* SRS rotation states: [x,y] cells, y down */
var SHAPES = {
  I: [
    [[0,1],[1,1],[2,1],[3,1]],
    [[2,0],[2,1],[2,2],[2,3]],
    [[0,2],[1,2],[2,2],[3,2]],
    [[1,0],[1,1],[1,2],[1,3]]
  ],
  O: [
    [[1,0],[2,0],[1,1],[2,1]],
    [[1,0],[2,0],[1,1],[2,1]],
    [[1,0],[2,0],[1,1],[2,1]],
    [[1,0],[2,0],[1,1],[2,1]]
  ],
  T: [
    [[1,0],[0,1],[1,1],[2,1]],
    [[1,0],[1,1],[2,1],[1,2]],
    [[0,1],[1,1],[2,1],[1,2]],
    [[1,0],[0,1],[1,1],[1,2]]
  ],
  S: [
    [[1,0],[2,0],[0,1],[1,1]],
    [[1,0],[1,1],[2,1],[2,2]],
    [[1,1],[2,1],[0,2],[1,2]],
    [[0,0],[0,1],[1,1],[1,2]]
  ],
  Z: [
    [[0,0],[1,0],[1,1],[2,1]],
    [[2,0],[1,1],[2,1],[1,2]],
    [[0,1],[1,1],[1,2],[2,2]],
    [[1,0],[0,1],[1,1],[0,2]]
  ],
  J: [
    [[0,0],[0,1],[1,1],[2,1]],
    [[1,0],[2,0],[1,1],[1,2]],
    [[0,1],[1,1],[2,1],[2,2]],
    [[1,0],[1,1],[0,2],[1,2]]
  ],
  L: [
    [[2,0],[0,1],[1,1],[2,1]],
    [[1,0],[1,1],[1,2],[2,2]],
    [[0,1],[1,1],[2,1],[0,2]],
    [[0,0],[1,0],[1,1],[1,2]]
  ]
};
/* Wall kicks, board coords (y down). key "from>to" */
var KICK_JLSTZ = {
  "0>1":[[0,0],[-1,0],[-1,-1],[0,2],[-1,2]],
  "1>0":[[0,0],[1,0],[1,1],[0,-2],[1,-2]],
  "1>2":[[0,0],[1,0],[1,1],[0,-2],[1,-2]],
  "2>1":[[0,0],[-1,0],[-1,-1],[0,2],[-1,2]],
  "2>3":[[0,0],[1,0],[1,-1],[0,2],[1,2]],
  "3>2":[[0,0],[-1,0],[-1,1],[0,-2],[-1,-2]],
  "3>0":[[0,0],[-1,0],[-1,1],[0,-2],[-1,-2]],
  "0>3":[[0,0],[1,0],[1,-1],[0,2],[1,2]]
};
var KICK_I = {
  "0>1":[[0,0],[-2,0],[1,0],[-2,1],[1,-2]],
  "1>0":[[0,0],[2,0],[-1,0],[2,-1],[-1,2]],
  "1>2":[[0,0],[-1,0],[2,0],[-1,-2],[2,1]],
  "2>1":[[0,0],[2,0],[-1,0],[2,-1],[-1,2]],
  "2>3":[[0,0],[2,0],[-1,0],[2,-1],[-1,2]],
  "3>2":[[0,0],[-2,0],[1,0],[-2,1],[1,-2]],
  "3>0":[[0,0],[-1,0],[2,0],[-1,-2],[2,1]],
  "0>3":[[0,0],[1,0],[-2,0],[1,2],[-2,-1]]
};

/* ============================================================
   テンプレ定義（placements = 実際に置ける7ピースの配置。
   target はその和集合。seq が出現順）
   座標は表示盤面基準 (x:0-9, y:0-19, 下が大きい)
   ============================================================ */
function cells(list){ return list.map(function(p){ return p[0]+","+p[1]; }); }
var TEMPLATES = [
  {
    id:"tki", name:"TKI積み", diff:2, diffLabel:"★★☆",
    tag:"Tスピンシングルへ繋ぐ定番の開幕",
    aim:"1巡目で平らな土台とTスピンの受け口を作り、2巡目のTでTスピンシングル（またはダブル）を撃つ開幕の王道。",
    feat:"左右の高さが揃いやすく、余ったピースの処理先が多い。開幕の事故が少なく、対戦・スコア両方で採用率が高い。",
    tips:"中央にTの受け口（1マス凹み）を残すのが核。Jを左端に立てて高さを作り、Zで左側の段差を埋めると形が安定する。",
    seq:["L","T","I","J","O","S","Z"],
    placements:[
      [[2,18],[0,19],[1,19],[2,19]],
      [[4,18],[3,19],[4,19],[5,19]],
      [[6,19],[7,19],[8,19],[9,19]],
      [[0,16],[1,16],[0,17],[0,18]],
      [[5,17],[6,17],[5,18],[6,18]],
      [[8,17],[9,17],[7,18],[8,18]],
      [[2,16],[1,17],[2,17],[1,18]]
    ]
  },
  {
    id:"dt", name:"DT砲", diff:3, diffLabel:"★★★",
    tag:"Tスピンダブル＋テトリスの連続火力",
    aim:"Tスピンダブルを撃った直後にテトリス（4ライン消去）が撃てる「砲台」を1巡目から組み始める火力特化の開幕。",
    feat:"決まれば開幕から大きな火力を連射できる。反面、土台の形が特殊で、ピース順に恵まれないと組みにくい。",
    tips:"右端にSを立てて砲の壁を作るのがポイント。中央のT（下向き）が砲の土台になるので、置き場所を間違えないこと。",
    seq:["J","L","I","O","T","Z","S"],
    placements:[
      [[0,18],[0,19],[1,19],[2,19]],
      [[5,18],[3,19],[4,19],[5,19]],
      [[6,19],[7,19],[8,19],[9,19]],
      [[1,17],[2,17],[1,18],[2,18]],
      [[3,17],[4,17],[5,17],[4,18]],
      [[6,17],[7,17],[7,18],[8,18]],
      [[8,16],[8,17],[9,17],[9,18]]
    ]
  },
  {
    id:"pc", name:"開幕パーフェクトクリア", diff:3, diffLabel:"★★★",
    tag:"10ピース全消しを狙う構築",
    aim:"1巡目＋2巡目の頭で盤面を全部消す（パーフェクトクリア）ための土台。成立すれば大きなボーナスと火力が入る。",
    feat:"形が左右非対称で、2巡目のピース順によって複数の解法分岐がある。暗記量は多めだが決まったときの爽快感は随一。",
    tips:"右端のZが高い位置に浮くのがPC土台の特徴。左のLで作る段差と、中央Jの出っ張りを正確に再現するのが第一歩。",
    seq:["I","T","O","J","L","S","Z"],
    placements:[
      [[0,19],[1,19],[2,19],[3,19]],
      [[5,18],[4,19],[5,19],[6,19]],
      [[7,18],[8,18],[7,19],[8,19]],
      [[2,17],[2,18],[3,18],[4,18]],
      [[0,16],[1,16],[1,17],[1,18]],
      [[6,16],[7,16],[5,17],[6,17]],
      [[9,15],[8,16],[9,16],[8,17]]
    ]
  },
  {
    id:"yama", name:"山岳積み", diff:1, diffLabel:"★☆☆",
    tag:"中央を高くする基本の積み感覚",
    aim:"中央に山を作り、左右にピースを流し込む積み方の基礎形。掘りと受けの感覚を養う入門テンプレ。",
    feat:"多少ズレてもリカバリーしやすい。山の高さを保ちながら両サイドを均す「地形管理」の練習になる。",
    tips:"山頂のS（最上段）が目印。Zで左の斜面、Lで右の斜面を作ると、自然と山の稜線ができあがる。",
    seq:["O","I","J","L","T","S","Z"],
    placements:[
      [[0,18],[1,18],[0,19],[1,19]],
      [[2,19],[3,19],[4,19],[5,19]],
      [[6,18],[6,19],[7,19],[8,19]],
      [[9,17],[7,18],[8,18],[9,18]],
      [[4,17],[3,18],[4,18],[5,18]],
      [[6,15],[7,15],[5,16],[6,16]],
      [[0,16],[1,16],[1,17],[2,17]]
    ]
  },
  {
    id:"hira", name:"平積みベース", diff:1, diffLabel:"★☆☆",
    tag:"凹凸を消し続ける最も基本の形",
    aim:"盤面をできるだけ平らに保ち、右端にテトリス用の井戸を残す基礎形。すべての開幕の土台になる考え方。",
    feat:"穴を作りにくく、次に来るどんなピースでも置き場所がある。平積みが速い人は中盤の安定感が段違いになる。",
    tips:"右端2列（井戸側）を最後まで空ける意識。Jを右上に寝かせてフタをすると、平らさが一気に増す。",
    seq:["I","O","T","L","Z","S","J"],
    placements:[
      [[0,19],[1,19],[2,19],[3,19]],
      [[4,18],[5,18],[4,19],[5,19]],
      [[7,18],[6,19],[7,19],[8,19]],
      [[2,17],[0,18],[1,18],[2,18]],
      [[2,16],[3,16],[3,17],[4,17]],
      [[5,16],[5,17],[6,17],[6,18]],
      [[7,16],[8,16],[9,16],[9,17]]
    ]
  }
];
TEMPLATES.forEach(function(t){
  t.targetSet = new Set();
  t.placements.forEach(function(pl){ cells(pl).forEach(function(k){ t.targetSet.add(k); }); });
});

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
  ctx.fillStyle = "#0d1119"; ctx.fillRect(0,0,300,600);
  // grid lines
  ctx.strokeStyle = "rgba(120,140,180,0.10)"; ctx.lineWidth = 1;
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
        ctx.fillStyle = "rgba(232,236,244,0.10)";
        ctx.fillRect(gx*CELL+2, gy*CELL+2, CELL-4, CELL-4);
        ctx.strokeStyle = "rgba(232,236,244,0.35)"; ctx.lineWidth = 1;
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

/* ============================================================
   キー設定（キーコンフィグ）: プリセット / カスタム / 保存
   ============================================================ */
var ACTIONS = {
  left:   { label: "左移動" },
  right:  { label: "右移動" },
  down:   { label: "ソフトドロップ" },
  hard:   { label: "ハードドロップ" },
  rotR:   { label: "右回転" },
  rotL:   { label: "左回転" },
  rot180: { label: "180度回転" },
  hold:   { label: "ホールド" },
  pause:  { label: "一時停止" },
  restart:{ label: "リスタート" }
};
var KEY_GROUPS = [
  { title: "スティック側（左手）", note: "横持ちでは左手のスティック操作にあたる部分。ぷよテト横持ち風では A／D／S／W のダイヤモンドに割り当てます。", actions: ["left","right","down","hard"] },
  { title: "ボタン側（右手）", note: "横持ちでは右手の4ボタン（ダイヤモンド配置）にあたる部分。ぷよテト横持ち風では →＝Aボタン位置（右回転）、↓＝Bボタン位置（左回転）、↑＝Xボタン位置（ホールド）です。", actions: ["rotR","rotL","rot180","hold"] },
  { title: "共通", note: "", actions: ["pause","restart"] }
];
var PRESETS = {
  standard: {
    label: "標準",
    env: "ガイドライン系",
    desc: "公式系タイトルの基本配置。矢印＋Z/X回転、Spaceでハードドロップ。",
    bindings: { left:["ArrowLeft"], right:["ArrowRight"], down:["ArrowDown"], hard:["Space"], rotR:["ArrowUp","KeyX"], rotL:["KeyZ"], rot180:[], hold:["KeyC"], pause:["KeyP"], restart:["KeyR"] }
  },
  tetrio: {
    label: "TETR.IO",
    env: "PCブラウザ対戦",
    desc: "TETR.IOデフォルト。180回転＝A、ホールド＝Shift/C。回転は↑/XとZ。",
    bindings: { left:["ArrowLeft"], right:["ArrowRight"], down:["ArrowDown"], hard:["Space"], rotR:["ArrowUp","KeyX"], rotL:["KeyZ"], rot180:["KeyA"], hold:["ShiftLeft","KeyC"], pause:["KeyP"], restart:["KeyR"] }
  },
  jstris: {
    label: "Jstris",
    env: "PCブラウザ対戦",
    desc: "Jstrisデフォルト。180回転＝A、ホールド＝C、右回転は↑のみの潔い配置。",
    bindings: { left:["ArrowLeft"], right:["ArrowRight"], down:["ArrowDown"], hard:["Space"], rotR:["ArrowUp"], rotL:["KeyZ"], rot180:["KeyA"], hold:["KeyC"], pause:["KeyP"], restart:["KeyR"] }
  },
  puyo: {
    label: "ぷよテト横持ち",
    env: "Switch / Joy-Con 1本",
    desc: "Joy-Con横持ちの構えをキーボードへ。左手A/D/S/W＋右手は矢印ダイヤモンド。",
    bindings: { left:["KeyA"], right:["KeyD"], down:["KeyS"], hard:["KeyW"], rotR:["ArrowRight"], rotL:["ArrowDown"], rot180:[], hold:["ArrowUp"], pause:["KeyP"], restart:["KeyR"] }
  }
};
var LS_KEY = "tetris-trainer-keybindings-v2";
function cloneBindings(b){
  var out = {};
  Object.keys(ACTIONS).forEach(function(a){ out[a] = (b[a] || []).slice(); });
  return out;
}
function loadBindings(){
  try{
    var raw = localStorage.getItem(LS_KEY);
    if(raw){
      var parsed = JSON.parse(raw);
      if(parsed && parsed.bindings){
        var ok = Object.keys(ACTIONS).every(function(a){ return Array.isArray(parsed.bindings[a]) && (a === "rot180" || parsed.bindings[a].length > 0); });
        if(ok) return { bindings: cloneBindings(parsed.bindings), preset: parsed.preset || "custom" };
      }
    }
  }catch(e){}
  return { bindings: cloneBindings(PRESETS.standard.bindings), preset: "standard" };
}
var keyConfig = loadBindings();
var bindings = keyConfig.bindings;
var activePreset = keyConfig.preset; // "standard" | "puyo" | "custom"
var capturingAction = null;
function saveBindings(){
  try{ localStorage.setItem(LS_KEY, JSON.stringify({ bindings: bindings, preset: activePreset })); }catch(e){}
}
function fmtCode(code){
  var map = { ArrowLeft:"←", ArrowRight:"→", ArrowUp:"↑", ArrowDown:"↓", Space:"Space", ShiftLeft:"Shift(左)", ShiftRight:"Shift(右)", ControlLeft:"Ctrl(左)", ControlRight:"Ctrl(右)", AltLeft:"Alt(左)", AltRight:"Alt(右)", Enter:"Enter", Tab:"Tab", Backspace:"Backspace" };
  if(map[code]) return map[code];
  if(code.indexOf("Key") === 0) return code.slice(3);
  if(code.indexOf("Digit") === 0) return code.slice(5);
  return code;
}
function actionForCode(code){
  var found = null;
  Object.keys(ACTIONS).forEach(function(a){ if(bindings[a].indexOf(code) >= 0) found = a; });
  return found;
}
function bindingsMatchPreset(name){
  var p = PRESETS[name].bindings;
  return Object.keys(ACTIONS).every(function(a){
    var pa = p[a] || [];
    return bindings[a].length === pa.length && bindings[a].every(function(c, i){ return c === pa[i]; });
  });
}
function keyNotice(msg){ var el = document.getElementById("keyNotice"); if(el) el.textContent = msg || ""; }
function renderKeyConfig(){
  var wrap = document.getElementById("keyConfigList");
  if(!wrap) return;
  wrap.innerHTML = "";
  KEY_GROUPS.forEach(function(gr){
    var h = document.createElement("div"); h.className = "keyGroup"; h.textContent = gr.title; wrap.appendChild(h);
    if(gr.note){ var n = document.createElement("p"); n.className = "keyGroupNote"; n.textContent = gr.note; wrap.appendChild(n); }
    gr.actions.forEach(function(a){
      var row = document.createElement("button");
      row.type = "button";
      row.className = "keyRow" + (capturingAction === a ? " listening" : "");
      row.setAttribute("aria-label", ACTIONS[a].label + " のキーを変更");
      var caps = bindings[a].map(function(c){ return '<span class="keyCap">' + fmtCode(c) + "</span>"; }).join("");
      if(capturingAction === a) caps = '<span class="keyCap">キーを押してください…</span>';
      row.innerHTML = '<span class="act">' + ACTIONS[a].label + '</span><span class="caps">' + caps + "</span>";
      row.addEventListener("click", function(){
        capturingAction = (capturingAction === a) ? null : a;
        keyNotice(capturingAction ? "「" + ACTIONS[a].label + "」のキーを押してください。Escでキャンセルします。" : "");
        renderKeyConfig();
      });
      wrap.appendChild(row);
    });
  });
  var st = document.getElementById("presetState");
  if(st){
    if(activePreset === "custom") st.innerHTML = "現在の設定：<b>カスタム</b>（プリセットから変更済み）";
    else st.innerHTML = "現在の設定：<b>" + (PRESETS[activePreset] ? PRESETS[activePreset].label : activePreset) + "</b>";
  }
  renderPresetList();
  renderKeysHelp();
}
function renderKeysHelp(){
  var el = document.getElementById("keysHelp");
  function caps(a){ return bindings[a].map(function(c){ return "<kbd>" + fmtCode(c) + "</kbd>"; }).join(""); }
  function row(ico, lab, sub, keys){
    return "<div class=\"gRow\"><span class=\"gIco\">" + ico + "</span><span class=\"gLab\">" + lab + (sub ? "<small>" + sub + "</small>" : "") + "</span><span class=\"gKeys\">" + keys + "</span></div>";
  }
  if(el){
    el.innerHTML = "<div class=\"guideGrid\">" +
      row("◀▶", "移動", "長押しで連続移動（DAS/ARR）", caps("left") + caps("right")) +
      row("▼", "ソフトドロップ", "押している間、速く落ちる", caps("down")) +
      row("↻", "右回転", "", caps("rotR")) +
      row("↺", "左回転", "", caps("rotL")) +
      (bindings.rot180.length ? row("⟳", "180度回転", "一気に裏返す（TETR.IO / Jstris系）", caps("rot180")) : "") +
      row("⇊", "ハードドロップ", "一気に落として固定", caps("hard")) +
      row("⇋", "ホールド", "今のピースをキープ／入れ替え", caps("hold")) +
      row("Ⅱ", "一時停止", "", caps("pause")) +
      row("↦", "リスタート", "", caps("restart")) +
      "</div>";
  }
  var qg = document.getElementById("quickGuide");
  if(qg){
    function chip(lab, a){ return "<span class=\"qChip\"><b>" + lab + "</b>" + bindings[a].map(function(c){ return "<kbd>" + fmtCode(c) + "</kbd>"; }).join("") + "</span>"; }
    qg.innerHTML = chip("移動", "left") + chip("回転", "rotR") + chip("落とす", "hard") + chip("ホールド", "hold");
  }
  var dl = document.getElementById("dropKeyLabel");
  if(dl) dl.textContent = bindings.hard.map(fmtCode).join(" / ");
  var pb = document.getElementById("pauseBtn");
  if(pb) pb.textContent = "⏸ 一時停止 (" + bindings.pause.map(fmtCode).join("/") + ")";
}
function applyPreset(name){
  bindings = cloneBindings(PRESETS[name].bindings);
  activePreset = name;
  capturingAction = null;
  saveBindings();
  keyNotice("プリセット「" + PRESETS[name].label + "」を適用しました。");
  renderKeyConfig();
}
function assignKey(action, code){
  if(code === "Escape"){ capturingAction = null; keyNotice("割り当てをキャンセルしました。"); renderKeyConfig(); return; }
  var oldCodes = bindings[action].slice();
  var other = actionForCode(code);
  var msg = "";
  if(other && other !== action){
    // 重複は自動入れ替え: 元のアクションには、このアクションの旧キーを渡す
    bindings[other] = oldCodes.slice();
    msg = "「" + fmtCode(code) + "」は「" + ACTIONS[other].label + "」で使用中だったため、自動で入れ替えました（" + ACTIONS[other].label + " → " + oldCodes.map(fmtCode).join(" / ") + "）。";
  }
  bindings[action] = [code];
  capturingAction = null;
  activePreset = "custom";
  Object.keys(PRESETS).forEach(function(n){ if(bindingsMatchPreset(n)) activePreset = n; });
  saveBindings();
  keyNotice(msg || "「" + ACTIONS[action].label + "」に " + fmtCode(code) + " を割り当てました。");
  renderKeyConfig();
}
function renderPresetList(){
  var wrap = document.getElementById("presetList");
  if(!wrap) return;
  wrap.innerHTML = "";
  Object.keys(PRESETS).forEach(function(name){
    var p = PRESETS[name];
    var b = document.createElement("button");
    b.type = "button";
    b.className = "presetCard" + (activePreset === name ? " active" : "");
    b.setAttribute("data-preset", name);
    b.innerHTML = "<b>" + p.label + "</b><small>" + p.env + "</small><span>" + p.desc + "</span>";
    wrap.appendChild(b);
  });
}
var presetListEl = document.getElementById("presetList");
if(presetListEl){
  presetListEl.addEventListener("click", function(e){
    var b = e.target.closest("[data-preset]");
    if(b) applyPreset(b.getAttribute("data-preset"));
  });
}
function helpLine(){
  function f(a){ return bindings[a].map(fmtCode).join("/"); }
  return "ガイドライン準拠のエンドレスモードです。<br>" + f("left") + f("right") + " 移動 / " + f("rotR") + " 回転 / " + f("hard") + " ハードドロップ / " + f("hold") + " ホールド<br>盤面の上にも主なキーを出しています。割り当て変更は右の「キー設定」から。";
}

/* ============================================================
   入力: DAS / ARR
   ============================================================ */
var DAS = 130, ARR = 25;
var keyState = { left:false, right:false, down:false };
var dasDir = 0, dasStart = 0, lastArr = 0, dasCharged = false;
document.addEventListener("keydown", function(e){
  if(capturingAction){
    e.preventDefault();
    if(e.code === "ShiftLeft" || e.code === "ShiftRight" || e.code === "ControlLeft" || e.code === "ControlRight" || e.code === "AltLeft" || e.code === "AltRight" || e.code === "MetaLeft" || e.code === "MetaRight") return;
    assignKey(capturingAction, e.code);
    return;
  }
  var act = actionForCode(e.code);
  if(!act) return;
  if(["left","right","down","rotR","rotL","rot180","hard"].indexOf(act) >= 0) e.preventDefault();
  if(e.repeat){ return; }
  switch(act){
    case "left": keyState.left = true; dasDir = -1; dasStart = performance.now(); dasCharged = false; if(G) tryMove(G,-1); break;
    case "right": keyState.right = true; dasDir = 1; dasStart = performance.now(); dasCharged = false; if(G) tryMove(G,1); break;
    case "down": keyState.down = true; break;
    case "rotR": if(G) tryRotate(G, 1); drawAll(); break;
    case "rotL": if(G) tryRotate(G, -1); drawAll(); break;
    case "rot180": if(G){ tryRotate180(G); drawAll(); } break;
    case "hard": if(G){ hardDrop(G); drawAll(); } break;
    case "hold": if(G){ doHold(G); drawAll(); } break;
    case "pause": togglePause(); break;
    case "restart": startCurrent(); break;
  }
});
document.addEventListener("keyup", function(e){
  if(capturingAction) return;
  var act = actionForCode(e.code);
  if(act === "left"){ keyState.left = false; if(dasDir === -1){ dasDir = keyState.right ? 1 : 0; dasStart = performance.now(); dasCharged = false; if(dasDir && G) tryMove(G, dasDir); } }
  if(act === "right"){ keyState.right = false; if(dasDir === 1){ dasDir = keyState.left ? -1 : 0; dasStart = performance.now(); dasCharged = false; if(dasDir && G) tryMove(G, dasDir); } }
  if(act === "down"){ keyState.down = false; }
});
function applyDAS(now){
  if(!G || !dasDir || G.paused || G.over || G.finished || !G.cur) return;
  if(!dasCharged){
    if(now - dasStart >= DAS){ dasCharged = true; lastArr = now; if(tryMove(G, dasDir)) drawAll(); }
  } else if(now - lastArr >= ARR){
    lastArr = now; if(tryMove(G, dasDir)) drawAll();
  }
}
/* touch */
var touchTimers = {};
document.querySelectorAll(".tbtn").forEach(function(btn){
  var act = btn.getAttribute("data-t");
  function fire(){
    if(!G) return;
    if(act === "left"){ tryMove(G,-1); }
    else if(act === "right"){ tryMove(G,1); }
    else if(act === "rotL"){ tryRotate(G,-1); }
    else if(act === "rotR"){ tryRotate(G,1); }
    else if(act === "hold"){ doHold(G); }
    else if(act === "drop"){ hardDrop(G); }
    drawAll();
  }
  btn.addEventListener("pointerdown", function(e){
    e.preventDefault();
    if(act === "down"){ keyState.down = true; return; }
    fire();
    if(act === "left" || act === "right"){
      var dir = act === "left" ? -1 : 1;
      var t1 = setTimeout(function(){
        var iv = setInterval(function(){ if(G && tryMove(G, dir)) drawAll(); }, ARR);
        touchTimers[act] = iv;
      }, DAS);
      touchTimers[act+"_das"] = t1;
    }
  });
  function release(){
    if(act === "down"){ keyState.down = false; }
    if(touchTimers[act]){ clearInterval(touchTimers[act]); delete touchTimers[act]; }
    if(touchTimers[act+"_das"]){ clearTimeout(touchTimers[act+"_das"]); delete touchTimers[act+"_das"]; }
  }
  btn.addEventListener("pointerup", release);
  btn.addEventListener("pointerleave", release);
  btn.addEventListener("pointercancel", release);
});

/* ============================================================
   ゲームパッド（Web Gamepad API）
   マッピング定数はすべて GAMEPAD_MAP に集約。
   実機の個体差・ブラウザ差でズレる場合はここだけ調整する。
   ============================================================ */
var GAMEPAD_MAP = {
  /* Gamepad standard mapping のボタン番号 */
  BTN: { B:0, A:1, Y:2, X:3, L:4, R:5, ZL:6, ZR:7, MINUS:8, PLUS:9, LSTICK:10, RSTICK:11, DPAD_UP:12, DPAD_DOWN:13, DPAD_LEFT:14, DPAD_RIGHT:15, HOME:16 },
  AXIS: { LX:0, LY:1, RX:2, RY:3 },   /* 左スティック = axes[0..1] */
  DEADZONE: 0.5,                       /* スティックを方向入力とみなすしきい値 */
  /* 両手持ち（Proコン / Joy-Conペア）: BTN の名前で割り当て */
  DUAL: {
    rotR: "A",          /* buttons[1] 右回転 */
    rotL: "B",          /* buttons[0] 左回転 */
    hold: ["L","R","ZL","ZR"], /* buttons[4..7] ホールド */
    pause: "PLUS"       /* buttons[9] 一時停止 */
  },
  /* Joy-Con 1本・横持ち: フェイスボタンを「位置」で判定する。
     値はボタン番号。右位置＝右回転 / 下位置＝左回転 / 上位置＝ホールド。
     R は Pro 配置（右=A[1] 下=B[0] 上=X[3] 左=Y[2]）、
     L は本体を90°回して持つためダイヤモンドが1つ回転する前提でずらしてある。 */
  SINGLE_FACE: {
    R: { right:1, down:0, up:3, left:2 },
    L: { right:0, down:2, up:1, left:3 }
  },
  SINGLE_HOLD_EXTRA: [4, 5],  /* SL / SR もホールド可（横持ち時の肩ボタン） */
  SINGLE_PAUSE: [8, 9],       /* − / ＋ があれば一時停止 */
  /* 横持ちのスティック軸補正: 横持ちではスティック軸が90°回転して報告される。
     画面基準の (x, y) を、報告 axes のどちらから・どの符号で作るかを L/R 別に定義。
     R: 右に倒す＝報告の -Y 方向、L: その逆回転。 */
  SINGLE_AXIS: {
    R: { xFrom:"LY", xSign:-1, yFrom:"LX", ySign: 1 },
    L: { xFrom:"LY", xSign: 1, yFrom:"LX", ySign:-1 }
  }
};
var LS_PAD = "tetris-trainer-gamepad-v1";
function loadPadSettings(){
  try{
    var raw = localStorage.getItem(LS_PAD);
    if(raw){ var p = JSON.parse(raw); if(p && (p.side === "L" || p.side === "R")) return { horizontal: !!p.horizontal, side: p.side }; }
  }catch(e){}
  return { horizontal: false, side: "R" };
}
var padSettings = loadPadSettings();
function savePadSettings(){
  try{ localStorage.setItem(LS_PAD, JSON.stringify(padSettings)); }catch(e){}
}
var padPrevButtons = [];   /* エッジ検出用: 前フレームのボタン状態 */
var padDir = 0;            /* パッド由来の左右方向 (-1/0/1) */
var padDown = false;       /* パッド由来のソフトドロップ */
var padUpHeld = false;     /* ハードドロップのエッジ検出用 */
var padDasStart = 0, padDasCharged = false, padLastArr = 0;
var padStatusCache = "";
function setPadStatus(text, connected){
  if(text === padStatusCache) return;
  padStatusCache = text;
  var el = document.getElementById("padStatus"), dot = document.getElementById("padDot");
  if(el) el.textContent = text;
  if(dot) dot.classList.toggle("on", !!connected);
}
window.addEventListener("gamepadconnected", function(e){
  setPadStatus("接続中：" + e.gamepad.id, true);
});
window.addEventListener("gamepaddisconnected", function(){
  padPrevButtons = []; padDir = 0; padDown = false; padUpHeld = false;
  setPadStatus("未接続", false);
});
function renderPadConfig(){
  var dual = document.getElementById("padModeDual"), single = document.getElementById("padModeSingle");
  var row = document.getElementById("padSideRow");
  var bl = document.getElementById("padSideL"), br = document.getElementById("padSideR");
  var help = document.getElementById("padHelp");
  if(dual) dual.classList.toggle("active", !padSettings.horizontal);
  if(single) single.classList.toggle("active", padSettings.horizontal);
  if(row) row.style.display = padSettings.horizontal ? "" : "none";
  if(bl) bl.classList.toggle("active", padSettings.side === "L");
  if(br) br.classList.toggle("active", padSettings.side === "R");
  if(help){
    if(!padSettings.horizontal){
      help.innerHTML =
        "<b>両手持ちの割り当て</b><div class=\"guideGrid\">" +
        "<div class=\"gRow\"><span class=\"gIco\">◀▶</span><span class=\"gLab\">移動<small>スティック上＝ハードドロップ／下＝ソフトドロップ。長押しリピートあり</small></span><span class=\"gKeys\"><kbd>スティック</kbd><kbd>十字キー</kbd></span></div>" +
        "<div class=\"gRow\"><span class=\"gIco\">↻</span><span class=\"gLab\">右回転</span><span class=\"gKeys\"><kbd>A</kbd></span></div>" +
        "<div class=\"gRow\"><span class=\"gIco\">↺</span><span class=\"gLab\">左回転</span><span class=\"gKeys\"><kbd>B</kbd></span></div>" +
        "<div class=\"gRow\"><span class=\"gIco\">⇋</span><span class=\"gLab\">ホールド</span><span class=\"gKeys\"><kbd>L</kbd><kbd>R</kbd><kbd>ZL</kbd><kbd>ZR</kbd></span></div>" +
        "<div class=\"gRow\"><span class=\"gIco\">Ⅱ</span><span class=\"gLab\">一時停止</span><span class=\"gKeys\"><kbd>＋</kbd></span></div>" +
        "</div>";
    } else {
      help.innerHTML =
        "<b>横持ち（Joy-Con " + padSettings.side + " 1本）の割り当て</b><div class=\"guideGrid\">" +
        "<div class=\"gRow\"><span class=\"gIco\">◀▶</span><span class=\"gLab\">移動<small>スティックは横持ち基準に90°補正済み。上＝ハードドロップ／下＝ソフトドロップ</small></span><span class=\"gKeys\"><kbd>スティック</kbd></span></div>" +
        "<div class=\"gRow\"><span class=\"gIco\">↻</span><span class=\"gLab\">右回転</span><span class=\"gKeys\"><kbd>右のボタン</kbd></span></div>" +
        "<div class=\"gRow\"><span class=\"gIco\">↺</span><span class=\"gLab\">左回転</span><span class=\"gKeys\"><kbd>下のボタン</kbd></span></div>" +
        "<div class=\"gRow\"><span class=\"gIco\">⇋</span><span class=\"gLab\">ホールド</span><span class=\"gKeys\"><kbd>上のボタン</kbd><kbd>SL</kbd><kbd>SR</kbd></span></div>" +
        "</div><div style=\"margin-top:6px\">キーボードの「ぷよテト横持ち風」と同じ考え方（左＝スティック、右＝ボタンのダイヤモンド）です。</div>";
    }
  }
}
document.getElementById("padModeDual").addEventListener("click", function(){ padSettings.horizontal = false; savePadSettings(); renderPadConfig(); });
document.getElementById("padModeSingle").addEventListener("click", function(){ padSettings.horizontal = true; savePadSettings(); renderPadConfig(); });
document.getElementById("padSideL").addEventListener("click", function(){ padSettings.side = "L"; savePadSettings(); renderPadConfig(); });
document.getElementById("padSideR").addEventListener("click", function(){ padSettings.side = "R"; savePadSettings(); renderPadConfig(); });

function padBtn(gp, idx){ return !!(gp.buttons[idx] && gp.buttons[idx].pressed); }
function pollGamepad(now){
  if(!navigator.getGamepads){ setPadStatus("このブラウザは Gamepad API 非対応です", false); return; }
  var pads = navigator.getGamepads();
  var gp = null;
  for(var i=0;i<pads.length;i++){ if(pads[i] && pads[i].connected){ gp = pads[i]; break; } }
  if(!gp){ setPadStatus("未接続", false); if(padDir || padDown){ padDir = 0; padDown = false; } return; }
  setPadStatus("接続中：" + gp.id, true);
  if(capturingAction) return; /* キー入力待ち中はパッドをゲームに流さない */

  var B = GAMEPAD_MAP.BTN, DZ = GAMEPAD_MAP.DEADZONE;
  var lx = gp.axes[GAMEPAD_MAP.AXIS.LX] || 0, ly = gp.axes[GAMEPAD_MAP.AXIS.LY] || 0;
  var leftOn, rightOn, downOn, upOn;
  var edgeActions = []; /* このフレームで立ち上がったアクション */

  function edge(idx, action){
    var nowOn = padBtn(gp, idx), wasOn = !!padPrevButtons[idx];
    if(nowOn && !wasOn) edgeActions.push(action);
  }

  if(!padSettings.horizontal){
    /* ---- 両手持ち ---- */
    leftOn  = padBtn(gp, B.DPAD_LEFT)  || lx < -DZ;
    rightOn = padBtn(gp, B.DPAD_RIGHT) || lx >  DZ;
    downOn  = padBtn(gp, B.DPAD_DOWN)  || ly >  DZ;
    upOn    = padBtn(gp, B.DPAD_UP)    || ly < -DZ;
    edge(GAMEPAD_MAP.BTN[GAMEPAD_MAP.DUAL.rotR], "rotR");
    edge(GAMEPAD_MAP.BTN[GAMEPAD_MAP.DUAL.rotL], "rotL");
    GAMEPAD_MAP.DUAL.hold.forEach(function(nm){ edge(GAMEPAD_MAP.BTN[nm], "hold"); });
    edge(GAMEPAD_MAP.BTN[GAMEPAD_MAP.DUAL.pause], "pause");
  } else {
    /* ---- Joy-Con 1本・横持ち: スティック軸を画面基準へ補正 ---- */
    var tr = GAMEPAD_MAP.SINGLE_AXIS[padSettings.side];
    var raw = { LX: lx, LY: ly };
    var sx = raw[tr.xFrom] * tr.xSign, sy = raw[tr.yFrom] * tr.ySign;
    leftOn = sx < -DZ; rightOn = sx > DZ; downOn = sy > DZ; upOn = sy < -DZ;
    var face = GAMEPAD_MAP.SINGLE_FACE[padSettings.side];
    edge(face.right, "rotR");
    edge(face.down, "rotL");
    edge(face.up, "hold");
    GAMEPAD_MAP.SINGLE_HOLD_EXTRA.forEach(function(idx){ edge(idx, "hold"); });
    GAMEPAD_MAP.SINGLE_PAUSE.forEach(function(idx){ edge(idx, "pause"); });
  }

  /* 左右: 方向が変わった瞬間に1マス動かし、DAS/ARR は applyPadDAS が継続する */
  var dir = leftOn && !rightOn ? -1 : rightOn && !leftOn ? 1 : 0;
  if(dir !== padDir){
    padDir = dir;
    if(dir !== 0){
      padDasStart = now; padDasCharged = false;
      if(G && tryMove(G, dir)) drawAll();
    }
  }
  padDown = !!downOn;
  /* スティック上 / 十字上はエッジ検出でハードドロップ（長押しで連射しない） */
  if(upOn && !padUpHeld){ if(G){ hardDrop(G); drawAll(); } }
  padUpHeld = !!upOn;

  /* ボタン: エッジ検出（押した瞬間のみ） */
  var fired = {};
  edgeActions.forEach(function(a){
    if(fired[a]) return; fired[a] = true;
    if(!G) return;
    if(a === "rotR"){ tryRotate(G, 1); drawAll(); }
    else if(a === "rotL"){ tryRotate(G, -1); drawAll(); }
    else if(a === "hold"){ doHold(G); drawAll(); }
    else if(a === "pause"){ togglePause(); }
  });

  padPrevButtons = gp.buttons.map(function(b){ return !!b.pressed; });
}
function applyPadDAS(now){
  if(!G || !padDir || G.paused || G.over || G.finished || !G.cur) return;
  if(!padDasCharged){
    if(now - padDasStart >= DAS){ padDasCharged = true; padLastArr = now; if(tryMove(G, padDir)) drawAll(); }
  } else if(now - padLastArr >= ARR){
    padLastArr = now; if(tryMove(G, padDir)) drawAll();
  }
}

/* ============================================================
   メインループ（重力＋ロックディレイ）
   ============================================================ */
var lastFrame = performance.now();
function loop(now){
  var dt = Math.min(100, now - lastFrame); lastFrame = now;
  pollGamepad(now);
  if(G && G.running && !G.paused && !G.over && !G.finished && G.cur){
    applyDAS(now);
    applyPadDAS(now);
    var softHeld = keyState.down || padDown;
    var interval = (mode === "free") ? gravityMs(G.level) : 900;
    if(softHeld) interval = Math.min(interval, 30);
    G.dropAcc += dt;
    var stepMs = softHeld ? 30 : interval;
    while(G.dropAcc >= stepMs){
      G.dropAcc -= stepMs;
      if(softStep(G)){ if(softHeld && mode === "free") G.score += 1; }
      else break;
    }
    G.grounded = collide(G, G.cur.type, G.cur.rot, G.cur.x, G.cur.y+1);
    if(G.grounded){
      G.lockAcc += dt;
      if(G.lockAcc >= 500){ lockPiece(G); }
    } else { G.lockAcc = 0; }
    G.elapsed = (now - (G.startTime || now));
    drawAll(); updateStats();
  }
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);

/* ============================================================
   サウンド（簡易ビープ、既定OFF）
   ============================================================ */
var soundOn = false, audioCtx = null;
document.getElementById("soundBtn").addEventListener("click", function(){
  soundOn = !soundOn;
  this.textContent = "サウンド：" + (soundOn ? "ON" : "OFF");
  if(soundOn && !audioCtx){ try{ audioCtx = new (window.AudioContext || window.webkitAudioContext)(); }catch(e){} }
  if(audioCtx && audioCtx.state === "suspended") audioCtx.resume();
});
function beep(freq, dur){
  if(!soundOn || !audioCtx) return;
  try{
    var o = audioCtx.createOscillator(), gn = audioCtx.createGain();
    o.type = "square"; o.frequency.value = freq;
    gn.gain.setValueAtTime(0.03, audioCtx.currentTime);
    gn.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + dur);
    o.connect(gn); gn.connect(audioCtx.destination);
    o.start(); o.stop(audioCtx.currentTime + dur);
  }catch(e){}
}

/* ============================================================
   UI: モード / テンプレ / 統計
   ============================================================ */
var $ = function(id){ return document.getElementById(id); };
function fmtTime(ms){
  var t = Math.max(0, ms/1000), m = Math.floor(t/60), s = t - m*60;
  return m + ":" + (s < 10 ? "0" : "") + s.toFixed(1);
}
var feedTimer = null;
function showAction(txt){
  $("actionFeed").textContent = txt;
  if(feedTimer) clearTimeout(feedTimer);
  feedTimer = setTimeout(function(){ $("actionFeed").textContent = ""; }, 2200);
}
function updateStats(){
  if(!G) return;
  $("stScore").textContent = G.score.toLocaleString();
  $("stLevel").textContent = G.level;
  $("stLines").textContent = G.lines;
  var el = G.finished ? (G.endStamp - G.startStamp) : (G.startTime ? performance.now() - G.startTime : 0);
  $("stTime").textContent = fmtTime(el);
  $("stPps").textContent = el > 0 ? (G.pieces / (el/1000)).toFixed(2) : "0.00";
  $("stPieces").textContent = G.pieces;
  $("stCombo").textContent = Math.max(0, G.maxCombo);
  $("stB2b").textContent = G.b2b ? "継続中" : "—";
}
function renderTplList(){
  var wrap = $("tplList"); wrap.innerHTML = "";
  TEMPLATES.forEach(function(t){
    var b = document.createElement("button");
    b.type = "button"; b.className = "tplCard" + (t.id === selectedTpl.id ? " active" : "");
    b.innerHTML = '<span class="nm"><span>' + t.name + '</span><span class="diff">' + t.diffLabel + '</span></span><span class="tag">' + t.tag + '</span>';
    b.addEventListener("click", function(){
      selectedTpl = t; renderTplList(); renderTplDesc();
      if(mode === "train") startCurrent();
      else if(mode !== "skill"){ /* free: just preview guide info */ }
    });
    wrap.appendChild(b);
  });
}
function renderTplDesc(){
  var t = selectedTpl;
  $("tplDesc").innerHTML =
    '<p><span class="k">狙い：</span>' + t.aim + '</p>' +
    '<p><span class="k">特徴：</span>' + t.feat + '</p>' +
    '<p><span class="k">コツ：</span>' + t.tips + '</p>' +
    '<p><span class="k">出現順：</span><b style="letter-spacing:.14em">' + t.seq.join(" → ") + '</b>（ホールドで入れ替え可）</p>';
}
var MODE_NOTES = {
  free: "通常のエンドレスモード。10ラインごとにレベルが上がり、落下速度が速くなります。Tスピン・コンボ・B2B・パーフェクトクリアも採点されます。",
  train: "選んだテンプレの<b>目標シルエット</b>が盤面に薄く表示されます。出現順どおりに1巡目（7ピース）を置き切りると、目標28セルとの一致率・所要時間・PPS・置きミスを判定します。ライン消去は止めてあるので、形づくりに集中できます。",
  skill: "ランダムなテンプレ<b>3題</b>を連続で出題し、精度・速度・ミス率・ホールド活用を総合採点して S〜D ランクと講評を出します。まずはテンプレ練習で各形を覚えてから挑戦を。"
};
function setMode(m){
  mode = m;
  document.querySelectorAll("nav.modes button").forEach(function(b){
    b.classList.toggle("active", b.getAttribute("data-mode") === m);
  });
  $("modeNote").innerHTML = MODE_NOTES[m];
  $("challengeBar").classList.remove("show");
  hideResult();
  if(m === "skill"){ startSkillIntro(); }
  else startCurrent();
}

/* overlay */
function showOverlay(title, msg, mainLabel, onMain, subLabel, onSub){
  $("ovTitle").textContent = title;
  $("ovMsg").innerHTML = msg;
  var main = $("ovMain"), sub = $("ovSub");
  main.textContent = mainLabel;
  main.onclick = onMain;
  if(subLabel){ sub.style.display = ""; sub.textContent = subLabel; sub.onclick = onSub; }
  else sub.style.display = "none";
  $("overlay").classList.add("show");
}
function hideOverlay(){ $("overlay").classList.remove("show"); }

/* ============================================================
   ゲーム開始系
   ============================================================ */
function startCurrent(){
  hideResult();
  $("challengeBar").classList.remove("show");
  if(mode === "free"){
    G = makeGame({});
    G.running = true;
    hideOverlay();
    spawn(G);
  } else if(mode === "train"){
    G = makeGame({ queue: selectedTpl.seq.slice(), noClear: true, target: selectedTpl });
    G.running = true;
    hideOverlay();
    spawn(G);
    $("trainStats").innerHTML = '<div class="modeNote">課題：<b style="color:var(--text)">' + selectedTpl.name + '</b>／7ピースを置き切ると判定します。</div>';
  } else if(mode === "skill"){
    startSkillIntro(); return;
  }
  keyState.left = keyState.right = keyState.down = false; dasDir = 0; padDir = 0; padDown = false;
  drawAll(); updateStats();
}
function gameOver(){
  if(!G) return;
  G.over = true; G.running = false; G.endStamp = performance.now();
  drawAll(); updateStats();
  if(mode === "free"){
    showOverlay("GAME OVER",
      "スコア <b>" + G.score.toLocaleString() + "</b>／" + G.lines + "ライン／" + G.pieces + "ピース<br>タイム " + fmtTime(G.endStamp - G.startStamp),
      "もう一度 (" + fmtCode(bindings.restart[0]) + ")", function(){ startCurrent(); });
  } else {
    // テンプレ中に天井到達 = その時点の配置で判定
    finishTrain();
  }
}
function togglePause(){
  if(!G || G.over || G.finished) return;
  G.paused = !G.paused;
  if(G.paused){
    showOverlay("一時停止中", fmtCode(bindings.pause[0]) + "キー／パッドの＋ボタン、またはボタンで再開します。", "再開する", function(){ togglePause(); });
  } else hideOverlay();
}
$("pauseBtn").addEventListener("click", togglePause);
$("startBtn").addEventListener("click", function(){ if(mode === "skill"){ startSkillIntro(); } else startCurrent(); });

/* ============================================================
   テンプレ判定
   ============================================================ */
function judge(g){
  var placed = new Set(g.placedKeys);
  var hit = 0;
  placed.forEach(function(k){ if(g.target.targetSet.has(k)) hit++; });
  var miss = g.placedKeys.length - hit; // 目標外セル数（重複なし）
  var missing = 28 - hit;
  var ms = Math.max(1, g.endStamp - g.startStamp);
  return {
    hit: hit, miss: miss, missing: missing,
    acc: Math.round(hit / 28 * 100),
    ms: ms, time: ms/1000,
    pps: g.pieces / (ms/1000),
    holds: g.holdUses, pieces: g.pieces
  };
}
function finishTrain(){
  if(!G || G.finished) return;
  G.finished = true; G.running = false; G.endStamp = performance.now();
  if(G.cur) { /* keep board as is */ }
  var r = judge(G);
  drawAll(); updateStats();
  if(mode === "skill"){ onSkillChallengeDone(r); return; }
  var comment =
    r.acc >= 95 ? "ほぼ完璧な再現です。この形は身体に入っています。" :
    r.acc >= 80 ? "かなり良い再現。ズレたセル（赤）の位置を確認して、もう1回。" :
    r.acc >= 60 ? "骨格はできています。抜けたセル（赤破線）の受けを作るピースの置き方を見直しましょう。" :
                 "まずは出現順どおりに、ガイドの上にそのまま重ねる感覚で置いてみましょう。";
  showResult(
    "「" + G.target.name + "」判定結果",
    '<div class="rankFlex"><div><div class="rankBig">' + r.acc + '<span style="font-size:22px">%</span></div><div style="color:var(--muted);font-size:12px">目標セル一致率</div></div>' +
    '<div class="scoreBars">' +
      barRow("一致セル", r.hit + " / 28", Math.round(r.hit/28*100)) +
      barRow("所要時間", fmtTime(r.ms), Math.max(4, Math.min(100, 100 - r.time*2))) +
      barRow("PPS", r.pps.toFixed(2), Math.min(100, Math.round(r.pps/1.2*100))) +
      barRow("置きミス", r.miss + " セル", Math.max(0, 100 - r.miss*8)) +
    '</div></div>' +
    '<p class="comment">' + comment + '<br><span style="color:var(--muted);font-size:12.5px">緑＝目標どおりのセル／赤＝目標外に置いたセル／赤破線＝置けなかった目標セル。ホールド使用：' + r.holds + '回</span></p>',
    [
      { label: "もう一度挑戦 (R)", fn: function(){ startCurrent(); }, primary: true },
      { label: "テンプレを変える", fn: function(){ hideResult(); window.scrollTo({top:0, behavior:"smooth"}); } }
    ]
  );
  showOverlay("判定完了", "一致率 <b>" + r.acc + "%</b>（" + r.hit + "/28セル）<br>下の結果パネルで詳細を確認できます。", "もう一度 (R)", function(){ hideOverlay(); startCurrent(); });
}
function barRow(label, valText, pct){
  var cls = pct >= 75 ? "good" : pct >= 45 ? "" : pct >= 25 ? "warn" : "bad";
  return '<div class="barRow"><span>' + label + '</span><span class="track"><span class="fill ' + cls + '" style="display:block;width:' + pct + '%"></span></span><span class="mono">' + valText + '</span></div>';
}
function showResult(title, html, buttons){
  var p = $("resultPanel"), inner = $("resultInner");
  inner.innerHTML = "<h2>" + title + "</h2>" + html;
  var row = document.createElement("div");
  row.className = "btnRow"; row.style.marginTop = "14px"; row.style.justifyContent = "flex-start";
  (buttons || []).forEach(function(b){
    var btn = document.createElement("button");
    btn.type = "button"; btn.className = "bigBtn" + (b.primary ? "" : " ghost");
    btn.textContent = b.label;
    btn.addEventListener("click", b.fn);
    row.appendChild(btn);
  });
  if(buttons && buttons.length) inner.appendChild(row);
  p.classList.add("show");
  p.scrollIntoView({ behavior:"smooth", block:"nearest" });
}
function hideResult(){ $("resultPanel").classList.remove("show"); }

/* ============================================================
   スキルチェック
   ============================================================ */
var skill = null;
function shuffledTemplates(n){
  var arr = TEMPLATES.slice();
  for(var i=arr.length-1;i>0;i--){ var j=Math.floor(Math.random()*(i+1)); var t=arr[i]; arr[i]=arr[j]; arr[j]=t; }
  return arr.slice(0, n);
}
function startSkillIntro(){
  G = makeGame({}); G.running = false;
  drawAll(); updateStats();
  $("trainStats").innerHTML = "";
  showOverlay("スキルチェック",
    "ランダムなテンプレ<b>3題</b>を連続出題します。<br>精度・速度・ミス率・ホールド活用を総合採点し、S〜Dランクと講評を出します。",
    "チェック開始", function(){ beginSkill(); });
}
function beginSkill(){
  skill = { list: shuffledTemplates(3), idx: 0, results: [] };
  nextSkillChallenge();
}
function nextSkillChallenge(){
  var t = skill.list[skill.idx];
  G = makeGame({ queue: t.seq.slice(), noClear: true, target: t });
  G.running = true;
  hideOverlay(); hideResult();
  $("challengeBar").innerHTML = "スキルチェック <b>第" + (skill.idx+1) + "題 / 3題</b>：課題は <b>" + t.name + "</b>（" + t.tag + "）— 出現順 " + t.seq.join(" → ");
  $("challengeBar").classList.add("show");
  $("trainStats").innerHTML = '<div class="modeNote">第' + (skill.idx+1) + '題：<b style="color:var(--text)">' + t.name + '</b></div>';
  keyState.left = keyState.right = keyState.down = false; dasDir = 0;
  spawn(G); drawAll(); updateStats();
}
function onSkillChallengeDone(r){
  skill.results.push({ tpl: G.target, r: r });
  var done = skill.results.length;
  drawAll();
  if(done < 3){
    showOverlay("第" + done + "題 終了",
      "「" + G.target.name + "」一致率 <b>" + r.acc + "%</b>／PPS " + r.pps.toFixed(2) + "／ミス " + r.miss + "セル",
      "次の課題へ", function(){ skill.idx++; nextSkillChallenge(); },
      "チェックをやめる", function(){ skill = null; setMode("train"); });
  } else {
    finishSkill();
  }
}
function finishSkill(){
  var rs = skill.results;
  var avgAcc = rs.reduce(function(a,s){ return a+s.r.acc; }, 0) / 3;
  var avgPps = rs.reduce(function(a,s){ return a+s.r.pps; }, 0) / 3;
  var totalMiss = rs.reduce(function(a,s){ return a+s.r.miss; }, 0);
  var totalTime = rs.reduce(function(a,s){ return a+s.r.time; }, 0);
  var totalHolds = rs.reduce(function(a,s){ return a+s.r.holds; }, 0);
  var missRate = totalMiss / (28*3);

  var sAcc = Math.round(avgAcc);                                        // 精度 0-100
  var sSpd = Math.round(Math.min(100, avgPps / 1.1 * 100));              // 速度: PPS1.1で満点
  var sMiss = Math.round(Math.max(0, 100 - missRate * 220));             // ミス率
  var sHold = Math.round(Math.min(100, totalHolds / 4 * 100));           // ホールド活用: 3題で4回が目安
  var total = Math.round(sAcc*0.45 + sSpd*0.25 + sMiss*0.20 + sHold*0.10);
  var rank = total >= 85 ? "S" : total >= 70 ? "A" : total >= 55 ? "B" : total >= 40 ? "C" : "D";

  var tendency;
  if(sSpd - sAcc >= 18) tendency = "はっきり<b>速度寄り</b>のタイプです。置く判断は速いので、あとは各テンプレの完成形を暗記して精度を底上げすれば、ランクが一段跳ね上がります。";
  else if(sAcc - sSpd >= 18) tendency = "<b>精度寄り</b>のタイプです。形の再現は丁寧で崩れにくいので、迷う時間を減らす反復練習（同じテンプレを連続で回す）が効きます。PPS 0.8超えが次の壁です。";
  else if(sAcc >= 75 && sSpd >= 60) tendency = "<b>バランス型</b>です。精度と速度が両立し始めていて、実戦の開幕でもそのまま使える水準です。DT砲のような高難度テンプレの解法分岐を増やすと伸びます。";
  else if(sMiss <= 45) tendency = "置きミスが多めで、形が崩れてから立て直す場面が見えます。まずは<b>平積みベースと山岳積み</b>で「穴を作らない置き方」を固めるのが近道です。";
  else tendency = "土台づくりの途中段階です。テンプレ練習で各形を2〜3回ずつ回すと、精度が目に見えて上がります。ホールドを「置きにくいピースの一時退避」に使うとミスが減ります。";
  if(totalHolds === 0) tendency += "<br>ホールド未使用でした。順番を入れ替えるだけで置ける形が増えるので、意識して使ってみてください。";

  var rows = rs.map(function(s, i){
    return "<tr><td>第" + (i+1) + "題：" + s.tpl.name + "</td><td>" + s.r.acc + "%</td><td>" + s.r.pps.toFixed(2) + "</td><td>" + fmtTime(s.r.ms) + "</td><td>" + s.r.miss + "</td><td>" + s.r.holds + "回</td></tr>";
  }).join("");

  showResult("スキルチェック結果",
    '<div class="rankFlex"><div style="text-align:center"><div class="rankBig">' + rank + '</div><div style="color:var(--muted);font-size:12px">総合 ' + total + ' / 100点</div></div>' +
    '<div class="scoreBars">' +
      barRow("再現精度", Math.round(avgAcc) + "%", sAcc) +
      barRow("速度 (PPS)", avgPps.toFixed(2), sSpd) +
      barRow("ミス率の低さ", "ミス " + totalMiss + "セル", sMiss) +
      barRow("ホールド活用", totalHolds + "回", sHold) +
    '</div></div>' +
    '<table class="miniTable"><tr><th>課題</th><th>一致率</th><th>PPS</th><th>タイム</th><th>ミス</th><th>ホールド</th></tr>' + rows + '</table>' +
    '<p class="comment"><b>あなたのスキル感：</b>' + tendency + '</p>',
    [
      { label: "もう一度チェック", fn: function(){ beginSkill(); }, primary: true },
      { label: "テンプレ練習へ", fn: function(){ setMode("train"); } }
    ]
  );
  showOverlay("チェック完了", "総合ランク <b>" + rank + "</b>（" + total + "点）<br>下の結果パネルで項目別スコアと講評を確認できます。", "結果を見る", function(){ hideOverlay(); });
  skill = null;
}

/* mode tab events */
document.querySelectorAll("nav.modes button").forEach(function(b){
  b.addEventListener("click", function(){ setMode(b.getAttribute("data-mode")); });
});

/* init */
renderTplList();
renderTplDesc();
renderKeyConfig();
renderPadConfig();
$("modeNote").innerHTML = MODE_NOTES.free;
G = makeGame({}); G.running = false; spawn(G);
drawAll(); updateStats();
showOverlay("フリープレイ", helpLine(), "スタート", function(){ hideOverlay(); if(G){ G.running = true; G.startTime = performance.now(); G.startStamp = G.startTime; } });
