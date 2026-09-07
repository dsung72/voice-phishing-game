/* Original music and UI sounds for the voice-phishing prevention game. */
(() => {
  'use strict';
  const assetBase = new URL('./audio/', document.currentScript.src);
  const storageKey = 'voice_game_sound_v1';
  const defaults = { music: .65, effects: .7, muted: false };
  let settings = { ...defaults };
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey) || 'null');
    if (saved && typeof saved === 'object') {
      for (const key of ['music', 'effects']) {
        if (typeof saved[key] === 'number' && Number.isFinite(saved[key])) settings[key] = Math.min(1, Math.max(0, saved[key]));
      }
      if (typeof saved.muted === 'boolean') settings.muted = saved.muted;
    }
  } catch (_) {}

  let ctx, master, musicBus, effectsBus, compressor;
  let screen = 'landing', desired = 'hero', speaking = false, initialized = false;
  let unavailable = false, musicError = false, prefetched = false, lastEffectAt = -1;
  const buffers = new Map(), pending = new Map(), tracks = new Map(), voices = new Set();
  const files = { hero: 'hero-theme.mp3', calm: 'calm-focus.mp3' };
  const audible = () => !settings.muted && !document.hidden;
  const musicWanted = () => audible() && settings.music > 0;
  const glide = (param, value, seconds = .15) => {
    if (!ctx) return;
    if (param.cancelAndHoldAtTime) param.cancelAndHoldAtTime(ctx.currentTime);
    else { const previous = param.value; param.cancelScheduledValues(ctx.currentTime); param.setValueAtTime(previous, ctx.currentTime); }
    param.linearRampToValueAtTime(value, ctx.currentTime + seconds);
  };

  function ensureContext() {
    if (ctx) return ctx;
    const AudioCtor = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtor) { unavailable = true; updateUI(); return null; }
    try {
      ctx = new AudioCtor({ latencyHint: 'interactive' });
      master = ctx.createGain(); musicBus = ctx.createGain(); effectsBus = ctx.createGain();
      compressor = ctx.createDynamicsCompressor();
      compressor.threshold.value = -7; compressor.knee.value = 8;
      compressor.ratio.value = 6; compressor.attack.value = .005; compressor.release.value = .15;
      musicBus.connect(master); effectsBus.connect(master);
      master.connect(compressor); compressor.connect(ctx.destination);
      master.gain.value = audible() ? 1 : 0;
      musicBus.gain.value = settings.music * (speaking ? .16 : 1);
      effectsBus.gain.value = settings.effects * .6;
      ctx.addEventListener('statechange', () => { if (ctx.state === 'running') syncMusic(); updateUI(); });
    } catch (_) { unavailable = true; updateUI(); }
    return ctx;
  }

  function loadTrack(name) {
    if (buffers.has(name)) return Promise.resolve(buffers.get(name));
    if (pending.has(name)) return pending.get(name);
    if (!ensureContext()) return Promise.resolve(null);
    const task = (async () => {
      try {
        const response = await fetch(new URL(files[name], assetBase));
        if (!response.ok) throw new Error('Audio unavailable');
        const buffer = await ctx.decodeAudioData(await response.arrayBuffer());
        buffers.set(name, buffer); musicError = false;
        return buffer;
      } catch (_) { musicError = true; return null; }
      finally { pending.delete(name); updateUI(); }
    })();
    pending.set(name, task);
    return task;
  }

  function stopTrack(name, fade = .7) {
    const track = tracks.get(name);
    if (!track) return;
    tracks.delete(name);
    glide(track.gain.gain, 0, fade);
    try { track.source.stop(ctx.currentTime + fade + .04); } catch (_) {}
  }

  function syncMusic() {
    if (!ctx || ctx.state !== 'running') return;
    glide(master.gain, audible() ? 1 : 0, .07);
    glide(musicBus.gain, settings.music * (speaking ? .16 : 1), speaking ? .12 : .55);
    glide(effectsBus.gain, settings.effects * .6, .05);
    if (!musicWanted()) { for (const name of [...tracks.keys()]) stopTrack(name, .12); return; }
    const name = desired;
    if (tracks.has(name)) return;
    const buffer = buffers.get(name);
    if (!buffer) {
      for (const other of [...tracks.keys()]) if (other !== name) stopTrack(other, .45);
      loadTrack(name).then(ready => { if (ready && desired === name && musicWanted()) syncMusic(); });
      return;
    }
    const source = ctx.createBufferSource(), gain = ctx.createGain();
    source.buffer = buffer; source.loop = true;
    gain.gain.value = 0; source.connect(gain); gain.connect(musicBus);
    const track = { source, gain };
    tracks.set(name, track);
    source.onended = () => { source.disconnect(); gain.disconnect(); if (tracks.get(name) === track) tracks.delete(name); };
    for (const other of [...tracks.keys()]) if (other !== name) stopTrack(other);
    source.start(); glide(gain.gain, 1, .9);
    if (!prefetched) { prefetched = true; loadTrack(name === 'hero' ? 'calm' : 'hero'); }
    updateUI();
  }

  function unlock() {
    if (!audible() || (!settings.music && !settings.effects)) return;
    if (!ensureContext()) return;
    if (ctx.state !== 'running') ctx.resume().then(() => { syncMusic(); updateUI(); }).catch(() => updateUI());
    else syncMusic();
  }

  function setScreen(name) {
    screen = name;
    desired = ['landing', 'mode', 'stage-select'].includes(name) ? 'hero' : 'calm';
    document.getElementById('sound-tools')?.setAttribute('data-audio-screen', name);
    if (ctx) syncMusic();
  }

  function setSpeaking(value) { speaking = !!value; if (ctx) syncMusic(); updateUI(); }

  function tone(freq, delay, duration, volume, type = 'sine', endFreq = freq) {
    if (voices.size >= 32) return;
    const time = ctx.currentTime + .006 + delay;
    const oscillator = ctx.createOscillator(), gain = ctx.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(freq, time);
    oscillator.frequency.exponentialRampToValueAtTime(Math.max(30, endFreq), time + duration);
    gain.gain.setValueAtTime(0, time);
    gain.gain.linearRampToValueAtTime(volume, time + .007);
    gain.gain.exponentialRampToValueAtTime(.0001, time + duration);
    oscillator.connect(gain); gain.connect(effectsBus);
    const voice = { oscillator, gain }; voices.add(voice);
    oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); voices.delete(voice); };
    oscillator.start(time); oscillator.stop(time + duration + .02);
  }

  function noise(delay, duration, volume) {
    if (voices.size >= 32) return;
    const time = ctx.currentTime + .006 + delay;
    const source = ctx.createBufferSource(), gain = ctx.createGain(), filter = ctx.createBiquadFilter();
    const buffer = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * duration), ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    source.buffer = buffer; filter.type = 'lowpass'; filter.frequency.value = 2100;
    source.connect(filter); filter.connect(gain); gain.connect(effectsBus);
    gain.gain.setValueAtTime(0, time); gain.gain.linearRampToValueAtTime(volume, time + .004);
    gain.gain.exponentialRampToValueAtTime(.0001, time + duration);
    const voice = { oscillator: source, gain }; voices.add(voice);
    source.onended = () => { source.disconnect(); filter.disconnect(); gain.disconnect(); voices.delete(voice); };
    source.start(time); source.stop(time + duration + .02);
  }

  function effect(kind = 'click') {
    if (!audible() || settings.effects <= 0) return;
    unlock();
    if (!ctx) return;
    // Only the newest sound waits for audio activation; taps never form a queue.
    if (ctx.state !== 'running') {
      const requested = performance.now(); lastEffectAt = requested;
      ctx.resume().then(() => {
        if (lastEffectAt === requested && performance.now() - requested < 500) { lastEffectAt = -1; effect(kind); }
      }).catch(() => {});
      return;
    }
    const now = performance.now();
    if (now - lastEffectAt < 45 && !['correct', 'wrong', 'timeout', 'complete'].includes(kind)) return;
    lastEffectAt = now;
    if (kind === 'start') {
      noise(0, .13, .09);
      [293.66, 440, 587.33].forEach((f, i) => tone(f, i * .07, .28, .13, 'triangle'));
      tone(90, 0, .19, .13, 'sine', 55);
    } else if (kind === 'correct') {
      [587.33, 739.99, 880].forEach((f, i) => { tone(f, i * .075, .35, .13); tone(f * 2, i * .075, .16, .026); });
    } else if (kind === 'wrong' || kind === 'timeout') {
      tone(246.94, 0, .18, .16, 'triangle', 196);
      tone(174.61, .11, .23, .12, 'sine', 146.83);
      noise(0, .055, .028);
    } else if (kind === 'complete') {
      [293.66, 369.99, 440, 587.33].forEach((f, i) => tone(f, i * .1, .5, .11, 'triangle'));
      tone(1174.66, .31, .7, .043); noise(0, .14, .055);
    } else if (kind === 'back') {
      tone(490, 0, .1, .1, 'sine', 330); noise(0, .028, .03);
    } else if (kind === 'next') {
      tone(440, 0, .09, .1); tone(659.25, .045, .13, .08); noise(0, .03, .025);
    } else {
      tone(740, 0, .085, .12, 'sine', 610); tone(185, 0, .045, .12); noise(0, .026, .036);
    }
  }

  function action(name) {
    if (name === 'choose') return; // The answer itself plays one result sound.
    if (/^(start-|retry|dismiss-practice-guide|open-voice-experience)/.test(name)) effect('start');
    else if (/^(go-|back-|exit-)/.test(name)) effect('back');
    else if (/next/.test(name)) effect('next');
    else effect('click');
  }

  function save() { try { localStorage.setItem(storageKey, JSON.stringify(settings)); } catch (_) {} }
  function updateUI() {
    const toggle = document.getElementById('sound-mute'), status = document.getElementById('sound-status');
    const silent = settings.muted || (!settings.music && !settings.effects);
    document.getElementById('sound-tools')?.classList.toggle('is-muted', silent);
    if (toggle) { toggle.textContent = settings.muted ? '전체 소리 켜기' : '전체 소리 끄기'; toggle.setAttribute('aria-pressed', String(settings.muted)); }
    if (status) status.textContent = unavailable ? '이 브라우저는 게임 소리를 지원하지 않아요.'
      : settings.muted ? '음악과 효과음이 꺼져 있어요.'
      : musicError ? '음악을 불러오지 못했어요. 소리를 다시 켜 주세요.'
      : !ctx || ctx.state !== 'running' ? '화면을 터치하면 음악이 시작돼요.'
      : speaking ? '통화가 잘 들리도록 음악을 줄였어요.' : '음악과 효과음 크기를 조절할 수 있어요.';
    for (const key of ['music', 'effects']) {
      const range = document.getElementById('sound-' + key), output = document.getElementById('sound-' + key + '-value');
      if (range) range.value = Math.round(settings[key] * 100);
      if (output) output.textContent = Math.round(settings[key] * 100) + '%';
    }
  }

  function init() {
    if (initialized) return;
    initialized = true;
    document.getElementById('sound-summary')?.addEventListener('click', () => effect());
    for (const key of ['music', 'effects']) document.getElementById('sound-' + key)?.addEventListener('input', event => {
      settings[key] = Number(event.target.value) / 100;
      settings.muted = false; save(); unlock(); if (ctx) syncMusic(); updateUI();
    });
    document.getElementById('sound-effects')?.addEventListener('change', () => effect());
    document.getElementById('sound-mute')?.addEventListener('click', () => {
      settings.muted = !settings.muted; save();
      if (!settings.muted) unlock();
      if (ctx) syncMusic(); updateUI();
    });
    document.addEventListener('click', event => {
      const panel = document.getElementById('sound-tools');
      if (panel && !panel.contains(event.target)) panel.open = false;
    });
    document.addEventListener('keydown', event => {
      if (event.key === 'Escape') {
        const panel = document.getElementById('sound-tools');
        if (panel?.open) { panel.open = false; document.getElementById('sound-summary')?.focus(); }
      }
      if (!event.repeat && ['Enter', ' ', '1', '2', '3'].includes(event.key)) unlock();
    }, true);
    // Keep gesture handlers: Safari can suspend audio again after an interruption.
    document.addEventListener('pointerdown', unlock, { capture: true, passive: true });
    document.addEventListener('touchend', unlock, { capture: true, passive: true });
    document.addEventListener('click', unlock, true);
    document.addEventListener('visibilitychange', () => {
      if (!ctx) return;
      if (document.hidden) {
        master.gain.cancelScheduledValues(ctx.currentTime); master.gain.setValueAtTime(0, ctx.currentTime);
        for (const voice of voices) { try { voice.oscillator.stop(); } catch (_) {} }
        ctx.suspend().catch(() => {});
      } else unlock();
      updateUI();
    });
    window.addEventListener('pagehide', () => { if (ctx) ctx.suspend().catch(() => {}); });
    window.addEventListener('pageshow', unlock);
    updateUI();
    unlock(); // Autoplay when permitted; otherwise the first interaction resumes it.
  }

  window.GameAudio = Object.freeze({ init, setScreen, setSpeaking, effect, action });
})();
