import { useEffect, useMemo } from "react";
import * as THREE from "three";
import { ITEM_IDS, type ItemId } from "../../game/content/ids";
import { ITEMS } from "../../game/content/items";
import { STICKER_IDS } from "../../game/content/stickers";
import { blobShadow } from "../../scene/materials";
import { FestivalChest } from "../../scene/models/festivalChest";
import { ITEM_DISPLAY, buildItem, itemSize } from "../../scene/models/items";
import { buildCharacter } from "../../scene/models/people";
import { SeaChest } from "../../scene/models/seaChest";
import { textSprite } from "../../scene/textSprite";
import { ItemIcon, ItemSilhouette } from "../../ui/icons/ItemIcon";
import { StickerIcon } from "../../ui/icons/StickerIcon";
import { GalleryCanvas, Ticker } from "../GalleryCanvas";
import { markGalleryReady } from "../ready";

const params = new URLSearchParams(location.search);
const view = params.get("view") ?? "items";

function pedestal(): THREE.Mesh {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.46, 0.06, 28), new THREE.MeshLambertMaterial({ color: "#fff6e0" }));
  m.position.y = 0.03;
  return m;
}

function ItemsView() {
  const { group, spinners } = useMemo(() => {
    const group = new THREE.Group();
    const spinners: THREE.Object3D[] = [];
    ITEM_IDS.forEach((id, i) => {
      const col = i % 3;
      const row = Math.floor(i / 3);
      const cell = new THREE.Group();
      cell.position.set((col - 1) * 1.15, 0, (row - 1) * 1.0);
      cell.add(pedestal());
      const spin = new THREE.Group();
      spin.position.y = 0.06;
      const m = buildItem(id);
      const size = itemSize(id);
      const k = ITEM_DISPLAY[id].world;
      m.scale.setScalar(k);
      m.position.set((-size.x / 2 + size.x / 2) * k, 0, 0);
      spin.add(m);
      cell.add(spin);
      spinners.push(spin);
      const label = textSprite(ITEMS[id].en, { height: 0.16, background: "rgba(255,255,255,0.85)" });
      label.position.set(0, 0.62, 0.3);
      cell.add(label);
      group.add(cell);
    });
    return { group, spinners };
  }, []);
  return (
    <>
      <primitive object={group} />
      <Ticker fn={(dt) => spinners.forEach((s, i) => (s.rotation.y += dt * (0.35 + i * 0.01)))} />
    </>
  );
}

function CloseupView({ id }: { id: ItemId }) {
  const obj = useMemo(() => {
    const g = new THREE.Group();
    const m = buildItem(id);
    const size = itemSize(id);
    const k = 1.1 / size.x;
    m.scale.setScalar(k);
    g.add(m);
    g.add(blobShadow(0.7));
    return g;
  }, [id]);
  return (
    <>
      <primitive object={obj} />
      <Ticker fn={(dt) => (obj.rotation.y += dt * 0.4)} />
    </>
  );
}

function ChestsView() {
  const { group, chests } = useMemo(() => {
    const group = new THREE.Group();
    const a = new FestivalChest();
    a.group.position.set(-1.25, 0, 0);
    a.setContents(["pencil", "eraser", "ruler", "marker"]);
    a.setSlot("notebook", "glowing");
    group.add(a.group);
    const b = new FestivalChest();
    b.group.position.set(1.35, 0, -0.6);
    b.group.rotation.y = -0.45;
    b.setContents([...ITEM_IDS]);
    b.setLidOpen(0.7);
    group.add(b.group);
    const s = new SeaChest(["stapler", "notebook", "pen"]);
    s.group.position.set(0.1, 0, 1.25);
    s.setLockOpen(1, true);
    group.add(s.group);
    for (const g of [a.group, b.group, s.group]) {
      const sh = blobShadow(1.1);
      sh.position.copy(g.position);
      group.add(sh);
    }
    return { group, chests: [a, b] };
  }, []);
  return (
    <>
      <primitive object={group} />
      <Ticker fn={(dt) => chests.forEach((c) => c.update(dt))} />
    </>
  );
}

function HandView() {
  const { group, rigs } = useMemo(() => {
    const group = new THREE.Group();
    const rigs = ITEM_IDS.map((id, i) => {
      const rig = buildCharacter(i % 2 ? "ken" : "player");
      rig.group.position.set((i % 5 - 2) * 0.95, 0, Math.floor(i / 5) * 1.3 - 0.6);
      rig.hold(id);
      group.add(rig.group);
      const sh = blobShadow(0.35);
      sh.position.copy(rig.group.position);
      group.add(sh);
      return rig;
    });
    return { group, rigs };
  }, []);
  return (
    <>
      <primitive object={group} />
      <Ticker
        fn={(dt) =>
          rigs.forEach((r) => {
            if (r.state !== "present") r.setState("present");
            r.update(dt);
          })
        }
      />
    </>
  );
}

function IconSheet() {
  useEffect(() => {
    const t = setTimeout(markGalleryReady, 300);
    return () => clearTimeout(t);
  }, []);
  const owned = new Set<ItemId>(["pen", "ruler", "notebook", "pencil"]);
  return (
    <main style={{ padding: 24, background: "#fffaf0", height: "100%", overflow: "auto", fontFamily: "var(--font)" }}>
      <h2 style={{ margin: "0 0 12px" }}>Item icons — 96 / 48 / 32 px, silhouettes</h2>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(9, 1fr)", gap: 8 }}>
        {ITEM_IDS.map((id) => (
          <div key={id} style={{ textAlign: "center", background: "#fff", borderRadius: 14, padding: 8, boxShadow: "0 2px 0 #e8dcc4" }}>
            <ItemIcon id={id} size={96} />
            <div>
              <ItemIcon id={id} size={48} />
              <ItemIcon id={id} size={32} />
            </div>
            <ItemSilhouette id={id} size={48} />
            <div style={{ fontWeight: 700 }}>{ITEMS[id].en}</div>
            <div style={{ color: "var(--ja)", fontSize: 14 }}>{ITEMS[id].ja}</div>
          </div>
        ))}
      </div>
      <h2 style={{ margin: "18px 0 8px" }}>Backpack slots — owned vs not owned (mock-up)</h2>
      <div style={{ display: "flex", gap: 8, background: "rgba(43,45,66,.08)", padding: 10, borderRadius: 18, width: "max-content" }}>
        {ITEM_IDS.map((id) =>
          owned.has(id) ? (
            <div key={id} style={{ width: 68, height: 68, borderRadius: 14, background: "#fff", border: "3px solid #2b2d42", display: "grid", placeItems: "center", boxShadow: "0 4px 0 rgba(43,45,66,.25), 0 0 0 3px #ffcf3f" }}>
              <ItemIcon id={id} size={52} />
            </div>
          ) : (
            <div key={id} style={{ width: 68, height: 68, borderRadius: 14, border: "3px dashed #b9b2a3", display: "grid", placeItems: "center", background: "rgba(255,255,255,.35)" }}>
              <ItemSilhouette id={id} size={44} color="#d9d2c4" />
            </div>
          )
        )}
      </div>
      <h2 style={{ margin: "18px 0 8px" }}>Stickers</h2>
      <div style={{ display: "flex", gap: 10 }}>
        {STICKER_IDS.map((s) => (
          <StickerIcon key={s} id={s} size={72} />
        ))}
        <StickerIcon id="kite" size={72} owned={false} />
      </div>
    </main>
  );
}

export default function ItemsGallery() {
  if (view === "icons") return <IconSheet />;
  if (view === "chests") return <GalleryCanvas camera={[0.2, 2.6, 5.2]} target={[0, 0.6, 0]}><ChestsView /></GalleryCanvas>;
  if (view === "hand") return <GalleryCanvas camera={[0, 1.6, 4.4]} target={[0, 0.8, 0]}><HandView /></GalleryCanvas>;
  if (view === "closeup") {
    const id = (params.get("item") ?? "pen") as ItemId;
    return <GalleryCanvas camera={[0, 0.9, 1.5]} target={[0, 0.05, 0]} fov={35}><CloseupView id={id} /></GalleryCanvas>;
  }
  return <GalleryCanvas camera={[0, 2.9, 3.2]} target={[0, 0.15, 0.1]}><ItemsView /></GalleryCanvas>;
}
