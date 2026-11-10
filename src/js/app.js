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
  if(mode === "train" && G.target){
    var best = loadBest();
    if(!best[G.target.id] || r.acc > best[G.target.id]){ best[G.target.id] = r.acc; saveBest(best); }
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
    '<p class="comment">' + comment + '<br><span style="color:var(--muted);font-size:12.5px">緑＝目標どおりのセル／赤＝目標外に置いたセル／赤破線＝置けなかった目標セル。ホールド使用：' + r.holds + '回</span></p>',
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
    var btn = document.createElement("button");
    btn.type = "button"; btn.className = "roadBtn"; btn.textContent = "このテンプレで練習する";
    btn.addEventListener("click", function(){
      selectedTpl = t; renderTplList(); renderTplDesc();
      switchView("play"); setMode("train");
    });
    card.appendChild(btn);
    wrap.appendChild(card);
    drawRoadFig(fig, t);
  });
}

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
