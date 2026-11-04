
import {AbsoluteFill, Sequence, interpolate, staticFile, useVideoConfig} from 'remotion';
import {Audio} from '@remotion/media';
import {TOKENS as T} from '../../web/lib/ui/tokens';
import {LaunchOpening3D} from './LaunchOpening3D';
import {LaunchBuild} from './LaunchBuild';
import {Sources, SeongsuReveal, SeongsuDetail, Listening} from './LaunchSeongsu';
import {KintexBridge, KintexReveal, KintexTop, KintexDetail} from './LaunchKintex';
import {ReportBridge, Report, PopupAreas, KintexAreas, Export, Documents, EndCard} from './LaunchReport';
import {clamp} from './LaunchKit';

// Scenes 0:20–3:00. Every capture floats as a panel in one shared CSS perspective:
// a virtual camera swings each panel in from a twisted angle, settles it with
// bezier easing and pushes in on the part of the saved demo that matters.

function FilmAudio(){const {fps}=useVideoConfig();return <Audio src={staticFile('designer-film/music.m4a')} volume={f=>interpolate(f,[0,1*fps,175*fps,180*fps],[0,.7,.7,0],clamp)}/>}
export function LaunchFilm(){const {fps}=useVideoConfig();return <AbsoluteFill style={{background:T.bg}}>
 <Sequence durationInFrames={20*fps} name="01 Opening in 3D"><LaunchOpening3D/></Sequence>
 <Sequence from={20*fps} durationInFrames={7.5*fps} name="04 Current source library"><Sources/></Sequence>
 <Sequence from={27.5*fps} durationInFrames={16*fps} name="05 Muvi builds the floor"><LaunchBuild/></Sequence>
 {/* The reveal joins mid-way: the build already showed the overview and the count. */}
 <Sequence from={43.5*fps} durationInFrames={6.5*fps} name="06 Seongsu entry at eye level"><Sequence from={-180} layout="none"><SeongsuReveal/></Sequence></Sequence>
 <Sequence from={50*fps} durationInFrames={10*fps} name="07 Fitting and photography"><SeongsuDetail/></Sequence>
 <Sequence from={60*fps} durationInFrames={10*fps} name="08 Annex and six areas"><Listening/></Sequence>
 <Sequence from={70*fps} durationInFrames={2.5*fps} name="09 Second scale"><KintexBridge/></Sequence>
 <Sequence from={72.5*fps} durationInFrames={12.5*fps} name="10 KINTEX reveal"><KintexReveal/></Sequence>
 <Sequence from={85*fps} durationInFrames={10*fps} name="11 Creator floor"><KintexTop/></Sequence>
 <Sequence from={95*fps} durationInFrames={10*fps} name="12 Creator detail"><KintexDetail/></Sequence>
 <Sequence from={105*fps} durationInFrames={2.5*fps} name="13 Proposal bridge"><ReportBridge/></Sequence>
 <Sequence from={107.5*fps} durationInFrames={10*fps} name="14 Completed pop-up report"><Report file="popup-report.mp4" title={'The design\nbecomes a\ndocument.'} eyebrow="03 / Planning report"/></Sequence>
 <Sequence from={117.5*fps} durationInFrames={12.5*fps} name="15 Pop-up area guide"><PopupAreas/></Sequence>
 <Sequence from={130*fps} durationInFrames={10*fps} name="16 Creator event report"><Report file="kintex-report.mp4" title={'The same\nclarity, at\nevent scale.'} eyebrow="KINTEX / completed report" mirror/></Sequence>
 <Sequence from={140*fps} durationInFrames={12.5*fps} name="17 Creator area guide"><KintexAreas/></Sequence>
 <Sequence from={152.5*fps} durationInFrames={7.5*fps} name="18 Export from the app"><Export/></Sequence>
 <Sequence from={160*fps} durationInFrames={12.5*fps} name="19 Real exported proposals"><Documents/></Sequence>
 <Sequence from={172.5*fps} durationInFrames={7.5*fps} name="20 Muvilion"><EndCard/></Sequence>
 <Sequence from={27.3*fps} durationInFrames={fps} name="Build entrance"><Audio src={staticFile('launch/whoosh.wav')} volume={.25}/></Sequence>
 <Sequence from={17*fps} durationInFrames={fps} name="Opening exit sound"><Audio src={staticFile('launch/whoosh.wav')} volume={.35}/></Sequence>
 <Sequence from={70*fps} durationInFrames={fps} name="Event transition"><Audio src={staticFile('launch/whoosh.wav')} volume={.3}/></Sequence>
 <Sequence from={105*fps} durationInFrames={fps} name="Document transition"><Audio src={staticFile('launch/whoosh.wav')} volume={.3}/></Sequence>
 <Sequence from={160*fps} durationInFrames={fps} name="PDF reveal"><Audio src={staticFile('launch/whoosh.wav')} volume={.3}/></Sequence>
 <FilmAudio/>
</AbsoluteFill>}
