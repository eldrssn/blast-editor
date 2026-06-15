import React from "react";
import { randomInt } from "node:crypto";
import { DEFAULT_LEVELS } from "@/entities/game/config/defaultLevels";
import HomeGameScreen from "@/widgets/home-game/ui/HomeGameScreen";

export const metadata = {
  title: "Block Blast Core",
  description: "Play the game with a random level and open level settings on demand.",
};

export const dynamic = "force-dynamic";

export default function Home() {
  const initialLevel = DEFAULT_LEVELS[randomInt(DEFAULT_LEVELS.length)] ?? DEFAULT_LEVELS[0];

  return <HomeGameScreen initialLevel={initialLevel} />;
}
