"""Create the English edition of the recorded demos; preserve geometry and photos."""
import json,re,base64
from pathlib import Path
root=Path(__file__).resolve().parents[2]
folder=root/'data/samples'
manifest=json.loads((folder/'samples.json').read_text())
phrases={
'천장고 도면표기 가정':'Ceiling height assumed from drawing','하중미검토 조명시각소품':'Lighting is illustrative; hanging loads not reviewed','출입대기접근 개념가정':'Entrance, queue and access are concept assumptions',
'천장 높이 미확인: 매달림 없음, 최고 3.2m 가벽':'Ceiling height unconfirmed: no suspended items; partitions up to 3.2m','천장 높이 미확인: 매달림 없음, 3.2m 이하':'Ceiling height unconfirmed: no suspended items; height up to 3.2m','40x30m 행사 범위가 전체 플로어':'The event floor is the 40 x 30m area','공식 브랜드 가이드 아님':'Not an official brand guide','안전 시뮬레이션 없음':'No safety simulation','출입구·기둥·안전 검증 없음, 개념 배치':'Concept layout; entrances, columns and safety are unverified',
'중앙 연결 통로':'Central connector','중앙 순환축 동':'East circulation spine','중앙 순환축 서':'West circulation spine','북측 진입·순환':'North entry and circulation','무대 관람 연결로':'Audience connector','등록·안내':'Registration and information','공동 안내 데스크':'Welcome desk','행사 안내 보드':'Event information board','안내 배경벽':'Welcome backdrop','편집존 북측 가벽':'Editing zone north partition','편집 레퍼런스 진열장':'Editing reference display','주제 카드 진열장':'Topic card display','주제 안내 보드':'Topic information board','살롱 동측 가벽':'Salon east partition','토크 무대·관람':'Talk stage and audience','토크 관람석':'Audience seating','토크 무대':'Talk stage','무대 트러스 좌':'Stage truss left','무대 트러스 우':'Stage truss right','장비 보관실':'Equipment storage','보관실 북측 가벽':'Storage north partition','보관실 서측 가벽':'Storage west partition','촬영 대기 안내':'Photo queue sign','보관실 안내 표지':'Storage sign','보관실 앞 화분':'Storage entrance planter','확장 대화 안내 보드':'Extended salon information','확장 대화 진열장':'Extended salon display','무대 측면 전시대':'Stage side plinth','대기열 전시 진열장':'Queue display','라운지 휴식 안내':'Lounge information','토크 안내 보드':'Talk information board',
'피팅 바 존':'Fitting bar zone','Messenger 시연':'Messenger demo','공유·상담 존':'Sharing and consultation','서비스·운영':'Service and operations','리스닝 라운지':'Listening lounge','입장 대기열':'Entry queue','촬영 산책로':'Photo walk','남측 연결로':'South connector','북측 연결로':'North connector','중앙 연결로':'Central connector','입장 연결로':'Entry connector','입구·체크인':'Entry and check-in','아넥스 연결로':'Annex connector','서측 연결로':'West connector','주 순환로':'Main circulation','체험 안내 보드':'Experience information','상담·픽업 카운터':'Consultation and pickup counter','공유 사진 벽':'Shared photo wall','피팅 백드롭 레터링':'Fitting backdrop lettering','포토스팟 그래픽':'Photo spot graphic','공유벽 마감':'Photo wall finish','북 쇼윈도 스트라이프':'North window stripes',
'Instagram 촬영 스튜디오':'Instagram photo studio','Edits 편집 상담':'Edits feedback','Threads 대화 살롱':'Threads conversation salon','Threads 대화 확장':'Threads extended salon','Instagram 디스플레이 포드':'Instagram display pods','휴게 소파 세트':'Lounge sofa set','휴게 라운지':'Rest lounge','대화 테이블':'Conversation table','촬영 세트':'Photo set','편집 상담':'Editing consultation','인스타 포드':'Instagram pod','피팅 바':'Fitting bar','리스닝 소파':'Listening sofa','상담 데스크':'Consultation desk','포토 스팟':'Photo spot','글래스 진열장':'Glasses display','오디오 진열장':'Audio display','행잉 사인':'Hanging sign','안내 보드':'Information board','탁상 조명':'Table lamp','소품 받침':'Prop plinth','전시 진열장':'Exhibit display','체크인':'Check-in','카운터':'Counter','펜던트':'Pendant','전시대':'Display plinth','낮은 벽':'Low wall','골목':'Alley','라운지':'Lounge','리스닝':'Listening','메신저':'Messenger','공유존':'Sharing zone','공유벽':'Photo wall','피팅':'Fitting','입구':'Entrance','식물':'Plant','스태프 테이블':'Staff table','운영 선반':'Operations shelf','스폿':'Spotlight','산책로':'Walk','운영':'Operations','북측':'North','남측':'South','서측':'West','동측':'East','웰컴':'Welcome','장비 선반':'Equipment shelf','촬영':'Photo','편집':'Editing','주제':'Topic','대화':'Conversation','살롱':'Salon','화분':'Planter','진열장':'Display','차단벽':'Screen','받침':'Plinth','안내':'Sign','진열':'Display','남동':'Southeast','북서':'Northwest','남서':'Southwest','벽':'Wall',' 서':' West',' 동':' East',' 남':' South',' 북':' North',' 좌':' Left',' 우':' Right'
}
def labels(v):
 if isinstance(v,dict):return {k:labels(a) for k,a in v.items()}
 if isinstance(v,list):return [labels(a) for a in v]
 if isinstance(v,str) and re.search('[가-힣]',v):
  for a,b in sorted(phrases.items(),key=lambda x:-len(x[0])):v=v.replace(a,b)
 return v
notice='An independently authored fictional demo, not an official Meta event, commission or partnership. Dimensions and quantities are design assumptions, not measured capacity or safety validation.'
bookmark='Official URL bookmark. No article text, logos or product photos are bundled. Spatial ideas are authored demo interpretations, not official brand guidelines.'
copy={
'popup':{
'name':'Seongsu Pop-up · Ray-Ban Meta × Messenger',
'drawing':'Seongsu Pop-up Studio · Ground Floor',
'sources':[
['Try. Capture. Share. · Pop-up brief',notice+'\n\nObjective: Give first-time visitors in their twenties and thirties a 20-minute journey through trying on glasses, hands-free photography, open-ear listening and sharing with friends. Use the entire approximately 590 m² ground floor in Seongsu.\n\nProgram: One check-in counter; two four-seat fitting bars with mirrors; a photo walk with three photo spots; an eight-seat listening lounge; two semi-enclosed Messenger demo booths; one shared photo wall; one consultation and pickup counter.\n\nJourney: Angled entrance → check-in → fitting bars → photo walk between columns → listening lounge → Messenger booths and photo wall in the annex → consultation and pickup. Keep the main route at least 1.5m clear. Use the south service door and storage for staff and stock.\n\nDrawing: The north main hall is approximately 32 × 15m with a 4.2m assumed ceiling; the southeast annex is approximately 18 × 7m with a 3.6m assumed ceiling. Preserve the three 0.6m square columns. Keep the north shopfront and east windows visible. Ceiling heights are drawing assumptions; suspended loads are unreviewed. Do not furnish the toilets or storage.\n\nDirection: Warm off-white surfaces, black lines inspired by acetate frames, and bright street-like lighting. Low walls, plants and signs create small Seongsu-inspired photo scenes.\n\nRequest: Design the entire floor with actual furniture and partitions, connecting the experiences with a one-way visitor journey.','Authored fictional venue and brief. Muse performed the drawing reading and design; no operations or safety simulation is included.'],
['Ray-Ban Meta · Brand reference','AI glasses with a camera, open-ear speakers and microphones. The demo interprets hands-free capture, listening and communication as fitting bars, a photo walk and a listening lounge.',bookmark],
['Messenger · Brand reference','Messaging and voice/video conversations with friends and groups. The demo interprets these as hands-free message and call booths, followed by a shared visitor photo wall.',bookmark],
['AI glasses fitting bar · Authored concept','A long off-white fitting counter with a black worktop and base, approximately 4m × 1.2m and 1.05m high. A walnut-toned tray holds demonstration glasses; three black-framed mirror panels stand behind it. Three black stools with brown cushions and a brass foot rail illustrate fitting, mirror checks and staff guidance in one furniture unit. This does not reproduce the product design.','Concept image drawn with repository script web/scripts/build-sample-popup.mjs. No external product photos, brand photos or logos. Width and seat counts are planning assumptions.'],
['Ray-Ban Meta Korea launch · News reference','Bookmarked Meta news about the May 2026 Korean launch of Ray-Ban Meta and Oakley Meta. Used only as context for a first-time visitor experience in Korea.','Official article bookmark; article images, logos and original text are not bundled.']],
'sections':[
'A fictional concept using the entire ground floor of Seongsu Pop-up Studio. The north main hall is the experience zone, with an assumed 4.2m ceiling; the southeast annex is for sharing and consultation, with an assumed 3.6m ceiling. The approximately 588 m² floor uses polished concrete. This is a design exercise, not an official event.',
'First-time visitors in their twenties and thirties are invited to try, capture, listen and share within 20 minutes. Warm off-white surfaces, black lines and bright lighting suggest a lively street. Low walls, plants and props create photo moments along the walk. This is a demo interpretation, not an official brand guide.',
'Angled entrance → check-in → fitting bars → photo walk → listening lounge → Messenger demo → shared photo wall → consultation and pickup. The main route is intended to stay at least 1.5m clear. Staff and stock use the south service door and storage. This is a planned route; widths and queue conflicts require on-site review.',
'Staffing follows check-in, fitting, photography, listening, demos, sharing and consultation. Staff and stock use the south service door, storage and southern operations area. Toilets and storage retain their existing uses. Ceiling heights are drawing assumptions; suspended loads have not been reviewed.',
'The three 0.6m square columns are retained. Tall walls are not planned in front of the north shopfront or east windows. Capacity, visibility and accessibility have not been certified. Wall and doorway dimensions and queue conflicts require measurement.'],
'areas':[
['Two semi-enclosed booths support hands-free messaging and call demonstrations with staff guidance.','Enter from the lounge through the annex and south connectors. Queue spacing and overlapping speech need on-site review.'],
['A shared visitor photo wall and a consultation/pickup counter complete the experience.','Continue through the annex after the Messenger demo. Check that counter queues do not conflict with the south service route.'],
['Two sofa groups and tables provide a relaxed setting for open-ear audio. Bright pendant lighting suggests a comfortable listening atmosphere.','Enter from the photo walk via the main loop and east aisle. Measure the clearances around the sofas on site.'],
['Two fitting bars with mirror panels support try-on guidance. Their position near the north shopfront makes the experience visible from the street.','Enter after check-in via the north connector and main loop. Confirm that queues leave the intended 1.5m route clear.'],
['Low walls, plants, displays and three photo spots suggest Seongsu streets. Visitors try hands-free photo and video capture along the walk.','A one-way route leads from fitting through the columns and central connector. Queue conflicts have not been simulated; staffing may need adjustment during busy periods.'],
['The check-in counter and information board beside the entrance introduce the 20-minute journey and fitting sequence.','Enter directly from the angled doorway onto the entry connector and main loop. Check that the entry queue does not obstruct the doorway.']]
},
'kintex':{
'name':'KINTEX · Instagram × Threads Creator Day',
'drawing':'KINTEX Hall 1B · 40 × 30m Event Area',
'sources':[
['Creator Connection Day · Event brief',notice+'\n\nObjective: Connect Instagram visual creation and Threads public conversation in one visitor journey for content creators and local community organizers.\n\nProgram: One welcome desk; three vertical-video sets with backdrops, lights and phone stands; two editing feedback tables; four topic-based conversation tables; one talk stage with 24 audience chairs; one lounge; one equipment store.\n\nJourney: Registration → capture → editing feedback → conversations → rest. Separate photo queues from stage access. Avoid directing photo lights at conversation seating. Leave accessible routes and seats for waiting visitors.\n\nDrawing: Use only an approximately 40 × 30m area inside Hall 1B, not the full 171 × 63m hall. Leave the remaining area empty.\n\nDirection: A bright production studio for Instagram and a calm conversation salon for Threads. This is an authored interpretation, not an official brand guide.\n\nRequest: Confirm the event area and scale, then arrange actual furniture and partitions for review. Do not automatically fill the entire hall.','Authored demo brief. Muse reads the drawing; no layout, operations or safety simulation is included.'],
['Instagram · Brand reference','Visual creation and sharing through photos, video and Reels. The demo turns capture, editing feedback and creator exchange into spatial experiences.',bookmark],
['Threads · Brand reference','Sharing interests through text and public conversation. The demo uses topic cards, short talks and conversation tables.',bookmark],
['Creator display pod · Generated concept','A purple arched backdrop, low coral plinth and small shelf form a compact capture/display module. Color, soft edges and open sightlines inform the design. The actual layout reinterprets the reference using supported partitions, plinths and shelves; it does not claim to reproduce identical curves.\n\nAn assumed width of 1.5m is a starting point, not a photographic measurement. Height, depth and stability need separate review.','Fictional display concept generated from an original prompt on 2026-11-02. Not a product photograph, official brand design or 3D reconstruction. No external logos or photos were supplied. Form, material and color reference only; fabrication is unverified.'],
['Edits · Video workflow reference','The official introduction describes Edits as a video creation app. This demo interprets idea development, capture and editing feedback as a visitor journey. It does not implement or integrate the service.','Independent summary of the official article reviewed on 2026-11-02. The URL is a bookmark, not automatic web ingestion. No article photos, logos or original text are bundled.']],
'sections':[
'A review concept for an approximately 40 × 30m event area inside KINTEX Hall 1B. It does not fill the entire 171 × 63m hall. The remaining area stays empty. This fictional demo is not an official Meta event, commission or partnership. It is designed for content creators and local community organizers.',
'Connect Instagram visual creation and Threads public conversation in one visit. A bright production studio expresses creation; a calm salon supports reading and conversation. This is a demo interpretation, not an official brand guide.',
'Registration → capture → editing feedback → conversations → rest. Photo queues and stage access are separated in the plan, and photo lights are directed away from conversation seating. The central connector and circulation spines support the route. This is a plan, not a simulation; on-site verification is required.',
'The core program includes one welcome desk, three capture sets, two editing tables, four conversation tables, a talk stage with 24 audience chairs, a lounge and equipment storage. An extended salon adds two conversation tables, with display pods connecting salon and stage. Counts are design assumptions, not validated capacity.',
'Ceiling height is unconfirmed. No suspended elements are proposed; partitions are at most 3.2m high. Scale is estimated from dimension annotations. Entrances, columns and safety conditions remain unverified. Accessible routes and waiting seats require on-site checks.'],
'areas':[
['A bright studio with three vertical-video sets, each combining a backdrop, lighting and a phone stand. The production process becomes part of the experience.','Enter from the north circulation route and west spine. Queues near the signs require review under busy conditions.'],
['Two consultation tables and reference displays support editing feedback immediately after capture.','Continue east from the photo studio. Keep the route in front of the south information board clear.'],
['One stage and 24 audience chairs support short talks in the southern area.','Enter via the audience connector and central spine. Rear and side seating clearances remain unverified.'],
['Two sofa groups and information boards create a place to rest and exchange ideas on the east side.','Enter from the east spine. Sofa clearances may be tight and need on-site review.'],
['A welcome desk, backdrops and display plinths greet visitors at the north entrance.','Enter directly from the north route. Guide registration queues so they do not obstruct circulation.'],
['Four topic-based conversation tables form a calm salon for reading and discussion.','Enter from the west spine and salon entrance. Measure actual table-to-table clearances.'],
['Two additional conversation tables extend the salon toward the stage.','The area sits between circulation spines; check that table clearances preserve both routes.'],
['Two low display pods provide compact exhibitions while preserving sightlines.','Visitors continue along the east spine. Manage dwell time in front of the pods to keep the route clear.']]
}}
for sample in manifest['projects']:
 ident=sample['id'];c=copy[ident];p=folder/sample['recorded']['file'];b=json.loads(p.read_text());s=b['state']
 sample['name']=c['name'];b['name']=c['name'];sample['drawings'][0]['name']=c['drawing']
 sample['recorded']['note']='Recorded live Muse design and completed planning document, localized in English. Opens as an editable saved project; choose Design from scratch to run Muse live.'
 for sources in [sample['sources'],s['sources']['items']]:
  for item,fields in zip(sources,c['sources']):item.update(dict(zip(['name','text','notes'],fields)))
 for asset in b['assets']:
  if asset['mimeType']=='text/plain':
   asset['name']=c['sources'][0][0]+'.txt';asset['data']=base64.b64encode(c['sources'][0][1].encode()).decode()
 s['document']=labels(s['document'])
 for d in s['drawings']:d['document']=labels(d['document'])
 for a in s['planningArtifacts']:
  a['basis']={'document':s['document'],'sources':s['sources']}
  a['content']['title']=c['name']+' · Planning Report'
  for section,content in zip(a['content']['sections'],c['sections']):section['text']=content
  for area,fields in zip(a['content']['booths'],c['areas']):
   area['description'],area['circulation']=fields
   area['fee']['basis']='No fee estimate: area, duration and pricing basis have not been agreed.'
   area['fee']['includes']='Included equipment and operating services are to be agreed.'
  # A localized edition starts a new textual revision history; photos and spatial state are retained.
  a['history']=[]
 remaining=[]
 def scan(v):
  if isinstance(v,dict):
   for x in v.values():scan(x)
  elif isinstance(v,list):
   for x in v:scan(x)
  elif isinstance(v,str) and re.search('[가-힣]',v):remaining.append(v[:160])
 scan(b)
 if remaining:raise ValueError(remaining)
 p.write_text(json.dumps(b,ensure_ascii=False)+'\n')
(folder/'samples.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n')
