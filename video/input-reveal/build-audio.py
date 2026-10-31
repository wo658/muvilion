"""Original 10-second electronic cue; no sampled or third-party audio."""
import math
import struct
import wave
from pathlib import Path

rate = 48000
notes = [146.832, 220.0, 293.665, 369.994]
path = Path(__file__).resolve().parent.parent / 'public/input-reveal/cue.wav'
with wave.open(str(path), 'wb') as output:
    output.setnchannels(2)
    output.setsampwidth(2)
    output.setframerate(rate)
    data = bytearray()
    for i in range(rate * 10):
        t = i / rate
        fade = min(1, t / .6, max(0, (10-t)/.8))
        pad = sum(math.sin(2*math.pi*n*t) + .16*math.sin(2*math.pi*n*2*t) for n in notes) * .024
        pulse = 0.0
        for onset in [0, .7, 1.1, 1.5, 3.1, 3.6, 4.8, 6, 7.2, 8.9]:
            age = t-onset
            if 0 <= age < .35:
                pulse += .08*math.exp(-age*18)*math.sin(2*math.pi*(65*age+1.8*(1-math.exp(-age*20))))
        tick = 0.0
        for onset in [.7, 1.1, 1.5, 3.6, 4.8, 8.9]:
            age=t-onset
            if 0 <= age < .18:
                tick += .025*math.sin(2*math.pi*880*age)*math.exp(-age*32)
        value=(pad+pulse+tick)*fade
        left=int(max(-1,min(1,value))*32767)
        right=int(max(-1,min(1,value+.004*math.sin(2*math.pi*440.4*t)*fade))*32767)
        data.extend(struct.pack('<hh',left,right))
    output.writeframes(data)
