import { createRoot } from "react-dom/client";
import Home from "../app/page";
import { FirstRunGuide } from "./first-run-guide";
import { InviteGate } from "./invite-gate";
import "../app/globals.css";
import "./first-run-guide.css";
import "./invite-gate.css";

const root = document.getElementById("root");

if (!root) {
  throw new Error("Missing application root element");
}

createRoot(root).render(
  <InviteGate>
    <FirstRunGuide>
      <Home />
    </FirstRunGuide>
  </InviteGate>,
);
