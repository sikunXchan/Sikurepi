"""An original upbeat instrumental and editorial SFX for Sikurepi's 118 s film.

Uses procedural instruments only: no songs, recordings or sample packs are copied.
The existing video is stream-copied without re-encoding or changing its edit.
"""
from pathlib import Path
import argparse
import hashlib
import json
import math
import re
import shutil
import subprocess
import wave

import numpy as np

ROOT = Path(__file__).resolve().parents[3]
FF = ROOT / 'outputs/video-tools/imageio_ffmpeg/binaries/ffmpeg-win-x86_64-v7.1.exe'
parser = argparse.ArgumentParser()
parser.add_argument('--source', type=Path, default=ROOT / 'outputs/video-edit-v7/sikurepi-caption-cut-v7.mp4')
parser.add_argument('--output', type=Path, default=ROOT / 'outputs/video-audio-v8')
parser.add_argument('--export', type=Path)
args = parser.parse_args()
OUT = args.output
OUT.mkdir(parents=True, exist_ok=True)
SR = 48000
DURATION = 118
N = SR * DURATION
rng = np.random.default_rng(20260920)
music = np.zeros((N, 2), dtype=np.float32)
fx = np.zeros_like(music)
events = []


def freq(note):
    return 440 * 2 ** ((note - 69) / 12)


def taper(w, attack=.005, release=.08):
    a, r = min(int(attack * SR), len(w)), min(int(release * SR), len(w))
    if a: w[:a] *= np.sin(np.linspace(0, np.pi / 2, a)) ** 2
    if r: w[-r:] *= np.cos(np.linspace(0, np.pi / 2, r)) ** 2
    return w.astype(np.float32)


def keys(note, length, bright=.7):
    t = np.arange(int(length * SR)) / SR
    f = freq(note)
    # Tine-like electric piano: a bright attack resolving into a warm fundamental.
    mod = (1.3 * bright * np.exp(-t * 8) + .12) * np.sin(2 * np.pi * f * 2 * t)
    w = np.sin(2 * np.pi * f * t + mod) * np.exp(-t * 2.6)
    w += .18 * np.sin(2 * np.pi * f * 2.002 * t) * np.exp(-t * 5)
    w += .07 * np.sin(2 * np.pi * f * 3 * t) * np.exp(-t * 9)
    return taper(w * .7, .002, .12)


def pluck(note, length):
    t = np.arange(int(length * SR)) / SR
    f = freq(note)
    w = np.zeros(len(t))
    for k in range(1, 8):
        w += np.sin(2 * np.pi * f * k * t + .05 * k) * (k ** -1.55) * np.exp(-t * (3 + k * .7))
    return taper(w * .75, .004, .06)


def bass(note, length):
    t = np.arange(int(length * SR)) / SR
    f = freq(note)
    phase = 2 * np.pi * f * t + .02 * np.sin(2 * np.pi * 4 * t)
    w = np.sin(phase) + .24 * np.sin(phase * 2) + .09 * np.sin(phase * 3)
    return taper(w * np.exp(-t * 2.5) * .78, .009, .10)


def air(length, smoothing=1):
    w = rng.normal(0, 1, int(length * SR))
    if smoothing > 1:
        w = np.convolve(w, np.ones(smoothing) / smoothing, mode='same')
    return w


def kick():
    t = np.arange(int(.30 * SR)) / SR
    phase = 2 * np.pi * (52 * t + 40 * .022 * (1 - np.exp(-t / .022)))
    return taper(np.sin(phase) * np.exp(-t * 19), .002, .07)


def clap():
    t = np.arange(int(.19 * SR)) / SR
    n = air(.19, 2)
    smooth = np.convolve(n, np.ones(24) / 24, mode='same')
    n -= smooth
    env = np.zeros_like(t)
    for onset, amp in [(0, .6), (.012, .8), (.026, 1)]:
        u = t - onset
        env += amp * np.exp(-np.maximum(0, u) * 40) * (u >= 0)
    return taper(n * env * .3, .001, .04)


def hat(length=.07):
    n = air(length)
    n -= np.convolve(n, np.ones(7) / 7, mode='same')
    t = np.arange(len(n)) / SR
    return taper(n * np.exp(-t * 65) * .25, .002, .02)


def mix(dest, w, at, gain=1, pan=0):
    start = int(at * SR)
    if start < 0:
        w = w[-start:]
        start = 0
    count = min(len(w), N - start)
    if count <= 0: return
    theta = (pan + 1) * np.pi / 4
    dest[start:start + count, 0] += w[:count] * gain * math.cos(theta)
    dest[start:start + count, 1] += w[:count] * gain * math.sin(theta)


def energy(at):
    if at < 6: return .44
    if 28 <= at < 41: return .77
    if 75 <= at < 85: return .66
    if 104 <= at < 112: return 1.09
    if at >= 112: return .65
    return 1


# 120 BPM: 2 s per bar; 6 s intro, 106 s main sequence, 6 s signature ending.
chords = [
    ([60, 64, 67, 71, 74], 36), ([59, 62, 67, 69, 74], 43),
    ([57, 60, 64, 67, 71], 33), ([57, 60, 64, 67, 71], 33),
    ([57, 60, 64, 65, 69], 41), ([57, 60, 64, 65, 69], 41),
    ([57, 60, 62, 65, 69], 38), ([59, 62, 65, 69, 76], 43),
]
motifs = [
    [(0, 76, .65), (1.5, 79, .4), (2.5, 74, .6)],
    [(.5, 74, .45), (1.5, 71, .55), (3, 69, .55)],
    [(0, 72, .7), (2, 76, .5), (3, 79, .5)],
    [(0, 76, .8), (2.5, 72, .6)],
    [(0, 77, .55), (1.5, 76, .4), (2.5, 72, .6)],
    [(.5, 69, .5), (2, 72, .5), (3, 76, .4)],
    [(0, 74, .6), (1.5, 77, .4), (3, 76, .4)],
    [(.5, 74, .55), (2, 71, .5), (3, 67, .65)],
]

print('Composing original instrumental, 120 BPM / C major / 118 seconds.', flush=True)
for i, note in enumerate([60, 64, 67, 71, 74, 79]):
    mix(music, keys(note, 3, .5), .12 + i * .18, .16, -.4 + i * .15)
for i, note in enumerate([72, 76, 79, 83]):
    mix(music, pluck(note, 1.5), 3 + i * .45, .16, -.1 + i * .10)

for bar in range(53):
    at = 6 + bar * 2
    if at >= 112: break
    chord, root = chords[bar % 8]
    amount = energy(at)
    # Unequal voicing, strum offsets and light human timing avoid a rigid loop.
    for beat, velocity in [(0, .8), (1.5, .60), (2.75, .67)]:
        for j, note in enumerate(chord[1:]):
            jitter = rng.uniform(-.010, .010)
            mix(music, keys(note, 1.4), at + beat * .5 + j * .012 + jitter,
                .12 * amount * velocity * rng.uniform(.88, 1.08), -.3 + j * .16)
    for beat, note, duration in [(0, root, .48), (1.5, root + 12, .30), (2.5, root + 7, .35), (3.5, root + 12, .25)]:
        mix(music, bass(note, duration), at + beat * .5, .23 * amount)
    # A light four-beat pop groove; hats sit wide and well below the melody.
    for beat in [0, 2, 3.5] if bar % 4 == 3 else [0, 2]:
        mix(music, kick(), at + beat * .5, .30 * amount)
    for beat in [1, 3]:
        mix(music, clap(), at + beat * .5 + rng.uniform(-.004, .006), .23 * amount, .05)
    for k in range(8):
        mix(music, hat(), at + k * .25 + (.013 if k % 2 else 0),
            (.11 if k % 2 else .075) * amount * rng.uniform(.82, 1.1), -.42 if k % 2 else .42)
    # Leave melodic breathing room during detailed reading and AI-help sections.
    quiet = (28 <= at < 40) or (75 <= at < 85)
    if not quiet or bar % 2 == 0:
        for beat, note, duration in motifs[bar % 8]:
            if 94 <= at < 112 and bar % 2: note += 12
            mix(music, pluck(note, duration + .35), at + beat * .5 + .02,
                (.14 if quiet else .21) * amount, .08)
    if bar % 4 == 3 and not quiet:
        for k, note in enumerate(chord[1:4]):
            mix(music, keys(note + 12, .55, .3), at + 1.5 + k * .125, .064, -.45 + k * .3)

# Resolve on the closing logo instead of chopping off a continuing loop.
for j, note in enumerate([48, 60, 64, 67, 71, 74]):
    mix(music, keys(note, 5.7, .4), 112 + j * .03, .18, -.4 + j * .14)
for at, note in [(112.1, 76), (112.7, 79), (113.3, 84), (114.2, 79), (115.0, 84)]:
    mix(music, pluck(note, 2.5), at, .18, .1)
mix(music, bass(36, 2.5), 112, .18)

# Small stereo ambience, not a long washy reverb that masks text-driven pacing.
dry = music.copy()
for delay, gain in [(.053, .09), (.089, .08), (.127, .07), (.181, .05), (.263, .03)]:
    offset = int(delay * SR)
    music[offset:] += dry[:-offset, ::-1] * gain
del dry
fade = np.ones(N, dtype=np.float32)
fade[:int(.18 * SR)] = np.linspace(0, 1, int(.18 * SR))
fade[int(116.3 * SR):] = np.linspace(1, 0, N - int(116.3 * SR)) ** 1.5
music *= fade[:, None]
music *= .115 / max(float(np.sqrt(np.mean(music ** 2))), 1e-9)


def effect(kind, at, gain=.1, pan=0):
    if kind == 'plate':
        t = np.arange(int(.45 * SR)) / SR
        w = sum(a * np.sin(2 * np.pi * f * t) * np.exp(-t * d) for f, a, d in [(530, .6, 45), (1670, .3, 27), (2780, .13, 19)])
        w = taper(w, .001, .08)
    elif kind == 'whoosh':
        length = .38
        t = np.arange(int(length * SR)) / SR
        w = air(length, 14) * np.sin(np.pi * t / length) ** 2
        w = taper(w * 1.3, .04, .06)
    elif kind == 'paper':
        length = .35
        t = np.arange(int(length * SR)) / SR
        n = air(length, 3)
        w = taper(n * np.sin(np.pi * t / length) ** 2 * (.35 + .65 * np.sin(t * 65) ** 2), .025, .045)
    elif kind == 'tick':
        t = np.arange(int(.11 * SR)) / SR
        w = taper(np.sin(2 * np.pi * (1100 * t - 1700 * t ** 2)) * np.exp(-t * 65), .001, .025)
    else:
        raise ValueError(kind)
    mix(fx, w, at, gain, pan)
    events.append({'at': at, 'sound': kind, 'gain': gain, 'editorial_not_recorded_app_audio': True})


def sparkle(at, notes, gain=.065, step=.095):
    for j, note in enumerate(notes):
        mix(fx, keys(note, 1.05, .55), at + j * step, gain, -.3 + j * .13)
    events.append({'at': at, 'sound': 'tonal-accent', 'notes': notes, 'editorial_not_recorded_app_audio': True})

effect('plate', 1.96, .12)
effect('whoosh', 2.90, .12, -.1)
sparkle(3.22, [76, 79, 84], .10, .12)
for at in [5.86, 27.91, 47.86, 57.87, 65.87, 74.83, 93.81, 103.88]:
    effect('whoosh', at, .09)
for at in [17.1, 45.0, 55.1, 85.25]:
    effect('tick', at, .06)
effect('paper', 66.8, .045, -.25)
effect('paper', 74.3, .04, .2)
sparkle(41.1, [72, 76, 79], .062, .12)
sparkle(99.18, [76, 79], .065, .15)
sparkle(105.0, [72, 76, 79, 84], .062, .25)
sparkle(108.9, [76, 79, 84, 88], .066, .13)
effect('whoosh', 111.84, .10)
sparkle(112.22, [72, 76, 79, 84], .074, .14)
fx *= fade[:, None]


def wav(name, array):
    peak = float(np.max(np.abs(array)))
    if peak >= .98:
        raise RuntimeError(f'Unexpected pre-master clipping: {name}: {peak}')
    with wave.open(str(OUT / name), 'wb') as handle:
        handle.setnchannels(2)
        handle.setsampwidth(2)
        handle.setframerate(SR)
        handle.writeframes(np.round(array * 32767).astype('<i2').tobytes())


wav('bgm-original.wav', music)
wav('editorial-sfx.wav', fx)
wav('premaster.wav', music + fx)
print('Rendered music and SFX stems. Measuring and mastering loudness.', flush=True)


def ff(arguments):
    return subprocess.run([str(FF), '-hide_banner', '-y', *map(str, arguments)], capture_output=True, check=True)


measurement = ff(['-i', OUT / 'premaster.wav', '-af', 'loudnorm=I=-16:TP=-1.5:LRA=7:print_format=json', '-f', 'null', 'NUL'])
stats = json.loads(re.findall(r'\{[\s\S]*?\}', measurement.stderr.decode('utf-8', errors='replace'))[-1])
filter_text = ('loudnorm=I=-16:TP=-1.5:LRA=7:linear=true:'
               f'measured_I={stats["input_i"]}:measured_TP={stats["input_tp"]}:'
               f'measured_LRA={stats["input_lra"]}:measured_thresh={stats["input_thresh"]}:'
               f'offset={stats["target_offset"]}')
ff(['-i', OUT / 'premaster.wav', '-af', filter_text, '-ar', SR, '-c:a', 'pcm_s24le', OUT / 'soundtrack-master.wav'])
master = OUT / 'Sikurepi_118s_v8_BGM_SFX.mp4'
ff(['-i', args.source, '-i', OUT / 'soundtrack-master.wav', '-map', '0:v:0', '-map', '1:a:0',
    '-c:v', 'copy', '-c:a', 'aac', '-b:a', '256k', '-ar', SR, '-t', DURATION,
    '-movflags', '+faststart', master])
ff(['-i', OUT / 'soundtrack-master.wav', '-c:a', 'libmp3lame', '-b:a', '192k', OUT / 'soundtrack-listen.mp3'])
ff(['-i', master, '-t', 28, '-vf', 'scale=1280:720', '-c:v', 'libx264', '-preset', 'fast', '-crf', '21',
    '-c:a', 'aac', '-b:a', '192k', '-movflags', '+faststart', OUT / 'preview-opening-28s.mp4'])

# A bitstream hash verifies that all video frames remain unchanged.
original_video_hash = ff(['-v', 'error', '-i', args.source, '-map', '0:v:0', '-c:v', 'copy', '-f', 'hash', '-hash', 'sha256', '-']).stdout.decode().strip()
new_video_hash = ff(['-v', 'error', '-i', master, '-map', '0:v:0', '-c:v', 'copy', '-f', 'hash', '-hash', 'sha256', '-']).stdout.decode().strip()
assert original_video_hash == new_video_hash, 'Video bitstream changed.'
analysis = ff(['-i', master, '-af', 'loudnorm=I=-16:TP=-1.5:LRA=7:print_format=json', '-f', 'null', 'NUL'])
info = analysis.stderr.decode('utf-8', errors='replace')
final_levels = json.loads(re.findall(r'\{[\s\S]*?\}', info)[-1])
assert '00:01:58.00' in info and '1920x1080' in info and '48000 Hz, stereo' in info
assert float(final_levels['input_tp']) <= -1.0
validation = {
    'duration_seconds': 118, 'resolution': '1920x1080', 'fps': 30,
    'audio': 'AAC stereo / 48 kHz / 256 kbps', 'video_bitstream_unchanged': True,
    'video_stream_hash': new_video_hash, 'final_levels': final_levels,
    'music': 'Original procedural instrumental; 120 BPM, C major; no external samples or existing songs',
    'sfx': 'Original procedural editorial sound design, not recorded app sounds',
    'narration': False, 'source_sha256': hashlib.sha256(args.source.read_bytes()).hexdigest(),
    'editorial_cues': events,
}
(OUT / 'validation.json').write_text(json.dumps(validation, indent=2), encoding='utf-8')
(OUT / 'README.md').write_text('''# Sikurepi — BGM / SFX preview v8

- Full video: `Sikurepi_118s_v8_BGM_SFX.mp4` (1:58, 1920 x 1080).
- Quick preview: `preview-opening-28s.mp4`.
- Audio only: `soundtrack-listen.mp3`.
- Music/SFX stems: `bgm-original.wav`, `editorial-sfx.wav`.
- Narration: none. Existing captions, animation and editing are unchanged.
- The original v7 video was not overwritten; video bitstream identity is verified.

An original, procedurally synthesized pop instrumental was composed for this preview.
120 BPM, C major, electric-piano-style chords, plucked melody, bass and light pop drums.
The cooking-help and preferences sections are thinner; the rank section lifts, and
the last logo resolves musically. SFX are selectively aligned editorial accents,
not a claim that the app itself makes these sounds. No third-party songs or sample
packs are used. This does not guarantee that automated music matching will never
produce a false match.

Sound level target: -16 LUFS integrated, true peak below -1 dBTP after AAC encoding.
See `validation.json` for measured levels and video integrity verification.
''', encoding='utf-8')
if args.export:
    args.export.mkdir(parents=True, exist_ok=True)
    for name in ['Sikurepi_118s_v8_BGM_SFX.mp4', 'preview-opening-28s.mp4', 'soundtrack-listen.mp3',
                 'bgm-original.wav', 'editorial-sfx.wav', 'README.md', 'validation.json']:
        shutil.copy2(OUT / name, args.export / name)
print(json.dumps({'master': str(master), 'levels': final_levels, 'video_unchanged': True}, indent=2), flush=True)
