import type { ExcalidrawElement } from "@excalidraw/excalidraw/element/types";

export type DiagramNode = {
  id: string;
  label: string;
  type?: "rectangle" | "diamond" | "ellipse" | "sticky";
};

export type DiagramEdge = {
  from: string;
  to: string;
  label?: string;
};

export type DiagramPayload = {
  nodes: DiagramNode[];
  edges: DiagramEdge[];
};

const NODE_WIDTH = 180;
const NODE_HEIGHT = 72;
const H_GAP = 80;
const V_GAP = 100;
const STICKY_COLORS = ["#fef08a", "#bbf7d0", "#bfdbfe", "#fbcfe8", "#ddd6fe"];

function randomSeed() {
  return Math.floor(Math.random() * 2 ** 31);
}

function layoutNodes(nodes: DiagramNode[]) {
  const cols = Math.max(2, Math.ceil(Math.sqrt(nodes.length)));
  const positions = new Map<string, { x: number; y: number }>();

  nodes.forEach((node, index) => {
    const row = Math.floor(index / cols);
    const col = index % cols;
    positions.set(node.id, {
      x: 120 + col * (NODE_WIDTH + H_GAP),
      y: 120 + row * (NODE_HEIGHT + V_GAP),
    });
  });

  return positions;
}

function baseElement(
  partial: Partial<ExcalidrawElement> & Pick<ExcalidrawElement, "id" | "type" | "x" | "y" | "width" | "height">
): ExcalidrawElement {
  const now = Date.now();
  return {
    angle: 0,
    backgroundColor: "transparent",
    boundElements: null,
    fillStyle: "solid",
    frameId: null,
    groupIds: [],
    isDeleted: false,
    link: null,
    locked: false,
    opacity: 100,
    roughness: 1,
    roundness: { type: 3 },
    seed: randomSeed(),
    strokeColor: "#1e1e1e",
    strokeStyle: "solid",
    strokeWidth: 2,
    updated: now,
    version: 1,
    versionNonce: randomSeed(),
    ...partial,
  } as ExcalidrawElement;
}

export function diagramToExcalidrawElements(payload: DiagramPayload): ExcalidrawElement[] {
  const { nodes, edges } = payload;
  if (!nodes.length) {
    return [];
  }

  const positions = layoutNodes(nodes);
  const shapeIds = new Map<string, string>();
  const elements: ExcalidrawElement[] = [];

  for (const [index, node] of nodes.entries()) {
    const pos = positions.get(node.id) ?? { x: 120, y: 120 };
    const shapeId = `ai-shape-${node.id}`;
    const textId = `ai-text-${node.id}`;
    shapeIds.set(node.id, shapeId);

    const nodeType = node.type ?? "rectangle";
    const isSticky = nodeType === "sticky";
    const shapeType =
      nodeType === "diamond" ? "diamond" : nodeType === "ellipse" ? "ellipse" : "rectangle";

    const bg = isSticky ? STICKY_COLORS[index % STICKY_COLORS.length] : "#a5d8ff";

    elements.push(
      baseElement({
        id: shapeId,
        type: shapeType,
        x: pos.x,
        y: pos.y,
        width: NODE_WIDTH,
        height: isSticky ? 100 : NODE_HEIGHT,
        backgroundColor: bg,
        roundness: isSticky ? { type: 3 } : { type: 3 },
        boundElements: [{ id: textId, type: "text" }],
      })
    );

    elements.push(
      baseElement({
        id: textId,
        type: "text",
        x: pos.x + 12,
        y: pos.y + (isSticky ? 16 : NODE_HEIGHT / 2 - 12),
        width: NODE_WIDTH - 24,
        height: 24,
        text: node.label,
        fontSize: 16,
        fontFamily: 1,
        textAlign: "center",
        verticalAlign: "middle",
        containerId: shapeId,
        originalText: node.label,
        lineHeight: 1.25 as ExcalidrawElement extends { lineHeight: infer L } ? L : never,
        autoResize: true,
      })
    );
  }

  for (const edge of edges) {
    const fromId = shapeIds.get(edge.from);
    const toId = shapeIds.get(edge.to);
    if (!fromId || !toId) {
      continue;
    }

    const arrowId = `ai-arrow-${edge.from}-${edge.to}`;
    elements.push(
      baseElement({
        id: arrowId,
        type: "arrow",
        x: 0,
        y: 0,
        width: 100,
        height: 0,
        points: [
          [0, 0],
          [100, 0],
        ],
        startBinding: { elementId: fromId, focus: 0, gap: 8 },
        endBinding: { elementId: toId, focus: 0, gap: 8 },
        startArrowhead: null,
        endArrowhead: "arrow",
      })
    );

    if (edge.label?.trim()) {
      elements.push(
        baseElement({
          id: `ai-edge-label-${edge.from}-${edge.to}`,
          type: "text",
          x: 0,
          y: 0,
          width: 80,
          height: 20,
          text: edge.label,
          fontSize: 14,
          fontFamily: 1,
          textAlign: "center",
          verticalAlign: "middle",
          originalText: edge.label,
          lineHeight: 1.25 as ExcalidrawElement extends { lineHeight: infer L } ? L : never,
        })
      );
    }
  }

  return elements;
}
