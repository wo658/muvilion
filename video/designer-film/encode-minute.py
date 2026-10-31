"""Encode actual browser captures and preserve the observed interaction coordinates."""
import json
import subprocess
from pathlib import Path
root=Path(__file__).resolve().parent.parent
assets=root/'public/designer-minute';assets.mkdir(exist_ok=True)
traces={}
for directory in sorted((root/'designer-film/generated/minute').iterdir()):
    manifest=directory/'frames.json'
    if not manifest.exists():continue
    capture=json.loads(manifest.read_text());frames=capture['frames'];traces[directory.name]=capture['trace']
    if not frames:continue
    output=assets/f'{directory.name}.mp4'
    if output.exists() and output.stat().st_mtime>manifest.stat().st_mtime:continue
    rows=['ffconcat version 1.0']
    for i,frame in enumerate(frames):
        duration=frames[i+1]['time']-frame['time'] if i+1<len(frames) else max(1/30,capture['duration']-(frame['time']-frames[0]['time']))
        rows += [f"file '{frame['name']}'",f'duration {max(1/60,duration)}']
    rows.append(f"file '{frames[-1]['name']}'")
    concat=directory/'capture.ffconcat';concat.write_text('\n'.join(rows)+'\n')
    subprocess.run(['ffmpeg','-y','-safe','0','-i',str(concat),'-vf','fps=30','-t',str(capture['duration']),'-c:v','libx264','-crf','18','-pix_fmt','yuv420p','-movflags','+faststart',str(output),'-loglevel','error'],check=True)
    print(output.name)
(assets/'traces.json').write_text(json.dumps(traces,indent=2)+'\n')

(root/'src/DesignerMinuteTraces.ts').write_text('type Point = {time:number;x:number;y:number;click?:boolean;drag?:boolean};\nconst traces: Record<string,Point[]> = '+json.dumps(traces)+';\nexport default traces;\n')
