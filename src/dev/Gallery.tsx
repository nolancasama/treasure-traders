import { lazy, Suspense, type ComponentType } from "react";

/**
 * Review galleries: `?gallery=<name>` renders `src/dev/galleries/<name>.tsx`
 * (its default export). Discovered with import.meta.glob, so adding a gallery
 * never touches this file. A gallery calls `markGalleryReady()` once its
 * content is on screen; screenshot specs wait for that.
 */
const modules = import.meta.glob<{ default: ComponentType }>("./galleries/*.tsx");

const galleries: Record<string, ComponentType> = {};
for (const [path, load] of Object.entries(modules)) {
  const name = path.replace("./galleries/", "").replace(/\.tsx$/, "");
  galleries[name] = lazy(load);
}

export function Gallery({ name }: { name: string }) {
  const Selected = galleries[name];
  if (!Selected) {
    return (
      <main className="scaffold">
        <h1>Galleries</h1>
        <ul style={{ fontSize: 24, textAlign: "left" }}>
          {Object.keys(galleries).map((g) => (
            <li key={g}>
              <a href={`?gallery=${g}`}>{g}</a>
            </li>
          ))}
        </ul>
      </main>
    );
  }
  return (
    <Suspense fallback={null}>
      <Selected />
    </Suspense>
  );
}
