import { Suspense } from "react";
import { HomeScreen } from "@/components/screens/HomeScreen";
import { ScreenLoading } from "@/components/ui/ScreenLoading";

export default function HomePage() {
  return (
    <Suspense fallback={<ScreenLoading />}>
      <HomeScreen />
    </Suspense>
  );
}
