// script.js — chart.json alapú spawn + teljes játéklogika
(function(){
  // DOM elemek
  const gameArea = document.getElementById('gameArea');
  const columns = document.querySelectorAll('.column');
  const startBtn = document.getElementById('startBtn');
  const restartBtn = document.getElementById('restartBtn');
  const exitBtn = document.getElementById('exitBtn');
  const pauseBtn = document.getElementById('pauseBtn');
  const scoreEl = document.getElementById('score');
  const overlay = document.getElementById('overlay');
  const finalScore = document.getElementById('finalScore');
  const centerCard = overlay ? overlay.querySelector('.center-card') : null;
  const resultText = document.getElementById('resultText');

  // játékállapot
  let tiles = [];                // Note objektumok tömbje
  let gameRunning = false;
  let paused = false;
  let score = 0;
  let perfectCount = 0;
  let greatCount = 0;

  // billentyűzet mapping
  const keyMap = { 'd':0,'f':1,'g':2 };

  // judge-line (ha nincs a markupban, létrehozzuk)
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
    judgeLine.style.zIndex = '100';
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
  const perfectAbove = 20;   // pixel fentebb
  const perfectBelow = 10;   // pixel lejjebb
  let greatWindow = 200;     // tágabb great ablak (szabadon állítható)

  // sebesség-szintek (ha használod a gyorsulást)
  const speedLevels = [8.0,8.0,8.0,10.0,10.0,10.0,12.0,12.0,12.0,14.0,14.0,14.0];
  let currentLevel = 0;
  setInterval(()=> { if(currentLevel < speedLevels.length-1) currentLevel++; }, 60000);
  function getCurrentSpeed(){ return speedLevels[currentLevel]; }

  // Chart adatok
  let chartData = null;
  let noteIndex = 0;
  let gameStartTime = 0;
  let pausedAccum = 0;     // összesen mennyi időt töltöttünk paused állapotban
  let pauseStart = 0;

  // betöltés (külső chart.json)
  async function loadChart(){
    try{
      const resp = await fetch('chart.json', {cache: "no-store"});
      if(!resp.ok) throw new Error('chart.json betöltése sikertelen: ' + resp.status);
      chartData = await resp.json();
      // rendezés idő szerint (biztosan növekvő)
      if(Array.isArray(chartData.notes)){
        chartData.notes.sort((a,b)=>a.time - b.time);
      } else {
        chartData = { notes: [] };
      }
      console.log('chart betöltve, note-ok:', chartData.notes.length);
    }catch(err){
      console.error('chart load error', err);
      chartData = { notes: [] };
    }
  }

  // Note osztály 
  class Note {
    constructor(type, colIndex, duration = 0) {
        this.type = type;  
        this.col = colIndex;
        this.hit = false;
        this.duration = duration; 

        const column = columns[colIndex];
        const colW = column.clientWidth;
        const tileWidth = Math.floor(colW * 0.84);

        this.el = document.createElement('div');
        this.el.className = 'tile ' + type;
        this.el.style.position = 'absolute';
        this.el.style.left = Math.round((colW - tileWidth)/2) + 'px';
        this.el.style.width = tileWidth + 'px';
        this.el.style.zIndex = '10';

        // magasság beállítás
        if(type === 'small'){
            this.height = 50;
            this.el.style.height = this.height + 'px';
            this.el.style.background = 'linear-gradient(180deg,#0b1220,#111827)';
            this.el.style.borderRadius = '6px';      
        } else if(type === 'normal' || type === 'upswipe' || type === 'downswipe'){
            this.height = 100;
            this.el.style.height = this.height + 'px';
            this.el.style.background = 'linear-gradient(180deg,#0b1220,#111827)';
            this.el.style.borderRadius = '6px';
        } else {
            this.el.style.background = 'red';
        }

        if(type !== 'upswipe' && type !== 'downswipe'){
            const midLine = document.createElement('div');
            midLine.className = 'mid';
            midLine.style.position = 'absolute';
            midLine.style.left = '5px';
            midLine.style.right = '5px';
            midLine.style.width = '90%';
            midLine.style.height = '3px';
            midLine.style.top = '50%';
            midLine.style.transform = 'translateY(-1px)';
            midLine.style.background = 'white';
            midLine.style.pointerEvents = 'none';
            this.el.appendChild(midLine);
        }

        if(type === 'upswipe'){ 
          const centerLine = document.createElement('div');
          centerLine.style.position = 'absolute';
          centerLine.style.left = '50%';
          centerLine.style.bottom = '15px';
          centerLine.style.top = '15px';
          centerLine.style.width = '5px';
          centerLine.style.height = this.height;
          centerLine.style.background = 'white';
          this.el.appendChild(centerLine);
          this.centerLine = centerLine;

          const leftSide = document.createElement('div');
          leftSide.style.position = 'absolute';
          leftSide.style.left = '37%';
          leftSide.style.bottom = '20px';
          leftSide.style.top = '12px';
          leftSide.style.width = '5px';
          leftSide.style.height = '45px';
          leftSide.style.rotate = '35deg';
          leftSide.style.background = 'white';
          this.el.appendChild(leftSide);
          this.leftSide = leftSide;

          const rightSide = document.createElement('div');
          rightSide.style.position = 'absolute';
          rightSide.style.left = '63%';
          rightSide.style.bottom = '20px';
          rightSide.style.top = '12px';
          rightSide.style.width = '5px';
          rightSide.style.height = '45px';
          rightSide.style.rotate = '-35deg';
          rightSide.style.background = 'white';
          this.el.appendChild(rightSide);
          this.rightSide = rightSide;
        }

        if(type === 'downswipe'){ 
          const centerLine = document.createElement('div');
          centerLine.style.position = 'absolute';
          centerLine.style.left = '50%';
          centerLine.style.bottom = '15px';
          centerLine.style.top = '15px';
          centerLine.style.width = '5px';
          centerLine.style.height = this.height;
          centerLine.style.background = 'white';
          this.el.appendChild(centerLine);
          this.centerLine = centerLine;

          const leftSide = document.createElement('div');
          leftSide.style.position = 'absolute';
          leftSide.style.left = '37%';
          leftSide.style.bottom = '12px';
          leftSide.style.top = '43px';
          leftSide.style.width = '5px';
          leftSide.style.height = '45px';
          leftSide.style.rotate = '-35deg';
          leftSide.style.background = 'white';
          this.el.appendChild(leftSide);
          this.leftSide = leftSide;

          const rightSide = document.createElement('div');
          rightSide.style.position = 'absolute';
          rightSide.style.left = '63%';
          rightSide.style.bottom = '12px';
          rightSide.style.top = '43px';
          rightSide.style.width = '5px';
          rightSide.style.height = '45px';
          rightSide.style.rotate = '35deg';
          rightSide.style.background = 'white';
          this.el.appendChild(rightSide);
          this.rightSide = rightSide;
        }

        column.appendChild(this.el);
        this.y = -this.height - 8;
        this.el.style.top = this.y + 'px';
    }

    move(dt, speed) {
        this.y += dt * 0.02 * speed;
        this.el.style.top = Math.round(this.y) + 'px';
    }


    attemptHit(){
      if(this.hit) return false;
      const tileCenter = this.y + (this.height / 2);
      const diff = tileCenter - judgeLineY;

      // PERFECT: judgeLine ± (above/below)
      if(diff >= -perfectAbove && diff <= perfectBelow){
        this.hit = 'perfect';
        score += 500;
        perfectCount++;
        this.el.style.background = 'linear-gradient(180deg,#064e3b,#16a34a)';
        scoreEl.textContent = score;
        setTimeout(()=> this.remove(), 90);
        return true;
      }

      // GREAT: minden más pozícióban, ha belül a greatWindow
      if(Math.abs(diff) <= greatWindow){
        this.hit = 'great';
        score += 375;
        greatCount++;
        this.el.style.background = 'linear-gradient(180deg,#ff8c42,#ffb37a)';
        scoreEl.textContent = score;
        setTimeout(()=> this.remove(), 90);
        return true;
      }

      return false; // nem találat
    }



    remove() {
        try { this.el.parentNode.removeChild(this.el); } catch (e) {}
        tiles = tiles.filter(x => x !== this);
    }
  }

  // update() — egyszerre kezeli a chart-spawnolást és a mozgást
  function update(currentTime, dt){
    if(!gameRunning) return;

    // ha paused, ne spawnoljunk és ne mozogjunk
    if(paused) return;

    // elapsed ms játékból (figyelembe vesszük a pause-okat)
    const elapsed = currentTime - gameStartTime - pausedAccum;

    // spawnolás a chart alapján: ha elértük a next note időpontját -> spawn
    while(chartData && noteIndex < chartData.notes.length && elapsed >= chartData.notes[noteIndex].time){
      const n = chartData.notes[noteIndex];
      // csak normal típus egyelőre (ha nincs type, default normal)
      const type = n.type || 'normal';
      const col = (typeof n.col === 'number' && n.col >= 0 && n.col < columns.length) ? n.col : 0;
      const created = new Note(type, col);
      tiles.push(created);
      // lehet debugolni: console.log('spawn note', noteIndex, 'time', n.time, 'col', col);
      noteIndex++;
    }

    // mozgás
    const speedMultiplier = getCurrentSpeed();
    for(const t of tiles.slice()){
      if(t.hit) continue;
      t.move(dt, speedMultiplier);
      // ha leesik a gameArea aljára -> game over
      const areaH = gameArea.clientHeight;
      if(t.y + t.height >= areaH){
        gameOver();
        return;
      }
    }

    // ha elfogytak a chart note-ok és nincs több tile -> vége
    if(chartData && noteIndex >= chartData.notes.length && tiles.length === 0){
      gameOver();
    }
  }

  // fő loop
  let lastFrameTime = 0;
  function loop(ts){
    if(!lastFrameTime) lastFrameTime = ts;
    const dt = ts - lastFrameTime;
    // update a játéklogikát (ha fut és nem paused)
    update(ts, dt);
    lastFrameTime = ts;
    requestAnimationFrame(loop);
  }

  // game over
  function gameOver(){
    gameRunning = false;
    paused = false;
    // összegez és megjelenít
    if(centerCard){
      // létrehozzuk a summary mezőket ha nincsenek
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
    if(startBtn) startBtn.innerHTML = '<i class="fa-solid fa-play"></i>';
  }

  // reset állapotok (start előtt)
  function resetState(){
    // töröljük DOM tile-okat és tömböt
    tiles.forEach(t => { try{ if(t.el.parentNode) t.el.parentNode.removeChild(t.el); } catch(e){} });
    tiles = [];
    score = 0;
    perfectCount = 0;
    greatCount = 0;
    scoreEl.textContent = score;
    noteIndex = 0;
    pausedAccum = 0;
    pauseStart = 0;
    currentLevel = 0;
    // judge line frissítése
    judgeLineY = updateJudgeLine();
  }

  // indítás
  async function startGame(){
    // betöltjük a chartot ha még nincs
    if(!chartData) await loadChart();

    resetState();
    overlay.style.display = 'none';
    gameRunning = true;
    paused = false;
    lastFrameTime = 0;
    gameStartTime = performance.now();
    noteIndex = 0;
    requestAnimationFrame(loop);

    if(startBtn) startBtn.innerHTML = '<i class="fa-solid fa-pause"></i>';
  }

  // pause / resume
  function togglePause(){
    if(!gameRunning) return;
    if(!paused){
      // most megállítjuk
      paused = true;
      pauseStart = performance.now();
      if(startBtn) startBtn.innerHTML = '<i class="fa-solid fa-play"></i>';
    } else {
      // folytatás
      paused = false;
      // növeljük a pausedAccum-ot a pause idővel
      pausedAccum += (performance.now() - pauseStart);
      pauseStart = 0;
      if(startBtn) startBtn.innerHTML = '<i class="fa-solid fa-pause"></i>';
    }
  }

  // kilépés: teljes törlés, nem indul el automatikusan
  function exitGame(){
    // törlés
    tiles.forEach(t => { try{ if(t.el.parentNode) t.el.parentNode.removeChild(t.el); } catch(e){} });
    tiles = [];
    chartData = null; // ha szeretnéd, töröljük a betöltött chartot is
    noteIndex = 0;
    gameRunning = false;
    paused = false;
    pausedAccum = 0;
    pauseStart = 0;
    score = 0; perfectCount = 0; greatCount = 0;
    scoreEl.textContent = score;
    overlay.style.display = 'none';
    if(startBtn) startBtn.innerHTML = '<i class="fa-solid fa-play"></i>';
  }

  // billentyűkezelés — csak ha fut és nincs pause
  window.addEventListener('keydown', (e)=>{
    if(!gameRunning || paused) return;
    const key = e.key.toLowerCase();
    if(!(key in keyMap)) return;
    const col = keyMap[key];
    const colTiles = tiles.filter(t => t.col === col && !t.hit);
    if(colTiles.length === 0) return;
    // a tile középpontja legközelebb a judgeLine-hoz
    const target = colTiles.reduce((a,b) => ( (a.y + a.height/2) > (b.y + b.height/2) ? a : b ));
    if(target) target.attemptHit();
  });



  // gomb események
  if(startBtn){
    startBtn.addEventListener('click', ()=>{
      if(!gameRunning) startGame();
      else togglePause();
    });
  }
  if(restartBtn){
    restartBtn.addEventListener('click', ()=> { startGame(); });
  }
  if(exitBtn){
    exitBtn.addEventListener('click', ()=> { exitGame(); });
  }
  if(pauseBtn){
    pauseBtn.addEventListener('click', ()=> { togglePause(); });
  }

  // indítjuk a loopot (nem fog spawnolni semmit addig, amíg startGame nem állítja gameRunning=true + gameStartTime)
  requestAnimationFrame(loop);

  // debug: ha szeretnéd látod mikor spawnol (kikommentezve)
  // function debugSpawn(note){ console.log('spawn:', note.time, 'col', note.col, 'type', note.type); }

})();
