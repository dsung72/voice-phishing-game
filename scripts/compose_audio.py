"""Original synthesized game scores. Requires numpy, scipy and ffmpeg.

No sampled commercial music or third-party audio is used. Run from repo root.
"""
from pathlib import Path
import subprocess
import numpy as np
from scipy.signal import butter, sosfilt, fftconvolve
from scipy.io.wavfile import write

SR = 32000
RNG = np.random.default_rng(720907)
OUT = Path(__file__).resolve().parents[1] / 'assets' / 'audio'
OUT.mkdir(parents=True, exist_ok=True)

def hz(midi): return 440 * 2 ** ((midi - 69) / 12)

def env(t, duration, attack=.025, release=.18):
    return np.minimum(t / attack, 1) * np.clip((duration - t) / release, 0, 1)

def instrument(kind, midi, duration):
    t = np.arange(int(duration * SR)) / SR
    f = hz(midi)
    if kind == 'brass':
        # Rounded horn section: warm fundamental, swelling upper harmonics.
        phase = 2*np.pi*f*t + .012*np.sin(2*np.pi*4.8*t)
        bright = .25 + .75*np.minimum(t/.11, 1)
        x = sum(np.sin(k*phase) * (1/k**1.45) * (bright if k > 1 else 1) for k in range(1, 10))
        x *= env(t, duration, .065, .23) * (.88 + .12*np.sin(np.pi*t/duration))
    elif kind in ('strings', 'pad'):
        x = np.zeros_like(t)
        for cents, p in [(-7, .6), (0, 1.8), (6, 3.1)]:
            phase = 2*np.pi*f*2**(cents/1200)*t + .025*np.sin(2*np.pi*5.1*t+p)
            harmonics = 7 if kind == 'strings' else 3
            x += sum(np.sin(k*phase+p) / k**(1.65 if kind == 'strings' else 2.3) for k in range(1, harmonics))/3
        x *= env(t, duration, .18 if kind == 'strings' else .65, .45 if kind == 'strings' else .9)
    elif kind == 'piano':
        x = sum(np.sin(2*np.pi*f*(k+.00015*k*k)*t) * np.exp(-t*(1.05+.5*k)) / k**1.9 for k in range(1, 7))
        x *= env(t, duration, .008, .25)
    elif kind == 'bell':
        x = (np.sin(2*np.pi*f*t)*np.exp(-2.2*t) + .22*np.sin(2*np.pi*f*2.005*t)*np.exp(-4*t)) * env(t,duration,.004,.25)
    elif kind == 'pluck':
        x = sum(np.sin(2*np.pi*f*k*t)/k**1.8 for k in range(1,6))*np.exp(-t*9)*env(t,duration,.006,.1)
    else:
        x = (np.sin(2*np.pi*f*t)+.22*np.sin(4*np.pi*f*t))*env(t,duration,.035,.2)
    return x.astype(np.float32)

class Score:
    def __init__(self, seconds):
        self.n = int(seconds*SR)
        self.mix = np.zeros((self.n, 2), np.float32)
    def add(self, x, start, gain, pan=0):
        i = int(start*SR) % self.n
        x = x[:self.n] * gain
        stereo = x[:,None] * np.array([np.cos((pan+1)*np.pi/4),np.sin((pan+1)*np.pi/4)])
        count = min(len(x), self.n-i)
        self.mix[i:i+count] += stereo[:count]
        if count < len(x): self.mix[:len(x)-count] += stereo[count:]
    def note(self, kind, midi, start, duration, gain, pan=0):
        self.add(instrument(kind,midi,duration),start,gain,pan)
    def drum(self, start, gain, high=False):
        duration = .8 if not high else .25
        t=np.arange(int(SR*duration))/SR
        if high:
            noise=sosfilt(butter(2,1800,fs=SR,btype='highpass',output='sos'), RNG.normal(size=len(t)))
            x=noise*np.exp(-22*t)*.35 + np.sin(2*np.pi*170*t)*np.exp(-26*t)
        else:
            phase=2*np.pi*(48*t+58*.035*(1-np.exp(-t/.035)))
            x=np.sin(phase)*np.exp(-6*t)+.09*RNG.normal(size=len(t))*np.exp(-45*t)
        self.add(x*env(t,duration,.004,.08),start,gain)
    def cymbal(self,start,gain):
        t=np.arange(SR*2)/SR
        noise=sosfilt(butter(2,4800,fs=SR,btype='highpass',output='sos'),RNG.normal(size=len(t)))
        self.add(noise*np.exp(-2.5*t)*env(t,2,.04,.4),start,gain,.3)
    def save(self,name,target):
        # Circular reverb wraps the tail into the beginning for a seamless loop.
        for ch in range(2):
            t=np.arange(int(1.65*SR))/SR
            ir=RNG.normal(size=len(t))*np.exp(-t*5)
            ir[:int(.025*SR)]=0
            ir=sosfilt(butter(2,3900,fs=SR,output='sos'),ir)
            ir*=.22/np.sqrt(np.sum(ir*ir))
            wet=fftconvolve(self.mix[:,ch],ir)
            wet[:len(wet)-self.n]+=wet[self.n:]
            self.mix[:,ch]+=wet[:self.n]
        self.mix=sosfilt(butter(2,35,fs=SR,btype='highpass',output='sos'),self.mix,axis=0)
        rms=np.sqrt(np.mean(self.mix**2))
        self.mix*=min(10**(target/20)/rms,.78/np.max(np.abs(self.mix)))
        # Remove any sub-millisecond discontinuity at the loop boundary.
        seam=int(.008*SR)
        anchor=(self.mix[0]+self.mix[-1])/2
        self.mix[:seam]=anchor+(self.mix[:seam]-anchor)*np.linspace(0,1,seam)[:,None]
        self.mix[-seam:]=anchor+(self.mix[-seam:]-anchor)*np.linspace(1,0,seam)[:,None]
        wav=OUT/(name+'.wav')
        write(wav,SR,(np.clip(self.mix,-1,1)*32767).astype(np.int16))
        subprocess.run(['ffmpeg','-hide_banner','-loglevel','error','-y','-i',str(wav),'-codec:a','libmp3lame','-b:a','128k','-metadata','artist=Voice Phishing Game','-metadata','title='+name,str(OUT/(name+'.mp3'))],check=True)
        wav.unlink()
        print(name,round(self.n/SR,2),'seconds; peak',round(float(np.max(np.abs(self.mix))),3),'rms dB',round(float(20*np.log10(np.sqrt(np.mean(self.mix**2)))),1),flush=True)

def hero():
    beat=60/104
    s=Score(24*4*beat)
    chords=[(38,[50,57,62,66]),(35,[47,54,59,62]),(31,[43,55,59,62]),(33,[45,57,61,64])]
    melody=[[(69,0,1),(74,1,1.5),(73,2.5,.5),(69,3,1)],[(66,0,1.5),(69,1.5,.5),(71,2,2)],[(67,0,1),(71,1,1),(74,2,1.5),(71,3.5,.5)],[(69,0,2),(76,2,1),(73,3,1)],[(74,0,1.5),(78,1.5,.5),(76,2,1),(74,3,1)],[(71,0,1),(74,1,1),(78,2,2)],[(79,0,1),(78,1,1),(74,2,1),(71,3,1)],[(73,0,1.5),(76,1.5,.5),(69,2,2)]]
    for bar in range(24):
        start=bar*4*beat
        root,notes=chords[bar%4]
        intensity=.76 if bar<8 else .88 if bar<16 else 1
        for j,note in enumerate(notes):
            s.note('strings',note,start,4*beat+.4,.085*intensity,(j-1.5)/2)
        s.note('bass',root,start,3.95*beat,.24)
        for eighth in range(8):
            n=notes[[0,1,2,1,0,1,3,2][eighth]]+12
            s.note('pluck',n,start+eighth*.5*beat,.4,.052*intensity,-.5 if eighth%2 else .5)
        for n,offset,length in melody[bar%8]:
            s.note('brass',n-12,start+offset*beat,length*beat+.16,.14*intensity,-.12)
            if bar>=8: s.note('strings',n,start+offset*beat,length*beat+.2,.044,.25)
        s.drum(start,.28*intensity)
        s.drum(start+2*beat,.18*intensity)
        if bar>=8:
            s.drum(start+beat,.052,True);s.drum(start+3*beat,.06,True)
        if bar%4==0:
            s.cymbal(start,.075)
            s.note('bell',notes[2]+24,start,2,.058,.35)
        if bar%4==3:
            for off in (3,3.5): s.drum(start+off*beat,.08,True)
    s.save('hero-theme',-17.5)

def calm():
    beat=60/76
    s=Score(16*4*beat)
    chords=[(38,[50,57,64,66]),(35,[47,54,61,62]),(31,[43,55,62,69]),(33,[45,57,62,64])]
    for bar in range(16):
        start=bar*4*beat
        root,notes=chords[bar%4]
        for j,n in enumerate(notes): s.note('pad',n,start,4*beat+1,.065,(j-1.5)/2)
        s.note('bass',root,start,4*beat+.3,.085)
        for pos,ix in [(0,0),(1,1),(2.5,2),(3.5,3)]:
            s.note('piano',notes[ix]+12,start+pos*beat,3.1,.105 if pos==0 else .075,(ix-1.5)*.22)
        if bar%2==0: s.note('bell',notes[2]+24,start+2*beat,2.6,.017,.6)
    s.save('calm-focus',-23)

if __name__=='__main__':
    hero()
    calm()
