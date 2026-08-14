import { createRoot } from "react-dom/client";
import App from "./App";
import AgriWalkthrough from "./AgriWalkthrough";
import "@fortawesome/fontawesome-free/css/all.min.css";
import "./index.css";
import "./print.css";

const pathname = window.location.pathname.replace(/\/+$/, "") || "/";
const rootView = pathname === "/p" ? <AgriWalkthrough /> : <App />;

createRoot(document.getElementById("root")!).render(rootView);
