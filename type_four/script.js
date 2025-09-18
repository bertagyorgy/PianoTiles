(function(){
  const columns = document.querySelectorAll('.column');
  const startBtn = document.getElementById('startBtn');
  const scoreEl = document.getElementById('score');
  const overlay = document.getElementById('overlay');
  const finalScore = document.getElementById('finalScore');
  const finalPerfect = document.getElementById('finalPerfect');
  const finalGreat = document.getElementById('finalGreat');
  const restartBtn = document.getElementById('restartBtn');
  const exitBtn = document.getElementById('exitBtn');

  let perfect = 0;
  let great = 0;
  let tiles = [];
  let gameRunning = false;
  let paused = false;
  let score = 0;
  let totalNotes = 0;
  const maxNotes = 100;

  const keyMap = { 'd':0,'f':1,'g':2 };
  const hitLineY = window.innerHeight * 0.75;

  function createTile(colIndex){
    if(totalNotes >= maxNotes) return;
    const column = columns[colIndex];
    const tile = document.createElement('div');
    tile.className = 'tile';
    tile.style.top = '-120px';
    column.appendChild(tile);
    tiles.push({ el: tile, col: colIndex, y: -120, hit: false });
    totalNotes++;
  }

  function hitTile(tile){
    if(!tile || tile.hit) return;
    tile.hit = true;

    const centerY = tile.y + tile.el.offsetHeight/2;
    const diff = centerY - hitLineY;

    let points = 0;
    if(diff >= -20 && diff <= 10){
      points = 500;
      tile.el.style.background = "limegreen";
      perfect+=1;
    } else {
      points = 375;
      tile.el.style.background = "orange";
      great+=1;
    }
    score += points;
    scoreEl.textContent = score;

    setTimeout(()=>{
      if(tile.el.parentNode) tile.el.parentNode.removeChild(tile.el);
      tiles = tiles.filter(x=>x.el!==tile.el);
    },100);
  }

  function gameOver(){
    gameRunning = false;
    overlay.style.display='flex';
    overlay.style.zIndex = 9999;
    finalScore.textContent = score;
    finalPerfect.textContent = perfect;
    finalGreat.textContent = great;
    startBtn.textContent = "Játék indítása"; // visszaállítjuk
  }

  let spawnTimer=0;
  let spawnInterval=700;
  let lastTime=0;

  function update(dt){
    if(!gameRunning || paused) return;
    spawnTimer += dt;
    if(spawnTimer > spawnInterval){
      spawnTimer=0;
      createTile(Math.floor(Math.random()*3));
    }
    for(const t of tiles.slice()){
      if(t.hit) continue;
      t.y += 0.25*dt;
      t.el.style.top = t.y + 'px';

      if(t.y > window.innerHeight){
        gameOver();
        return;
      }
    }
  }

  function loop(ts){
    if(!lastTime) lastTime=ts;
    const dt = ts-lastTime;
    lastTime=ts;
    update(dt);
    requestAnimationFrame(loop);
  }

  function startGame(){
    tiles.forEach(t=>{ if(t.el.parentNode) t.el.parentNode.removeChild(t.el); });
    tiles=[];
    score=0; scoreEl.textContent=score;
    totalNotes=0;
    overlay.style.display='none';
    gameRunning=true;
    paused=false;
    lastTime=0; spawnTimer=0;
    startBtn.textContent = "Szünet";
  }

  function togglePause(){
    if(!gameRunning) return;
    paused = !paused;
    startBtn.textContent = paused ? "Folytatás" : "Szünet";
  }

  window.addEventListener('keydown',e=>{
    if(!gameRunning || paused) return;
    const key = e.key.toLowerCase();
    if(key in keyMap){
      const col = keyMap[key];
      const colTiles = tiles.filter(t=>t.col===col && !t.hit);
      if(colTiles.length===0) return;
      const target = colTiles.reduce((a,b)=>Math.abs((a.y+a.el.offsetHeight/2)-hitLineY) <
                                          Math.abs((b.y+b.el.offsetHeight/2)-hitLineY) ? a : b);
      hitTile(target);
    }
  });

  startBtn.addEventListener('click', ()=>{
    if(!gameRunning){
      startGame();
    } else {
      togglePause();
    }
  });
  restartBtn.addEventListener('click', startGame);
  exitBtn.addEventListener('click', ()=>{
    overlay.style.display='none';
    gameRunning=false;
    paused=false;
    tiles=[];
    score=0;
    scoreEl.textContent=score;
    startBtn.textContent="Játék indítása";
  });

  requestAnimationFrame(loop);
})();
