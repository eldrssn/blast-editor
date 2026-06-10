import { FigureShape } from "../model/types";

export const FIGURE_SHAPES: FigureShape[] = [
  {
    id: "1",
    cells: [{ row: 0, col: 0 }]
  },
  {
    id: "2",
    cells: [
      { row: 0, col: 0 },
      { row: 0, col: 1 }
    ]
  },
  {
    id: "3",
    cells: [
      { row: 0, col: 0 },
      { row: 1, col: 0 }
    ]
  },
  {
    id: "4",
    cells: [
      { row: 0, col: 0 },
      { row: 0, col: 1 },
      { row: 0, col: 2 }
    ]
  },
  {
    id: "5",
    cells: [
      { row: 0, col: 0 },
      { row: 1, col: 0 },
      { row: 2, col: 0 }
    ]
  },
  {
    id: "6",
    cells: [
      { row: 0, col: 0 },
      { row: 1, col: 0 },
      { row: 1, col: 1 }
    ]
  },
  {
    id: "7",
    cells: [
      { row: 0, col: 0 },
      { row: 0, col: 1 },
      { row: 1, col: 0 },
      { row: 1, col: 1 }
    ]
  },
  {
    id: "8",
    cells: [
      { row: 0, col: 0 },
      { row: 0, col: 1 },
      { row: 0, col: 2 },
      { row: 0, col: 3 }
    ]
  },
  {
    id: "9",
    cells: [
      { row: 0, col: 0 },
      { row: 1, col: 0 },
      { row: 2, col: 0 },
      { row: 3, col: 0 }
    ]
  },
  {
    id: "10",
    cells: [
      { row: 0, col: 0 },
      { row: 0, col: 1 },
      { row: 0, col: 2 },
      { row: 1, col: 1 }
    ]
  },
  {
    id: "11",
    cells: [
      { row: 0, col: 0 },
      { row: 1, col: 0 },
      { row: 2, col: 0 },
      { row: 2, col: 1 }
    ]
  },
  {
    id: "12",
    cells: [
      { row: 0, col: 1 },
      { row: 1, col: 1 },
      { row: 2, col: 0 },
      { row: 2, col: 1 }
    ]
  },
  {
    id: "13",
    cells: [
      { row: 0, col: 1 },
      { row: 0, col: 2 },
      { row: 1, col: 0 },
      { row: 1, col: 1 }
    ]
  },
  {
    id: "14",
    cells: [
      { row: 0, col: 0 },
      { row: 0, col: 1 },
      { row: 1, col: 1 },
      { row: 1, col: 2 }
    ]
  },
  {
    id: "15",
    cells: [
      { row: 0, col: 0 },
      { row: 0, col: 1 },
      { row: 0, col: 2 },
      { row: 1, col: 0 },
      { row: 1, col: 1 },
      { row: 1, col: 2 }
    ]
  }
];

export const DEFAULT_FIGURE_WEIGHTS: Record<string, number> = {
  "1": 16,
  "2": 10,
  "3": 10,
  "4": 8,
  "5": 8,
  "6": 6,
  "7": 9,
  "8": 4,
  "9": 4,
  "10": 6,
  "11": 5,
  "12": 5,
  "13": 4,
  "14": 4,
  "15": 1
};
