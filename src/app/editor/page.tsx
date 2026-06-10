import React from "react";
import LevelEditor from "@/widgets/level-editor/ui/LevelEditor";

export const metadata = {
  title: "Block Blast Level Editor",
  description: "Create and test levels for the Block Blast Core game.",
};

export default function EditorPage() {
  return <LevelEditor />;
}
