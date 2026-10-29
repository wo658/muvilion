// Lightweight shared metadata. Provenance and checksums remain in the public manifest;
// neither browser code nor model tools need to load that larger document at runtime.
export const MODEL_ASSET_IDS = [
  "modern_arm_chair_01", "modern_coffee_table_01", "modular_street_seating",
  "modern_ceiling_lamp_01", "mounted_fluorescent_lights", "desk_lamp_arm_01",
  "gallery_wall", "movable_partition", "display_plinth", "display_vitrine", "reception_desk",
  "floor_plan_board", "track_spot", "truss_horizontal", "truss_vertical",
] as const;
export const MATERIAL_ASSET_IDS = ["Plaster001", "Concrete034", "Wood051", "Metal036", "Fabric026", "Tiles074"] as const;
export const ASSET_CATEGORIES = ["all", "material", "furniture", "light", "partition", "equipment"] as const;
export type ModelAssetId = typeof MODEL_ASSET_IDS[number];
export type MaterialAssetId = typeof MATERIAL_ASSET_IDS[number];

type AssetMetadata = {
  name: string;
  description: string;
  tags: readonly string[];
  license: "CC0-1.0";
  aiGenerated?: true;
};
export type ModelAsset = AssetMetadata & {
  id: ModelAssetId;
  kind: "furniture" | "light" | "partition" | "equipment";
  url: string;
  width: number;
  depth: number;
  height: number;
  dimensionSource: "gltf-scene-bounds";
};
export type MaterialAsset = AssetMetadata & {
  id: MaterialAssetId;
  kind: "material";
  maps: { color: string; normal: string; roughness: string; metalness?: string };
};

const base = "/assets/cc0";
const generatedGlb = { fileName: "model.glb", aiGenerated: true } as const;
function model(
  id: ModelAssetId, kind: ModelAsset["kind"], name: string, description: string,
  tags: readonly string[], width: number, depth: number, height: number,
  options: { fileName?: string; aiGenerated?: true } = {},
): ModelAsset {
  return { id, kind, name, description, tags, width, depth, height,
    url: `${base}/models/${id}/${options.fileName ?? `${id}_1k.gltf`}`, license: "CC0-1.0", dimensionSource: "gltf-scene-bounds",
    ...(options.aiGenerated ? { aiGenerated: true } : {}) };
}

// Metre bounds measured from the downloaded glTF scene's transformed POSITION
// vertices (X width, Z depth, Y height). These are not surveyed product dimensions.
const models: readonly ModelAsset[] = [
  model("modern_arm_chair_01", "furniture", "Modern Arm Chair 01",
    "목재 프레임과 검은 가죽 쿠션의 라운지 암체어. 단일 좌석.",
    ["의자", "암체어", "좌석", "라운지", "상담", "목재", "chair", "seat", "lounge", "wood", "black leather"],
    0.820344, 0.986562, 1.022852),
  model("modern_coffee_table_01", "furniture", "Modern Coffee Table 01",
    "석재 상판과 목재 프레임의 낮은 직사각형 커피 테이블. 긴 방향은 로컬 Z축.",
    ["테이블", "탁자", "라운지", "상담", "목재", "석재", "table", "coffee", "lounge", "stone", "wood"],
    0.6, 1.201830, 0.39),
  model("modular_street_seating", "furniture", "Modular Street Seating",
    "목재 슬랫과 금속 지지대의 모듈형 벤치 부품 세트. 단일 완성 의자가 아니며 공용·외부 공간 스타일.",
    ["벤치", "좌석", "야외", "대기", "모듈", "세트", "bench", "outdoor", "seating", "modular", "kit"],
    4.34, 0.770370, 0.950000),
  model("modern_ceiling_lamp_01", "light", "Modern Ceiling Lamp 01",
    "흰 반투명 구형 유리와 금속 피팅의 천장 펜던트 조명. 케이블을 포함한 외형이며 실제 광원·배광 검증은 별도.",
    ["전등", "조명", "펜던트", "천장", "구형", "라운지", "흰색", "light", "lamp", "pendant", "ceiling", "white finish", "globe"],
    0.431649, 0.431661, 0.951551),
  model("mounted_fluorescent_lights", "light", "Mounted Fluorescent Lights",
    "선형 형광등 기구 여러 개의 세트. 단일 등으로 취급하지 말 것. 발광 표면은 조도 시뮬레이션이 아님.",
    ["전등", "조명", "형광등", "선형", "천장", "세트", "light", "lamp", "linear", "fluorescent", "ceiling", "set"],
    0.912181, 0.645437, 0.035353),
  model("desk_lamp_arm_01", "light", "Desk Lamp Arm 01",
    "접수대·작업대에 사용하는 클램프 고정 관절형 스탠드. 책상 위 설치 높이를 별도 지정.",
    ["전등", "조명", "책상", "스탠드", "데스크", "접수대", "light", "lamp", "desk", "task", "clamp"],
    0.201729, 0.613873, 0.892611),
  model("gallery_wall", "partition", "Gallery Wall Module",
    "전시·갤러리 가벽 모듈 하나. 완성 부스가 아니며 여러 partition 객체로 둘레를 만들고 출입구를 남겨야 함. AI 생성 콘셉트 모델.",
    ["가벽", "벽", "전시", "갤러리", "부스", "모듈", "wall", "partition", "gallery", "exhibition", "booth", "module"],
    1.999866, 0.199921, 3.2, generatedGlb),
  model("movable_partition", "partition", "Movable Partition Wall",
    "이동식 전시 파티션 모듈 하나. 깊이는 받침대를 포함하며 통로를 확보해야 함. AI 생성 콘셉트 모델로 실제 안정성은 검증되지 않음.",
    ["가벽", "파티션", "벽", "이동식", "전시", "부스", "partition", "movable", "wall", "exhibition", "booth"],
    1.800096, 0.620057, 2.39, generatedGlb),
  model("display_plinth", "furniture", "Display Plinth",
    "전시품을 올리는 독립형 전시대. 물건을 위에 배치할 때 전시대 높이를 elevation에 반영. AI 생성 콘셉트 모델.",
    ["전시대", "받침대", "진열", "전시", "부스", "plinth", "pedestal", "display", "exhibition", "booth"],
    0.508002, 0.508002, 0.6, generatedGlb),
  model("display_vitrine", "furniture", "Display Vitrine",
    "작은 장식 전시물이 포함된 진열장 외형. 내부 전시 가능 공간과 하중은 확인되지 않았으며 충돌 검사는 전체 외곽 크기를 사용. AI 생성 콘셉트 모델.",
    ["진열장", "쇼케이스", "전시", "유리", "vitrine", "showcase", "display", "case", "exhibition"],
    0.64003, 0.640955, 1.437516, generatedGlb),
  model("reception_desk", "furniture", "Reception Desk",
    "데스크톱 모니터가 포함된 전시장·부스 안내용 접수 데스크. 높이는 모니터를 포함한 전체 외곽이며 상판 높이가 아님. AI 생성 콘셉트 모델.",
    ["접수대", "안내", "데스크", "카운터", "전시", "부스", "reception", "desk", "counter", "welcome", "booth"],
    2.5, 0.799966, 1.630022, generatedGlb),
  model("floor_plan_board", "equipment", "Floor Plan Board",
    "자리표시용 그래픽이 있는 전시장 안내 보드 외형. 실제 지도나 도면과 연결된 배치도가 아님. AI 생성 콘셉트 모델.",
    ["안내판", "안내", "보드", "배치도", "사인", "전시", "board", "sign", "floor plan", "wayfinding", "exhibition"],
    1.14, 0.600076, 1.866488, generatedGlb),
  model("track_spot", "light", "Track Spot Head",
    "아래쪽을 향하는 전시용 트랙 스폿 조명 헤드 하나. 전체 레일이나 실제 광원·배광 계산은 포함하지 않음. AI 생성 콘셉트 모델.",
    ["조명", "전등", "스폿", "스포트", "트랙", "전시", "light", "spot", "track", "lamp", "exhibition"],
    0.110015, 0.108323, 0.21, generatedGlb),
  model("truss_horizontal", "equipment", "Horizontal Truss Bay",
    "가로 방향 트러스 구간의 시각적 모델. 설치 시 elevation을 명시하고, 지지·하중·리깅 검증을 주장하지 말 것. AI 생성 콘셉트 모델.",
    ["트러스", "가로", "무대", "전시", "부스", "구조", "truss", "horizontal", "stage", "exhibition", "booth"],
    3.068, 0.289881, 0.425084, generatedGlb),
  model("truss_vertical", "equipment", "Vertical Truss Tower",
    "세로 방향 트러스 타워의 시각적 모델. 실제 구조물의 지지력이나 안전성을 검증하지 않음. AI 생성 콘셉트 모델.",
    ["트러스", "세로", "타워", "무대", "전시", "부스", "구조", "truss", "vertical", "tower", "stage", "exhibition", "booth"],
    0.425084, 0.289881, 3.068, generatedGlb),
];

function material(id: MaterialAssetId, name: string, description: string, tags: readonly string[]): MaterialAsset {
  const prefix = `${base}/materials/${id}/${id}_1K-JPG`;
  return { id, kind: "material", name, description, tags, license: "CC0-1.0",
    maps: { color: `${prefix}_Color.jpg`, normal: `${prefix}_NormalGL.jpg`, roughness: `${prefix}_Roughness.jpg`,
      ...(id === "Metal036" ? { metalness: `${prefix}_Metalness.jpg` } : {}) } };
}

const materials: readonly MaterialAsset[] = [
  material("Plaster001", "Plaster 001", "흰 무광 미장 재질. 매끈한 도장보다 거친 표면이며 가벽 마감에 사용.",
    ["흰", "흰색", "미장", "가벽", "벽", "무광", "white finish", "plaster", "wall", "partition", "matte"]),
  material("Concrete034", "Concrete 034", "밝은 회색의 매끈한 콘크리트 재질.",
    ["콘크리트", "회색", "바닥", "벽", "concrete", "grey", "floor", "wall"]),
  material("Wood051", "Wood 051", "어둡고 매끈한 목재. 전시대·카운터·가구 마감에 적합.",
    ["목재", "나무", "전시대", "카운터", "갈색", "wood", "dark", "brown", "counter"]),
  material("Metal036", "Metal 036", "매끈한 회색 금속. 프레임·기둥·외장에 적합.",
    ["금속", "회색", "프레임", "기둥", "metal", "grey", "frame"]),
  material("Fabric026", "Fabric 026", "붉은 카펫 직물. 중성색 패브릭이 아닌 행사 포인트 마감.",
    ["직물", "카펫", "패브릭", "빨강", "붉은", "fabric", "carpet", "red", "cloth"]),
  material("Tiles074", "Tiles 074", "대리석 타일 무늬. 로비·라운지의 석재 마감.",
    ["대리석", "타일", "로비", "석재", "marble", "tile", "tiles", "stone", "lobby"]),
];

export function getModelAsset(id?: string): ModelAsset | undefined {
  return models.find(asset => asset.id === id);
}

export function getMaterialAsset(id?: string): MaterialAsset | undefined {
  return materials.find(asset => asset.id === id);
}

export function searchDesignAssets(input: { query?: string; category?: typeof ASSET_CATEGORIES[number] }): (ModelAsset | MaterialAsset)[] {
  const tokens = (input.query ?? "").trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
  return [...models, ...materials]
    .filter(asset => !input.category || input.category === "all" || asset.kind === input.category)
    .map(asset => {
      const haystack = `${asset.id} ${asset.name} ${asset.description} ${asset.tags.join(" ")}`.toLocaleLowerCase();
      return { asset, score: tokens.filter(token => haystack.includes(token)).length };
    })
    .filter(item => !tokens.length || item.score > 0)
    .sort((a, b) => b.score - a.score)
    .map(item => item.asset);
}
