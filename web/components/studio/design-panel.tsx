"use client";
import { NativeSelect } from "../ui/native-select";
import { Input } from "../ui/input";
import { useMemo, useState } from "react";
import { designWarnings } from "@/lib/plans/design";
import type { DesignObject, PlanDocument, SpaceZone } from "@/lib/plans/schema";
import { EntranceEditor } from "./entrance-editor";
import { Segmented } from "../ui";
import { Button } from "../ui";
const TYPES: DesignObject["kind"][] = ["partition", "stage", "furniture", "equipment", "light", "hanging-sign", "canopy", "beam"];
const PURPOSES: SpaceZone["purpose"][] = ["experience", "exhibition", "lounge", "stage", "circulation", "operations", "booth", "other"];
const DEFAULTS: Record<DesignObject["kind"], [
    number,
    number,
    number,
    number
]> = { booth: [3, 3, 2.4, 0], stage: [6, 4, 0.6, 0], lounge: [4, 3, 0.6, 0], partition: [4, 0.15, 2.4, 0], furniture: [2, 0.8, 0.8, 0], equipment: [1, 0.6, 1.5, 0], light: [1, 0.4, 0.15, 3], "hanging-sign": [3, 0.15, 0.8, 3], canopy: [5, 5, 0.1, 3], beam: [6, 0.3, 0.4, 3] };
function NumberField({ label, value, min = 0.1, max = 100, onChange }: {
    label: string;
    value: number;
    min?: number;
    max?: number;
    onChange: (value: number) => void;
}) {
    return <label className="ps-field">{label}<Input type="number" min={min} max={max} step="0.1" value={value} onChange={e => { const n = e.target.valueAsNumber; if (Number.isFinite(n) && n >= min && n <= max)
        onChange(n); }}/></label>;
}
export function DesignPanel({ document, onDocumentChange, selected, onSelect }: {
    document: PlanDocument;
    onDocumentChange: (document: PlanDocument) => void;
    selected: string | null;
    onSelect: (id: string | null) => void;
}) {
    const [tab, setTab] = useState<"zones" | "objects" | "height">("zones");
    const objects = document.objects ?? [], zones = document.zones ?? [];
    const object = objects.find(item => item.id === selected), zone = zones.find(item => item.id === selected);
    const issues = useMemo(() => designWarnings(document), [document]);
    const update = (patch: Partial<DesignObject>) => onDocumentChange({ ...document, objects: objects.map(item => item.id === selected ? { ...item, ...patch } : item) });
    const updateZone = (patch: Partial<SpaceZone>) => onDocumentChange({ ...document, zones: zones.map(item => item.id === selected ? { ...item, ...patch } : item) });
    const centre = document.walkStart ?? (document.floorBoundary?.length ? { x: document.floorBoundary.reduce((n, p) => n + p.x, 0) / document.floorBoundary.length, y: document.floorBoundary.reduce((n, p) => n + p.y, 0) / document.floorBoundary.length } : { x: 0.5, y: 0.5 });
    const add = (kind: DesignObject["kind"]) => {
        const id = crypto.randomUUID(), [width, depth, height, elevation] = DEFAULTS[kind];
        onDocumentChange({ ...document, objects: [...objects, { id, kind, provenance: "manual", label: `${kind} ${objects.length + 1}`, ...centre, width, depth, height, elevation, rotation: 0, color: kind === "light" ? "#fff0b0" : "#89a9b6" }] });
        onSelect(id);
    };
    const addZone = (purpose: SpaceZone["purpose"]) => { const id = crypto.randomUUID(); onDocumentChange({ ...document, zones: [...zones, { id, label: `${purpose} ${zones.length + 1}`, purpose, ...centre, width: 8, depth: 6, rotation: 0, assignable: purpose === "booth" }] }); onSelect(id); };
    const activeTab = object ? "objects" : zone ? "zones" : tab;
    return <section className="ps-section ps-design-panel" aria-label="Space designer"><div className="ps-section-heading"><h2>Design your space</h2><span className="ps-small-muted">{zones.length} areas · {objects.length} elements</span></div>
    <Segmented label="Design layer" value={activeTab} onChange={id=>{setTab(id);onSelect(null);}} options={[{id:"zones",label:"Spaces"},{id:"objects",label:"Elements"},{id:"height",label:"Height"}]}/>
    <EntranceEditor document={document} onChange={onDocumentChange} selected={selected} onSelect={onSelect}/>
    {!document.scaleConfirmed && <p className="ps-help">Confirm drawing scale in Details before designing.</p>}
    {activeTab === "zones" && <><p className="ps-help">Plan uses and circulation. Areas are not walls; booths are optional.</p><div className="ps-design-catalog">{PURPOSES.map(p => <Button key={p} disabled={!document.scaleConfirmed || zones.length >= 100} onClick={() => addZone(p)}>+ {p}</Button>)}</div>
      <label className="ps-field">Selected space<NativeSelect aria-label="Selected space" value={zone?.id ?? ""} onChange={e => onSelect(e.target.value || null)}><option value="">Choose a space</option>{zones.map(z => <option key={z.id} value={z.id}>{z.label}</option>)}</NativeSelect></label>
      {zone && <div className="ps-object-fields"><label className="ps-field">Space name<Input value={zone.label} maxLength={100} onChange={e => updateZone({ label: e.target.value })}/></label><label className="ps-field">Purpose<NativeSelect aria-label="Purpose" value={zone.purpose} onChange={e => updateZone({ purpose: e.target.value as SpaceZone["purpose"] })}>{PURPOSES.map(p => <option key={p}>{p}</option>)}</NativeSelect></label><div className="ps-dimensions"><NumberField label="Space width (m)" value={zone.width} onChange={width => updateZone({ width })}/><NumberField label="Space depth (m)" value={zone.depth} onChange={depth => updateZone({ depth })}/></div><Position x={zone.x} y={zone.y} onChange={updateZone}/><Button onClick={() => updateZone({ rotation: zone.rotation === 0 ? 90 : 0 })}>Rotate {zone.rotation}°</Button><label className="ps-design-check"><input type="checkbox" checked={zone.assignable} onChange={e => updateZone({ assignable: e.target.checked })}/>Available for company or team assignment</label><Button variant="danger" onClick={() => { onDocumentChange({ ...document, zones: zones.filter(z => z.id !== selected), objects: objects.map(o => o.zoneId === selected ? { ...o, zoneId: undefined } : o) }); onSelect(null); }}>Remove space</Button></div>}
    </>}
    {activeTab === "objects" && <><p className="ps-help">Place physical elements. Elevation is the bottom height above the floor.</p><div className="ps-design-catalog">{TYPES.map(kind => <Button key={kind} disabled={!document.scaleConfirmed || objects.length >= 200} onClick={() => add(kind)}>+ {kind}</Button>)}</div><label className="ps-field">Selected element<NativeSelect aria-label="Selected element" value={object?.id ?? ""} onChange={e => onSelect(e.target.value || null)}><option value="">Choose an element</option>{objects.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}</NativeSelect></label>
    {object && <div className="ps-object-fields"><label className="ps-field">Element name<Input value={object.label} maxLength={100} onChange={e => update({ label: e.target.value })}/></label><div className="ps-dimensions">{(["width", "depth", "height"] as const).map(key => <NumberField key={key} label={`${key} (m)`} value={object[key]} max={key === "height" ? 30 : 100} onChange={value => update({ [key]: value })}/>)}</div><NumberField label="Elevation / bottom height (m)" value={object.elevation ?? 0} min={0} max={30} onChange={elevation => update({ elevation })}/><p className="ps-help">Top height: {((object.elevation ?? 0) + object.height).toFixed(2)} m</p><Position x={object.x} y={object.y} onChange={update}/><label className="ps-field">Related space<NativeSelect aria-label="Related space" value={object.zoneId ?? ""} onChange={e => update({ zoneId: e.target.value || undefined })}><option value="">Whole venue</option>{zones.map(z => <option value={z.id} key={z.id}>{z.label}</option>)}</NativeSelect></label><div className="ps-classify"><Button onClick={() => update({ rotation: object.rotation === 0 ? 90 : 0 })}>Rotate {object.rotation}°</Button><label className="ps-field">Finish<Input aria-label="Element color" type="color" value={object.color} onChange={e => update({ color: e.target.value })}/></label></div><Button variant="danger" onClick={() => { onDocumentChange({ ...document, objects: objects.filter(o => o.id !== selected) }); onSelect(null); }}>Remove element</Button></div>}
    </>}
    {activeTab === "height" && <><p className="ps-help">Start with a level ceiling. Add beam elements for local overhead obstacles. Heights from a plan alone are not confirmed measurements.</p><NumberField label="Existing wall height (m)" value={document.wallHeight ?? 3} max={30} onChange={wallHeight => onDocumentChange({ ...document, wallHeight })}/>{!document.ceiling ? <Button disabled={!document.scaleConfirmed} onClick={() => onDocumentChange({ ...document, ceiling: { height: 4, status: "estimated", color: "#e2e5e7" } })}>Add estimated ceiling</Button> : <><NumberField label="Ceiling underside height (m)" value={document.ceiling.height} max={30} onChange={height => onDocumentChange({ ...document, ceiling: { ...document.ceiling!, height } })}/><label className="ps-field">Height evidence<NativeSelect aria-label="Height evidence" value={document.ceiling.status} onChange={e => onDocumentChange({ ...document, ceiling: { ...document.ceiling!, status: e.target.value as "estimated" | "confirmed" } })}><option value="estimated">Estimated — needs review</option><option value="confirmed">Confirmed from supplied information</option></NativeSelect></label><label className="ps-field">Ceiling finish<Input aria-label="Ceiling color" type="color" value={document.ceiling.color} onChange={e => onDocumentChange({ ...document, ceiling: { ...document.ceiling!, color: e.target.value } })}/></label><Button variant="danger" onClick={() => onDocumentChange({ ...document, ceiling: undefined })}>Remove ceiling</Button></>}{!document.floorBoundary?.length && <p className="ps-help">Trace an interior floor outline in Details to define the ceiling footprint.</p>}<p className="ps-help">3D visibility controls only hide surfaces. Height checks and Muse still use hidden elements.</p></>}
    {issues.length > 0 && <details className="ps-design-issues"><summary>{issues.length} design checks to review</summary>{issues.slice(0, 20).map((issue, i) => <p key={i}>{issue}</p>)}{issues.length > 20 && <p>{issues.length - 20} more checks.</p>}</details>}
  </section>;
}
function Position({ x, y, onChange }: {
    x: number;
    y: number;
    onChange: (patch: {
        x?: number;
        y?: number;
    }) => void;
}) { return <><label className="ps-field">Across drawing<Input aria-label="Element horizontal position" type="range" min="0" max="1" step="0.002" value={x} onChange={e => onChange({ x: Number(e.target.value) })}/></label><label className="ps-field">Down drawing<Input aria-label="Element vertical position" type="range" min="0" max="1" step="0.002" value={y} onChange={e => onChange({ y: Number(e.target.value) })}/></label></>; }
