"""Mozart's Turkish March, K.331 III: a brisk, synthesized gameplay arrangement.

Melody reference: Mutopia-2015/08/13-108, typeset by Rune Zedeler and Chris Sawer.
Both the composition and this notation edition are public domain:
https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=108

The A, B and C themes below follow that score (ornaments simplified), with a
new light march accompaniment. No third-party recording or samples are used.
Run: python3 scripts/compose_turkish_march.py
"""
import re
import numpy as np
from compose_audio import Score, SR, env, hz

BPM = 152
THEMES = {
    'A': '''
        B4/16 A4/16 G#4/16 A4/16 |
        C5/8 R/8 D5/16 C5/16 B4/16 C5/16 |
        E5/8 R/8 F5/16 E5/16 D#5/16 E5/16 |
        B5/16 A5/16 G#5/16 A5/16 B5/16 A5/16 G#5/16 A5/16 |
        C6/4 A5/8 C6/8 |
        B5/8 F#5+A5/8 E5+G5/8 F#5+A5/8 |
        B5/8 F#5+A5/8 E5+G5/8 F#5+A5/8 |
        B5/8 F#5+A5/8 E5+G5/8 D#5+F#5/8 | E5/4
    ''',
    'B': '''
        C5+E5/8 D5+F5/8 |
        E5+G5/8 E5+G5/8 A5/16 G5/16 F5/16 E5/16 |
        B4+D5/4 C5+E5/8 D5+F5/8 |
        E5+G5/8 E5+G5/8 A5/16 G5/16 F5/16 E5/16 |
        B4+D5/4 A4+C5/8 B4+D5/8 |
        C5+E5/8 C5+E5/8 F5/16 E5/16 D5/16 C5/16 |
        G#4+B4/4 A4+C5/8 B4+D5/8 |
        C5+E5/8 C5+E5/8 F5/16 E5/16 D5/16 C5/16 | G#4+B4/4
    ''',
    'Aa': '''
        B4/16 A4/16 G#4/16 A4/16 |
        C5/8 R/8 D5/16 C5/16 B4/16 C5/16 |
        E5/8 R/8 F5/16 E5/16 D#5/16 E5/16 |
        B5/16 A5/16 G#5/16 A5/16 B5/16 A5/16 G#5/16 A5/16 |
        C6/8 R/8 A5/8 B5/8 |
        C6/8 B5/8 A5/8 G#5/8 | A5/8 E5/8 F5/8 D5/8 |
        C5/4 B4/8. A4/32 B4/32 | A4/4
    ''',
    'C': '''
        A4+A5/8 B4+B5/8 |
        C#5+C#6/4 A4+A5/8 B4+B5/8 |
        C#5+C#6/8 B4+B5/8 A4+A5/8 G#4+G#5/8 |
        F#4+F#5/8 G#4+G#5/8 A4+A5/8 B4+B5/8 |
        G#4+G#5/8 E4+E5/8 A4+A5/8 B4+B5/8 |
        C#5+C#6/4 A4+A5/8 B4+B5/8 |
        C#5+C#6/8 B4+B5/8 A4+A5/8 G#4+G#5/8 |
        F#4+F#5/8 B4+B5/8 G#4+G#5/8 E4+E5/8 | A4+A5/4
    '''
}


def midi(note):
    letter, sharp, octave = re.fullmatch(r'([A-G])(#?)(\d)', note).groups()
    return (int(octave) + 1) * 12 + 'C D EF G A B'.index(letter) + bool(sharp)


def events(text):
    position = 0
    for token in text.replace('|', ' ').split():
        notes, denominator = token.split('/')
        dotted = denominator.endswith('.')
        length = 4 / int(denominator.rstrip('.')) * (1.5 if dotted else 1)
        yield position, length, [] if notes == 'R' else [midi(n) for n in notes.split('+')]
        position += length
    assert position == 16, f'Expected a complete 16-beat phrase, got {position}'


def march_piano(note, duration):
    t = np.arange(int(duration * SR)) / SR
    f = hz(note)
    x = np.zeros_like(t)
    # A bright struck tone, with fast upper-partial decay and a short release.
    for partial in range(1, 9):
        phase = 2 * np.pi * f * (partial + .00013 * partial ** 2) * t
        x += np.sin(phase) * np.exp(-t * (2.8 + .8 * partial)) / partial ** 1.45
    return (x * env(t, duration, .003, .045)).astype(np.float32)


def turkish_march():
    beat = 60 / BPM
    sequence = ['A', 'A', 'B', 'Aa', 'B', 'Aa', 'C', 'C']
    score = Score(len(sequence) * 16 * beat)
    for phrase, name in enumerate(sequence):
        start = phrase * 16
        for offset, length, notes in events(THEMES[name]):
            for voice, note in enumerate(notes):
                gain = (.19 if len(notes) == 1 else .135) * (1.08 if offset % 1 == 0 else 1)
                duration = min(.55, length * beat * .84 + .05)
                score.add(march_piano(note, duration), (start + offset) * beat,
                          gain, .1 + voice * .1)
        # Accompaniment begins after the one-beat pickup of each phrase.
        if name == 'A':
            harmony = [(45,[60,64])] * 4 + [(40,[59,64])] * 3 + [(40,[59,64])]
        elif name == 'Aa':
            harmony = [(45,[60,64])] * 3 + [(41,[57,63]), (40,[57,64]),
                      (38,[59,65]), (40,[59,64]), (45,[60,64])]
        elif name == 'B':
            harmony = [(48,[60,64]),(43,[59,62]),(48,[60,64]),(43,[59,62]),
                       (45,[60,64]),(40,[59,64]),(45,[60,64]),(40,[59,64])]
        else:
            harmony = [(45,[61,64]),(45,[61,64]),(38,[57,62]),(40,[59,64]),
                       (45,[61,64]),(45,[61,64]),(40,[59,64]),(45,[61,64])]
        for bar, (root, chord) in enumerate(harmony):
            offset = 1 + 2 * bar
            for pulse in range(4 if bar < 7 else 2):
                time = (start + offset + pulse * .5) * beat
                notes = [root, root+12] if pulse == 0 else chord
                for note in notes:
                    score.add(march_piano(note, .3), time, .095 if pulse == 0 else .07, -.28)
            score.drum((start + offset) * beat, .062)
            if bar < 7:
                score.drum((start + offset + 1) * beat, .032, high=True)
    score.save('turkish-march', -19.8)


if __name__ == '__main__':
    turkish_march()
