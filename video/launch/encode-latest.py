"""Encode capture clips at 30 fps. Frame-stepped captures map one screenshot to one frame;
older wall-clock captures keep their timestamps and are normalized to 30 fps."""
from pathlib import Path
import json,subprocess,shutil,base64
root=Path(__file__).resolve().parents[1]
raw=root/'out/latest-captures';assets=root/'public/launch-current';assets.mkdir(exist_ok=True)
for folder in sorted(raw.iterdir()):
 manifest=folder/'frames.json'
 if not manifest.is_file():continue
 dest=assets/(folder.name+'.mp4')
 if dest.exists() and dest.stat().st_size>10000 and dest.stat().st_mtime>manifest.stat().st_mtime:continue
 capture=json.loads(manifest.read_text());frames=capture['frames'];rows=['ffconcat version 1.0']
 if capture.get('stepped'):
  subprocess.run(['ffmpeg','-y','-v','error','-framerate',str(capture['fps']),'-i',str(folder/'f%06d.jpg'),'-frames:v',str(len(frames)),'-vf','pad=ceil(iw/2)*2:ceil(ih/2)*2','-r',str(capture['fps']),'-c:v','libx264','-preset','medium','-crf','14','-pix_fmt','yuv420p','-movflags','+faststart',str(dest)],check=True)
  print(dest.name,round(capture['duration'],2),flush=True);continue
 for i,frame in enumerate(frames):
  duration=frames[i+1]['time']-frame['time'] if i+1<len(frames) else max(1/30,capture['duration']-(frame['time']-frames[0]['time']))
  rows += [f"file '{frame['name']}'",f'duration {max(1/120,duration)}']
 rows.append(f"file '{frames[-1]['name']}'");listing=folder/'frames.ffconcat';listing.write_text('\n'.join(rows)+'\n')
 subprocess.run(['ffmpeg','-y','-v','error','-safe','0','-i',str(listing),'-vf','fps=30,pad=ceil(iw/2)*2:ceil(ih/2)*2','-t',str(capture['duration']),'-c:v','libx264','-preset','medium','-crf','14','-pix_fmt','yuv420p','-movflags','+faststart',str(dest)],check=True)
 print(dest.name,round(capture['duration'],2),flush=True)
for img in raw.glob('*.png'):shutil.copy2(img,assets/img.name)
for sample in ['popup','kintex']:
 bundle=json.loads((root.parent/f'data/samples/{sample}/recorded.json').read_text())
 for i,photo in enumerate(bundle['state']['planningArtifacts'][0]['photos']):
  image=photo['image'];suffix='jpg' if 'jpeg' in image[:30] else 'png';(assets/f'{sample}-photo-{i}.{suffix}').write_bytes(base64.b64decode(image.split(',')[1]))
