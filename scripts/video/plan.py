import json,sys
S='/Users/andy/Documents/Ai/apps/hakaton/Ibm25-09/shots/video/'
C4=json.loads(sys.argv[1]); C5=json.loads(sys.argv[2])  # per-clip params
img=lambda f,d:{"kind":"image","path":S+f,"dur":d}
vid=lambda f,a,b,d,crop:{"kind":"video","path":S+f,"from":a,"to":b,"dur":d,"crop":crop}
sections=[
 [img('01-cover.png',5),img('02-problem.png',12),img('03-kairos.png',9.5)],
 [vid('04-check.mov',*seg) for seg in C4],
 [vid('05-fix.mov',*seg) for seg in C5],
 [img('06-pr-comment.png',9),img('07-pr-blocked.png',6),img('08-timeline.png',7)],
 [img('09-how-bob.png',9),img('10-bob-task.png',5),img('11-living-docs.png',6),img('12-cover-end.png',6)],
]
segs=[];audio=[];t=0
for i,sec in enumerate(sections):
  audio.append({"path":S+f"{i+1}.wav","at":t+0.6})
  for s in sec: segs.append(s); t+=s["dur"]
json.dump({"segs":segs,"audio":audio},open('/tmp/k/v/plan.json','w'),indent=1)
print("total",round(t,1),"demo part (2-4)",round(sum(s['dur'] for sec in sections[1:4] for s in sec),1))
