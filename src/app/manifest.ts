import type { MetadataRoute } from "next";

// Name, colours and icons used when Reload is saved to a phone's home screen.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Reload | ريلود",
    short_name: "Reload",
    description:
      "الإرجاع وخدمة العملاء عبر واتساب للمتاجر الإلكترونية. Returns and customer support on WhatsApp.",
    lang: "ar",
    dir: "rtl",
    start_url: "/ar",
    display: "standalone",
    background_color: "#f8f7f4",
    theme_color: "#f8f7f4",
    icons: [
      { src: "/brand/reload-icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/brand/reload-icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/brand/reload-icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
