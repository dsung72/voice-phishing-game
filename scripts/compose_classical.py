"""Classical-inspired game variations, synthesized without external recordings.

Moonlight Sonata (Beethoven, 1801) and Flight of the Bumblebee
(Rimsky-Korsakov, 1899-1900) are public-domain compositions. These are short,
freely developed game variations, not transcriptions of modern arrangements.
All notes and timbres are generated here; no MIDI, samples or recordings used.
Run from the repository root: python3 scripts/compose_classical.py
"""
import numpy as np
from compose_audio import Score, SR, env, hz


def bowed_note(midi, duration):
    """A short violin-like stroke, with a gentle attack rather than a synth beep."""
    t = np.arange(int(duration * SR)) / SR
    f = hz(midi)
    x = np.zeros_like(t)
    for cents, phase_offset in [(-4, .3), (4, 1.1)]:
        phase = 2 * np.pi * f * 2 ** (cents / 1200) * t
        phase += .016 * np.sin(2 * np.pi * 5.2 * t + phase_offset)
        for k in range(1, 9):
            x += np.sin(k * phase + phase_offset) / (2 * k ** 1.5)
    return (x * env(t, duration, .014, .05) * np.exp(-1.5 * t)).astype(np.float32)


def moonlight():
    # C-sharp minor, recognisable rolling triplets with a quicker pulse.
    beat = 60 / 112
    score = Score(24 * 4 * beat)
    harmony = [
        (37, [56, 61, 64]), (35, [56, 61, 64]),
        (33, [57, 61, 64]), (30, [57, 62, 66]),
        (32, [56, 60, 66]), (32, [56, 60, 63]),
        (37, [56, 61, 64]), (32, [56, 60, 63]),
    ]
    # Long upper notes leave the question text room while the triplets move.
    melody = [
        [(68, 0, 3), (68, 3, .75)], [(68, 0, 2), (71, 2, 2)],
        [(69, 0, 3), (68, 3, 1)], [(66, 0, 2), (69, 2, 2)],
        [(68, 0, 3), (66, 3, 1)], [(63, 0, 2), (66, 2, 2)],
        [(64, 0, 3), (63, 3, 1)], [(60, 0, 2), (63, 2, 2)],
    ]
    for bar in range(24):
        start = bar * 4 * beat
        root, chord = harmony[bar % 8]
        energy = [.9, 1, .94][bar // 8]
        for i in range(12):
            note = chord[i % 3]
            # The middle phrase rises an octave briefly, then settles back.
            if 8 <= bar < 16 and i >= 6:
                note += 12
            score.note('piano', note, start + i * beat / 3, .9,
                       (.16 if i % 3 == 0 else .12) * energy, -.25 + .25 * (i % 3))
        for pos in [0, 2]:
            score.note('piano', root, start + pos * beat, 2 * beat + .3, .17, -.3)
            score.note('piano', root + 12, start + pos * beat, 2 * beat + .2, .075, -.2)
        for n, pos, length in melody[bar % 8]:
            score.note('piano', n, start + pos * beat, length * beat + .35, .16, .18)
        for i, n in enumerate(chord):
            score.note('strings', n - 12, start, 4 * beat + .3, .026, (i - 1) * .5)
        # Muted low pulse adds urgency without a startling percussion hit.
        for pos in [0, 2]:
            score.drum(start + pos * beat, .055)
    score.save('moonlight-pursuit', -21)


def bumblebee():
    beat = 60 / 168
    score = Score(32 * 4 * beat)
    # Semitone flights and turns evoke the public-domain orchestral interlude.
    # New harmonic sequence / phrase order make a continuous game-length loop.
    figures = [
        [76, 75, 74, 73, 72, 71, 70, 69, 68, 69, 70, 71, 72, 71, 70, 69],
        [68, 69, 70, 71, 72, 73, 74, 75, 76, 75, 74, 73, 72, 71, 70, 69],
        [72, 71, 70, 69, 68, 67, 66, 65, 64, 65, 66, 67, 68, 69, 70, 71],
        [72, 73, 74, 75, 76, 77, 78, 79, 80, 79, 78, 77, 76, 75, 74, 73],
    ]
    harmony = [(45, [57, 60, 64]), (45, [57, 60, 64]),
               (41, [53, 57, 60]), (40, [52, 56, 59]),
               (38, [50, 53, 57]), (45, [57, 60, 64]),
               (40, [52, 56, 59]), (40, [52, 56, 62])]
    for bar in range(32):
        start = bar * 4 * beat
        root, chord = harmony[bar % 8]
        figure = figures[bar % 4]
        transpose = [0, 5, 0, 0][bar // 8]
        root += transpose
        chord = [n + transpose for n in chord]
        for i, n in enumerate(figure):
            time = start + i * beat / 4
            accent = 1 if i % 4 == 0 else .8
            score.add(bowed_note(n + transpose, beat * .34), time, .16 * accent, .12)
            score.note('piano', n + transpose - 12, time, .22, .09 * accent, -.2)
        # Low strings / piano alternate root and fifth beneath the fast line.
        for pulse in range(8):
            n = root if pulse % 2 == 0 else root + 7
            time = start + pulse * beat / 2
            score.add(bowed_note(n, beat * .65), time, .115, -.28)
            score.note('piano', n, time, .42, .11, -.3)
        for pos in [1, 3]:
            for i, n in enumerate(chord):
                score.add(bowed_note(n, beat * .6), start + pos * beat, .062, (i - 1) * .4)
        for pos in [0, 2]:
            score.drum(start + pos * beat, .095)
        if bar % 4 == 3:
            score.drum(start + 3.5 * beat, .06)
    score.save('bumblebee-chase', -19.5)


if __name__ == '__main__':
    moonlight()
    bumblebee()
