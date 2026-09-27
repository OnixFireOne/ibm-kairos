# Demo video assembly

Built without ffmpeg (Intel Mac): AVFoundation via a Swift script. Inputs in `../shots/video/`: stills (cover, slides rendered with headless Chrome, PR screenshots, timeline), two QuickTime screen clips of the live Bob run (`04-check.mov`, `05-fix.mov`) and five voice files (`1.wav`…`5.wav`, Google AI Studio TTS, text in `docs/video-narration.md`).

```bash
swiftc -O scripts/video/build.swift -o /tmp/build
TOP='[0,0,0.72,0.669]'; BOT='[0,0.331,0.72,0.669]'
python3 scripts/video/plan.py "[[3,15,12,$TOP],[15,53,4,$TOP],[53,73,20,$TOP]]" "[[3,11,8,$TOP],[11,87,4,$TOP],[87,111,22,$BOT]]"
/tmp/build /tmp/k/v/plan.json ../shots/video/kairos-demo.mp4
```
Clip segments are `[from, to, outputDuration, crop]`: Bob's waiting time is sped up, the output is played at normal speed. `plan.py` writes `/tmp/k/v/plan.json`.
