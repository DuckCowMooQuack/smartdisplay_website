/* Calm ASCII interiors for Nat King Cole. Uniform scale, no title or audio. */
(function () {
  'use strict';
  var canvas = document.getElementById('winter'), ctx = canvas.getContext('2d');
  var background = document.createElement('canvas'), base = background.getContext('2d');
  var scene = document.body.getAttribute('data-scene');
  var w, h, scale, snow = [], elapsed = 0, last = 0, paused = false, controlsTimer;
  var reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var cream = '#dfd4b9', gold = '#ebbd79', wood = '#9c7c59', muted = '#645847';
  var seed = 1225;
  function random() {
    seed = (Math.imul(seed, 1664525) + 1013904223) | 0;
    return (seed >>> 0) / 4294967296;
  }
  function text(value, x, y, color, size, target) {
    var c = target || ctx;
    c.font = (size || 17) + 'px "Courier New", monospace';
    c.textBaseline = 'top'; c.fillStyle = color || cream;
    c.fillText(value, x, y);
  }
  function sprite(lines, x, y, color, size) {
    size = size || 17;
    lines.forEach(function (line, i) { text(line, x, y + i * size * 1.05, color, size); });
  }
  function row(x, y, count, glyph, color, size, target) {
    text(new Array(count + 1).join(glyph), x, y, color, size, target);
  }
  function candle(x, bottom, tall, phase) {
    var top = bottom - tall;
    ctx.globalAlpha = 0.8 + Math.sin(elapsed * 1.8 + phase) * 0.12;
    text(Math.sin(elapsed * 1.2 + phase) > 0 ? ')' : '(', x + 9, top - 38, '#f5db9f', 22);
    text('*', x + 7, top - 20, '#e5a75d', 21);
    ctx.globalAlpha = 1;
    text('___', x, top, cream, 17);
    for (var y = top + 15; y < bottom; y += 17) text('|:|', x, y, '#c9bb9e', 17);
    text('===', x, bottom, wood, 17);
  }
  function tree(x, bottom, size) {
    ctx.save(); ctx.translate(x, bottom); ctx.scale(size, size);
    text('+', -8, -321, gold, 26);
    for (var r = 0; r < 18; r++) {
      var span = Math.floor(r * 0.68);
      var branch = '/' + new Array(span * 2 + 1).join(r % 4 === 3 ? '_' : '^') + '\\';
      text(branch, -branch.length * 5.1, -285 + r * 16, r % 4 === 3 ? '#81a08a' : '#427e68', 17);
      if (r > 4 && r % 3 === 0) {
        for (var c = -span; c < span; c += 5) {
          ctx.globalAlpha = 0.65 + Math.sin(elapsed * 0.6 + c + r) * 0.18;
          text('*', c * 10, -285 + r * 16, gold, 17);
        }
        ctx.globalAlpha = 1;
      }
    }
    sprite(['|H|', '|H|'], -15, 0, wood, 17);
    ctx.restore();
  }
  function stocking(x, y, color) {
    sprite(['|____|', '|    |', '|    |', '|    |___', '|        )', " `------'"], x, y, color, 17);
    text('======', x, y - 5, cream, 17);
  }
  function fire(x, bottom) {
    var height = 10;
    for (var y = 0; y < height; y++) {
      var p = y / height;
      var curl = Math.sin(elapsed * 1.7 + p * 3) * p * 2;
      var spread = (1 - p) * 10;
      for (var col = -12; col <= 12; col++) {
        if (Math.abs(col - curl) > spread + Math.sin(col + elapsed * 2.1) * 0.8) continue;
        var edge = Math.abs(col - curl) / Math.max(1, spread);
        var glyphs = edge < 0.45 ? 'oO@' : '*x^';
        var glyph = glyphs[Math.abs(Math.floor(elapsed * 2.5 + y + col)) % 3];
        text(glyph, x + col * 10, bottom - y * 16, edge < 0.45 ? '#f7d79a' : '#d98d53', 18);
      }
    }
    sprite(['  /====================/ ', ' /____________________/  '], x - 130, bottom + 20, '#ae7850', 17);
    row(x - 130, bottom + 57, 26, '=', muted, 17);
  }
  function fireplace() {
    var cx = w * 0.57, bottom = h * 0.79, top = bottom - 480;
    // Individual ASCII bricks retain their shape rather than stretching to fit.
    for (var y = top; y <= bottom; y += 23) {
      var offset = Math.round((y - top) / 23) % 2 ? 28 : 0;
      row(cx - 240 - offset, y, 9, '[____]', '#80654e', 16);
    }
    ctx.fillStyle = '#0b0b0c'; ctx.fillRect(cx - 161, bottom - 235, 330, 230);
    row(cx - 171, bottom - 253, 36, '_', wood, 16);
    for (y = bottom - 235; y < bottom; y += 19) {
      text('||', cx - 178, y, wood, 17); text('||', cx + 162, y, wood, 17);
    }
    row(cx - 290, top - 22, 59, '=', '#c9a57b', 17);
    row(cx - 290, top - 2, 59, '-', wood, 17);
    stocking(cx - 135, top + 15, '#b36d68');
    stocking(cx + 75, top + 15, '#718b79');
    candle(cx - 190, top - 25, 62, 0);
    candle(cx + 156, top - 25, 88, 2);
    sprite(['  .---. ', ' ( * * )', "  `---' "], cx - 40, top - 87, '#69967b', 18);
    fire(cx, bottom - 90);
    row(cx - 270, bottom + 18, 55, '=', '#ad8d67', 17);
    tree(w * 0.15, bottom + 20, 0.84);
    sprite(['   ><   ', '+---+---+', '|   |   |', '+---+---+'], w * 0.15 - 42, bottom + 59, '#a7836d', 17);
    for (var r = 0; r < 7; r++) {
      var inset = Math.abs(3 - r) * 23;
      row(w * 0.22 + inset, bottom + 142 + r * 12, Math.floor((w * 0.57 - inset * 2) / 10), r % 2 ? '.' : '-', '#69514a', 16);
    }
  }
  function windowScene(dt) {
    var left = w / 2 - 268, top = h * 0.20, bottom = top + 490;
    ctx.fillStyle = '#07131e'; ctx.fillRect(left, top, 540, 490);
    // A quiet silhouette beyond the glass, including a distant cabin.
    for (var i = 0; i < 7; i++) {
      var x = left + 25 + i * 78;
      sprite(['   ^   ', '  /_\\  ', ' /___\\ ', '/_____\\', '   |   '], x, bottom - 140 - (i % 2) * 35, '#36565f', 15);
    }
    sprite(['   /\\   ', '  /__\\  ', ' /____\\ ', '| [] []|', '|___|__|'], left + 206, bottom - 83, '#64828a', 15);
    text('[] []', left + 224, bottom - 37, '#b8a378', 15);
    ctx.save(); ctx.beginPath(); ctx.rect(left + 8, top + 8, 523, 475); ctx.clip();
    snow.forEach(function (flake, i) {
      flake.y = (flake.y + dt * flake.speed) % 490;
      ctx.globalAlpha = i % 3 ? 0.55 : 0.8;
      text(i % 11 ? '.' : '*', left + flake.x + Math.sin(elapsed * 0.3 + flake.phase) * 4, top + flake.y, '#c6d4d9', 16);
    });
    ctx.globalAlpha = 1; ctx.restore();
    for (var y = top; y <= bottom; y += 18) {
      text('||', left - 16, y, wood, 17); text('||', left + 534, y, wood, 17);
      text('||', left + 260, y, '#ad906a', 17);
    }
    row(left - 17, top - 18, 59, '=', '#b99a76', 16);
    row(left - 17, top + 232, 59, '=', '#a98b66', 16);
    row(left - 36, bottom + 8, 64, '=', '#c0a17d', 16);
    row(left - 36, bottom + 29, 64, '-', wood, 16);
    // A simple evergreen swag above the window.
    for (i = 0; i < 23; i++) {
      text(i % 3 ? '^' : '*', left + i * 23, top - 65 + Math.sin(i / 22 * Math.PI) * 15, i % 3 ? '#50816b' : gold, 18);
    }
    var table = bottom + 175;
    candle(left + 35, table, 94, 1); candle(left + 90, table, 61, 3);
    sprite(['   .----------. ', '   |  ~    ~  |--.', '   |          |  |', "   |          |--'", '    `--------\'  ', '  =============='], left + 262, table - 94, '#c6a48d', 19);
    for (i = 0; i < 4; i++) {
      var rise = (elapsed * 7 + i * 19) % 83;
      ctx.globalAlpha = 0.6 * (1 - rise / 100);
      text(i % 2 ? ')' : '(', left + 332 + Math.sin(elapsed * 0.5 + i) * 10, table - 100 - rise, '#b6b3a8', 20);
    }
    ctx.globalAlpha = 1;
    sprite([' .-----------------.', ' |_________________|', ' .-----------------.', ' |_________________|'], left + 4, table + 31, '#8a837b', 18);
    row(left - 54, table + 114, 68, '=', wood, 16);
    for (y = table + 133; y < Math.min(h - 40, table + 320); y += 18) {
      text('||', left - 26, y, muted, 17); text('||', left + 558, y, muted, 17);
    }
  }
  function rebuild() {
    seed = 1225;
    canvas.width = background.width = window.innerWidth;
    canvas.height = background.height = window.innerHeight;
    scale = Math.min(canvas.width / 800, canvas.height / 1080);
    w = canvas.width / scale; h = canvas.height / scale;
    base.setTransform(scale, 0, 0, scale, 0, 0);
    base.fillStyle = '#100f11'; base.fillRect(0, 0, w, h);
    for (var y = 30; y < h * 0.82; y += 51) {
      for (var x = 18; x < w; x += 84) text('.', x, y, '#3b3432', 15, base);
    }
    for (y = h * 0.86; y < h; y += 34) row(0, y, Math.ceil(w / 10), '_', '#3f3430', 16, base);
    snow = [];
    for (var i = 0; i < 130; i++) snow.push({x: random() * 535, y: random() * 490, speed: 4 + random() * 9, phase: random() * 6.28});
    draw(0);
  }
  function draw(dt) {
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1;
    ctx.drawImage(background, 0, 0);
    ctx.setTransform(scale, 0, 0, scale, 0, 0);
    if (scene === 'fireplace_room') fireplace(); else windowScene(dt);
  }
  function frame(now) {
    window.requestAnimationFrame(frame);
    if (document.hidden || paused || reduced) { last = now; return; }
    if (now - last < 66) return;
    var dt = Math.min(0.2, (now - (last || now)) / 1000);
    last = now; elapsed += dt; draw(dt);
  }
  function showControls() {
    document.getElementById('controls').classList.add('visible');
    clearTimeout(controlsTimer);
    controlsTimer = setTimeout(function () { document.getElementById('controls').classList.remove('visible'); }, 5000);
  }
  if (reduced) { paused = true; document.getElementById('pause').textContent = 'Resume'; }
  document.getElementById('pause').onclick = function () {
    paused = !paused; reduced = false; this.textContent = paused ? 'Resume' : 'Pause';
  };
  document.getElementById('back').onclick = function (event) {
    if (window.parent !== window) {
      event.preventDefault(); window.parent.postMessage({type: 'smartdisplay-scene-dismiss'}, window.location.origin);
    }
  };
  document.addEventListener('pointerdown', showControls);
  document.addEventListener('keydown', function (event) { showControls(); if (event.key === 'Escape') document.getElementById('back').click(); });
  window.addEventListener('resize', rebuild);
  rebuild(); window.requestAnimationFrame(frame);
}());
