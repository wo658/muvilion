"""Encode timestamped browser captures without inventing intermediate app states."""
import json
import subprocess
from pathlib import Path
root = Path(__file__).resolve().parent.parent
for directory in sorted((root/'designer-film/generated').iterdir()):
    manifest=directory/'frames.json'
    if not manifest.exists(): continue
    frames=json.loads(manifest.read_text())
    if len(frames)<2: continue
    output=root/'public/designer-film'/f'{directory.name}.mp4'
    if output.exists() and output.stat().st_mtime>manifest.stat().st_mtime: continue
    rows=['ffconcat version 1.0']
    for i,item in enumerate(frames):
        duration=frames[i+1]['time']-item['time'] if i+1<len(frames) else 1/30
        rows += [f"file '{item['name']}'",f'duration {max(.001,duration)}']
    rows.append(f"file '{frames[-1]['name']}'")
    concat=directory/'capture.ffconcat';concat.write_text('\n'.join(rows)+'\n')
    subprocess.run(['ffmpeg','-y','-safe','0','-i',str(concat),'-vf','fps=30','-c:v','libx264','-crf','19','-pix_fmt','yuv420p','-movflags','+faststart',str(output),'-loglevel','error'],check=True)
    print(output.name, round(frames[-1]['time']-frames[0]['time'],2))
