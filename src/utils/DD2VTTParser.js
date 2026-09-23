/**
 * DD2VTTParser - Universal VTT (.dd2vtt) Parser for Phaser 3
 *
 * Parses Dungeon Alchemist & Universal VTT format files:
 * - Resolution & world dimension scaling
 * - Line of Sight (solid walls & obstacles)
 * - Portals (doors, windows, closed/open states)
 * - Coordinate transformations from grid units to scaled world pixels
 */

export default class DD2VTTParser {
  /**
   * @param {object} vttData Parsed JSON object from a .dd2vtt file
   * @param {number} scale Game world scale factor (default: 0.42)
   */
  constructor(vttData, scale = 0.42) {
    if (!vttData) {
      throw new Error('DD2VTTParser: vttData is required');
    }
    this.vtt = vttData;
    this.scale = scale;

    const res = vttData.resolution || {};
    this.ppg = res.pixels_per_grid || 150;
    this.mapSizeX = (res.map_size && res.map_size.x) || 40;
    this.mapSizeY = (res.map_size && res.map_size.y) || 30;

    this.nativeWidth = this.mapSizeX * this.ppg;
    this.nativeHeight = this.mapSizeY * this.ppg;
    this.worldWidth = Math.round(this.nativeWidth * this.scale);
    this.worldHeight = Math.round(this.nativeHeight * this.scale);
  }

  /**
   * Convert grid X to scaled world X in pixels
   */
  toWorldX(gridX) {
    return Math.round(gridX * this.ppg * this.scale);
  }

  /**
   * Convert grid Y to scaled world Y in pixels
   */
  toWorldY(gridY) {
    return Math.round(gridY * this.ppg * this.scale);
  }

  /**
   * Convert a grid coordinate point {x, y} to world pixel coordinates
   */
  toWorldPoint(pt) {
    if (!pt) return { x: 0, y: 0 };
    return {
      x: this.toWorldX(pt.x),
      y: this.toWorldY(pt.y),
    };
  }

  /**
   * Parse line_of_sight into array of wall segments in world coordinates
   * @returns {Array<{ x1: number, y1: number, x2: number, y2: number }>}
   */
  getWalls() {
    const walls = [];
    if (!Array.isArray(this.vtt.line_of_sight)) return walls;

    this.vtt.line_of_sight.forEach(seg => {
      if (Array.isArray(seg) && seg.length >= 2) {
        walls.push({
          x1: this.toWorldX(seg[0].x),
          y1: this.toWorldY(seg[0].y),
          x2: this.toWorldX(seg[1].x),
          y2: this.toWorldY(seg[1].y),
        });
      }
    });

    return walls;
  }

  /**
   * Extract all portals (doors and windows) with parsed world coordinates
   * @returns {Array<object>}
   */
  getPortals() {
    if (!Array.isArray(this.vtt.portals)) return [];

    return this.vtt.portals.map((p, index) => {
      const worldPos = p.position ? this.toWorldPoint(p.position) : { x: 0, y: 0 };
      const worldBounds = (Array.isArray(p.bounds) && p.bounds.length >= 2)
        ? [this.toWorldPoint(p.bounds[0]), this.toWorldPoint(p.bounds[1])]
        : null;

      const isDoor = p.closed === true;
      const isWindow = p.closed === false;

      return {
        id: `portal_${index}`,
        index,
        isDoor,
        isWindow,
        closed: p.closed,
        gridPos: p.position ? { ...p.position } : null,
        worldX: worldPos.x,
        worldY: worldPos.y,
        bounds: worldBounds,
        rotation: p.rotation || 0,
        raw: p,
      };
    });
  }

  /**
   * Get all portals classified as doors (closed: true)
   */
  getDoors() {
    return this.getPortals().filter(p => p.isDoor);
  }

  /**
   * Get all portals classified as windows (closed: false)
   */
  getWindows() {
    return this.getPortals().filter(p => p.isWindow);
  }

  /**
   * Finds the door portal furthest to the left (lowest X coordinate in grid/world space).
   * Automatically combines adjacent door leaves if they form a double door.
   *
   * @returns {object|null} Structured door object with worldX, worldY, bounds, id, etc.
   */
  getLeftmostDoor() {
    const doors = this.getDoors();
    if (doors.length === 0) return null;

    // Sort ascending by worldX
    doors.sort((a, b) => a.worldX - b.worldX);
    const leftmost = doors[0];

    // Check if an adjacent door leaf exists nearby (e.g. double doors in SoulsChapel portal_17 & 18)
    const twinDoor = doors.slice(1).find(d =>
      Math.abs(d.worldX - leftmost.worldX) <= 25 &&
      Math.abs(d.worldY - leftmost.worldY) <= 80
    );

    if (twinDoor && leftmost.bounds && twinDoor.bounds) {
      const midY = Math.round((leftmost.worldY + twinDoor.worldY) / 2);
      const minX = Math.min(leftmost.bounds[0].x, leftmost.bounds[1].x, twinDoor.bounds[0].x, twinDoor.bounds[1].x);
      const maxX = Math.max(leftmost.bounds[0].x, leftmost.bounds[1].x, twinDoor.bounds[0].x, twinDoor.bounds[1].x);
      const minY = Math.min(leftmost.bounds[0].y, leftmost.bounds[1].y, twinDoor.bounds[0].y, twinDoor.bounds[1].y);
      const maxY = Math.max(leftmost.bounds[0].y, leftmost.bounds[1].y, twinDoor.bounds[0].y, twinDoor.bounds[1].y);

      return {
        id: `${leftmost.id}_combined`,
        primaryPortal: leftmost,
        twinPortal: twinDoor,
        indices: [leftmost.index, twinDoor.index],
        isDoor: true,
        isDoubleDoor: true,
        worldX: leftmost.worldX,
        worldY: midY,
        bounds: [
          { x: minX, y: minY },
          { x: maxX, y: maxY },
        ],
      };
    }

    return leftmost;
  }

  /**
   * Find a specific door by index
   */
  getDoorByIndex(index) {
    const portals = this.getPortals();
    return portals.find(p => p.index === index) || null;
  }

  /**
   * Find a door closest to a given world coordinate
   */
  getDoorNear(worldX, worldY, maxDist = 120) {
    const doors = this.getDoors();
    let best = null;
    let minDist = Infinity;

    doors.forEach(d => {
      const dist = Math.hypot(d.worldX - worldX, d.worldY - worldY);
      if (dist < minDist && dist <= maxDist) {
        minDist = dist;
        best = d;
      }
    });

    return best;
  }
}
