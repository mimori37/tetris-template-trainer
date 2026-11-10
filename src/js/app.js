/* app.js — 画面遷移・モード・判定・スキルチェック・ロードマップ・起動処理 */
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
  var wrap = $("tplChips"); if(!wrap) return; wrap.innerHTML = "";
  TEMPLATES.forEach(function(t){
    var b = document.createElement("button");
    b.type = "button"; b.className = "tplChip" + (t.id === selectedTpl.id ? " active" : "");
    b.textContent = t.name;
    b.addEventListener("click", function(){
      selectedTpl = t; renderTplList(); renderTplDesc(); renderRoadmap();
      if(mode === "train") startCurrent();
    });
    wrap.appendChild(b);
  });
}
function renderTplDesc(){
  var t = selectedTpl;
  $("tplDesc").innerHTML =
    '<p><span class="k">' + t.name + '：</span>' + t.tag + '</p>' +
    '<p><span class="k">出現順：</span><b style="letter-spacing:.14em">' + t.seq.join(" → ") + '</b>（ホールドで入れ替え可）</p>' +
    '<p style="color:var(--muted)">狙い・特徴・コツは「テンプレ図鑑」にまとめています。</p>';
}
var MODE_NOTES = {
  free: "通常のエンドレスモード。10ラインごとにレベルが上がり、落下速度が速くなります。Tスピン・コンボ・B2B・パーフェクトクリアも採点されます。",
  train: "選んだテンプレの<b>目標シルエット</b>が盤面に薄く表示されます。出現順どおりに1巡目（7ピース）を置き切りると、目標28セルとの一致率・所要時間・PPS・置きミスを判定します。ライン消去は止めてあるので、形づくりに集中できます。",
  skill: "ランダムなテンプレ<b>3題</b>を連続で出題し、精度・速度・ミス率・ホールド活用を総合採点して S〜D ランクと講評を出します。まずはテンプレ練習で各形を覚えてから挑戦を。",
  ghost: "選んだテンプレを<b>AIゴーストと同時に</b>積みます。AIは約9.5秒で正解配置を完成させるペースで並走します。先に置き切って、一致率でも負けないのが目標です。"
};
function setMode(m){
  mode = m;
  document.querySelectorAll("nav.modes button").forEach(function(b){
    b.classList.toggle("active", b.getAttribute("data-mode") === m);
  });
  $("modeNote").innerHTML = MODE_NOTES[m];
  $("ghostPanel").hidden = m !== "ghost";
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
  stopGhostAi();
  hideResult();
  $("challengeBar").classList.remove("show");
  if(mode === "free"){
    G = makeGame({});
    G.running = true;
    hideOverlay();
    spawn(G);
  } else if(mode === "train" || mode === "ghost"){
    G = makeGame({ queue: selectedTpl.seq.slice(), noClear: true, target: selectedTpl });
    G.running = true;
    hideOverlay();
    spawn(G);
    $("trainStats").innerHTML = '<div class="modeNote">課題：<b style="color:var(--text)">' + selectedTpl.name + '</b>／7ピースを置き切ると判定します。</div>';
    if(mode === "ghost") startGhostAi(selectedTpl);
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
  if((mode === "train" || mode === "ghost") && G.target){
    var best = loadBest();
    if(!best[G.target.id] || r.acc > best[G.target.id]){ best[G.target.id] = r.acc; saveBest(best); }
  }
  var ghostLine = "";
  if(mode === "ghost" && ghostAi){
    var aiMs = ghostAi.doneAt() ? ghostAi.doneAt() - ghostAi.startStamp : null;
    ghostLine = (aiMs == null || r.ms <= aiMs)
      ? "🏆 AIゴーストに勝利！（あなた " + fmtTime(r.ms) + (aiMs != null ? " ／ AI " + fmtTime(aiMs) : " ／ AIは未完成") + "）"
      : "AIゴーストの勝ち（AI " + fmtTime(aiMs) + " ／ あなた " + fmtTime(r.ms) + "）。あと少しで届きます。";
    stopGhostAi();
  }
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
    '<p class="comment">' + (ghostLine ? "<b>" + ghostLine + "</b><br>" : "") + comment + '<br><span style="color:var(--muted);font-size:12.5px">緑＝目標どおりのセル／赤＝目標外に置いたセル／赤破線＝置けなかった目標セル。ホールド使用：' + r.holds + '回</span></p>',
    [
      { label: "もう一度挑戦 (R)", fn: function(){ startCurrent(); }, primary: true },
      { label: "テンプレ図鑑で選ぶ", fn: function(){ hideResult(); switchView("roadmap"); } }
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

/* ============================================================
   自己ベスト（テンプレ別・一致率）
   ============================================================ */
var BEST_LS = "tetris-trainer-best-v1";
function loadBest(){
  try{ return JSON.parse(localStorage.getItem(BEST_LS) || "{}") || {}; }catch(e){ return {}; }
}
function saveBest(b){
  try{ localStorage.setItem(BEST_LS, JSON.stringify(b)); }catch(e){}
}

/* ============================================================
   テンプレ図鑑（習得ロードマップ）
   ============================================================ */
var ROADMAP_ORDER = ["hira", "yama", "tki", "dt", "pc"];
function drawRoadFig(cv, t){
  var dpr = Math.min(2, window.devicePixelRatio || 1);
  cv.width = 118 * dpr; cv.height = 64 * dpr;
  var ctx = cv.getContext("2d");
  var W = 118, H = 64;
  ctx.setTransform(dpr,0,0,dpr,0,0);
  ctx.clearRect(0,0,W,H);
  var size = 11, ox = (W - size*10)/2, oy = H - size*5 - 4;
  t.placements.forEach(function(pl, i){
    ctx.fillStyle = COLORS[t.seq[i]];
    pl.forEach(function(c){
      var px = ox + c[0]*size, py = oy + (c[1]-15)*size;
      ctx.fillRect(px+1, py+1, size-2, size-2);
    });
  });
}
function renderRoadmap(){
  var wrap = $("roadList"); if(!wrap) return;
  var best = loadBest();
  wrap.innerHTML = "";
  ROADMAP_ORDER.forEach(function(id, idx){
    var t = TEMPLATES.filter(function(x){ return x.id === id; })[0];
    if(!t) return;
    var card = document.createElement("div");
    card.className = "roadCard" + (t.id === selectedTpl.id ? " sel" : "");
    var b = best[t.id];
    card.innerHTML =
      '<span class="stepBadge">STEP ' + (idx+1) + '</span>' +
      '<div class="roadMain">' +
        '<div class="nm"><span>' + t.name + '</span><span class="diff">' + t.diffLabel + '</span></div>' +
        '<div class="tag">' + t.tag + '</div>' +
        '<p class="aim">' + t.aim + '</p>' +
        '<details><summary>特徴・コツ・出現順を見る</summary>' +
          '<p><span class="k">特徴：</span>' + t.feat + '</p>' +
          '<p><span class="k">コツ：</span>' + t.tips + '</p>' +
          '<p><span class="k">出現順：</span><b style="letter-spacing:.14em">' + t.seq.join(" → ") + '</b></p>' +
        '</details>' +
        '<div class="bestRow"><span>自己ベスト</span><span class="bestTrack"><span class="bestFill" style="display:block;width:' + (b || 0) + '%"></span></span><b>' + (b == null ? "未挑戦" : b + "%") + '</b></div>' +
      '</div>';
    var fig = document.createElement("canvas");
    fig.className = "roadFig";
    card.appendChild(fig);
    var btns = document.createElement("div");
    btns.className = "roadBtns";
    var btn = document.createElement("button");
    btn.type = "button"; btn.className = "roadBtn"; btn.textContent = "このテンプレで練習する";
    btn.addEventListener("click", function(){
      selectedTpl = t; renderTplList(); renderTplDesc();
      switchView("play"); setMode("train");
    });
    btns.appendChild(btn);
    var demoBtn = document.createElement("button");
    demoBtn.type = "button"; demoBtn.className = "roadBtn sub"; demoBtn.textContent = "お手本を見る";
    demoBtn.addEventListener("click", function(){ openDemo(t); });
    btns.appendChild(demoBtn);
    card.appendChild(btns);
    wrap.appendChild(card);
    drawRoadFig(fig, t);
  });
}

/* ============================================================
   AIプレイヤー（お手本デモ / ゴースト戦）
   テンプレの正解配置データから (回転, x) の手順を逆算し、
   実際のエンジン関数で1手ずつ実行する。
   ============================================================ */
function solveTemplate(t){
  var N = t.seq.length;
  function tryPlace(grid, idx){
    var type = t.seq[idx];
    var target = {};
    t.placements[idx].forEach(function(c){ target[c[0] + "," + (c[1] + HIDDEN)] = 1; });
    var actions = solvePiece(grid, type, target);
    if(!actions) return null;
    var g2 = grid.map(function(r){ return r.slice(); });
    var st = { grid: g2, cur: { type: type, rot: 0, x: 3, y: HIDDEN - 2 }, paused: false, over: false, finished: false, grounded: false, lockAcc: 0, lockResets: 0, lastRotate: false, lastKickIdx: 0 };
    if(collide(st, type, 0, st.cur.x, st.cur.y)) st.cur.y -= 1;
    actions.forEach(function(a){
      if(a === "left") tryMove(st, -1);
      else if(a === "right") tryMove(st, 1);
      else if(a === "rotR") tryRotate(st, 1);
      else if(a === "rotL") tryRotate(st, -1);
      else if(a === "rot180") tryRotate180(st);
      else if(a === "down"){ if(!collide(st, type, st.cur.rot, st.cur.x, st.cur.y + 1)) st.cur.y++; }
    });
    cellsOf(type, st.cur.rot, st.cur.x, st.cur.y).forEach(function(c){ g2[c[1]][c[0]] = type; });
    return { actions: actions, grid: g2 };
  }
  function dfs(grid, queue, current, held, canHold, plan){
    if(plan.filter(function(e){ return !e.hold; }).length === N) return plan;
    var placed = tryPlace(grid, current);
    if(placed){
      var next = queue.length ? queue[0] : held;
      var rest = queue.length ? queue.slice(1) : [];
      var heldAfter = queue.length ? held : null;
      var plan2 = plan.concat([{ idx: current, actions: placed.actions }]);
      if(next == null){
        if(plan2.filter(function(e){ return !e.hold; }).length === N) return plan2;
      } else {
        var r = dfs(placed.grid, rest, next, heldAfter, true, plan2);
        if(r) return r;
      }
    }
    if(canHold && queue.length){
      if(held != null){
        var r2 = dfs(grid, queue, held, current, false, plan.concat([{ hold: true }]));
        if(r2) return r2;
      } else if(queue.length){
        var r3 = dfs(grid, queue.slice(1), queue[0], current, false, plan.concat([{ hold: true }]));
        if(r3) return r3;
      }
    }
    return null;
  }
  var queue = [];
  for(var i=1;i<N;i++) queue.push(i);
  return dfs(emptyGrid(), queue, 0, null, true, []);
}
function solvePiece(grid, type, target){
  var gridRef = { grid: grid };
  function scratch(x, y, r){
    return { grid: grid, cur: { type: type, rot: r, x: x, y: y }, paused: false, over: false, finished: false, grounded: false, lockAcc: 0, lockResets: 0, lastRotate: false, lastKickIdx: 0 };
  }
  function isGoal(x, y, r){
    var cs = cellsOf(type, r, x, y);
    for(var j=0;j<cs.length;j++){ if(!target[cs[j][0] + "," + cs[j][1]]) return false; }
    return collide(gridRef, type, r, x, y + 1);
  }
  var startY = HIDDEN - 2;
  if(collide(gridRef, type, 0, 3, startY)) startY -= 1;
  var q = [{ x: 3, y: startY, r: 0, path: [] }];
  var seen = {}; seen["3," + startY + ",0"] = 1;
  while(q.length){
    var n = q.shift();
    if(isGoal(n.x, n.y, n.r)) return n.path;
    if(n.path.length > 70) continue;
    var cand = [];
    var s1 = scratch(n.x, n.y, n.r); tryMove(s1, -1); if(s1.cur.x !== n.x) cand.push({ x: s1.cur.x, y: s1.cur.y, r: s1.cur.rot, a: "left" });
    var s2 = scratch(n.x, n.y, n.r); tryMove(s2, 1); if(s2.cur.x !== n.x) cand.push({ x: s2.cur.x, y: s2.cur.y, r: s2.cur.rot, a: "right" });
    var s3 = scratch(n.x, n.y, n.r); tryRotate(s3, 1); if(s3.cur.rot !== n.r || s3.cur.x !== n.x || s3.cur.y !== n.y) cand.push({ x: s3.cur.x, y: s3.cur.y, r: s3.cur.rot, a: "rotR" });
    var s4 = scratch(n.x, n.y, n.r); tryRotate(s4, -1); if(s4.cur.rot !== n.r || s4.cur.x !== n.x || s4.cur.y !== n.y) cand.push({ x: s4.cur.x, y: s4.cur.y, r: s4.cur.rot, a: "rotL" });
    var s5 = scratch(n.x, n.y, n.r); tryRotate180(s5); if(s5.cur.rot !== n.r || s5.cur.x !== n.x || s5.cur.y !== n.y) cand.push({ x: s5.cur.x, y: s5.cur.y, r: s5.cur.rot, a: "rot180" });
    if(!collide(gridRef, type, n.r, n.x, n.y + 1)) cand.push({ x: n.x, y: n.y + 1, r: n.r, a: "down" });
    for(var k=0;k<cand.length;k++){
      var c = cand[k], kk = c.x + "," + c.y + "," + c.r;
      if(seen[kk]) continue;
      seen[kk] = 1;
      q.push({ x: c.x, y: c.y, r: c.r, path: n.path.concat([c.a]) });
    }
  }
  return null;
}
function drawAiBoard(cv, g){
  if(!cv || !g) return;
  var ctx = cv.getContext("2d");
  var cell = cv.width / COLS;
  ctx.fillStyle = cssVar("--board-bg"); ctx.fillRect(0, 0, cv.width, cv.height);
  if(g.target){
    ctx.fillStyle = cssVar("--guide-fill");
    g.target.targetSet.forEach(function(k){
      var p = k.split(","); var gx = +p[0], gy = +p[1];
      if(!(g.grid[gy+HIDDEN] && g.grid[gy+HIDDEN][gx])) ctx.fillRect(gx*cell+1, gy*cell+1, cell-2, cell-2);
    });
  }
  for(var ry=HIDDEN; ry<ROWS; ry++){
    for(var x=0; x<COLS; x++){
      var v = g.grid[ry][x];
      if(v) drawCell(ctx, x, ry-HIDDEN, cell, COLORS[v], 1);
    }
  }
  if(g.cur){
    cellsOf(g.cur.type, g.cur.rot, g.cur.x, g.cur.y).forEach(function(c){
      if(c[1] >= HIDDEN) drawCell(ctx, c[0], c[1]-HIDDEN, cell, COLORS[g.cur.type], 1);
    });
  }
}
function createAiRunner(t, cv, opts){
  var plan = solveTemplate(t);
  /* 終端で spawn が全体の finishTrain を呼ばないよう、予備ピースを1つ足す */
  var g = makeGame({ queue: t.seq.concat(["T"]), noClear: true, target: t });
  g.running = true;
  spawn(g);
  var idx = 0, actIdx = 0, placedCount = 0, timer = null, done = false, doneAt = null;
  function draw(){ drawAiBoard(cv, g); if(opts.onProgress) opts.onProgress(placedCount, t.seq.length, done); }
  function step(){
    if(!plan || idx >= plan.length){ finish(); return; }
    var p = plan[idx];
    if(p.hold){ doHold(g); idx++; draw(); return; }
    if(actIdx < p.actions.length){
      var a = p.actions[actIdx++];
      if(a === "left") tryMove(g, -1);
      else if(a === "right") tryMove(g, 1);
      else if(a === "rotR") tryRotate(g, 1);
      else if(a === "rotL") tryRotate(g, -1);
      else if(a === "rot180") tryRotate180(g);
      else if(a === "down"){ if(!collide(g, g.cur.type, g.cur.rot, g.cur.x, g.cur.y + 1)) g.cur.y++; }
      draw();
      return;
    }
    hardDrop(g); idx++; actIdx = 0; placedCount++; draw();
    if(placedCount >= t.seq.length) finish();
  }
  function finish(){
    if(done) return;
    done = true; doneAt = performance.now(); stop();
    draw();
    if(opts.onDone) opts.onDone();
  }
  function start(){ if(!timer && !done) timer = setInterval(step, opts.stepMs); }
  function stop(){ if(timer){ clearInterval(timer); timer = null; } }
  draw();
  return {
    start: start, stop: stop, game: g, placed: function(){ return placedCount; },
    isDone: function(){ return done; }, doneAt: function(){ return doneAt; },
    startStamp: 0
  };
}

/* ---- お手本デモ ---- */
var demoRunner = null, demoTimer = null, demoTpl = null, demoSpeed = 105;
function stopDemo(){
  if(demoRunner){ demoRunner.stop(); demoRunner = null; }
  if(demoTimer){ clearTimeout(demoTimer); demoTimer = null; }
}
function launchDemo(){
  stopDemo();
  if(!demoTpl) return;
  demoRunner = createAiRunner(demoTpl, $("demoCv"), {
    stepMs: demoSpeed,
    onDone: function(){
      demoTimer = setTimeout(function(){ if($("demoModal").classList.contains("show")) launchDemo(); }, 1300);
    }
  });
  demoRunner.start();
}
function openDemo(t){
  demoTpl = t;
  selectedTpl = t; renderTplList(); renderTplDesc();
  $("demoTitle").textContent = "お手本デモ：" + t.name;
  $("demoModal").classList.add("show");
  launchDemo();
}
function closeDemo(){
  stopDemo();
  $("demoModal").classList.remove("show");
}
document.querySelectorAll("[data-demo-speed]").forEach(function(b){
  b.addEventListener("click", function(){ demoSpeed = +b.getAttribute("data-demo-speed"); launchDemo(); });
});
$("demoCloseBtn").addEventListener("click", closeDemo);
$("demoPracticeBtn").addEventListener("click", function(){
  var t = demoTpl;
  closeDemo();
  if(t){ selectedTpl = t; renderTplList(); renderTplDesc(); switchView("play"); setMode("train"); }
});

/* ---- ゴースト戦 ---- */
var ghostAi = null;
function stopGhostAi(){
  if(ghostAi){ ghostAi.stop(); ghostAi = null; }
}
function startGhostAi(t){
  stopGhostAi();
  var cv = $("ghostCv");
  var plan = solveTemplate(t);
  var totalSteps = 20;
  if(plan){
    totalSteps = 0;
    plan.forEach(function(p){ totalSteps += p.hold ? 1 : p.actions.length + 1; });
  }
  var stepMs = Math.max(45, Math.round(9500 / totalSteps));
  ghostAi = createAiRunner(t, cv, {
    stepMs: stepMs,
    onProgress: function(n, total, done){
      var el = $("ghostStatus");
      if(el) el.textContent = done ? "AIは完成しました。あなたの判定は置き切った時点で行われます" : ("AI進捗：" + n + " / " + total + " ピース");
    },
    onDone: function(){
      var el = $("ghostStatus");
      if(el) el.textContent = "AIが先に完成！ 判定はあなたが置き切った時点で行われます";
    }
  });
  ghostAi.startStamp = performance.now();
  ghostAi.start();
}

/* ============================================================
   記録の引き継ぎ（サーバーなし：データをリンク自体に埋め込む）
   ============================================================ */
function b64encode(str){
  var bytes = new TextEncoder().encode(str);
  var bin = "";
  bytes.forEach(function(b){ bin += String.fromCharCode(b); });
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function b64decode(s){
  s = s.replace(/-/g, "+").replace(/_/g, "/");
  while(s.length % 4) s += "=";
  var bin = atob(s);
  var bytes = new Uint8Array(bin.length);
  for(var i=0;i<bin.length;i++) bytes[i] = bin.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}
function buildSyncLink(){
  var payload = {
    v: 1,
    best: loadBest(),
    key: { bindings: keyConfig.bindings, preset: activePreset },
    pad: padSettings,
    theme: curTheme
  };
  return location.origin + location.pathname + "#t=" + b64encode(JSON.stringify(payload));
}
function importFromHash(){
  var m = location.hash.match(/^#t=(.+)$/);
  if(!m) return false;
  try{
    var payload = JSON.parse(b64decode(m[1]));
    if(payload.best) saveBest(payload.best);
    if(payload.key && payload.key.bindings){
      keyConfig = { bindings: payload.key.bindings, preset: payload.key.preset || "custom" };
      bindings = keyConfig.bindings;
      activePreset = keyConfig.preset;
      saveBindings();
    }
    if(payload.pad){
      padSettings = payload.pad;
      savePadSettings();
    }
    if(payload.theme) applyTheme(payload.theme);
    history.replaceState(null, "", location.pathname);
    var st = $("syncStatus");
    if(st) st.textContent = "リンクから記録を取り込みました（キー設定・自己ベスト・テーマ）。";
    return true;
  }catch(e){
    return false;
  }
}
$("syncCopyBtn").addEventListener("click", function(){
  var link = buildSyncLink();
  var done = function(){ $("syncStatus").textContent = "引き継ぎリンクをコピーしました。別端末で開くと記録が取り込まれます。"; };
  if(navigator.clipboard && navigator.clipboard.writeText){
    navigator.clipboard.writeText(link).then(done, function(){ window.prompt("このリンクをコピーしてください", link); });
  } else {
    window.prompt("このリンクをコピーしてください", link);
  }
});
$("syncQrBtn").addEventListener("click", function(){
  var box = $("qrBox");
  if(!box.hidden){ box.hidden = true; return; }
  try{
    var qr = qrcode(0, "L");
    qr.addData(buildSyncLink());
    qr.make();
    box.innerHTML = qr.createSvgTag(4, 10) + '<div class="qrCap">スマホのカメラで読み取ると、この端末の記録が取り込まれます</div>';
    box.hidden = false;
  }catch(e){
    $("syncStatus").textContent = "QRコードを作れませんでした（データ量オーバー）。リンクのコピーを使ってください。";
  }
});


/* ============================================================
   ビュー切替（プレイ / 図鑑 / 設定）
   ============================================================ */
var currentView = "play";
function switchView(v){
  currentView = v;
  $("viewPlay").hidden = v !== "play";
  $("viewRoadmap").hidden = v !== "roadmap";
  $("viewSettings").hidden = v !== "settings";
  document.querySelector("nav.modes").style.display = v === "play" ? "" : "none";
  document.querySelectorAll("nav.views button").forEach(function(b){
    b.classList.toggle("active", b.getAttribute("data-view") === v);
  });
  if(v !== "play" && typeof G !== "undefined" && G && G.running && !G.paused && !G.over && !G.finished) togglePause();
  if(v === "roadmap") renderRoadmap();
  window.scrollTo({ top: 0 });
}
document.querySelectorAll("nav.views button").forEach(function(b){
  b.addEventListener("click", function(){ switchView(b.getAttribute("data-view")); });
});

/* ============================================================
   起動ポップアップ
   ============================================================ */
var SKIP_START_LS = "tetris-trainer-skip-start-v1";
function closeStartModal(){
  $("startModal").classList.remove("show");
  var cb = $("skipStart");
  if(cb && cb.checked){ try{ localStorage.setItem(SKIP_START_LS, "1"); }catch(e){} }
}
document.querySelectorAll("[data-start-mode]").forEach(function(b){
  b.addEventListener("click", function(){
    closeStartModal();
    switchView("play");
    setMode(b.getAttribute("data-start-mode"));
  });
});
var themeBtnEl = $("themeBtn"); if(themeBtnEl) themeBtnEl.addEventListener("click", toggleTheme);
var startThemeBtnEl = $("startThemeBtn"); if(startThemeBtnEl) startThemeBtnEl.addEventListener("click", toggleTheme);

/* mode tab events */
document.querySelectorAll("nav.modes button").forEach(function(b){
  b.addEventListener("click", function(){ setMode(b.getAttribute("data-mode")); });
});

/* init */
importFromHash();
applyTheme(curTheme);
renderTplList();
renderTplDesc();
renderKeyConfig();
renderPadConfig();
$("modeNote").innerHTML = MODE_NOTES.free;
G = makeGame({}); G.running = false; spawn(G);
drawAll(); updateStats();
showOverlay("フリープレイ", helpLine(), "スタート", function(){ hideOverlay(); if(G){ G.running = true; G.startTime = performance.now(); G.startStamp = G.startTime; } });
(function(){
  var skip = false;
  try{ skip = localStorage.getItem(SKIP_START_LS) === "1"; }catch(e){}
  if(!skip) $("startModal").classList.add("show");
})();
