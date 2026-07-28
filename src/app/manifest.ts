import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Pollinator Beekeeping",
    short_name: "Pollinator",
    description: "For all your apitherapy needs",
    start_url: "/",
    display: "standalone",
    background_color: "#fdf8ef",
    theme_color: "#f5c200",
    categories: ["business", "productivity"],
    orientation: "any",
    icons: [
      {
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-512-maskable.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
