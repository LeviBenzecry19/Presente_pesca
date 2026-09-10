import type { Metadata } from "next";
import { AlbumScreen } from "@/components/screens/AlbumScreen";

export const metadata: Metadata = { title: "Meu álbum" };

export default function AlbumPage() {
  return <AlbumScreen />;
}
