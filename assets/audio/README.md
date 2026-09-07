# Game audio

Original synthesized music, composed specifically for this game. No commercial
game recordings, sampled soundtracks or third-party audio files are included.

- `hero-theme.mp3`: 104 BPM, D major, 55.38-second orchestral-style synth loop.
- `calm-focus.mp3`: 76 BPM, D major, 50.53-second piano/pad loop.
- UI click, start, back, next, correct, wrong, timeout and completion sounds are
  synthesized in `../game-audio.js` using Web Audio.

The music crossfades between scenes, drops to 16% of its selected volume during
educational speech, and suspends when the page is hidden. Independent music and
effects volume settings, plus mute, are saved on the device. Autoplay is attempted;
when the browser blocks it, the first click/touch or supported key resumes audio.

Rebuild music from the repository root with `python scripts/compose_audio.py`
(numpy, scipy and ffmpeg required). Run lifecycle checks with
`node scripts/audio-lifecycle.test.cjs`.

Design references consulted on 2026-09-07 (inspiration, no audio copied):

- [Nintendo: The making of the music of Kirby Air Riders, Chapter 2](https://www.nintendo.com/en-gb/News/2026/March/The-making-of-the-music-of-Kirby-Air-Riders-Chapter-2-3047229.html)
- [Astro Bot audio review](https://www.theverge.com/2024/9/13/24243763/astro-bot-sound-design-dualsense-controller)
- [Chrome: Web Audio, Autoplay Policy and Games](https://developer.chrome.com/blog/web-audio-autoplay)
