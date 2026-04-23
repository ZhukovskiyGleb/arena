import Phaser from 'phaser';
import type { HexCoord } from '../utils/hexMath';
import { hexToPixel, pixelToHex, hexDistance } from '../utils/hexMath';

const CENTER: HexCoord = { q: 0, r: 0, s: 0 };
const C = {
  base:   0x1a1a2e,
  border: 0x2d2d5e,
  move:   0x3498db,
  attack: 0xe74c3c,
  hover:  0xf1c40f,
};

export class HexGrid {
  readonly scene: Phaser.Scene;
  readonly cx: number;
  readonly cy: number;
  readonly hexSize: number;
  readonly fieldRadius: number;

  private gfx: Phaser.GameObjects.Graphics;
  private moveSet  = new Set<string>();
  private attackSet = new Set<string>();
  private hoverKey: string | null = null;

  onHexClick?: (hex: HexCoord) => void;
  onHexHover?: (hex: HexCoord | null) => void;

  constructor(
    scene: Phaser.Scene,
    cx: number, cy: number,
    fieldRadius: number,
    hexSize: number,
  ) {
    this.scene = scene;
    this.cx = cx;
    this.cy = cy;
    this.fieldRadius = fieldRadius;
    this.hexSize = hexSize;

    this.gfx = scene.add.graphics();

    scene.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      const lx = p.x - cx;
      const ly = p.y - cy;
      const hex = pixelToHex(lx, ly, hexSize);
      if (hexDistance(CENTER, hex) <= fieldRadius) {
        const key = hk(hex);
        if (this.hoverKey !== key) {
          this.hoverKey = key;
          this.redraw();
          this.onHexHover?.(hex);
        }
      } else if (this.hoverKey !== null) {
        this.hoverKey = null;
        this.redraw();
        this.onHexHover?.(null);
      }
    });

    scene.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      const lx = p.x - cx;
      const ly = p.y - cy;
      const hex = pixelToHex(lx, ly, hexSize);
      if (hexDistance(CENTER, hex) <= fieldRadius) {
        this.onHexClick?.(hex);
      }
    });

    this.redraw();
  }

  setMoveHighlights(hexes: HexCoord[]): void {
    this.moveSet = new Set(hexes.map(hk));
    this.redraw();
  }

  setAttackHighlights(hexes: HexCoord[]): void {
    this.attackSet = new Set(hexes.map(hk));
    this.redraw();
  }

  clearHighlights(): void {
    this.moveSet.clear();
    this.attackSet.clear();
    this.redraw();
  }

  hexToWorld(h: HexCoord): { x: number; y: number } {
    const p = hexToPixel(h, this.hexSize);
    return { x: this.cx + p.x, y: this.cy + p.y };
  }

  private redraw(): void {
    this.gfx.clear();
    for (let r = -this.fieldRadius; r <= this.fieldRadius; r++) {
      for (let q = -this.fieldRadius; q <= this.fieldRadius; q++) {
        const s = -q - r;
        const h: HexCoord = { q, r, s };
        if (hexDistance(CENTER, h) <= this.fieldRadius) this.drawHex(h);
      }
    }
  }

  private drawHex(h: HexCoord): void {
    const { x, y } = hexToPixel(h, this.hexSize);
    const wx = this.cx + x;
    const wy = this.cy + y;
    const key = hk(h);
    const isHover  = this.hoverKey === key;
    const isMove   = this.moveSet.has(key);
    const isAttack = this.attackSet.has(key);

    const pts = hexCorners(wx, wy, this.hexSize);

    let fillColor = C.base;
    let fillAlpha = 1;
    if (isAttack) { fillColor = C.attack; fillAlpha = 0.3; }
    else if (isMove) { fillColor = C.move; fillAlpha = 0.3; }
    if (isHover)  { fillColor = C.hover;  fillAlpha = 0.45; }

    this.gfx.fillStyle(fillColor, fillAlpha);
    this.gfx.beginPath();
    this.gfx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < 6; i++) this.gfx.lineTo(pts[i].x, pts[i].y);
    this.gfx.closePath();
    this.gfx.fillPath();

    this.gfx.lineStyle(1, C.border, 0.7);
    this.gfx.beginPath();
    this.gfx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < 6; i++) this.gfx.lineTo(pts[i].x, pts[i].y);
    this.gfx.closePath();
    this.gfx.strokePath();
  }

  destroy(): void {
    this.gfx.destroy();
  }
}

function hk(h: HexCoord): string {
  return `${h.q},${h.r},${h.s}`;
}

function hexCorners(cx: number, cy: number, size: number): Array<{ x: number; y: number }> {
  const pts = [];
  for (let i = 0; i < 6; i++) {
    const angle = (Math.PI / 3) * i - Math.PI / 6; // pointy-top: offset -30°
    pts.push({ x: cx + size * Math.cos(angle), y: cy + size * Math.sin(angle) });
  }
  return pts;
}

