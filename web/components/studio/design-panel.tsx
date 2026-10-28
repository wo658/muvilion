"use client";
import { useState } from "react";
import { designWarnings } from "@/lib/plans/design";
import type { DesignObject, PlanDocument } from "@/lib/plans/schema";
import { Button } from "../ui";

export function DesignPanel({ document, onDocumentChange }: { document: PlanDocument; onDocumentChange: (document: PlanDocument) => void }) {
  const [selected, setSelected] = useState<string | null>(null);
  const objects = document.objects ?? [];
  const object = objects.find(item => item.id === selected);
  const issues = designWarnings(document);
  const update = (patch: Partial<DesignObject>) => onDocumentChange({ ...document, objects: objects.map(item => item.id === selected ? {...item,...patch} : item) });
  const add = (kind: DesignObject["kind"]) => {
    const id = crypto.randomUUID();
    const dimensions = kind === "stage" ? [6,4,0.8] : kind === "lounge" ? [4,3,0.6] : [3,3,2.4];
    onDocumentChange({ ...document, objects: [...objects, {id,kind,label:`${kind[0].toUpperCase()+kind.slice(1)} ${objects.length+1}`,x:0.5,y:0.5,width:dimensions[0],depth:dimensions[1],height:dimensions[2],rotation:0,color:kind === "stage" ? "#64748b" : kind === "lounge" ? "#84a69a" : "#b5cbe4"}] });
    setSelected(id);
  };
  return <section className="ps-section"><div className="ps-section-heading"><h2>Design your space</h2><span className="ps-small-muted">{objects.length} objects</span></div>
    <p className="ps-help">Place editable concepts on the confirmed drawing. Positions start at the centre.</p>
    <div className="ps-classify">{(["booth","stage","lounge"] as const).map(kind => <button key={kind} disabled={!document.scaleConfirmed || objects.length >= 200} onClick={() => add(kind)}>+ {kind}</button>)}</div>
    {objects.length > 0 && <label className="ps-field">Selected object<select value={object?.id ?? ""} onChange={e => setSelected(e.target.value)}><option value="">Choose an object</option>{objects.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label>}
    {object && <div className="ps-object-fields">
      <label className="ps-field">Name<input value={object.label} maxLength={100} onChange={e => update({label:e.target.value})} /></label>
      <div className="ps-dimensions">{(["width","depth","height"] as const).map(key => <label className="ps-field" key={key}>{key} (m)<input type="number" value={object[key]} min="0.1" max={key === "height" ? 30 : 100} step="0.1" onChange={e => {const n=Number(e.target.value);if(n>0 && n <= (key === "height" ? 30 : 100)) update({[key]:n});}} /></label>)}</div>
      <label className="ps-field">Across drawing <input aria-label="Object horizontal position" type="range" min="0" max="1" step="0.005" value={object.x} onChange={e=>update({x:Number(e.target.value)})} /></label>
      <label className="ps-field">Down drawing <input aria-label="Object vertical position" type="range" min="0" max="1" step="0.005" value={object.y} onChange={e=>update({y:Number(e.target.value)})} /></label>
      <div className="ps-classify"><button onClick={()=>update({rotation:object.rotation===0?90:0})}>Rotate {object.rotation}°</button><label className="ps-field">Finish<input aria-label="Object color" type="color" value={object.color} onChange={e=>update({color:e.target.value})} /></label></div>
      <Button variant="danger" onClick={()=>{onDocumentChange({...document,objects:objects.filter(item=>item.id!==selected)});setSelected(null);}}>Remove object</Button>
    </div>}
    {issues.length > 0 && <div className="ps-help" role="status">{issues.slice(0,5).map((issue,i)=><p key={i}>{issue}</p>)}{issues.length>5 && <p>And {issues.length-5} more conflicts.</p>}</div>}
    <p className="ps-help">Checks cover object overlap, drawing bounds and wall lines. Usable area, exits and aisle clearances need review.</p>
  </section>;
}
