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
    "Lounge armchair with a wooden frame and black leather cushions. Single seat. Decorative model without seating review, so seats people will use should be fixtureType event-chair or lounge-sofa.",
    ["chair", "armchair", "seat", "lounge", "consultation", "wood", "black leather"],
    0.820344, 0.986562, 1.022852),
  model("modern_coffee_table_01", "furniture", "Modern Coffee Table 01",
    "Low rectangular coffee table with a stone top and wooden frame. The long side runs along the local Z axis.",
    ["table", "coffee", "lounge", "consultation", "stone", "wood"],
    0.6, 1.201830, 0.39),
  model("modular_street_seating", "furniture", "Modular Street Seating",
    "Modular bench parts kit with wooden slats and metal supports. Not a single finished chair; public/outdoor style.",
    ["bench", "seat", "outdoor", "seating", "waiting", "modular", "kit", "set"],
    4.34, 0.770370, 0.950000),
  model("modern_ceiling_lamp_01", "light", "Modern Ceiling Lamp 01",
    "Ceiling pendant light with a white translucent glass globe and metal fittings. The shape includes the cable; actual light output and distribution must be checked separately.",
    ["light", "lamp", "lighting", "pendant", "ceiling", "globe", "lounge", "white finish"],
    0.431649, 0.431661, 0.951551),
  model("mounted_fluorescent_lights", "light", "Mounted Fluorescent Lights",
    "Set of several linear fluorescent fixtures. Do not treat it as a single lamp. Emissive surfaces are not a lighting simulation.",
    ["light", "lamp", "lighting", "linear", "fluorescent", "ceiling", "set"],
    0.912181, 0.645437, 0.035353),
  model("desk_lamp_arm_01", "light", "Desk Lamp Arm 01",
    "Clamp-mounted articulated lamp for reception and work desks. Specify the desktop mounting height separately.",
    ["light", "lamp", "lighting", "desk", "task", "clamp", "stand", "reception"],
    0.201729, 0.613873, 0.892611),
  model("gallery_wall", "partition", "Gallery Wall Module",
    "A single exhibition/gallery wall module. Not a finished booth; build the perimeter from several partition objects and leave an entrance. AI-generated concept model.",
    ["wall", "partition", "gallery", "exhibition", "booth", "module"],
    1.999866, 0.199921, 3.2, generatedGlb),
  model("movable_partition", "partition", "Movable Partition Wall",
    "A single movable exhibition partition module. Depth includes the base; keep aisles clear. AI-generated concept model; real stability is not verified.",
    ["partition", "movable", "wall", "exhibition", "booth"],
    1.800096, 0.620057, 2.39, generatedGlb),
  model("display_plinth", "furniture", "Display Plinth",
    "Freestanding plinth for exhibits. When placing an object on top, reflect the plinth height in its elevation. AI-generated concept model.",
    ["plinth", "pedestal", "stand", "display", "exhibition", "booth"],
    0.508002, 0.508002, 0.6, generatedGlb),
  model("display_vitrine", "furniture", "Display Vitrine",
    "Display case shape with small decorative exhibits. Usable interior display space and load are unverified, and collision checks use the full outer bounds. AI-generated concept model.",
    ["vitrine", "showcase", "display", "case", "glass", "exhibition"],
    0.64003, 0.64003, 1.420001, generatedGlb),
  model("reception_desk", "furniture", "Reception Desk",
    "Reception desk with a desktop monitor for exhibition halls and booths. Height is the full outer bounds including the monitor, not the countertop height. AI-generated concept model.",
    ["reception", "information", "desk", "counter", "welcome", "exhibition", "booth"],
    2.5, 0.799966, 1.630022, generatedGlb),
  model("floor_plan_board", "equipment", "Floor Plan Board",
    "Exhibition information board shape with placeholder graphics. Not a floor plan linked to an actual map or drawing. AI-generated concept model.",
    ["board", "sign", "information", "floor plan", "wayfinding", "exhibition"],
    1.14, 0.600076, 1.866488, generatedGlb),
  model("track_spot", "light", "Track Spot Head",
    "A single downward-facing exhibition track spotlight head. Does not include the full rail or actual light output/distribution calculations. AI-generated concept model.",
    ["light", "lamp", "lighting", "spot", "spotlight", "track", "exhibition"],
    0.110015, 0.108323, 0.21, generatedGlb),
  model("truss_horizontal", "equipment", "Horizontal Truss Bay",
    "Visual model of a horizontal truss section. State its elevation when installing, and do not claim support, load or rigging verification. AI-generated concept model.",
    ["truss", "horizontal", "stage", "exhibition", "booth", "structure"],
    3.068, 0.289881, 0.425084, generatedGlb),
  model("truss_vertical", "equipment", "Vertical Truss Tower",
    "Visual model of a vertical truss tower. Does not verify the load capacity or safety of a real structure. AI-generated concept model.",
    ["truss", "vertical", "tower", "stage", "exhibition", "booth", "structure"],
    0.425084, 0.289881, 3.068, generatedGlb),
];

function material(id: MaterialAssetId, name: string, description: string, tags: readonly string[]): MaterialAsset {
  const prefix = `${base}/materials/${id}/${id}_1K-JPG`;
  return { id, kind: "material", name, description, tags, license: "CC0-1.0",
    maps: { color: `${prefix}_Color.jpg`, normal: `${prefix}_NormalGL.jpg`, roughness: `${prefix}_Roughness.jpg`,
      ...(id === "Metal036" ? { metalness: `${prefix}_Metalness.jpg` } : {}) } };
}

const materials: readonly MaterialAsset[] = [
  material("Plaster001", "Plaster 001", "White matte plaster. Rougher than smooth paint; used for partition wall finishes.",
    ["white finish", "plaster", "wall", "partition", "matte"]),
  material("Concrete034", "Concrete 034", "Smooth light grey concrete.",
    ["concrete", "grey", "floor", "wall"]),
  material("Wood051", "Wood 051", "Dark smooth wood. Suits plinth, counter and furniture finishes.",
    ["wood", "dark", "brown", "plinth", "counter"]),
  material("Metal036", "Metal 036", "Smooth grey metal. Suits frames, columns and cladding.",
    ["metal", "grey", "frame", "column"]),
  material("Fabric026", "Fabric 026", "Red carpet fabric. An event accent finish, not a neutral fabric.",
    ["fabric", "carpet", "red", "cloth"]),
  material("Tiles074", "Tiles 074", "Marble tile pattern. Stone finish for lobbies and lounges.",
    ["marble", "tile", "tiles", "stone", "lobby"]),
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
