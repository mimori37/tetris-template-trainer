/* input.js — キー設定（環境別プリセット/カスタム）、DAS処理、タッチ、ゲームパッド */
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
  ["presetList", "startPresetList"].forEach(function(id){
    var wrap = document.getElementById(id);
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
  });
}
["presetList", "startPresetList"].forEach(function(id){
  var el = document.getElementById(id);
  if(el){
    el.addEventListener("click", function(e){
      var b = e.target.closest("[data-preset]");
      if(b) applyPreset(b.getAttribute("data-preset"));
    });
  }
});
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
