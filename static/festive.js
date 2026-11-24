/* Four original ASCII Christmas animations. No audio or external assets. */
(function () {
  'use strict';
  var canvas = document.getElementById('winter');
  var ctx = canvas.getContext('2d');
  var background = document.createElement('canvas');
  var back = background.getContext('2d');
  var scene = document.body.getAttribute('data-scene');
  var width, height, scale, w, h, ground;
  var snow = [], stars = [], time = 0, last = 0, paused = false, controlsTimer;
  var reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var colors = ['#ff797d', '#ffd578', '#7edab1', '#87bfff', '#d7a2ed'];
  var white = '#e6f1f3', dim = '#5e8599', gold = '#ffe4a3';
  var seed = 1225;
  function random() {
    seed = (Math.imul(seed, 1664525) + 1013904223) | 0;
    return (seed >>> 0) / 4294967296;
  }
  function text(value, x, y, color, size, target) {
    var c = target || ctx;
    c.fillStyle = color || white;
    c.font = (size || 17) + 'px "Courier New", monospace';
    c.textBaseline = 'top';
    c.fillText(value, x, y);
  }
  function sprite(lines, x, y, color, size) {
    size = size || 17;
    lines.forEach(function (line, i) { text(line, x, y + i * size * 1.05, color, size); });
  }
  function center(value, y, color, size) {
    size = size || 17;
    text(value, (w - value.length * size * 0.602) / 2, y, color, size);
  }
  function bulb(x, y, color, phase) {
    ctx.globalAlpha = 0.7 + 0.25 * Math.sin(time * 2 + phase);
    text('*', x, y, color, 19);
    ctx.globalAlpha = 1;
  }
  function rebuild() {
    seed = 1225;
    width = window.innerWidth; height = window.innerHeight;
    canvas.width = background.width = width;
    canvas.height = background.height = height;
    // Uniform physical scale preserves round snowmen on tall portrait displays.
    scale = Math.min(width / 800, height / 1050);
    w = width / scale; h = height / scale;
    ground = h * 0.77;
    back.setTransform(scale, 0, 0, scale, 0, 0);
    back.fillStyle = '#040c18'; back.fillRect(0, 0, w, h);
    stars = []; snow = [];
    for (var i = 0; i < Math.min(180, w * h / 6500); i++) {
      var star = {x: random() * w, y: random() * h * 0.72, phase: random() * 6.28};
      stars.push(star);
      text(i % 9 === 0 ? '+' : '.', star.x, star.y, '#42617e', 15, back);
    }
    for (var y = ground - 110; y < h; y += 18) {
      for (var x = 0; x < w; x += 14) {
        if (random() < 0.17 + (y / h) * 0.13) {
          text(random() < 0.25 ? '.' : '_', x, y, y > ground ? '#73969e' : '#244455', 15, back);
        }
      }
    }
    for (i = 0; i < 180; i++) snow.push({x: random() * w, y: random() * h, speed: 9 + random() * 24, phase: random() * 6.28});
    draw(0);
  }
  function tree(x, y, size, phase, dancing) {
    ctx.save(); ctx.translate(x, y);
    var beat = Math.sin(time * Math.PI * 2 * 150 / 60 + phase);
    if (dancing) {
      ctx.translate(0, -Math.max(0, beat) * 10);
      ctx.rotate(Math.sin(time * 3.8 + phase) * 0.08);
    }
    ctx.scale(size, size);
    text('*', -6, -315, gold, 26);
    for (var row = 0; row < 17; row++) {
      var half = Math.floor(row * 0.66);
      var branch = '/' + new Array(half * 2 + 1).join(row % 4 === 3 ? '_' : '^') + '\\';
      text(branch, -branch.length * 5.1, -285 + row * 16, row % 4 === 3 ? '#a9e4c3' : '#3aa786', 17);
      if (row > 3 && row % 3 === 0) {
        for (var j = -half; j <= half; j += 4) bulb(j * 10, -285 + row * 16, colors[(row + j + 40) % colors.length], phase + row + j);
      }
    }
    sprite(['|H|', '|H|'], -15, -12, '#b99b70', 17);
    ctx.restore();
  }
  function gift(x, y, size, color, phase, hopping) {
    var jump = hopping ? Math.max(0, Math.sin(time * 4.5 + phase)) * 12 : 0;
    ctx.save(); ctx.translate(x, y - jump); ctx.scale(size, size);
    sprite(['  ><  ', '+--+--+', '|  |  |', '+--+--+'], -35, -55, color, 16);
    ctx.restore();
  }
  function snowman(x, feet, size, phase, scarf) {
    var beat = Math.sin(time * Math.PI * 2 * 150 / 60 + phase);
    ctx.save(); ctx.translate(x, feet - Math.max(0, beat) * 12);
    ctx.rotate(Math.sin(time * 3.9 + phase) * 0.095); ctx.scale(size, size);
    sprite(['  _____  ', ' |_____| ', ' _|___|_ '], -45, -241, '#9eb6ce', 18);
    text(' ======= ', -45, -210, scarf, 18);
    sprite(['  .---.  ', ' (o > o) ', "  `---'  "], -45, -190, white, 18);
    text(' ==#=== ', -40, -142, scarf, 19);
    text('   ##', 0, -126, scarf, 17);
    sprite([' .----- .', '(   o   )', ' `.   .\'', ' .----- .', '(   o   )', '(       )', " `-----' "], -46, -123, white, 18);
    if (beat > 0) {
      sprite(['\\', ' \\___'], -104, -146, '#c99f76', 18);
      sprite(['    /', '___/'], 43, -159, '#c99f76', 18);
    } else {
      sprite([' ___', '/'], -104, -113, '#c99f76', 18);
      sprite(['___', '   \\'], 43, -117, '#c99f76', 18);
    }
    text(beat > 0 ? '__/      \\___' : '___/      \\__', -65, 2, white, 17);
    ctx.restore();
  }
  function notes(x, y, phase, color) {
    var lift = (time * 22 + phase * 40) % 130;
    ctx.globalAlpha = 0.85 * (1 - lift / 160);
    sprite([' |~', ' | ', '(o)'], x + Math.sin(time + phase) * 12, y - lift, color, 18);
    ctx.globalAlpha = 1;
  }
  function candyCane(x, y, size) {
    ctx.save(); ctx.translate(x, y); ctx.scale(size, size);
    sprite([' .--. ', '/ /\\|', '|/    ', '|/    ', '|/    ', '|/    ', '|/    '], 0, -125, '#e9c9c6', 18);
    for (var k = 0; k < 4; k++) text('/', 0, -72 + k * 18, '#ff797d', 18);
    ctx.restore();
  }
  function party() {
    center('*  *  *', h * 0.12 + 35, '#94b4cd', 17);
    tree(w * 0.5, ground - 175, 1.13, 1, false);
    candyCane(w * 0.08, ground + 12, 1.05);
    candyCane(w * 0.88, ground + 12, 1.05);
    snowman(w * 0.23, ground + 18, 0.91, 0, colors[0]);
    snowman(w * 0.77, ground + 18, 0.91, Math.PI, colors[3]);
    snowman(w * 0.5, ground + 112, 1.08, Math.PI / 2, colors[2]);
    notes(w * 0.10, ground - 275, 0, colors[3]);
    notes(w * 0.83, ground - 280, 2, colors[0]);
    notes(w * 0.57, ground - 355, 4, gold);
    gift(w * 0.17, ground + 120, 0.85, colors[4], 0, true);
    gift(w * 0.84, ground + 128, 0.9, colors[1], 2, true);
  }
  function house(x, bottom, size, color, phase) {
    ctx.save(); ctx.translate(x, bottom); ctx.scale(size, size);
    sprite(['      /\\      ', '     /__\\     ', '    /____\\    ', '   /______\\   ', '  /________\\  ', ' /__________\\ ', '/____________\\'], -84, -225, '#c9e1e4', 18);
    sprite(['|            |', '| []      [] |', '|            |', '|     __     |', '|    |  |    |', '|____|__|____|'], -76, -99, color, 18);
    text('[]', -55, -80, gold, 18); text('[]', 30, -80, gold, 18);
    for (var i = 0; i < 13; i++) bulb(-77 + i * 12, -111, colors[(Math.floor(time * 2) + i + phase) % colors.length], i);
    ctx.restore();
  }
  function train() {
    var span = w + 650;
    var x = ((time * 72 + w * 0.3) % span) - 480;
    var y = h * 0.89;
    text(new Array(Math.ceil(w / 10)).join('='), 0, y + 70, '#77909c', 16);
    sprite(['  __    ____ ', ' |  |__| []| ', ' |_________|]', '  (o)  (o)   '], x, y, colors[0], 19);
    for (var i = 0; i < 3; i++) {
      var wagonX = x + 155 + i * 102;
      gift(wagonX + 37, y + 24, 0.68, colors[i + 1], i, false);
      sprite(['[_______]', ' (o) (o) '], wagonX, y + 31, colors[i + 1], 18);
    }
    for (i = 0; i < 4; i++) text(i % 2 ? '.' : 'o', x + 20 - i * 11, y - 20 - ((time * 20 + i * 14) % 70), '#87a3b2', 18);
  }
  function village() {
    for (var i = 0; i < 7; i++) house(w * (i / 6), ground - 150, 0.58, '#446376', i);
    house(w * 0.17, ground + 28, 1.06, '#7f9bba', 1);
    house(w * 0.83, ground + 28, 1.06, '#a98b9e', 3);
    tree(w * 0.5, ground + 55, 1.2, 0, false);
    gift(w * 0.43, ground + 100, 0.8, colors[0], 0, false);
    gift(w * 0.6, ground + 95, 0.85, colors[3], 1, false);
    train();
  }
  function dancingTrees() {
    tree(w * 0.31, ground - 170, 0.83, 0, true);
    tree(w * 0.69, ground - 170, 0.83, 2, true);
    tree(w * 0.18, ground + 65, 0.95, 0.5, true);
    tree(w * 0.82, ground + 65, 0.95, 3.5, true);
    tree(w * 0.5, ground + 110, 1.26, 1.5, true);
    for (var i = 0; i < 5; i++) gift(w * (0.12 + i * 0.19), ground + 175, 0.85, colors[i], i, true);
    notes(w * 0.12, ground - 250, 0, colors[0]);
    notes(w * 0.85, ground - 250, 3, colors[3]);
  }
  function reindeer(x, y, phase) {
    var run = Math.sin(time * 8 + phase) > 0;
    sprite([' \\ /  \\ /', '  Y    Y ', ' <o>--./ ', '  /====/ ', run ? ' / /  / /' : '  \\ \\ \\ \\'], x, y, '#dbbd90', 19);
    text('*', x + 1, y + 39, '#ff797d', 18);
  }
  function sleigh() {
    // Scrolling rooftops make the flight feel continuous without losing Santa
    // off the edges of a narrow portrait screen.
    for (var i = -1; i < Math.ceil(w / 180) + 1; i++) {
      var x = i * 180 + (time * 18 % 180);
      house(x, ground + 35 + (i % 2) * 35, 0.87, i % 2 ? '#557e98' : '#8d7b97', i + 10);
    }
    ctx.save();
    var groupScale = Math.min(1.05, w / 850);
    ctx.translate(w * 0.5 + Math.sin(time * 0.24) * w * 0.08, h * 0.39 + Math.sin(time * 2) * 12);
    ctx.scale(groupScale, groupScale);
    text('-------------------------------------------------', -330, 59, '#b7a178', 18);
    reindeer(-340, -14, 0); reindeer(-220, 4, 2); reindeer(-100, 20, 4);
    sprite(['    /\\_     ', '   /___*    ', '  (o o)     ', '  /www\\     '], 90, -85, white, 20);
    text(' /___\\', 100, -80, colors[0], 20);
    sprite(['  .------.   ___ ', '  | +  + |  /  /', ' /|______|_/  / ', '(____________/  ', ' \\___________/  '], 35, 4, '#ff8c91', 21);
    gift(230, 15, 1, colors[2], 0, false);
    gift(275, 20, 0.8, colors[1], 1, false);
    for (i = 0; i < 22; i++) {
      var trail = (i * 23 + time * 42) % 300;
      ctx.globalAlpha = 1 - trail / 340;
      text(i % 3 ? '.' : '+', 330 + trail, 45 + Math.sin(i * 2) * 28, colors[i % 5], 18);
    }
    ctx.globalAlpha = 1; ctx.restore();
    for (i = 0; i < 5; i++) gift(w * (0.18 + i * 0.16), ground + 155, 0.75, colors[i], i, true);
  }
  function draw(dt) {
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1;
    ctx.drawImage(background, 0, 0);
    ctx.setTransform(scale, 0, 0, scale, 0, 0);
    // A scalloped string of warm, colorful lights frames every party scene.
    for (var i = 0; i < Math.ceil(w / 26); i++) {
      var y = 32 + Math.abs(Math.sin(i / 6)) * 26;
      text('_', i * 26, y - 12, '#46616b', 18);
      bulb(i * 26, y, colors[i % 5], i);
    }
    if (scene === 'snowman_party') party();
    else if (scene === 'christmas_village') village();
    else if (scene === 'dancing_trees') dancingTrees();
    else if (scene === 'santa_sleigh') sleigh();
    snow.forEach(function (flake, i) {
      flake.y = (flake.y + dt * flake.speed) % h;
      flake.x = (flake.x + dt * 3 + w) % w;
      ctx.globalAlpha = i % 3 ? 0.48 : 0.8;
      text(i % 9 === 0 ? '*' : '.', flake.x + Math.sin(time + flake.phase) * 5, flake.y, white, 16);
    });
    ctx.globalAlpha = 1;
  }
  function frame(now) {
    window.requestAnimationFrame(frame);
    if (document.hidden || paused || reduced) { last = now; return; }
    if (now - last < 66) return;
    var dt = Math.min(0.2, (now - (last || now)) / 1000);
    last = now; time += dt; draw(dt);
  }
  function showControls() {
    document.getElementById('controls').classList.add('visible');
    clearTimeout(controlsTimer);
    controlsTimer = setTimeout(function () { document.getElementById('controls').classList.remove('visible'); }, 5000);
  }
  if (reduced) {
    paused = true; document.getElementById('pause').textContent = 'Resume';
  }
  document.getElementById('pause').onclick = function () {
    paused = !paused; reduced = false; this.textContent = paused ? 'Resume' : 'Pause';
  };
  document.getElementById('back').onclick = function (event) {
    if (window.parent !== window) {
      event.preventDefault(); window.parent.postMessage({type: 'smartdisplay-scene-dismiss'}, window.location.origin);
    }
  };
  document.addEventListener('pointerdown', showControls);
  document.addEventListener('keydown', function (event) {
    showControls(); if (event.key === 'Escape') document.getElementById('back').click();
  });
  window.addEventListener('resize', rebuild);
  rebuild(); window.requestAnimationFrame(frame);
}());
