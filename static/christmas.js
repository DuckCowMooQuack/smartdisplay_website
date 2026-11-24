/* Winter Night. All scenery is drawn with ASCII characters; no external assets. */
(function () {
  'use strict';
  var canvas = document.getElementById('winter');
  var ctx = canvas.getContext('2d');
  var forest = document.createElement('canvas');
  var groundLight = document.createElement('canvas');
  var base = forest.getContext('2d');
  var glow = groundLight.getContext('2d');
  var width, height, font, cw, ch, cols, rows, sceneRows, sceneTop, fireX, fireY;
  var snow = [], lights = [], sparks = [];
  var paused = false, last = 0, elapsed = 0, controlTimer;
  var embedded = window.parent !== window;
  var reducedMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var palette = ['#173136', '#28494b', '#47706c', '#72958a', '#a8beb0', '#d9dfc8'];
  var seed = 241;
  function random() {
    seed = (Math.imul(seed, 1664525) + 1013904223) | 0;
    return (seed >>> 0) / 4294967296;
  }
  function put(layer, x, y, text, color) {
    layer.fillStyle = color;
    layer.fillText(text, Math.round(x * cw), Math.round(y * ch));
  }
  function rebuild() {
    seed = 241;
    width = window.innerWidth;
    height = window.innerHeight;
    font = Math.max(8, Math.min(width / 75, height / 75));
    cw = font * 0.602;
    ch = font * 1.18;
    cols = Math.ceil(width / cw);
    rows = Math.ceil(height / ch);
    // Size the clearing from the shorter dimension instead of stretching its
    // depth to fill a tall screen. Extra portrait space becomes sky/foreground.
    sceneRows = Math.min(rows, width * 1.1 / ch);
    sceneTop = (rows - sceneRows) * 0.45;
    function sceneY(fraction) { return sceneTop + sceneRows * fraction; }
    // CSS pixels keep this light enough for the Pi and older Android kiosks.
    canvas.width = forest.width = groundLight.width = width;
    canvas.height = forest.height = groundLight.height = height;
    [ctx, base, glow].forEach(function (c) {
      c.font = font + 'px "Courier New", monospace';
      c.textBaseline = 'top';
    });
    base.fillStyle = '#020609';
    base.fillRect(0, 0, width, height);
    lights = []; snow = []; sparks = [];
    fireX = cols * 0.5;
    fireY = sceneY(0.87);

    // Distant stars and a small moon, leaving a dark opening above the clearing.
    for (var s = 0; s < cols * rows / 80; s++) {
      put(base, random() * cols, random() * rows * 0.57, random() < 0.12 ? '+' : '.', '#345052');
    }
    put(base, cols * 0.72, rows * 0.12, ' .--. ', '#7d9388');
    put(base, cols * 0.72, rows * 0.12 + 1, '( .  )', '#b9c5af');
    put(base, cols * 0.72, rows * 0.12 + 2, " `--' ", '#7d9388');

    // Snow-covered ground: the spacing expands toward the viewer.
    var horizon = sceneY(0.58);
    for (var y = Math.floor(horizon); y < rows; y++) {
      var depth = (y - horizon) / (rows - horizon);
      for (var x = 0; x < cols; x++) {
        if (random() < 0.24 + depth * 0.25) {
          var dx = (x - fireX) / (cols * 0.4);
          var dy = (y - fireY) / (sceneRows * 0.22);
          var heat = Math.max(0, 1 - Math.sqrt(dx * dx + dy * dy));
          var glyph = random() < 0.66 ? (depth > 0.6 ? '=' : '_') : '.';
          put(base, x, y, glyph, palette[Math.min(4, Math.floor(depth * 3) + 1)]);
          if (heat > 0) put(glow, x, y, glyph, 'rgba(255,187,98,' + (heat * 0.65) + ')');
        }
      }
    }
    function tree(cx, bottom, tall, near, decorated) {
      var top = bottom - tall;
      // Character cells are almost twice as tall as wide. Compensate so a pine
      // has the same natural silhouette in either screen orientation.
      var half = tall * 0.27 * ch / cw;
      // Paint a silhouette first so distant trees stay behind the branches.
      base.fillStyle = '#020609';
      base.beginPath();
      base.moveTo(cx * cw, top * ch);
      base.lineTo((cx - half) * cw, (bottom - 2) * ch);
      base.lineTo((cx + half) * cw, (bottom - 2) * ch);
      base.closePath(); base.fill();
      for (var r = 0; r < tall - 3; r++) {
        var proportion = r / tall;
        var tier = r % 7;
        var span = Math.max(0, Math.floor(half * proportion - (6 - tier) * 0.30));
        for (var c = -span; c <= span; c++) {
          var edge = Math.abs(c) / Math.max(1, span);
          var snowy = tier === 6 || (tier === 0 && random() > 0.3) || random() < 0.13;
          var glyph = snowy ? '_^*'[Math.floor(random() * 3)] : '/\\A^"'[Math.floor(random() * 5)];
          if (c === -span) glyph = '/';
          if (c === span) glyph = '\\';
          if (!span) glyph = '^';
          var shade = snowy ? Math.min(5, 2 + Math.floor(near * 3)) : Math.min(3, Math.floor(near * 3));
          if (edge < 0.5 && !snowy) shade = Math.max(0, shade - 1);
          put(base, cx + c, top + r, glyph, palette[shade]);
          if (decorated && r > 6 && tier === 4 && (c + span) % 7 === 0) {
            lights.push({x: cx + c, y: top + r, phase: random() * 6.28, color: random() < 0.75 ? '#ffe09a' : '#dd8b62'});
          }
        }
      }
      for (var t = 0; t < Math.max(2, tall * 0.09); t++) {
        put(base, cx - 1, bottom - t, near > 0.7 ? '|H|' : '||', near > 0.7 ? '#7b7860' : '#3b514a');
      }
    }
    // Back-to-front layers make a clearing framed by towering, close pines.
    for (var i = 0; i < 16; i++) {
      tree(cols * (0.12 + i * 0.051), sceneY(0.61 + random() * 0.06), sceneRows * (0.19 + random() * 0.17), 0.12, false);
    }
    [
      [0.13, 0.78, 0.64, 0.42], [0.89, 0.77, 0.70, 0.46],
      [0.27, 0.74, 0.47, 0.50], [0.73, 0.76, 0.51, 0.53],
      [0.07, 0.92, 0.95, 0.80], [0.97, 0.94, 0.99, 0.84],
      [0.19, 0.87, 0.68, 0.70], [0.85, 0.88, 0.75, 0.75],
      [-0.02, 1.02, 1.18, 1], [1.06, 1.03, 1.20, 1]
    ].forEach(function (p) { tree(cols * p[0], sceneY(p[1]), sceneRows * p[2], p[3], true); });

    // Fire ring and crossed logs.
    for (i = 0; i < 30; i++) {
      var a = i / 30 * Math.PI * 2;
      put(base, fireX + Math.cos(a) * 10, fireY + Math.sin(a) * 2 + 3, 'o', '#a29a7c');
    }
    for (i = -7; i <= 7; i++) {
      put(base, fireX + i, fireY + i * 0.16 + 3, '#', '#805a37');
      put(base, fireX + i, fireY - i * 0.16 + 3, '#', '#b47f46');
    }
    for (i = 0; i < Math.min(360, Math.floor(cols * rows / 30)); i++) {
      snow.push({x: random() * cols, y: random() * rows, speed: 1.1 + random() * 4.8,
        phase: random() * 6.28, size: random()});
    }
    for (i = 0; i < 24; i++) sparks.push({phase: random(), drift: random() * 2 - 1});
    draw(0);
  }
  function draw(dt) {
    ctx.globalAlpha = 1;
    ctx.drawImage(forest, 0, 0);
    var flicker = 0.76 + 0.13 * Math.sin(elapsed * 7.7) + 0.08 * Math.sin(elapsed * 13.1);
    ctx.globalAlpha = flicker;
    ctx.drawImage(groundLight, 0, 0);
    ctx.globalAlpha = 1;
    lights.forEach(function (light) {
      ctx.globalAlpha = 0.6 + Math.sin(elapsed * 1.2 + light.phase) * 0.3;
      put(ctx, light.x, light.y, '*', light.color);
    });
    ctx.globalAlpha = 1;
    // A character-cell flame field, tapered and curled by low-frequency wind.
    var flameHeight = Math.max(8, Math.min(12, sceneRows * 0.15));
    for (var y = 0; y < flameHeight; y++) {
      var f = y / flameHeight;
      var center = Math.sin(elapsed * 2.3 + f * 4) * (f * 2.2);
      var spread = (1 - f) * 6.5;
      for (var x = -8; x <= 8; x++) {
        var wave = Math.sin(x * 1.8 + elapsed * 8 + y * 0.7) * 0.7;
        if (Math.abs(x - center) > spread + wave) continue;
        var hot = Math.abs(x - center) / Math.max(1, spread);
        var color = hot < 0.35 ? '#fff3bf' : hot < 0.7 ? '#ffd16b' : '#ee863f';
        var chars = hot < 0.4 ? '@Oo' : 'x*^';
        var index = Math.abs(Math.floor(elapsed * 9 + x * 3 + y)) % chars.length;
        put(ctx, fireX + x, fireY - y, chars[index], color);
      }
    }
    sparks.forEach(function (spark) {
      var life = (elapsed * 0.18 + spark.phase) % 1;
      ctx.globalAlpha = (1 - life) * 0.8;
      put(ctx, fireX + spark.drift * life * 10 + Math.sin(elapsed + spark.phase * 9) * life * 2,
        fireY - life * flameHeight * 2.6, life > 0.5 ? '.' : '+', '#ffc378');
    });
    ctx.globalAlpha = 1;
    snow.forEach(function (flake) {
      flake.y = (flake.y + dt * flake.speed) % rows;
      flake.x = (flake.x + dt * (0.6 + Math.sin(elapsed * 0.25) * 0.8) + cols) % cols;
      var sway = Math.sin(elapsed * 0.65 + flake.phase) * (0.5 + flake.size);
      ctx.globalAlpha = 0.35 + flake.size * 0.6;
      put(ctx, flake.x + sway, flake.y, flake.size > 0.8 ? '*' : flake.size > 0.45 ? '+' : '.', '#e0e9df');
    });
    ctx.globalAlpha = 1;
  }
  function frame(now) {
    window.requestAnimationFrame(frame);
    if (document.hidden || paused || reducedMotion) { last = now; return; }
    if (now - last < 66) return; // 15 fps: calm snowfall and modest kiosk CPU use.
    var dt = Math.min(0.2, (now - (last || now)) / 1000);
    last = now; elapsed += dt;
    draw(dt);
  }
  function showControls() {
    document.getElementById('controls').classList.add('visible');
    clearTimeout(controlTimer);
    controlTimer = setTimeout(function () { document.getElementById('controls').classList.remove('visible'); }, 4000);
  }
  document.getElementById('pause').onclick = function () {
    paused = !paused;
    reducedMotion = false;
    this.textContent = paused ? 'Resume' : 'Pause';
  };
  if (reducedMotion) {
    paused = true;
    document.getElementById('pause').textContent = 'Resume';
  }
  document.getElementById('back').onclick = function (event) {
    if (embedded) { event.preventDefault(); window.parent.postMessage({type: 'smartdisplay-scene-dismiss'}, window.location.origin); }
  };
  document.addEventListener('pointerdown', showControls);
  document.addEventListener('keydown', function (event) {
    showControls();
    if (event.key === 'Escape') document.getElementById('back').click();
  });
  window.addEventListener('resize', rebuild);
  rebuild();
  window.requestAnimationFrame(frame);
}());
