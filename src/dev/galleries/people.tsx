import { useEffect, useMemo } from "react";
import * as THREE from "three";
import { speakerName } from "../../game/content/cast";
import type { CharacterId } from "../../game/content/ids";
import { blobShadow } from "../../scene/materials";
import { KiwiRig } from "../../scene/models/kiwi";
import { ALL_LOOK_IDS, buildCharacter, type CharacterRig, type Expression, type RigGesture, type RigState } from "../../scene/models/people";
import { props } from "../../scene/models/props";
import { textSprite } from "../../scene/textSprite";
import { Portrait } from "../../ui/icons/Portrait";
import { GalleryCanvas, Ticker } from "../GalleryCanvas";
import { markGalleryReady } from "../ready";

const params = new URLSearchParams(location.search);
const view = params.get("view") ?? "lineup";

function withShadow(group: THREE.Group, rig: CharacterRig) {
  const sh = blobShadow(rig.radius * 1.2);
  sh.position.copy(rig.group.position);
  group.add(sh);
}

function Lineup() {
  const { group, rigs } = useMemo(() => {
    const group = new THREE.Group();
    const rigs: CharacterRig[] = [];
    ALL_LOOK_IDS.forEach((id, i) => {
      const rig = buildCharacter(id);
      const row = i < 10 ? 0 : 1;
      const col = i % 10;
      rig.group.position.set((col - 4.5) * 0.85, 0, row === 0 ? -0.9 : 0.6);
      group.add(rig.group);
      withShadow(group, rig);
      const label = textSprite(speakerName(id as CharacterId).en, { height: 0.13, background: "rgba(255,255,255,0.85)" });
      label.position.set(rig.group.position.x, rig.height + 0.15, rig.group.position.z);
      group.add(label);
      rigs.push(rig);
    });
    return { group, rigs };
  }, []);
  return (
    <>
      <primitive object={group} />
      <Ticker fn={(dt) => rigs.forEach((r) => r.update(dt))} />
    </>
  );
}

const STATES: (RigState | RigGesture)[] = ["idle", "walk", "run", "talk", "nod", "shake", "cheer", "give", "show", "sad", "think", "sit"];

function States() {
  const { group, rigs } = useMemo(() => {
    const group = new THREE.Group();
    const who = ["player", "ume", "bo", "yuki", "max", "aya"] as const;
    const rigs: { rig: CharacterRig; state: RigState | RigGesture }[] = [];
    STATES.forEach((state, i) => {
      const rig = buildCharacter(who[i % who.length]);
      rig.group.position.set((i % 6 - 2.5) * 1.05, 0, Math.floor(i / 6) * 1.5 - 0.7);
      if (state === "show" || state === "give") rig.hold("notebook");
      if (state === "sit") {
        const bench = props.bench();
        bench.position.copy(rig.group.position).add(new THREE.Vector3(0, 0, -0.12));
        group.add(bench);
        rig.group.position.y = 0.42 - 0.48;
      }
      group.add(rig.group);
      withShadow(group, rig);
      const label = textSprite(state, { height: 0.13, background: "rgba(255,255,255,0.85)" });
      label.position.set(rig.group.position.x, 1.85, rig.group.position.z);
      group.add(label);
      rigs.push({ rig, state });
    });
    return { group, rigs };
  }, []);
  return (
    <>
      <primitive object={group} />
      <Ticker
        fn={(dt) =>
          rigs.forEach(({ rig, state }) => {
            if (state === "walk" || state === "run") rig.setWalkSpeed(state === "run" ? 4 : 2);
            if (["nod", "shake", "cheer", "give", "show"].includes(state)) {
              if (!rig.gesturing) rig.setState(state);
            } else if (rig.state !== state) rig.setState(state);
            rig.update(dt);
          })
        }
      />
    </>
  );
}

const EXPRS: Expression[] = ["neutral", "happy", "sad", "surprised"];

function Faces() {
  const { group, rigs } = useMemo(() => {
    const group = new THREE.Group();
    const who = ["player", "lily", "pom", "emma"] as const;
    const rigs: CharacterRig[] = [];
    who.forEach((id, row) => {
      EXPRS.forEach((e, col) => {
        const rig = buildCharacter(id);
        rig.setExpression(e);
        rig.group.position.set((col - 1.5) * 0.62, -row * 0.0, -row * 1.1);
        group.add(rig.group);
        rigs.push(rig);
      });
    });
    return { group, rigs };
  }, []);
  return (
    <>
      <primitive object={group} />
      <Ticker fn={(dt) => rigs.forEach((r) => r.update(dt))} />
    </>
  );
}

function KiwiView() {
  const { group, update } = useMemo(() => {
    const group = new THREE.Group();
    const player = buildCharacter("player");
    group.add(player.group);
    withShadow(group, player);
    const perched = new KiwiRig();
    perched.setState("perch");
    player.shoulder.add(perched.group);
    const flying = new KiwiRig();
    flying.setState("fly");
    flying.group.position.set(1.0, 1.3, 0.2);
    flying.group.scale.setScalar(1.6);
    group.add(flying.group);
    const hover = new KiwiRig();
    hover.setState("hover");
    hover.group.position.set(-1.0, 1.0, 0.3);
    hover.group.scale.setScalar(1.6);
    group.add(hover.group);
    return {
      group,
      update: (dt: number, t: number) => {
        player.update(dt);
        perched.update(dt);
        flying.update(dt);
        hover.update(dt);
        flying.group.position.y = 1.3 + Math.sin(t * 2) * 0.08;
      }
    };
  }, []);
  return (
    <>
      <primitive object={group} />
      <Ticker fn={update} />
    </>
  );
}

function Closeup({ id }: { id: CharacterId }) {
  const { group, rig } = useMemo(() => {
    const group = new THREE.Group();
    const rig = buildCharacter(id as Exclude<CharacterId, "kiwi">);
    group.add(rig.group);
    withShadow(group, rig);
    return { group, rig };
  }, [id]);
  return (
    <>
      <primitive object={group} />
      <Ticker fn={(dt) => rig.update(dt)} />
    </>
  );
}

function PortraitSheet() {
  useEffect(() => {
    const t = setTimeout(markGalleryReady, 2500);
    return () => clearTimeout(t);
  }, []);
  const ids = [...ALL_LOOK_IDS, "kiwi", "seaChest"] as const;
  return (
    <main style={{ padding: 20, background: "#fffaf0", height: "100%", overflow: "auto", fontFamily: "var(--font)" }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(11, 1fr)", gap: 10 }}>
        {ids.map((id) => (
          <div key={id} style={{ textAlign: "center" }}>
            <Portrait id={id} size={96} />
            <div style={{ fontWeight: 700, fontSize: 14 }}>{id === "seaChest" ? "Sea chest" : speakerName(id).en}</div>
          </div>
        ))}
        {(["neutral", "happy", "sad", "surprised"] as const).map((m) => (
          <div key={m} style={{ textAlign: "center" }}>
            <Portrait id="ken" size={96} mood={m} />
            <div style={{ fontSize: 14 }}>{m}</div>
          </div>
        ))}
      </div>
    </main>
  );
}

export default function PeopleGallery() {
  if (view === "portraits") return <PortraitSheet />;
  if (view === "states") return <GalleryCanvas camera={[0, 2.4, 6.0]} target={[0, 0.8, 0]}><States /></GalleryCanvas>;
  if (view === "faces") return <GalleryCanvas camera={[0, 1.15, 1.9]} target={[0, 1.0, -1.2]} fov={38}><Faces /></GalleryCanvas>;
  if (view === "kiwi") return <GalleryCanvas camera={[0.6, 1.5, 3.0]} target={[0, 1.0, 0]}><KiwiView /></GalleryCanvas>;
  if (view === "closeup") return <GalleryCanvas camera={[0.5, 1.3, 2.4]} target={[0, 0.8, 0]}><Closeup id={(params.get("id") ?? "player") as CharacterId} /></GalleryCanvas>;
  return <GalleryCanvas camera={[0, 2.2, 7.0]} target={[0, 0.7, -0.2]}><Lineup /></GalleryCanvas>;
}
