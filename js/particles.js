// ─── Particle Text Effect ───
// Uso: initParticles('container-id', ['Palabra1', 'Palabra2'])
// El canvas se adapta al tamaño del contenedor y es responsive.
//
// Uso screensaver: initScreensaver(['Palabra1', 'Palabra2'], 5)
// Muestra partículas a pantalla completa tras N minutos de inactividad.

function initParticles(containerId, words) {
  const container = document.getElementById(containerId);
  if (!container) return;

  const canvas = document.createElement('canvas');
  container.appendChild(canvas);
  const ctx = canvas.getContext('2d');

  const pixelSteps = 6;
  const drawAsPoints = true;
  let wordIndex = 0;
  let frameCount = 0;
  const particles = [];
  const mouse = { x: 0, y: 0, isPressed: false, isRightClick: false };

  function resize() {
    const w = container.clientWidth;
    const h = container.clientHeight;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    canvas.style.width = w + 'px';
    canvas.style.height = h + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return { w, h };
  }

  let displayW, displayH;

  class Particle {
    constructor() {
      this.pos = { x: 0, y: 0 };
      this.vel = { x: 0, y: 0 };
      this.acc = { x: 0, y: 0 };
      this.target = { x: 0, y: 0 };
      this.closeEnoughTarget = 100;
      this.maxSpeed = 1.0;
      this.maxForce = 0.1;
      this.particleSize = 10;
      this.isKilled = false;
      this.startColor = { r: 0, g: 0, b: 0 };
      this.targetColor = { r: 0, g: 0, b: 0 };
      this.colorWeight = 0;
      this.colorBlendRate = 0.01;
    }

    move() {
      let proximityMult = 1;
      const dx = this.pos.x - this.target.x;
      const dy = this.pos.y - this.target.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      if (distance < this.closeEnoughTarget) {
        proximityMult = distance / this.closeEnoughTarget;
      }
      let towardsX = this.target.x - this.pos.x;
      let towardsY = this.target.y - this.pos.y;
      const magnitude = Math.sqrt(towardsX * towardsX + towardsY * towardsY);
      if (magnitude > 0) {
        towardsX = (towardsX / magnitude) * this.maxSpeed * proximityMult;
        towardsY = (towardsY / magnitude) * this.maxSpeed * proximityMult;
      }
      let steerX = towardsX - this.vel.x;
      let steerY = towardsY - this.vel.y;
      const steerMag = Math.sqrt(steerX * steerX + steerY * steerY);
      if (steerMag > 0) {
        steerX = (steerX / steerMag) * this.maxForce;
        steerY = (steerY / steerMag) * this.maxForce;
      }
      this.acc.x += steerX;
      this.acc.y += steerY;
      this.vel.x += this.acc.x;
      this.vel.y += this.acc.y;
      this.pos.x += this.vel.x;
      this.pos.y += this.vel.y;
      this.acc.x = 0;
      this.acc.y = 0;
    }

    draw() {
      if (this.colorWeight < 1.0) {
        this.colorWeight = Math.min(this.colorWeight + this.colorBlendRate, 1.0);
      }
      const cr = Math.round(this.startColor.r + (this.targetColor.r - this.startColor.r) * this.colorWeight);
      const cg = Math.round(this.startColor.g + (this.targetColor.g - this.startColor.g) * this.colorWeight);
      const cb = Math.round(this.startColor.b + (this.targetColor.b - this.startColor.b) * this.colorWeight);
      ctx.fillStyle = `rgb(${cr}, ${cg}, ${cb})`;
      if (drawAsPoints) {
        ctx.fillRect(this.pos.x, this.pos.y, 2, 2);
      } else {
        ctx.beginPath();
        ctx.arc(this.pos.x, this.pos.y, this.particleSize / 2, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    kill() {
      if (!this.isKilled) {
        const randomX = Math.random() * 1000;
        const randomY = Math.random() * 500;
        let dirX = randomX - displayW / 2;
        let dirY = randomY - displayH / 2;
        const mag = Math.sqrt(dirX * dirX + dirY * dirY);
        const scale = (displayW + displayH) / 2;
        if (mag > 0) {
          dirX = (dirX / mag) * scale;
          dirY = (dirY / mag) * scale;
        }
        this.target.x = displayW / 2 + dirX;
        this.target.y = displayH / 2 + dirY;
        this.startColor = {
          r: this.startColor.r + (this.targetColor.r - this.startColor.r) * this.colorWeight,
          g: this.startColor.g + (this.targetColor.g - this.startColor.g) * this.colorWeight,
          b: this.startColor.b + (this.targetColor.b - this.startColor.b) * this.colorWeight,
        };
        this.targetColor = { r: 0, g: 0, b: 0 };
        this.colorWeight = 0;
        this.isKilled = true;
      }
    }
  }

  function randomPos(centerX, centerY, mag) {
    const rx = Math.random() * 1000;
    const ry = Math.random() * 500;
    let dx = rx - centerX;
    let dy = ry - centerY;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist > 0) {
      dx = (dx / dist) * mag;
      dy = (dy / dist) * mag;
    }
    return { x: centerX + dx, y: centerY + dy };
  }

  function nextWord(word) {
    const offscreen = document.createElement('canvas');
    offscreen.width = displayW;
    offscreen.height = displayH;
    const offCtx = offscreen.getContext('2d');
    offCtx.fillStyle = '#fff';
    offCtx.font = 'bold 100px Arial';
    offCtx.textAlign = 'center';
    offCtx.textBaseline = 'middle';
    offCtx.fillText(word, displayW / 2, displayH / 2);
    const imageData = offCtx.getImageData(0, 0, displayW, displayH);
    const pixels = imageData.data;

    const newColor = {
      r: Math.random() * 255,
      g: Math.random() * 255,
      b: Math.random() * 255,
    };

    const coords = [];
    for (let i = 0; i < pixels.length; i += pixelSteps * 4) {
      coords.push(i);
    }
    for (let i = coords.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [coords[i], coords[j]] = [coords[j], coords[i]];
    }

    let pIdx = 0;
    for (const coord of coords) {
      const alpha = pixels[coord + 3];
      if (alpha > 0) {
        const x = (coord / 4) % displayW;
        const y = Math.floor((coord / 4) / displayW);
        let p;
        if (pIdx < particles.length) {
          p = particles[pIdx];
          p.isKilled = false;
          pIdx++;
        } else {
          p = new Particle();
          const rp = randomPos(displayW / 2, displayH / 2, (displayW + displayH) / 2);
          p.pos.x = rp.x;
          p.pos.y = rp.y;
          p.maxSpeed = Math.random() * 6 + 4;
          p.maxForce = p.maxSpeed * 0.05;
          p.particleSize = Math.random() * 6 + 6;
          p.colorBlendRate = Math.random() * 0.0275 + 0.0025;
          particles.push(p);
        }
        p.startColor = {
          r: p.startColor.r + (p.targetColor.r - p.startColor.r) * p.colorWeight,
          g: p.startColor.g + (p.targetColor.g - p.startColor.g) * p.colorWeight,
          b: p.startColor.b + (p.targetColor.b - p.startColor.b) * p.colorWeight,
        };
        p.targetColor = newColor;
        p.colorWeight = 0;
        p.target.x = x;
        p.target.y = y;
      }
    }

    for (let i = pIdx; i < particles.length; i++) {
      particles[i].kill();
    }
  }

  function animate() {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.1)';
    ctx.fillRect(0, 0, displayW, displayH);

    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.move();
      p.draw();
      if (p.isKilled) {
        if (p.pos.x < 0 || p.pos.x > displayW || p.pos.y < 0 || p.pos.y > displayH) {
          particles.splice(i, 1);
        }
      }
    }

    if (mouse.isPressed && mouse.isRightClick) {
      for (const p of particles) {
        const dx = p.pos.x - mouse.x;
        const dy = p.pos.y - mouse.y;
        if (Math.sqrt(dx * dx + dy * dy) < 50) {
          p.kill();
        }
      }
    }

    frameCount++;
    if (frameCount % 240 === 0) {
      wordIndex = (wordIndex + 1) % words.length;
      nextWord(words[wordIndex]);
    }
    requestAnimationFrame(animate);
  }

  function init() {
    const dims = resize();
    displayW = dims.w;
    displayH = dims.h;
    nextWord(words[0]);
    animate();
  }

  canvas.addEventListener('mousedown', (e) => {
    mouse.isPressed = true;
    mouse.isRightClick = e.button === 2;
  });

  canvas.addEventListener('mouseup', () => {
    mouse.isPressed = false;
    mouse.isRightClick = false;
  });

  canvas.addEventListener('mousemove', (e) => {
    const rect = canvas.getBoundingClientRect();
    mouse.x = e.clientX - rect.left;
    mouse.y = e.clientY - rect.top;
  });

  canvas.addEventListener('contextmenu', (e) => e.preventDefault());

  window.addEventListener('resize', () => {
    const dims = resize();
    displayW = dims.w;
    displayH = dims.h;
  });

  init();
}

// ─── Inactivity Screensaver ───
// Call once per page: initScreensaver(['Taller', 'Pro'], 5)
// After N minutes of inactivity, shows full-screen particles.
// Any keypress dismisses it.

function initScreensaver(words, idleMinutes) {
  if (!words || !idleMinutes) return;

  const overlay = document.createElement('div');
  overlay.className = 'screensaver';
  overlay.id = 'screensaver-overlay';
  document.body.appendChild(overlay);

  let idleTimer = null;
  let isActive = false;

  function startScreensaver() {
    if (isActive) return;
    isActive = true;
    overlay.classList.add('active');
    initParticles('screensaver-overlay', words);
  }

  function stopScreensaver() {
    if (!isActive) return;
    isActive = false;
    overlay.classList.remove('active');
    overlay.innerHTML = '';
    resetTimer();
  }

  function resetTimer() {
    if (idleTimer) clearTimeout(idleTimer);
    idleTimer = setTimeout(startScreensaver, idleMinutes * 60 * 1000);
  }

  const events = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll', 'click'];
  for (const evt of events) {
    window.addEventListener(evt, () => {
      if (!isActive) {
        resetTimer();
      }
    });
  }

  window.addEventListener('keydown', (e) => {
    if (isActive) {
      e.preventDefault();
      stopScreensaver();
    }
  });

  resetTimer();
}
