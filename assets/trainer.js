(function(){
const $ = (s, r=document) => r.querySelector(s);
const esc = s => String(s).replace(/[&<>"]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const areaById = Object.fromEntries(AREAS.map(a => [a.id, a]));
const LETTERS = "ABCDEFGH";
const LS_KEY = "ecprep-v1";

// ---------- state & persistence ----------
let state = { stats:{}, exams:[], generated:[], settings:{ examCount:40, examMinutes:60, passMark:59 } };
function normalize(s){
  s = s || {};
  return { stats:s.stats||{}, exams:Array.isArray(s.exams)?s.exams:[], generated:Array.isArray(s.generated)?s.generated:[],
    settings:Object.assign({ examCount:40, examMinutes:60, passMark:59 }, s.settings||{}) };
}
try { const raw = localStorage.getItem(LS_KEY); if (raw) state = normalize(JSON.parse(raw)); } catch(e){}
function save(){ try { localStorage.setItem(LS_KEY, JSON.stringify(state)); } catch(e){} }

// ---------- question pool ----------
function pool(){ return BASE_QUESTIONS.concat(state.generated); }
function byArea(areaIds){ return pool().filter(q => areaIds.includes(q.area)); }
function shuffle(a){ a = a.slice(); for (let i=a.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); [a[i],a[j]]=[a[j],a[i]]; } return a; }
// Options are shown in a new random order each session; correct indexes are remapped.
function shuffleOpts(q){ const idx = shuffle(q.options.map((_, i) => i)); return Object.assign({}, q, { options: idx.map(i => q.options[i]), correct: q.correct.map(c => idx.indexOf(c)).sort((a, b) => a - b) }); }
function isCorrect(q, chosen){ const c = q.correct.slice().sort().join(","); return chosen.slice().sort().join(",") === c; }
function record(q, ok){
  const s = state.stats[q.id] || { n:0, c:0 };
  s.n++; if (ok) s.c++; s.last = ok ? 1 : 0; s.t = Date.now();
  state.stats[q.id] = s;
}
function areaStats(areaId){
  const qs = pool().filter(q => q.area === areaId);
  let seen=0, mastered=0, n=0, c=0;
  qs.forEach(q => { const s = state.stats[q.id]; if (s){ seen++; n+=s.n; c+=s.c; if (s.last) mastered++; } });
  return { total:qs.length, seen, mastered, acc: n ? Math.round(100*c/n) : null, mastery: qs.length ? Math.round(100*mastered/qs.length) : 0 };
}
function level(p){ return p >= 75 ? "good" : p >= 50 ? "warn" : "bad"; }
function multiHint(q){ if (q.type !== "multi") return ""; const n = q.correct.length; return "Choose " + (["","one","two","three","four"][n] || n) + "."; }

// ---------- routing ----------
let view = "home", session = null, timerId = null;
document.getElementById("tabs").addEventListener("click", e => {
  const b = e.target.closest("button[data-view]"); if (!b) return;
  if (session && session.finished) session = null;
  if (session && session.mode === "exam" && !session.finished && b.dataset.view !== "exam") {
    view = "exam"; render(); showLeaveWarning(); return;
  }
  if (session && session.mode === "practice" && b.dataset.view !== view) session = null;
  view = b.dataset.view; render();
});
function setTabs(){ document.querySelectorAll("#tabs button").forEach(b => b.setAttribute("aria-selected", String(b.dataset.view === view))); }
function render(){
  setTabs();
  const m = $("#main");
  if (session && (view === "practice" || view === "exam" || view === "review") && session.view === view) { renderSession(); return; }
  clearInterval(timerId);
  ({ home:renderHome, practice:renderPracticeSetup, exam:renderExamSetup, review:renderReview })[view](m);
  window.scrollTo({top:0});
}
function go(v){ view = v; render(); }

// ---------- Overview ----------
function renderHome(m){
  const all = pool();
  const answered = Object.keys(state.stats).filter(id => all.some(q => q.id === id)).length;
  let n=0,c=0; Object.values(state.stats).forEach(s => { n+=s.n; c+=s.c; });
  const mastered = all.filter(q => state.stats[q.id]?.last).length;
  const readiness = all.length ? Math.round(100*mastered/all.length) : 0;
  const last = state.exams[state.exams.length-1];
  const rows = AREAS.map(a => {
    const s = areaStats(a.id);
    const pill = s.seen === 0 ? '<span class="pill new">Not started</span>' : '<span class="pill '+level(s.mastery)+'">'+(s.mastery>=75?"Solid":s.mastery>=50?"Getting there":"Needs work")+'</span>';
    return '<tr><td class="name"><b>'+esc(a.name)+'</b><div class="small muted">'+s.total+' questions · '+s.seen+' answered</div></td>'+
      '<td style="width:34%"><div class="bar '+level(s.mastery)+'"><i style="width:'+s.mastery+'%"></i></div></td>'+
      '<td style="width:56px;text-align:right"><b>'+s.mastery+'%</b></td><td>'+pill+'</td>'+
      '<td style="text-align:right"><a class="btn ghost" href="notes/'+a.id+'.html">Notes</a><button class="btn ghost" data-area="'+a.id+'">Practice</button></td></tr>';
  }).join("");
  m.innerHTML = `
  <section class="stack">
    <p class="label">SAP Certified · SuccessFactors Employee Central Core and Position Management</p>
    <h2>Where you stand</h2>
    <p class="muted" style="max-width:65ch">Mastery counts a question as learned when your most recent answer to it was correct. Work through each topic until the bars turn green, then sit an exam simulation. The real exam is hands-on, so also do the practice tasks in the study notes.</p>
  </section>
  <section class="panel kpis">
    <div class="kpi lead"><span class="label">Readiness</span><b>${readiness}%</b><span class="small muted">${mastered} of ${all.length} questions mastered</span></div>
    <div class="kpi"><span class="label">Answered</span><b>${answered}</b><span class="small muted">different questions</span></div>
    <div class="kpi"><span class="label">Accuracy</span><b>${n?Math.round(100*c/n)+"%":"–"}</b><span class="small muted">${n} attempts in total</span></div>
    <div class="kpi"><span class="label">Last exam</span><b>${last?last.score+"%":"–"}</b><span class="small muted">${last?(last.score>=last.pass?"Passed":"Below pass mark")+" · "+new Date(last.date).toLocaleDateString():"No simulation yet"}</span></div>
  </section>
  <section class="stack">
    <div class="row" style="justify-content:space-between"><h3>Mastery by topic area</h3>
      <div class="row"><button class="btn" id="goPractice">Mixed quiz</button><button class="btn primary" id="goExam">Start exam simulation</button></div></div>
    <div class="tablebox"><table class="areas"><thead><tr><th>Topic area</th><th>Mastery</th><th></th><th>Status</th><th></th></tr></thead><tbody>${rows}</tbody></table></div>
  </section>
  ${state.exams.length ? `<section class="stack"><h3>Exam history</h3><div class="tablebox"><table class="areas"><thead><tr><th>Date</th><th>Questions</th><th>Score</th><th>Result</th></tr></thead><tbody>${
    state.exams.slice(-8).reverse().map(x => `<tr><td>${new Date(x.date).toLocaleString()}</td><td>${x.total}</td><td><b>${x.score}%</b></td><td><span class="pill ${x.score>=x.pass?"good":"bad"}">${x.score>=x.pass?"Passed":"Not passed"}</span></td></tr>`).join("")
  }</tbody></table></div></section>`:""}
  <section class="panel stack">
    <h3>Study sources</h3>
    <p class="small muted">The questions here are written for practice from public SAP documentation. They are not official SAP exam questions. Always check details against the sources below.</p>
    <ul class="links small">
      <li><a href="https://learning.sap.com/learning-journeys/configuring-sap-successfactors-employee-central-core-and-position-management" target="_blank" rel="noopener">SAP Learning Journey: Configuring Employee Central Core and Position Management</a></li>
      <li><a href="https://help.sap.com/docs/SAP_SUCCESSFACTORS_EMPLOYEE_CENTRAL" target="_blank" rel="noopener">SAP Help Portal: SAP SuccessFactors Employee Central</a></li>
      <li><a href="guide.html">Exam guide: format, booking and a study plan</a></li>
      <li><a href="https://learning.sap.com/live-sessions/get-certified-implementation-consultant-sap-successfactors-employee-central-core" target="_blank" rel="noopener">SAP Learning: Get Certified live sessions for C_THR81</a></li>
    </ul>
  </section>`;
  m.querySelectorAll("button[data-area]").forEach(b => b.onclick = () => startPractice([b.dataset.area], 10, false));
  $("#goPractice").onclick = () => go("practice");
  $("#goExam").onclick = () => go("exam");
}

// ---------- Topic quiz setup ----------
function renderPracticeSetup(m){
  m.innerHTML = `
  <section class="stack"><h2>Topic quiz</h2><p class="muted" style="max-width:65ch">Pick one or more topic areas. You get the answer and an explanation right after each question.</p></section>
  <section class="panel stack">
    <div class="field"><label>Topic areas</label><div class="chips" id="areaChips">${AREAS.map(a => `<label class="chip"><input type="checkbox" id="pa-${a.id}" value="${a.id}" checked> ${esc(a.name)} <span class="muted small">${areaStats(a.id).total}</span></label>`).join("")}</div>
      <div class="row"><button class="btn ghost" id="allA">Select all</button><button class="btn ghost" id="noneA">Clear</button></div></div>
    <div class="setup">
      <div class="field"><label for="pCount">Number of questions</label><input type="number" id="pCount" min="1" max="200" value="15"></div>
      <div class="field"><label for="pOrder">Which questions first</label><select id="pOrder"><option value="weak">Unanswered and wrong answers first</option><option value="random">Random</option></select></div>
    </div>
    <div class="row"><button class="btn primary" id="pStart">Start quiz</button><span class="small muted" id="pInfo"></span></div>
  </section>`;
  const chosen = () => [...m.querySelectorAll("#areaChips input:checked")].map(i => i.value);
  const info = () => { $("#pInfo").textContent = byArea(chosen()).length + " questions available"; };
  m.querySelectorAll("#areaChips input").forEach(i => i.onchange = info); info();
  $("#allA").onclick = () => { m.querySelectorAll("#areaChips input").forEach(i => i.checked = true); info(); };
  $("#noneA").onclick = () => { m.querySelectorAll("#areaChips input").forEach(i => i.checked = false); info(); };
  $("#pStart").onclick = () => {
    const a = chosen(); if (!a.length) { $("#pInfo").textContent = "Select at least one topic area."; return; }
    startPractice(a, Math.max(1, +$("#pCount").value || 15), $("#pOrder").value === "weak");
  };
}
function weakFirst(qs){
  const score = q => { const s = state.stats[q.id]; if (!s) return 0; return s.last ? 2 : 1; };
  return shuffle(qs).sort((a,b) => score(a) - score(b));
}
function startPractice(areas, count, weak){
  let qs = byArea(areas); qs = weak ? weakFirst(qs) : shuffle(qs);
  qs = qs.slice(0, count).map(shuffleOpts);
  if (!qs.length) return;
  session = { mode:"practice", view:"practice", qs, i:0, answers:qs.map(() => []), checked:qs.map(() => false), finished:false };
  view = "practice"; render();
}
function startReviewSession(qs){
  qs = qs.map(shuffleOpts);
  session = { mode:"practice", view:"review", qs, i:0, answers:qs.map(() => []), checked:qs.map(() => false), finished:false };
  view = "review"; render();
}

// ---------- Exam setup ----------
function renderExamSetup(m){
  const st = state.settings, total = pool().length;
  m.innerHTML = `
  <section class="stack"><h2>Exam simulation</h2><p class="muted" style="max-width:65ch">Questions are drawn across all topic areas, with Position Management at about 15 % and the Employee Central Core areas sharing the rest. You see your result and all explanations only at the end.</p></section>
  <section class="panel stack">
    <div class="setup">
      <div class="field"><label for="eCount">Questions</label><input type="number" id="eCount" min="5" max="200" value="${st.examCount}"></div>
      <div class="field"><label for="eMin">Time in minutes</label><input type="number" id="eMin" min="5" max="300" value="${st.examMinutes}"></div>
      <div class="field"><label for="ePass">Pass mark in %</label><input type="number" id="ePass" min="1" max="100" value="${st.passMark}"></div>
    </div>
    <p class="note">The real C_THR81 exam is now system-based: hands-on tasks in an SAP SuccessFactors system, 3 hours, pass score 59&nbsp;%. This simulation is a timed knowledge check, not a copy of the exam. Pair it with the practice tasks in the <a href="notes/">study notes</a>. Details in the <a href="guide.html">exam guide</a>.</p>
    ${total < st.examCount ? `<p class="small muted">Your question pool has ${total} questions. A longer simulation uses all of them.</p>`:""}
    <div class="row"><button class="btn primary" id="eStart">Start exam</button></div>
  </section>`;
  $("#eStart").onclick = () => {
    st.examCount = Math.max(5, +$("#eCount").value || 80);
    st.examMinutes = Math.max(5, +$("#eMin").value || 180);
    st.passMark = Math.min(100, Math.max(1, +$("#ePass").value || 65));
    save(); startExam();
  };
}
function startExam(){
  const st = state.settings, all = pool();
  const count = Math.min(st.examCount, all.length);
  const weights = Object.fromEntries(AREAS.map(a => [a.id, a.id === "pm" ? 0.15 : 0.85/(AREAS.length-1)]));
  const buckets = Object.fromEntries(AREAS.map(a => [a.id, shuffle(all.filter(q => q.area === a.id))]));
  let picked = [];
  AREAS.forEach(a => { picked = picked.concat(buckets[a.id].splice(0, Math.round(count*weights[a.id]))); });
  let rest = shuffle(Object.values(buckets).flat());
  while (picked.length < count && rest.length) picked.push(rest.pop());
  picked = shuffle(picked.slice(0, count)).map(shuffleOpts);
  session = { mode:"exam", view:"exam", qs:picked, i:0, answers:picked.map(() => []), flags:picked.map(() => false),
    end: Date.now() + st.examMinutes*60000, finished:false, pass: st.passMark, confirm:false };
  view = "exam"; render();
}

// ---------- Session rendering ----------
function renderSession(){
  const m = $("#main"), s = session;
  if (s.finished) { renderResults(m); return; }
  const q = s.qs[s.i], chosen = s.answers[s.i];
  const exam = s.mode === "exam", checked = !exam && s.checked[s.i];
  const area = areaById[q.area];
  const optsHtml = q.options.map((o, k) => {
    let cls = "opt";
    if (chosen.includes(k)) cls += " sel";
    if (checked) { cls += " locked"; if (q.correct.includes(k)) cls += " right"; else if (chosen.includes(k)) cls += " wrong"; }
    const type = q.type === "multi" ? "checkbox" : "radio";
    return `<label class="${cls}"><input type="${type}" name="opt" id="opt-${s.i}-${k}" value="${k}" ${chosen.includes(k)?"checked":""} ${checked?"disabled":""}><span class="letter">${LETTERS[k]}</span><span>${esc(o)}</span></label>`;
  }).join("");
  const ok = checked && isCorrect(q, chosen);
  m.innerHTML = `
  <section class="stack">
    <div class="qhead">
      <span class="label">${exam?"Exam simulation":"Practice"} · Question ${s.i+1} of ${s.qs.length}</span>
      ${exam?`<span class="timer" id="timer">--:--</span>`:`<button class="btn ghost" id="quit">End quiz</button>`}
    </div>
    <div class="progress"><i style="width:${Math.round(100*(s.i+1)/s.qs.length)}%"></i></div>
  </section>
  <article class="qcard">
    <div class="row"><span class="pill new">${esc(area?area.name:q.area)}</span>${q.ai?'<span class="pill warn">AI-generated</span>':""}${exam&&s.flags[s.i]?'<span class="pill warn">Flagged</span>':""}</div>
    <p class="qprompt">${esc(q.prompt)}</p>
    ${q.type==="multi"?`<p class="small muted">${multiHint(q)} Only a fully correct selection scores.</p>`:""}
    <div class="opts" id="opts">${optsHtml}</div>
    ${checked?`<div class="expl"><span class="verdict ${ok?"good":"bad"}">${ok?"Correct.":"Not quite. Correct answer: "+q.correct.map(k=>LETTERS[k]).join(", ")}</span><p>${esc(q.explanation)}</p>${q.ref?`<p class="small muted">Source: ${esc(q.ref)} (SAP Help Portal)</p>`:""}
      ${q.ai?`<div class="row"><button class="btn ghost" id="delGen">This question is wrong, remove it</button></div>`:""}</div>`:""}
    <div class="row" style="justify-content:space-between">
      <div class="row">${exam?`<button class="btn" id="prev" ${s.i===0?"disabled":""}>Previous</button><button class="btn" id="flag">${s.flags[s.i]?"Remove flag":"Flag for review"}</button>`:""}</div>
      <div class="row">${exam
        ? (s.i < s.qs.length-1 ? `<button class="btn primary" id="next">Next</button>` : `<button class="btn primary" id="finish">Finish exam</button>`)
        : (!checked ? `<button class="btn primary" id="check" ${chosen.length?"":"disabled"}>Check answer</button>`
                    : (s.i < s.qs.length-1 ? `<button class="btn primary" id="next">Next question</button>` : `<button class="btn primary" id="finish">See summary</button>`))}</div>
    </div>
  </article>
  ${exam?`<section class="stack"><div class="row" style="justify-content:space-between"><span class="label">Jump to question</span><span class="small muted">${s.answers.filter(a=>a.length).length} of ${s.qs.length} answered</span></div>
    <div class="palette" id="palette">${s.qs.map((_,k)=>`<button class="${s.answers[k].length?"done":""} ${k===s.i?"cur":""} ${s.flags[k]?"flag":""}" data-k="${k}" aria-label="Question ${k+1}">${k+1}</button>`).join("")}</div>
    <div id="confirmBox"></div>
    <div class="row"><button class="btn" id="finish2">Finish exam</button></div></section>`:""}`;

  // option clicks
  if (!checked) m.querySelectorAll("#opts input").forEach(inp => inp.onchange = () => {
    const k = +inp.value;
    if (q.type === "multi") s.answers[s.i] = [...m.querySelectorAll("#opts input:checked")].map(x => +x.value);
    else s.answers[s.i] = [k];
    m.querySelectorAll("#opts .opt").forEach((l, idx) => l.classList.toggle("sel", s.answers[s.i].includes(idx)));
    const c = $("#check"); if (c) c.disabled = !s.answers[s.i].length;
    if (exam) { const pb = m.querySelector(`#palette button[data-k="${s.i}"]`); if (pb) pb.classList.toggle("done", s.answers[s.i].length>0); }
  });
  const on = (id, fn) => { const el = $("#"+id); if (el) el.onclick = fn; };
  on("check", () => { s.checked[s.i] = true; record(q, isCorrect(q, s.answers[s.i])); save(); renderSession(); });
  on("next", () => { s.i++; renderSession(); window.scrollTo({top:0}); });
  on("prev", () => { s.i--; renderSession(); });
  on("flag", () => { s.flags[s.i] = !s.flags[s.i]; renderSession(); });
  on("quit", () => { s.finished = true; renderSession(); });
  on("delGen", () => { state.generated = state.generated.filter(g => g.id !== q.id); delete state.stats[q.id]; save(); s.qs.splice(s.i,1); s.answers.splice(s.i,1); s.checked.splice(s.i,1); if (!s.qs.length){ session=null; render(); return; } if (s.i>=s.qs.length) s.i=s.qs.length-1; renderSession(); });
  const askFinish = () => {
    const open = s.answers.filter(a => !a.length).length, flagged = s.flags.filter(Boolean).length;
    $("#confirmBox").innerHTML = `<div class="confirm"><p><b>Finish the exam now?</b> ${open?open+" unanswered question"+(open>1?"s":"")+". ":""}${flagged?flagged+" flagged. ":""}You cannot change answers afterwards.</p><div class="row"><button class="btn primary" id="yesFinish">Finish and see result</button><button class="btn" id="noFinish">Keep working</button></div></div>`;
    $("#yesFinish").onclick = finishExam; $("#noFinish").onclick = () => $("#confirmBox").innerHTML = "";
    $("#confirmBox").scrollIntoView({block:"center"});
  };
  if (exam) { on("finish", askFinish); on("finish2", askFinish); }
  else on("finish", () => { s.finished = true; renderSession(); });
  m.querySelectorAll("#palette button").forEach(b => b.onclick = () => { s.i = +b.dataset.k; renderSession(); });
  if (exam) startTimer();
}
function showLeaveWarning(){ const b = $("#confirmBox"); if (b) { b.innerHTML = `<p class="note">An exam is running. Finish it before you switch to another tab.</p>`; b.scrollIntoView({block:"center"}); } }
function startTimer(){
  clearInterval(timerId);
  const tick = () => {
    const t = $("#timer"); if (!session || session.finished) { clearInterval(timerId); return; }
    const left = Math.max(0, session.end - Date.now());
    if (t) { const mm = Math.floor(left/60000), ss = Math.floor(left/1000)%60; t.textContent = String(mm).padStart(2,"0")+":"+String(ss).padStart(2,"0"); t.classList.toggle("low", left < 5*60000); }
    if (left <= 0) finishExam();
  };
  tick(); timerId = setInterval(tick, 1000);
}
function finishExam(){
  const s = session; if (!s || s.finished) return;
  clearInterval(timerId);
  let right = 0; const per = {};
  s.qs.forEach((q, k) => { const ok = isCorrect(q, s.answers[k]); if (ok) right++; record(q, ok);
    per[q.area] = per[q.area] || {n:0,c:0}; per[q.area].n++; if (ok) per[q.area].c++; });
  const score = Math.round(100*right/s.qs.length);
  s.result = { right, score, per };
  state.exams.push({ date:Date.now(), total:s.qs.length, right, score, pass:s.pass, per });
  if (state.exams.length > 50) state.exams = state.exams.slice(-50);
  save(); s.finished = true; renderSession(); window.scrollTo({top:0});
}
function renderResults(m){
  const s = session, exam = s.mode === "exam";
  let items = s.qs.map((q,k) => ({ q, a:s.answers[k], done: exam || s.checked[k] })).filter(x => x.done);
  const right = items.filter(x => isCorrect(x.q, x.a)).length;
  const score = items.length ? Math.round(100*right/items.length) : 0;
  const per = {}; items.forEach(x => { per[x.q.area] = per[x.q.area] || {n:0,c:0}; per[x.q.area].n++; if (isCorrect(x.q,x.a)) per[x.q.area].c++; });
  const passed = exam ? score >= s.pass : null;
  const wrong = items.filter(x => !isCorrect(x.q, x.a));
  const rev = x => { const ok = isCorrect(x.q, x.a); return `<details class="rev"><summary><span class="mark ${ok?"good":"bad"}">${ok?"✓":"✗"}</span><span>${esc(x.q.prompt)}</span></summary><div class="body">
    <ul class="ans">${x.q.options.map((o,k)=>`<li class="${x.q.correct.includes(k)?"c":(x.a.includes(k)?"x":"")}">${LETTERS[k]}. ${esc(o)}</li>`).join("")}</ul>
    <p class="small">${esc(x.q.explanation)}</p>${x.q.ref?`<p class="small muted">Source: ${esc(x.q.ref)}</p>`:""}</div></details>`; };
  m.innerHTML = `
  <section class="stack">
    <p class="label">${exam?"Exam result":"Quiz summary"}</p>
    <div class="score"><b>${score}%</b><span class="muted">${right} of ${items.length} correct</span>${exam?`<span class="pill ${passed?"good":"bad"}">${passed?"Passed":"Not passed"} · pass mark ${s.pass}%</span>`:""}</div>
  </section>
  ${items.length ? `<section class="stack"><h3>By topic area</h3><div class="tablebox"><table class="areas"><tbody>${
    AREAS.filter(a => per[a.id]).map(a => { const p = Math.round(100*per[a.id].c/per[a.id].n);
      return `<tr><td class="name">${esc(a.name)}</td><td style="width:40%"><div class="bar ${level(p)}"><i style="width:${p}%"></i></div></td><td style="text-align:right"><b>${per[a.id].c}/${per[a.id].n}</b></td></tr>`; }).join("")
  }</tbody></table></div></section>` : `<p class="empty">No questions were answered.</p>`}
  <div class="row">${wrong.length?`<button class="btn primary" id="retryWrong">Practice the ${wrong.length} wrong question${wrong.length>1?"s":""}</button>`:""}<button class="btn" id="toHome">Back to overview</button></div>
  ${items.length?`<section class="stack"><h3>Review answers</h3>${wrong.map(rev).join("")}${items.filter(x=>isCorrect(x.q,x.a)).map(rev).join("")}</section>`:""}`;
  const rw = $("#retryWrong"); if (rw) rw.onclick = () => startReviewSession(shuffle(wrong.map(x => x.q)));
  $("#toHome").onclick = () => { session = null; go("home"); };
}

// ---------- Weak spots ----------
function renderReview(m){
  const weak = pool().filter(q => state.stats[q.id] && !state.stats[q.id].last);
  const unseen = pool().filter(q => !state.stats[q.id]);
  m.innerHTML = `
  <section class="stack"><h2>Weak spots</h2><p class="muted" style="max-width:65ch">These are the questions you answered wrong last time. Answer one correctly and it leaves this list.</p></section>
  <div class="row"><button class="btn primary" id="rwAll" ${weak.length?"":"disabled"}>Practice all ${weak.length} weak questions</button>${unseen.length?`<button class="btn" id="rwNew">Practice ${Math.min(20,unseen.length)} unseen questions</button>`:""}</div>
  ${weak.length ? `<section class="stack">${AREAS.map(a => { const w = weak.filter(q => q.area === a.id); if (!w.length) return "";
      return `<div class="stack"><div class="row" style="justify-content:space-between"><h3>${esc(a.name)} <span class="pill bad">${w.length}</span></h3><button class="btn ghost" data-a="${a.id}">Practice these</button></div>${w.map(q=>`<p class="small" style="padding-left:12px;border-left:2px solid var(--line)">${esc(q.prompt)}</p>`).join("")}</div>`; }).join("")}</section>`
  : `<p class="empty">No weak spots yet. Wrong answers from quizzes and exams collect here.</p>`}`;
  const a = $("#rwAll"); if (a) a.onclick = () => startReviewSession(shuffle(weak));
  const n = $("#rwNew"); if (n) n.onclick = () => startReviewSession(shuffle(unseen).slice(0,20));
  m.querySelectorAll("button[data-a]").forEach(b => b.onclick = () => startReviewSession(shuffle(weak.filter(q => q.area === b.dataset.a))));
}

// ---------- Deep links: index.html#quiz=<areaId> starts a topic quiz ----------
function fromHash(){
  const m = location.hash.match(/^#quiz=([a-z]+)$/);
  if (m && areaById[m[1]]) { history.replaceState(null, "", location.pathname); startPractice([m[1]], 10, true); return true; }
  return false;
}
window.addEventListener("hashchange", fromHash);

if (!fromHash()) render();
})();
