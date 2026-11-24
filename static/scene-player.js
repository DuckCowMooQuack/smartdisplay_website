/* Poll scene control without navigating the kiosk away from its photo page. */
(function () {
  'use strict';
  var script = document.querySelector('script[data-refresh-seconds]');
  var refreshSeconds = Number(script.getAttribute('data-refresh-seconds'));
  var activeId = null, dismissedId = null, frame = null, endTimer = null, refreshTimer;
  var scenes = {
    christmas: 'Christmas winter forest',
    snowman_party: 'Snowman dance party',
    christmas_village: 'Christmas village light show',
    dancing_trees: 'Dancing Christmas trees',
    santa_sleigh: "Santa's sleigh ride",
    fireplace_room: 'Cozy fireplace room',
    candlelit_window: 'Candlelit winter window'
  };
  function scheduleRefresh() {
    clearTimeout(refreshTimer);
    if (refreshSeconds > 0) refreshTimer = setTimeout(function () {
      if (!frame) window.location.reload();
    }, refreshSeconds * 1000);
  }
  function stop() {
    if (frame) frame.parentNode.removeChild(frame);
    frame = null;
    activeId = null;
    clearTimeout(endTimer);
    scheduleRefresh();
  }
  function poll() {
    var xhr = new XMLHttpRequest();
    xhr.open('GET', '/api/scene');
    xhr.timeout = 4000;
    xhr.onload = function () {
      if (xhr.status !== 200) return;
      var state;
      try { state = JSON.parse(xhr.responseText); } catch (error) { return; }
      var remaining = (state.ends_at - state.server_time) * 1000;
      if (!Object.prototype.hasOwnProperty.call(scenes, state.scene) || remaining <= 0) {
        if (frame) stop();
        return;
      }
      if (state.id === dismissedId || state.id === activeId) return;
      if (frame) stop();
      activeId = state.id;
      frame = document.createElement('iframe');
      frame.title = scenes[state.scene];
      frame.src = '/scenes/' + state.scene;
      frame.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;border:0;z-index:9999;background:#020609;';
      document.body.appendChild(frame);
      clearTimeout(refreshTimer);
      endTimer = setTimeout(stop, remaining);
    };
    // Keep the expiry timer running even if a request fails or HA goes offline.
    xhr.onloadend = function () { setTimeout(poll, 1000); };
    xhr.send();
  }
  window.addEventListener('message', function (event) {
    if (event.origin !== window.location.origin || !frame || event.source !== frame.contentWindow) return;
    if (event.data && event.data.type === 'smartdisplay-scene-dismiss') {
      dismissedId = activeId;
      stop();
    }
  });
  scheduleRefresh();
  poll();
}());
