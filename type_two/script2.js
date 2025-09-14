// script.js — javított verzió: pontos judge-line, hitablak, kilépés törli tiles-t
(function(){
  const gameArea = document.getElementById('gameArea');
  const columns = document.querySelectorAll('.column');
  const startBtn = document.getElementById('startBtn');
  const restartBtn = document.getElementById('restartBtn');
  const exitBtn = document.getElementById('exitBtn'); // lehet, hogy nincs, ellenőrizzük
  const scoreEl = document.getElementById('score');
  const overlay = document.getElementById('overlay');
  const finalScore = document.getElementById('finalScore');
  const centerCard = overlay ? overlay.querySelector('.center-card') : null;
  


  // játékállapot
  let tiles = [];
  let gameRunning = false;
  let paused = false;
  let score = 0;
  let perfectCount = 0;
  let greatCount = 0;
  let spawnedNotes = 0;
  const maxNotes = 100;

  const keyMap = { 'd':0,'f':1,'g':2 };

  // judge-line DOM elem (ha nincs, létrehozzuk)
  let judgeLine = document.getElementById('judgeLine');
  if(!judgeLine){
    judgeLine = document.createElement('div');
    judgeLine.id = 'judgeLine';
    judgeLine.style.position = 'absolute';
    judgeLine.style.left = '0';
    judgeLine.style.right = '0';
    judgeLine.style.height = '2px';
    judgeLine.style.background = 'white';
    judgeLine.style.pointerEvents = 'none';
    judgeLine.style.zIndex = '5';
    gameArea.appendChild(judgeLine);
  }
  // judgeLineY a gameArea belső koordinátájában (0..gameArea.clientHeight)
  function updateJudgeLine(){
    const areaH = gameArea.clientHeight;
    const y = Math.round(areaH * 0.75);
    judgeLine.style.top = y+60 + 'px';
    return y;
  }
  let judgeLineY = updateJudgeLine();
  window.addEventListener('resize', ()=>{ judgeLineY = updateJudgeLine(); });

  // hit ablakok (px, gameArea-relatív)
  const perfectAbove = 20; // 20px felötte (tile középpont túl fent => negative diff allowed)
  const perfectBelow = 10; // 10px alatta
  const greatWindow = 200; // ±120px belül great, azon túl semmi

  // segédfüggvény: eltávolít tile DOM-ot és listából
  function removeTileObj(t){
    try { if(t.el && t.el.parentNode) t.el.parentNode.removeChild(t.el); } catch(e){}
    tiles = tiles.filter(x=>x !== t);
  }

  // spawnolási ellenőrzés: ne spawnolj össze (alapmin távolság)
  function canSpawnInColumn(colIndex, tileHeight){
    const colTiles = tiles.filter(t => t.col === colIndex && !t.hit);
    if(colTiles.length === 0) return true;
    const last = colTiles[colTiles.length - 1];
    // last.y relatív a column top; lastBottom = last.y + lastHeight
    const lastHeight = last.el.offsetHeight || tileHeight;
    const lastBottom = last.y + lastHeight;
    const minDistance = Math.round(tileHeight * 0.6);
    // csak akkor spawnoljunk, ha az utolsó tile alsó széle jóval feljebb van, mint a spawnstart (ami negatív)
    return (lastBottom < -minDistance);
  }

  // létrehozás: használjuk az aktuális column szélességét, és állítsuk be a magasságot 2:1 arányban,
  // de ha a designból fix 100px-ot szeretnél, itt egyszerűen átállítható a tileHeight változóban.
  const forcedTileHeight = 100; // ha szeretnéd másra állítani, módosítsd itt
  function createTile(colIndex){
    if(spawnedNotes >= maxNotes) return null;
    const column = columns[colIndex];
    const colW = column.clientWidth;
    const tileWidth = Math.floor(colW * 0.84);
    const tileHeight = forcedTileHeight; // használjuk a kívánt 100px-et (így a CSS-override problémát elkerüljük)

    if(!canSpawnInColumn(colIndex, tileHeight)) return null;

    const tile = document.createElement('div');
    tile.className = 'tile';
    tile.style.position = 'absolute';
    tile.style.left = Math.round((colW - tileWidth)/2) + 'px';
    tile.style.width = tileWidth + 'px';
    tile.style.height = tileHeight + 'px';
    tile.style.top = (-tileHeight - 8) + 'px';
    tile.style.zIndex = '10';
    tile.style.background = ''; // alapértelmezett css background maradjon ha van
    // NE adjunk közép-vonalat a tile-hoz (kérése szerint)

    const mid = document.createElement('div');
    mid.style.position = 'absolute';
    mid.style.left = '0';
    mid.style.width = '100%';
    mid.style.height = '2px';
    mid.style.top = '50%';
    mid.style.transform = 'translateY(-1px)';
    mid.style.background = 'white';
    mid.style.pointerEvents = 'none'; // <-------------------------------------------------------------white line
    tile.appendChild(mid);

    tile.addEventListener('mousedown', ()=> {
      // mousedown esetén az elemhez tartozó objektumot keressük, és hívjuk a hitet
      const obj = tiles.find(x => x.el === tile);
      if(obj) attemptHit(obj);
    });

    column.appendChild(tile);
    const obj = { el: tile, col: colIndex, y: -tileHeight - 8, hit: false };
    tiles.push(obj);
    spawnedNotes++;
    return obj;
  }

  // próbálunk eltalálni egy tile-t (használja a judge szabályokat)
  function attemptHit(t){
    if(!t || t.hit) return;
    const tileCenter = t.y + (t.el.offsetHeight / 2);
    const diff = tileCenter - judgeLineY; // negative = tile középpont fentebb, positive = lejjebb

    // PERFECT: tileCenter in [-20, +10] relative to judgeLine
    if(diff >= -perfectAbove && diff <= perfectBelow){
      // PERFECT
      t.hit = 'perfect';
      score += 500;
      perfectCount++;
      t.el.style.background = 'linear-gradient(180deg,#064e3b,#16a34a)';
      scoreEl.textContent = score;
      // eltűntetés
      setTimeout(()=> removeTileObj(t), 90);
      return;
    }

    // GREAT: ha tileCenter abs(diff) <= greatWindow
    if(Math.abs(diff) <= greatWindow){
      t.hit = 'great';
      score += 375;
      greatCount++;
      t.el.style.background = 'linear-gradient(180deg,#ff8c42,#ffb37a)';
      scoreEl.textContent = score;
      setTimeout(()=> removeTileObj(t), 90);
      return;
    }

    // egyébként NEM találat — semmi, hagyjuk a tile-t tovább esni
  }

  // ha egy tile leesik a gameArea aljára -> immediate gameOver
  function checkTileFall(t){
    const areaH = gameArea.clientHeight;
    if(t.y + t.el.offsetHeight >= areaH){
      // leesett
      gameOver();
      return true;
    }
    return false;
  }

  function gameOver(){
    gameRunning = false;
    paused = false;
    // overlay tartalom frissítése (ha nincs finalPerfect/finalGreat elemek, létrehozzuk)
    if(centerCard){
      if(!document.getElementById('finalPerfect')){
        const p = document.createElement('p'); p.id='finalPerfect'; p.style.margin='6px 0';
        const g = document.createElement('p'); g.id='finalGreat'; g.style.margin='6px 0';
        centerCard.insertBefore(p, centerCard.querySelector('#restartBtn') || null);
        centerCard.insertBefore(g, centerCard.querySelector('#restartBtn') || null);
      }
      finalScore.textContent = score;
      document.getElementById('finalPerfect').textContent = perfectCount;
      document.getElementById('finalGreat').textContent = greatCount;
      overlay.style.display = 'flex';
      overlay.style.zIndex = '99999';
    } else {
      alert(`Game over\nScore: ${score}\nPerfect: ${perfectCount}\nGreat: ${greatCount}`);
    }
    // start gomb felirata vissza "Játék indítása"
    if(startBtn) startBtn.innerHTML = '<i class="fa-solid fa-play"></i>';
  }

  // update / spawn loop
  let spawnTimer = 0;
  let spawnInterval = 700;
  let lastTime = 0;

  // speed logic (ha kell, percenként növel)
  const speedLevels = [8.0,8.0,8.0,10.0,10.0,10.0,12.0,12.0,12.0,14.0,14.0,14.0];
  let currentLevel = 0;
  setInterval(()=>{ if(currentLevel < speedLevels.length-1) currentLevel++; }, 60000);
  function getCurrentSpeed(){ return speedLevels[currentLevel]; }

  function update(dt){
    if(!gameRunning || paused) return;

    // spawn
    spawnTimer += dt;
    if(spawnTimer > spawnInterval && spawnedNotes < maxNotes){
      spawnTimer = 0;
      // próbáljunk spawnolni egy véletlen oszlopba, de ha az oszlop foglalt, próbálkozunk párszor
      let attempts = 0;
      while(attempts < 4){
        const col = Math.floor(Math.random() * columns.length);
        const created = createTile(col);
        if(created) break;
        attempts++;
      }
    }

    // mozgás
    const factor = 0.02;
    const speedMultiplier = getCurrentSpeed();
    for(const t of tiles.slice()){
      if(t.hit) continue;
      t.y += dt * factor * speedMultiplier;
      t.el.style.top = Math.round(t.y) + 'px';
      // ha leesett -> gameOver
      if(checkTileFall(t)) return;
    }

    // ha végére értünk és nincs több tile -> vége
    if(spawnedNotes >= maxNotes && tiles.length === 0){
      gameOver();
    }
  }

  function loop(ts){
    if(!lastTime) lastTime = ts;
    const dt = ts - lastTime;
    lastTime = ts;
    update(dt);
    requestAnimationFrame(loop);
  }

  // start / pause / resume logic
  function resetState(){
    // töröljük a DOM tile elemeket és a tiles tömböt
    tiles.forEach(t => { try{ if(t.el.parentNode) t.el.parentNode.removeChild(t.el); }catch(e){} });
    tiles = [];
    spawnedNotes = 0;
    spawnTimer = 0;
    lastTime = 0;
    score = 0;
    perfectCount = 0;
    greatCount = 0;
    scoreEl.textContent = score;
    // judgeLine frissítése (méretváltozás esetén)
    judgeLineY = updateJudgeLine();
  }

  function startGame(){
    resetState();
    overlay.style.display = 'none';
    gameRunning = true;
    paused = false;
    if(startBtn) startBtn.innerHTML = '<i class="fa-solid fa-pause"></i>';
    requestAnimationFrame(loop);
  }

  function togglePause(){
    if(!gameRunning) return;
    paused = !paused;
    if(startBtn) startBtn.innerHTML = paused ? '<i class="fa-solid fa-play"></i>' : '<i class="fa-solid fa-pause"></i>';
  }

  // billentyűkezelés: csak ha fut és nincs pause
  window.addEventListener('keydown', (e)=>{
    if(!gameRunning || paused) return;
    const key = e.key.toLowerCase();
    if(!(key in keyMap)) return;
    const col = keyMap[key];
    const colTiles = tiles.filter(t => t.col === col && !t.hit);
    if(colTiles.length === 0) return;
    // kiválasztjuk azt a tile-t amelyik középpontja legközelebb van a judgeLineY-hoz
    const target = colTiles.reduce((a,b) => {
      const aCenter = a.y + a.el.offsetHeight/2;
      const bCenter = b.y + b.el.offsetHeight/2;
      return Math.abs(aCenter - judgeLineY) < Math.abs(bCenter - judgeLineY) ? a : b;
    });
    // attempt Hit (ez figyeli a perf/great windows-t)
    attemptHit(target);
  });

  // egér kattintás tile-on már createTile által beállítva (mousedown -> attemptHit)

  // start / pause gomb
  if(startBtn){
    startBtn.addEventListener('click', ()=>{
      if(!gameRunning) startGame();
      else togglePause();
    });
  }
  // restart -> újraindít
  if(restartBtn){
    restartBtn.addEventListener('click', ()=> { startGame(); });
  }
  // exit -> töröljük a tiles listát + DOM elemeket és ne indítsuk el a chartot
  if(exitBtn){
    exitBtn.addEventListener('click', ()=>{
      // törlés
      tiles.forEach(t => { try{ if(t.el.parentNode) t.el.parentNode.removeChild(t.el); }catch(e){} });
      tiles = [];
      spawnedNotes = 0;
      gameRunning = false;
      paused = false;
      spawnTimer = 0;
      lastTime = 0;
      score = 0; perfectCount = 0; greatCount = 0;
      scoreEl.textContent = score;
      overlay.style.display = 'none';
      if(startBtn) startBtn.innerHTML = '<i class="fa-solid fa-play"></i>';
    });
  }

  // indítsuk a loopot (nem indul el a játékmenet automatikusan)
  requestAnimationFrame(loop);

  // inicializáljuk a judgeLine pozíciót
  judgeLineY = updateJudgeLine();
  // reagáljunk ablakméret-változásra
  window.addEventListener('resize', ()=> { judgeLineY = updateJudgeLine(); });

})();
