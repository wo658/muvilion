import { readFile, writeFile, mkdir } from "node:fs/promises";
import { createRequire } from "node:module";
import { randomUUID } from "node:crypto";
import { TOKENS } from "../../web/lib/ui/tokens";
import { cropEvidence } from "../../web/lib/plans/crop";
import { PlanDocumentSchema } from "../../web/lib/plans/schema";
const require = createRequire(
  new URL("../../web/package.json", import.meta.url),
);
const sharp = require("sharp");
const root = new URL("../../", import.meta.url);
const bytes = await readFile(new URL("data/samples/moscone/west-L3.pdf", root));
const form = new FormData();
form.append(
  "file",
  new File([bytes], "west-L3.pdf", { type: "application/pdf" }),
);
form.append("page", "1");
const response = await fetch("http://localhost:3000/api/plans/extract", {
  method: "POST",
  body: form,
});
if (!response.ok) throw new Error(await response.text());
const source = PlanDocumentSchema.parse(await response.json());
// Room 3011, reviewed against the actual page. Retain source crop coordinates.
const box = { left: 633, top: 350, width: 204, height: 136 };
const preview = Buffer.from(source.preview.split(",")[1], "base64");
const crop = await sharp(preview).extract(box).png().toBuffer();
const evidence = cropEvidence(source, {
  x: box.left / 1224,
  y: box.top / 1584,
  width: box.width / 1224,
  height: box.height / 1584,
});
// Printed 0–15m scale spans approximately 134 pixels on this 1224×1584 preview.
const metresPerPixel = 15 / 134;
const document = PlanDocumentSchema.parse({
  ...evidence,
  preview: `data:image/png;base64,${crop.toString("base64")}`,
  widthMeters: box.width * metresPerPixel,
  heightMeters: box.height * metresPerPixel,
  scaleConfirmed: true,
  visualStyle: "exhibition",
  wallHeight: 3.2,
  ceiling: { height: 4, status: "estimated", color: TOKENS.surface },
  floorBoundary: [
    { x: 0.04, y: 0.06 },
    { x: 0.96, y: 0.06 },
    { x: 0.96, y: 0.94 },
    { x: 0.04, y: 0.94 },
  ],
  walkStart: { x: 0.91, y: 0.25 },
  warnings: [
    ...evidence.warnings,
    "Room 3011 cropped from the official Moscone West Level 3 PDF. Scale calibrated approximately from the printed 15m bar (134 preview pixels). Floor outline manually reviewed; heights estimated. Not an as-built or safety-certified design.",
  ],
});
const brief =
  "COMMUNITY STUDIO\n가상 전시 기획서 · Moscone West Level 3 / Room 3011\n실제 공식 PDF의 3011호실을 사용한 가상 Facebook 커뮤니티 체험 공간.\n콘셉트: 사람과 아이디어가 만나는 밝고 차분한 블루·오프화이트 공간.\n필수 프로그램: 환영 리셉션 1개, 커뮤니티 스토리 전시 패널 3개, 디지털 체험 카운터 2개, 4인 라운지 1곳(의자4개와 테이블1개), 발표 스테이지 1개와 스크린1개, 장식 식물4개, 상부 브랜드 사인1개.\n배치: 출입문이 있는 오른쪽 가장자리 동선을 비우고 내부에 전시·체험·대화 공간을 구분한다. 고정 벽체나 원본 도면을 바꾸지 않는다. 총 20~30개 내외의 전시물로 완결한다.\nMeta의 공식 행사나 의뢰가 아닌 독자 작성 데모이며, 실측·시공·피난 검증이 아니다.";
const drawingId = randomUUID(),
  briefId = randomUUID();
const sources = {
  version: 1,
  drawingSelected: true,
  items: [
    {
      id: randomUUID(),
      kind: "brief",
      name: "Community Studio · 전시 기획서",
      selected: true,
      originalAssetId: briefId,
      text: brief,
      notes: "영상용 독자 작성 가상 기획",
      images: [],
    },
    {
      id: randomUUID(),
      kind: "brand",
      name: "Facebook · 브랜드 URL",
      selected: true,
      url: "https://www.meta.com/facebook-app/",
      text: "Facebook은 사람들의 연결과 관심사 커뮤니티를 위한 서비스. 이 데모에서는 커뮤니티 스토리 전시, 디지털 체험, 대화 라운지로 해석한다. 블루·오프화이트, 명료한 안내, 열린 교류를 디자인 방향으로 사용한다.",
      notes:
        "공식 URL 북마크와 사람이 작성한 참고 요약. 자동 웹 수집 결과가 아님.",
      images: [],
    },
  ],
};
const bundle = {
  name: "Community Studio · 실제 PDF 기반 영상",
  state: { projectVersion: 1, document, sources, originalDrawingId: drawingId },
  assets: [
    {
      id: drawingId,
      name: "west-L3.pdf",
      mimeType: "application/pdf",
      data: bytes.toString("base64"),
    },
    {
      id: briefId,
      name: "community-studio-brief.txt",
      mimeType: "text/plain",
      data: Buffer.from(brief).toString("base64"),
    },
  ],
};
await mkdir(new URL("./generated/", import.meta.url), { recursive: true });
await writeFile(
  new URL("./generated/before.json", import.meta.url),
  JSON.stringify(bundle),
);
await writeFile(new URL("./brief.txt", import.meta.url), brief);
await writeFile(
  new URL("../public/input-reveal/plan.png", import.meta.url),
  crop,
);
await writeFile(new URL("./generated/full-plan.png", import.meta.url), preview);
const result = await fetch("http://localhost:3000/api/projects", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    Origin: "http://localhost:3000",
  },
  body: JSON.stringify(bundle),
});
if (!result.ok) throw new Error(await result.text());
const project = await result.json();
await writeFile(
  new URL("./generated/project.json", import.meta.url),
  JSON.stringify({ id: project.id, name: project.name }),
);
console.log(
  JSON.stringify({
    url: `http://localhost:3000/?project=${project.id}`,
    source: document.source,
    lines: document.lines.length,
    width: document.widthMeters,
    depth: document.heightMeters,
  }),
);
