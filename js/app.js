// ===== 姐姐的小膳坊 V3 - 主逻辑（支持菜品图片） =====

let dishes = [];
try {
  const saved = localStorage.getItem("xiaoshanfang_dishes");
  dishes = saved ? JSON.parse(saved) : JSON.parse(JSON.stringify(DISHES));
} catch(e) { dishes = JSON.parse(JSON.stringify(DISHES)); }

// 确保每个菜品有svg和image字段
dishes.forEach(d => {
  if (!d.svg) d.svg = genFoodSVG(d.name, "#f472b6", "#f9a8d4", "😏");
  if (d.image === undefined) d.image = null;
});

const CATEGORIES = ["全部","拌饭盖饭","家常荤菜","家常素菜","凉菜","汤羹类","新疆风味"];
const RATING_TEXTS = ["", "😅 一般般吧…", "🙂 还行~", "😊 还不错！", "😋 挺好吃！", "🤤 太好吃了吧！！"];

let currentCategory = "全部";
let currentDetailIndex = 0;
let isDrawing = false;
let currentRating = 0;
let selectedRatingDishId = null;
let uploadedPhoto = null;

// ===== 金币 =====
function getCoins() { return parseInt(localStorage.getItem("xs_coins") || "0"); }
function addCoins(n) {
  let c = getCoins() + n;
  localStorage.setItem("xs_coins", c.toString());
  updateCoinDisplay();
  if (c >= 100 && !localStorage.getItem("xs_egg_100")) setTimeout(showEgg, 300);
}
function updateCoinDisplay() { document.getElementById("coinCount").textContent = getCoins(); }

// ===== 每日推荐 =====
function getDailyDish() {
  const today = new Date().toDateString();
  let idx = parseInt(localStorage.getItem("xs_daily_idx") || "-1");
  const storedDate = localStorage.getItem("xs_daily_date");
  if (storedDate !== today) {
    idx = Math.floor(Math.random() * dishes.length);
    localStorage.setItem("xs_daily_idx", idx.toString());
    localStorage.setItem("xs_daily_date", today);
  }
  return idx;
}
let dailyDishIndex = getDailyDish();
function updateDailyRec() {
  const d = dishes[dailyDishIndex];
  if (!d) return;
  document.getElementById("dailyEmoji").textContent = d.emoji || "🍽️";
  document.getElementById("dailyName").textContent = d.name;
  document.getElementById("dailyDesc").textContent = d.desc || "";
}

// ===== 页面切换 =====
function switchPage(page) {
  document.querySelectorAll(".page").forEach(p => p.classList.remove("active"));
  document.querySelectorAll(".bottom-nav button").forEach(b => b.classList.remove("active"));
  const pe = document.getElementById("page-" + page);
  if (pe) pe.classList.add("active");
  const nm = {home:0,fortune:1,browse:2,rating:3,manage:4};
  const btns = document.querySelectorAll(".bottom-nav button");
  if (nm[page] !== undefined) btns[nm[page]].classList.add("active");
  if (page==="browse"||page==="home") renderCategories();
  if (page==="browse") renderDishGrid(currentCategory);
  if (page==="manage") renderManage();
  if (page==="rating") { renderRatingDishSelect(); showRatingHistory(); }
  if (page==="fortune") setTimeout(()=>document.getElementById("speechBubble")?.classList.add("show"),200);
  window.scrollTo(0,0);
}

// ===== 菜品图片渲染 =====
function getDishMediaHTML(d) {
  if (d.image && d.image.startsWith("data:image")) {
    return `<img src="${d.image}" alt="${d.name}" style="width:100%;height:100%;object-fit:cover;" loading="lazy">`;
  }
  return d.emoji || "🍽️";
}

// ===== 分类 + 菜品渲染 =====
function renderCategories() {
  ["homeCats","browseCats"].forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    const active = id==="homeCats" ? currentCategory : (document.getElementById("page-browse")?.classList.contains("active") ? currentCategory : "全部");
    el.innerHTML = CATEGORIES.map(c => `<button class="category-tab ${c===active?"active":""}" onclick="${id==="homeCats"?"selectHomeCat":"selectBrowseCat"}('${c}')">${c}</button>`).join("");
  });
  renderDishGrid(currentCategory);
}
function selectHomeCat(cat) { currentCategory=cat; switchPage("browse"); }
function selectBrowseCat(cat) { currentCategory=cat; renderCategories(); }

function renderDishGrid(category) {
  const grid = document.getElementById("browseDishGrid");
  const homeGrid = document.getElementById("homeDishGrid");
  let filtered = category==="全部" ? dishes : dishes.filter(d=>d.category===category);
  const card = (d) => `<div class="dish-card" onclick="goToDetail(${dishes.indexOf(d)})">
    <div class="dish-svg-wrap">${getDishMediaHTML(d)}</div>
    <div class="dish-info">
      <div class="dish-name">${d.name}</div>
      <div class="dish-meta">
        <span>⏱️ ${d.cookTime||""}</span>
        <span>${d.difficulty||""}</span>
        <span class="dish-tag">${d.category}</span>
      </div>
    </div>
  </div>`;
  if (grid) grid.innerHTML = filtered.map(d=>card(d)).join("");
  if (homeGrid) homeGrid.innerHTML = filtered.slice(0,6).map(d=>card(d)).join("");
}

// ===== 菜品详情 =====
function goToDetail(idx) {
  if (idx<0||idx>=dishes.length) return;
  currentDetailIndex=idx; const d=dishes[idx];
  document.getElementById("detailEmoji").innerHTML = d.image ? `<img src="${d.image}" style="width:72px;height:72px;border-radius:50%;object-fit:cover;" alt="${d.name}">` : (d.emoji||"🍽️");
  document.getElementById("detailName").textContent=d.name;
  document.getElementById("detailTime").textContent=d.cookTime||"15分钟";
  document.getElementById("detailDiff").textContent=d.difficulty||"⭐";
  document.getElementById("detailCat").textContent=d.category;
  document.getElementById("detailDesc").textContent=d.desc||"";
  document.getElementById("detailIngredients").innerHTML=(d.ingredients||[]).map(i=>`<span class="ingredient-tag">${i}</span>`).join("");
  document.getElementById("detailSteps").innerHTML=(d.steps||[]).map(s=>`<div class="step-item">${s}</div>`).join("");
  document.querySelectorAll(".page").forEach(p=>p.classList.remove("active"));
  document.getElementById("page-detail").classList.add("active");
  window.scrollTo(0,0);
}
function goBackFromDetail() { switchPage("browse"); }

// ===== 做饭模式 =====
let cookStepIndex = 0;
function startCookMode() {
  const d=dishes[currentDetailIndex];
  if(!d||!d.steps||!d.steps.length) return;
  cookStepIndex=0;
  document.getElementById("cookEmoji").textContent=d.emoji||"🍽️";
  document.getElementById("cookName").textContent=d.name;
  document.getElementById("cookMode").classList.add("active");
  updateCookStep();
}
function updateCookStep() {
  const d=dishes[currentDetailIndex], steps=d.steps||[];
  document.getElementById("cookStepNum").textContent=`第 ${cookStepIndex+1} 步，共 ${steps.length} 步`;
  document.getElementById("cookStepText").textContent=steps[cookStepIndex]||"完成！";
  document.getElementById("cookProgressBar").style.width=`${((cookStepIndex+1)/steps.length)*100}%`;
}
function nextCookStep() {
  const d=dishes[currentDetailIndex], steps=d.steps||[];
  if(cookStepIndex<steps.length-1){cookStepIndex++;updateCookStep();}
  else{spawnConfetti();setTimeout(closeCookMode,1500);}
}
function prevCookStep(){if(cookStepIndex>0){cookStepIndex--;updateCookStep();}}
function closeCookMode(){document.getElementById("cookMode").classList.remove("active");}

// ===== 抽签 =====
function drawFortune() {
  if(isDrawing) return; isDrawing=true;
  const btn=document.getElementById("fortuneBtn"), result=document.getElementById("fortuneResult"), bubble=document.getElementById("speechBubble");
  btn.disabled=true; result.classList.remove("show");
  bubble.textContent="咕噜咕噜～变！🪄"; bubble.classList.add("show");
  const wr=document.querySelector(".fortune-witch-wrap")?.getBoundingClientRect();
  if(wr) for(let i=0;i<12;i++) setTimeout(()=>spawnParticles(wr.left+40+Math.random()*80,wr.top+60+Math.random()*80),i*60);
  setTimeout(()=>{
    const dish=dishes[Math.floor(Math.random()*dishes.length)];
    document.getElementById("fortuneEmoji").textContent=dish.emoji||"🍽️";
    document.getElementById("fortuneName").textContent=dish.name;
    document.getElementById("fortuneCat").textContent=dish.category;
    result.classList.add("show");
    bubble.textContent="想不起来吃啥\n那就交给命运吧 🪄";
    btn.disabled=false; isDrawing=false; spawnConfetti();
  },1200);
}

// ===== 评分 =====
function renderRatingDishSelect(){
  const sel=document.getElementById("ratingDishSelect");
  sel.innerHTML=`<option value="">-- 请选择菜品 --</option>`+dishes.map((d,i)=>`<option value="${i}">${d.emoji||"🍽️"} ${d.name}</option>`).join("");
  if(selectedRatingDishId!==null) sel.value=selectedRatingDishId;
}
function selectRatingDish(){selectedRatingDishId=document.getElementById("ratingDishSelect").value;}
function setRating(r){
  currentRating=r;
  document.querySelectorAll(".stars span").forEach((s,i)=>s.classList.toggle("active",i<r));
  const t=document.getElementById("ratingText");
  t.textContent=RATING_TEXTS[r]||""; t.classList.toggle("has-rating",r>0);
}
function handlePhoto(e){
  const file=e.target.files[0]; if(!file) return;
  uploadedPhoto=file;
  const reader=new FileReader();
  reader.onload=function(ev){document.getElementById("photoUpload").innerHTML=`<img src="${ev.target.result}" alt="upload">`;};
  reader.readAsDataURL(file);
}
function submitRating(){
  const idx=parseInt(document.getElementById("ratingDishSelect").value);
  if(isNaN(idx)){alert("请选择要评分的菜品 🍽️"); return;}
  if(currentRating===0){alert("请给个评分吧 ⭐"); return;}
  const d=dishes[idx];
  let h=JSON.parse(localStorage.getItem("xs_ratings")||"[]");
  h.unshift({name:d.name,emoji:d.emoji,rating:currentRating,time:new Date().toLocaleString(),photo:uploadedPhoto?"📷":"📱"});
  localStorage.setItem("xs_ratings",JSON.stringify(h));
  addCoins(20);
  currentRating=0; selectedRatingDishId=null; uploadedPhoto=null;
  document.getElementById("ratingDishSelect").value="";
  document.getElementById("photoUpload").innerHTML=`<div class="upload-icon">📷</div><div class="upload-text">点击拍照或从相册选择</div>`;
  document.querySelectorAll(".stars span").forEach(s=>s.classList.remove("active"));
  document.getElementById("ratingText").textContent="";
  showRatingHistory(); spawnConfetti();
  showWitchModal("评分成功！🪙+20","别忘了去首页打个卡哦～",[
    {text:"✅ 去打卡",action:"switchPage('home');closeWitchModal()"},
    {text:"🔮 继续评分"}
  ]);
}
function showRatingHistory(){
  const c=document.getElementById("ratingHistory");
  const h=JSON.parse(localStorage.getItem("xs_ratings")||"[]");
  if(!h.length){c.innerHTML='<div class="empty-state"><div class="empty-icon">📸</div><p>还没有评分记录哦</p></div>';return;}
  c.innerHTML=h.slice(0,10).map(r=>`<div style="display:flex;align-items:center;gap:8px;padding:8px 0;border-bottom:1px solid var(--pink-100);font-size:14px;">
    <span>${r.emoji||"🍽️"}</span><span style="font-weight:600;flex:1;">${r.name}</span>
    <span style="color:#f59e0b;">${"★".repeat(r.rating)}${"☆".repeat(5-r.rating)}</span>
    <span style="color:#aaa;font-size:12px;">${r.time}</span>
  </div>`).join("");
}

// ===== 女巫弹窗 =====
function showWitchModal(text,sub,buttons){
  const o=document.getElementById("witchModal");
  document.getElementById("wmText").textContent=text;
  document.getElementById("wmSub").textContent=sub||"";
  document.getElementById("wmActions").innerHTML=buttons.map((b,i)=>i===0
    ?`<button class="btn btn-primary btn-sm" onclick="${b.action||'closeWitchModal()'}">${b.text}</button>`
    :`<button class="btn btn-outline btn-sm" onclick="closeWitchModal()">${b.text}</button>`).join("");
  o.classList.add("show");
}
function closeWitchModal(){document.getElementById("witchModal").classList.remove("show");}

// ===== 管理 =====
function renderManage(){
  const container=document.getElementById("manageList"), cats=document.getElementById("manageCats");
  if(cats) cats.innerHTML=CATEGORIES.map(c=>`<button class="category-tab ${c===currentCategory?"active":""}" onclick="manageSelectCat('${c}')">${c}</button>`).join("");
  let filtered=currentCategory==="全部"?dishes:dishes.filter(d=>d.category===currentCategory);
  container.innerHTML=filtered.map((d,i)=>{
    const ri=dishes.indexOf(d);
    return `<div class="manage-item">
      <div class="mi-emoji">${d.image?`<img src="${d.image}" style="width:28px;height:28px;border-radius:50%;object-fit:cover;">`:d.emoji||"🍽️"}</div>
      <div class="mi-info"><div class="mi-name">${d.name}</div><div class="mi-cat">${d.category} · ${d.cookTime||""}</div></div>
      <div class="mi-actions">
        <button class="btn-edit" onclick="editDish(${ri})">✏️</button>
        <button class="btn-del" onclick="deleteDish(${ri})">🗑️</button>
      </div>
    </div>`;
  }).join("");
}
function manageSelectCat(cat){currentCategory=cat;renderManage();}

// ===== 添加/编辑菜品（支持图片） =====
function showAddDishModal(){
  document.getElementById("addDishModal").classList.add("show");
  ["mName","mEmoji","mDesc","mIngredients","mSteps"].forEach(id=>{const el=document.getElementById(id);if(el)el.value="";});
  document.getElementById("mCategory").value="家常荤菜"; document.getElementById("mEmoji").value="🍽️";
  document.getElementById("mImagePreview").innerHTML=""; document.getElementById("mImageData").value="";
  document.querySelector("#addDishModal .btn-primary").onclick=saveDish;
}
function closeModal(id){document.getElementById(id).classList.remove("show");}

// ===== 图片自动压缩 =====
function compressImage(file, maxW=400, quality=0.7) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = function(e) {
      const img = new Image();
      img.onload = function() {
        let w = img.width, h = img.height;
        if (w > maxW) { h = h * maxW / w; w = maxW; }
        const canvas = document.createElement("canvas");
        canvas.width = w; canvas.height = h;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL("image/jpeg", quality));
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });
}

// 图片上传（管理菜品用，自动压缩）
function handleDishImageUpload(e){
  const file=e.target.files[0]; if(!file) return;
  compressImage(file).then(dataUrl => {
    document.getElementById("mImagePreview").innerHTML=`<img src="${dataUrl}" alt="preview">`;
    document.getElementById("mImageData").value=dataUrl;
  });
}
function handleDishImagePaste(e){
  const items=(e.clipboardData||e.originalEvent?.clipboardData)?.items;
  if(!items) return;
  for(let item of items){
    if(item.type.startsWith("image/")){
      const file=item.getAsFile();
      compressImage(file).then(dataUrl => {
        document.getElementById("mImagePreview").innerHTML=`<img src="${dataUrl}" alt="preview">`;
        document.getElementById("mImageData").value=dataUrl;
      });
      e.preventDefault();
      break;
    }
  }
}
function clearDishImage(){
  document.getElementById("mImagePreview").innerHTML="暂无图片，可上传或粘贴";
  document.getElementById("mImageData").value="";
}

function saveDish(){
  const name=document.getElementById("mName").value.trim();
  if(!name){alert("请输入菜名 🍽️"); return;}
  const imgData=document.getElementById("mImageData").value;
  const dish={
    id:dishes.length+1, name, category:document.getElementById("mCategory").value,
    emoji:document.getElementById("mEmoji").value||"🍽️",
    desc:document.getElementById("mDesc").value||"姐姐的拿手好菜",
    ingredients:document.getElementById("mIngredients").value.split(/[,，\n]/).map(s=>s.trim()).filter(Boolean),
    steps:document.getElementById("mSteps").value.split("\n").map(s=>s.trim()).filter(Boolean),
    cookTime:"20分钟", difficulty:"⭐",
    svg:genFoodSVG(name,"#f472b6","#f9a8d4","😏"), custom:true,
    image:imgData||null
  };
  dishes.push(dish); saveDishes(); closeModal("addDishModal");
  renderManage(); renderCategories();
}

function editDish(idx){
  const d=dishes[idx];
  document.getElementById("mName").value=d.name; document.getElementById("mCategory").value=d.category;
  document.getElementById("mEmoji").value=d.emoji||"🍽️"; document.getElementById("mDesc").value=d.desc||"";
  document.getElementById("mIngredients").value=(d.ingredients||[]).join("，");
  document.getElementById("mSteps").value=(d.steps||[]).join("\n");
  document.getElementById("mImagePreview").innerHTML=d.image?`<img src="${d.image}" alt="preview">`:"暂无图片，可上传或粘贴";
  document.getElementById("mImageData").value=d.image||"";
  document.getElementById("addDishModal").classList.add("show");
  document.querySelector("#addDishModal .btn-primary").onclick=function(){
    const name=document.getElementById("mName").value.trim();
    if(!name){alert("请输入菜名"); return;}
    const imgData=document.getElementById("mImageData").value;
    dishes[idx].name=name; dishes[idx].category=document.getElementById("mCategory").value;
    dishes[idx].emoji=document.getElementById("mEmoji").value||"🍽️";
    dishes[idx].desc=document.getElementById("mDesc").value||"";
    dishes[idx].ingredients=document.getElementById("mIngredients").value.split(/[,，\n]/).map(s=>s.trim()).filter(Boolean);
    dishes[idx].steps=document.getElementById("mSteps").value.split("\n").map(s=>s.trim()).filter(Boolean);
    dishes[idx].custom=true; dishes[idx].image=imgData||null;
    saveDishes(); closeModal("addDishModal"); renderManage(); renderCategories();
    document.querySelector("#addDishModal .btn-primary").onclick=saveDish;
  };
}

function deleteDish(idx){
  if(!confirm(`确定删除「${dishes[idx].name}」吗？🗑️`)) return;
  dishes.splice(idx,1); saveDishes(); renderManage(); renderCategories();
}
function saveDishes(){localStorage.setItem("xiaoshanfang_dishes",JSON.stringify(dishes));}

// ===== 金币彩蛋 =====
function showEgg(){
  localStorage.setItem("xs_egg_100","true");
  document.getElementById("eggOverlay").classList.add("show");
  document.getElementById("eggCard").classList.remove("flipped");
  spawnConfetti(); setTimeout(flipEggCard,3000);
}
let eggFlipped=false;
function flipEggCard(){if(eggFlipped) return; eggFlipped=true; document.getElementById("eggCard").classList.add("flipped"); setTimeout(spawnConfetti,500);setTimeout(spawnConfetti,1000);}
function closeEgg(){document.getElementById("eggOverlay").classList.remove("show"); eggFlipped=false;}

// ===== 特效 =====
function spawnParticles(cx,cy){
  const c=document.getElementById("particles"),colors=["#fbbf24","#f472b6","#a855f7","#fde68a","#c084fc","#f9a8d4","#34d399"];
  for(let i=0;i<10;i++){
    const p=document.createElement("div"); p.className="particle";
    const size=Math.random()*5+3, angle=Math.random()*Math.PI*2, dist=Math.random()*70+20;
    p.style.cssText=`left:${cx}px;top:${cy}px;width:${size}px;height:${size}px;background:${colors[Math.floor(Math.random()*colors.length)]};--x:${Math.cos(angle)*dist}px;--y:${Math.sin(angle)*dist}px;animation-duration:${0.6+Math.random()*0.5}s;`;
    c.appendChild(p); setTimeout(()=>p.remove(),1200);
  }
}
function spawnConfetti(){
  const w=document.getElementById("confettiWrap"),colors=["#f472b6","#fbbf24","#a855f7","#34d399","#f97316","#3b82f6","#ef4444"],shapes=["■","●","▲","★","♦"];
  for(let i=0;i<30;i++){
    const c=document.createElement("div"); c.className="confetti";
    c.textContent=shapes[Math.floor(Math.random()*shapes.length)];
    c.style.cssText=`left:${Math.random()*100}%;color:${colors[Math.floor(Math.random()*colors.length)]};font-size:${Math.random()*10+8}px;--d:${2+Math.random()*2}s;animation-delay:${Math.random()*0.5}s;`;
    w.appendChild(c); setTimeout(()=>c.remove(),4000);
  }
}

// ===== 导出共享数据 =====
function exportSharedData() {
  // 只导出：id、name、emoji、image（有图片的才导出）
  const shared = [];
  dishes.forEach(d => {
    const item = { id: d.id, name: d.name, emoji: d.emoji };
    if (d.image) item.image = d.image;
    shared.push(item);
  });
  
  const json = JSON.stringify(shared, null, 2);
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "dishes-shared.json";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  
  const status = document.getElementById("exportStatus");
  if (status) {
    status.textContent = "✅ 导出成功！请将此文件上传到 Gitee 仓库中";
    status.style.color = "#22c55e";
  }
  spawnConfetti();
}

// ===== 加载共享数据 =====
async function loadSharedData() {
  try {
    const resp = await fetch("dishes-shared.json");
    if (!resp.ok) return;
    const shared = await resp.json();
    if (!Array.isArray(shared)) return;
    
    // 用共享数据更新菜品图片（只更新image字段）
    shared.forEach(s => {
      const dish = dishes.find(d => d.id === s.id || d.name === s.name);
      if (dish && s.image) {
        dish.image = s.image;
      }
    });
    
    // 重新渲染
    renderCategories();
    console.log("✅ 已加载共享菜品图片");
  } catch(e) {
    // 没有共享文件，正常使用
    console.log("ℹ️ 未找到共享数据，使用默认Emoji");
  }
}

// ===== 初始化 =====
updateCoinDisplay(); updateDailyRec(); renderCategories(); showRatingHistory();
loadSharedData();


// ===== 自动版本检测 & 实时更新 =====
const APP_VERSION_KEY = "xs_app_version";
const CURRENT_VERSION = "2.1.0";

async function checkForUpdate() {
  try {
    const resp = await fetch("version.json?_t=" + Date.now());
    if (!resp.ok) return;
    const v = await resp.json();
    if (v.version && v.version !== localStorage.getItem(APP_VERSION_KEY)) {
      console.log("🔄 检测到新版本:", v.version);
      localStorage.setItem(APP_VERSION_KEY, v.version);
      
      // 更新 Service Worker
      if ("serviceWorker" in navigator && navigator.serviceWorker.controller) {
        navigator.serviceWorker.controller.postMessage("update");
        navigator.serviceWorker.register("sw.js").then(reg => {
          if (reg.waiting) {
            reg.waiting.postMessage("skipWaiting");
            window.location.reload();
          }
        });
      }
    }
  } catch(e) {
    // 忽略错误
  }
}

// 加载共享数据时使用时间戳避免缓存
const origLoadSharedData = loadSharedData;
loadSharedData = async function() {
  try {
    const resp = await fetch("dishes-shared.json?_t=" + Date.now());
    if (!resp.ok) return;
    const shared = await resp.json();
    if (!Array.isArray(shared)) return;
    
    shared.forEach(s => {
      const dish = dishes.find(d => d.id === s.id || d.name === s.name);
      if (dish && s.image) {
        dish.image = s.image;
      }
    });
    
    renderCategories();
    console.log("✅ 已加载共享菜品图片（新）");
  } catch(e) {
    console.log("ℹ️ 未找到共享数据，使用默认Emoji");
  }
};

// 定期检查更新（每60秒）
checkForUpdate();
setInterval(checkForUpdate, 60000);

