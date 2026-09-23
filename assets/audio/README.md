# Game audio

Synthesized music made specifically for this game. No commercial
game recordings, sampled soundtracks or third-party audio files are included.

- `hero-theme.mp3`: 104 BPM, D major, 55.38-second orchestral-style synth loop.
- `calm-focus.mp3`: 76 BPM, D major, 50.53-second piano/pad loop.
- `turkish-march.mp3`: 152 BPM, 50.53-second piano arrangement of Mozart’s
  *Turkish March (Rondo Alla Turca)*, K.331 III. General/easy and all type-specific
  practice modes (including voice listening) share this brisk march loop.
- `moonlight-pursuit.mp3`: earlier 112 BPM Moonlight variation, retained as an
  unused source asset; no game mode loads it.
- `bumblebee-chase.mp3`: 168 BPM, 45.71-second chromatic string/piano chase
  inspired by Rimsky-Korsakov’s *Flight of the Bumblebee*. Expert gameplay only.
- UI click, start, back, next, correct, wrong, timeout and completion sounds are
  synthesized in `../game-audio.js` using Web Audio.

The music crossfades between scenes, is completely muted throughout educational
speech (including the gaps between utterances), and suspends when the page is
hidden. Speech completion, stop or failure restores the selected music volume.
The silent music loop retains its playhead. Results and reading screens use
`calm-focus.mp3`; the landing and mode-selection screens use `hero-theme.mp3`. Independent music and
effects volume settings, plus mute, are saved on the device. Autoplay is attempted;
when the browser blocks it, the first click/touch or supported key resumes audio.

Rebuild music from the repository root with `python scripts/compose_audio.py`
, `python3 scripts/compose_classical.py`, and `python3 scripts/compose_turkish_march.py`
(numpy, scipy and ffmpeg required). Run lifecycle checks with
`node scripts/audio-lifecycle.test.cjs` and `node scripts/voice-playback.test.cjs`.

Design references consulted on 2026-09-07 (inspiration, no audio copied):

- [Nintendo: The making of the music of Kirby Air Riders, Chapter 2](https://www.nintendo.com/en-gb/News/2026/March/The-making-of-the-music-of-Kirby-Air-Riders-Chapter-2-3047229.html)
- [Astro Bot audio review](https://www.theverge.com/2024/9/13/24243763/astro-bot-sound-design-dualsense-controller)
- [Chrome: Web Audio, Autoplay Policy and Games](https://developer.chrome.com/blog/web-audio-autoplay)

## Classical variations and rights

The classical audio assets use public-domain
compositions: Beethoven (1770–1827), *Piano Sonata No. 14*, Op. 27 No. 2 (1801),
and Rimsky-Korsakov (1844–1908), *Flight of the Bumblebee* (1899–1900).
They are not complete performances or copies of modern arrangements. The
Python scripts define every note and synthesize all timbres; no third-party
recording or sample library is used.

The Turkish March arrangement follows the A, B and C themes of Mozart’s
*Rondo Alla Turca*, with simplified ornaments, faster 152 BPM articulation and
a newly synthesized march accompaniment. The notation reference is
[Mutopia-2015/08/13-108](https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=108),
typeset by Rune Zedeler and Chris Sawer and explicitly placed in the public
domain. Both the original composition and this notation edition are public
domain. No audio from another performer was copied.
Changing the pitch or speed of someone else's recording does not remove their
rights. Composition rights and recording/performance rights are separate.

Rights references checked on 2026-09-23:

- [KOMCA FAQ (expired classical works and separate recording rights)](https://www.komca.or.kr/CTLJSP?EVENTID=info_05_list&MENUID=1000005023005&SYSID=PATHFINDER&S_PAGENUMBER=1&S_ROWS=100&S_TTCON=)
- [U.S. Copyright Office: musical compositions and sound recordings](https://www.copyright.gov/register/pa-sr.html)
