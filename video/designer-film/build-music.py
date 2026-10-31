"""Original 180-second electronic underscore. No external recordings or samples."""
from pathlib import Path
import wave
import numpy as np

root=Path(__file__).resolve().parent.parent
rate=48000
rng=np.random.default_rng(42)
chords=[[146.832,220,293.665,369.994],[130.813,195.998,261.626,329.628],[164.814,246.942,329.628,391.995],[123.471,185,246.942,311.127]]
path=root/'designer-film/generated/music.wav'
with wave.open(str(path),'wb') as out:
    out.setnchannels(2);out.setsampwidth(2);out.setframerate(rate)
    for second in range(180):
        t=second+np.arange(rate)/rate
        chord=chords[(second//10)%4]
        next_chord=chords[((second//10)+1)%4]
        mix=np.clip((t%10-9)/1,0,1)
        pad=sum(np.sin(2*np.pi*n*t)+.12*np.sin(2*np.pi*n*2*t) for n in chord)*.023
        next_pad=sum(np.sin(2*np.pi*n*t)+.12*np.sin(2*np.pi*n*2*t) for n in next_chord)*.023
        pad=pad*(1-mix)+next_pad*mix
        beat=t%.625
        kick=.065*np.exp(-beat*24)*np.sin(2*np.pi*(55*beat+1.3*(1-np.exp(-beat*28))))
        notes=[440,554.365,659.255,493.883]
        note=notes[int(second/1.25)%4]
        age=t%1.25
        pluck=.018*np.exp(-age*5)*np.sin(2*np.pi*note*t)
        tick=.004*rng.normal(size=rate)*np.exp(-(t%.3125)*70)
        cue=np.zeros(rate)
        for onset in [6,15,45,50,82,108,135,160,176]:
            age=t-onset
            cue+=np.where((age>=0)&(age<.7),.018*np.sin(2*np.pi*(600*age+90*age*age))*np.exp(-np.maximum(age,0)*10),0)
        fade=np.minimum(np.minimum(t/2,(180-t)/4),1)
        value=(pad+kick+pluck+tick+cue)*fade
        stereo=np.stack([value,value+.006*np.sin(2*np.pi*440.2*t)*fade],axis=1)
        out.writeframes((np.clip(stereo,-.95,.95)*32767).astype('<i2').tobytes())
