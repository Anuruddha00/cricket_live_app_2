import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App.jsx";
import "./styles.css";

document.body.className = location.pathname.startsWith("/overlay") ? "ov" : "app";
createRoot(document.getElementById("root")).render(<App />);
