"use client";

import React from "react";
import { FIGURE_SHAPES } from "@/entities/game/config/figureShapes";

const SHAPE_BY_ID = new Map(FIGURE_SHAPES.map((s) => [s.id, s]));

type Props = {
  shapeId: string;
  /** Size of a single cell in pixels. */
  cellSize?: number;
  color?: string;
};

/**
 * Renders a small CSS-grid preview of a figure derived from its FIGURE_SHAPES
 * geometry, so editors see the actual shape instead of a bare id.
 */
export default function FigurePreview({ shapeId, cellSize = 12, color = "#3C70FF" }: Props) {
  const shape = SHAPE_BY_ID.get(shapeId);
  if (!shape) return null;

  const rows = Math.max(...shape.cells.map((c) => c.row)) + 1;
  const cols = Math.max(...shape.cells.map((c) => c.col)) + 1;
  const filled = new Set(shape.cells.map((c) => `${c.row}-${c.col}`));

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: `repeat(${cols}, ${cellSize}px)`,
        gridTemplateRows: `repeat(${rows}, ${cellSize}px)`,
        gap: 2,
      }}
    >
      {Array.from({ length: rows }).map((_, r) =>
        Array.from({ length: cols }).map((__, c) => {
          const isFilled = filled.has(`${r}-${c}`);
          return (
            <div
              key={`${r}-${c}`}
              style={{
                width: cellSize,
                height: cellSize,
                borderRadius: 3,
                background: isFilled ? color : "transparent",
              }}
            />
          );
        })
      )}
    </div>
  );
}
