import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { Gallery } from "./dev/Gallery";
import "./styles.css";

const params = new URLSearchParams(location.search);
// Review galleries exist only in development or an explicit e2e session.
const gallery = import.meta.env.DEV || params.get("e2e") === "1" ? params.get("gallery") : null;

createRoot(document.getElementById("root")!).render(
  <StrictMode>{gallery !== null ? <Gallery name={gallery} /> : <App />}</StrictMode>
);
