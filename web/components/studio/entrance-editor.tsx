"use client";
import type { PlanDocument } from "@/lib/plans/schema";
import { Button } from "../ui";
import { Field, FieldLabel } from "../ui/field";
import { Input } from "../ui/input";
import { NativeSelect } from "../ui/native-select";
export function EntranceEditor({ document, onChange, selected, onSelect }: { document: PlanDocument; onChange: (value: PlanDocument) => void; selected: string | null; onSelect: (id: string | null) => void }) {
  const entrances = document.entrances ?? [];
  const entrance = entrances.find(item => item.id === selected);
  return <details open={Boolean(entrance)} className="my-3"><summary>입구 · {entrances.length}</summary>
    <p className="ps-help">2D에서 위치를 표시합니다. 벽의 개구부는 바꾸지 않습니다.</p>
    <Field><FieldLabel htmlFor="entrance-select">입구 선택</FieldLabel><NativeSelect id="entrance-select" value={entrance?.id ?? ""} onChange={e => onSelect(e.target.value || null)}><option value="">선택</option>{entrances.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}</NativeSelect></Field>
    {entrance && <><Field><FieldLabel htmlFor="entrance-name">이름</FieldLabel><Input id="entrance-name" value={entrance.label} maxLength={80} onChange={e => { if (e.target.value.trim()) onChange({ ...document, entrances: entrances.map(item => item.id === selected ? { ...item, label: e.target.value } : item) }); }}/></Field>
    <Button onClick={() => onChange({ ...document, entrances: entrances.map(item => item.id === selected ? { ...item, rotation: (item.rotation + 90) % 360 } : item) })}>방향 회전</Button>
    <Button variant="ghost" onClick={() => { onChange({ ...document, entrances: entrances.filter(item => item.id !== selected) }); onSelect(null); }}>표시 삭제</Button></>}
  </details>;
}
