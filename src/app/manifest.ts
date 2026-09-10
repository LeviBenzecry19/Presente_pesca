import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "Pesca — planeje e registre suas pescarias",
    short_name: "Pesca",
    description: "Planejamento com clima e previsão de pesca, sessão ativa e registro de capturas, funcionando offline.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    lang: "pt-BR",
    background_color: "#f1f5f9",
    theme_color: "#0a6b95",
    categories: ["sports", "lifestyle", "utilities"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      {
        name: "Registrar captura",
        short_name: "Captura",
        url: "/?acao=captura",
        icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }],
      },
      {
        name: "Planejar pescaria",
        short_name: "Planejar",
        url: "/planejar",
        icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }],
      },
    ],
  };
}
