import { v4 as uuidv4 } from 'uuid';
import type { AlignmentData, Transform, Vector3, Matrix4 } from '../types';

export interface QRCodeData {
  roomId: string;
  timestamp: number;
  nonce: string;
}

export interface AlignmentTransform {
  rotation: Matrix4;
  translation: Vector3;
  scale: Vector3;
  confidence: number;
}

export class QRCodeManager {
  private static readonly QR_SIZE = 256;
  private static readonly ERROR_CORRECTION = 'H' as const;

  static generateQRCode(roomId: string): string {
    const data: QRCodeData = {
      roomId,
      timestamp: Date.now(),
      nonce: uuidv4(),
    };

    const payload = JSON.stringify(data);
    const encoded = btoa(payload);

    const svg = this.createQRSVG(encoded);
    return `data:image/svg+xml;base64,${btoa(svg)}`;
  }

  private static createQRSVG(data: string): string {
    const size = this.QR_SIZE;
    const modules = 21;
    const moduleSize = size / modules;

    const matrix = this.generateQRMatrix(data, modules);

    let rects = '';
    for (let row = 0; row < modules; row++) {
      for (let col = 0; col < modules; col++) {
        if (matrix[row][col]) {
          rects += `<rect x="${col * moduleSize}" y="${row * moduleSize}" width="${moduleSize}" height="${moduleSize}" fill="#000"/>`;
        }
      }
    }

    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}">
      <rect width="${size}" height="${size}" fill="#fff"/>
      ${rects}
    </svg>`;
  }

  private static generateQRMatrix(
    data: string,
    size: number
  ): boolean[][] {
    const matrix: boolean[][] = Array.from({ length: size }, () =>
      Array(size).fill(false)
    );

    this.addFinderPattern(matrix, 0, 0);
    this.addFinderPattern(matrix, size - 7, 0);
    this.addFinderPattern(matrix, 0, size - 7);

    this.addDataPattern(matrix, data, size);

    return matrix;
  }

  private static addFinderPattern(
    matrix: boolean[][],
    row: number,
    col: number
  ): void {
    const pattern = [
      [1, 1, 1, 1, 1, 1, 1],
      [1, 0, 0, 0, 0, 0, 1],
      [1, 0, 1, 1, 1, 0, 1],
      [1, 0, 1, 1, 1, 0, 1],
      [1, 0, 1, 1, 1, 0, 1],
      [1, 0, 0, 0, 0, 0, 1],
      [1, 1, 1, 1, 1, 1, 1],
    ];

    for (let r = 0; r < 7; r++) {
      for (let c = 0; c < 7; c++) {
        const mr = row + r;
        const mc = col + c;
        if (mr >= 0 && mr < matrix.length && mc >= 0 && mc < matrix[0].length) {
          matrix[mr][mc] = pattern[r][c] === 1;
        }
      }
    }
  }

  private static addDataPattern(
    matrix: boolean[][],
    data: string,
    size: number
  ): void {
    const bits = this.dataToBits(data);
    let bitIndex = 0;

    for (let col = size - 1; col >= 0; col -= 2) {
      if (col === 6) col--;
      for (let row = 0; row < size; row++) {
        for (let c = 0; c < 2; c++) {
          const currentCol = col - c;
          if (currentCol < 0 || currentCol >= size) continue;

          if (this.isReservedArea(row, currentCol, size)) continue;

          if (bitIndex < bits.length) {
            matrix[row][currentCol] = bits[bitIndex] === 1;
            bitIndex++;
          }
        }
      }
    }
  }

  private static isReservedArea(row: number, col: number, size: number): boolean {
    if (row < 9 && col < 9) return true;
    if (row < 9 && col >= size - 8) return true;
    if (row >= size - 8 && col < 9) return true;
    if (row === 6 || col === 6) return true;
    return false;
  }

  private static dataToBits(data: string): number[] {
    const bits: number[] = [];
    for (let i = 0; i < data.length; i++) {
      const charCode = data.charCodeAt(i);
      for (let bit = 7; bit >= 0; bit--) {
        bits.push((charCode >> bit) & 1);
      }
    }
    return bits;
  }

  static decodeQRCode(imageData: ImageData | string): QRCodeData | null {
    if (typeof imageData === 'string') {
      try {
        const decoded = atob(imageData);
        const data = JSON.parse(decoded) as QRCodeData;
        if (data.roomId && data.timestamp && data.nonce) {
          return data;
        }
      } catch {
        return null;
      }
    }
    return null;
  }

  static validateQRCode(data: QRCodeData, maxAgeMs: number = 300000): boolean {
    if (!data.roomId || !data.nonce) return false;
    const age = Date.now() - data.timestamp;
    return age <= maxAgeMs;
  }
}

export class CoordinateSystem {
  static calculateAlignmentTransform(
    originUser: {
      position: Vector3;
      rotation: Vector3;
      cameraMatrix?: Matrix4;
    },
    scanningUser: {
      position: Vector3;
      rotation: Vector3;
      cameraMatrix?: Matrix4;
      qrPosition?: Vector3;
    }
  ): AlignmentTransform {
    const positionDiff: Vector3 = {
      x: originUser.position.x - scanningUser.position.x,
      y: originUser.position.y - scanningUser.position.y,
      z: originUser.position.z - scanningUser.position.z,
    };

    const rotationDiff: Vector3 = {
      x: originUser.rotation.x - scanningUser.rotation.x,
      y: originUser.rotation.y - scanningUser.rotation.y,
      z: originUser.rotation.z - scanningUser.rotation.z,
    };

    const distance = Math.sqrt(
      positionDiff.x ** 2 +
        positionDiff.y ** 2 +
        positionDiff.z ** 2
    );

    const confidence = Math.max(0, 1 - distance / 10);

    const translationMatrix = this.createTranslationMatrix(positionDiff);
    const rotationMatrix = this.createRotationMatrix(rotationDiff);

    const combinedMatrix = this.multiplyMatrices(
      translationMatrix,
      rotationMatrix
    );

    return {
      rotation: rotationMatrix,
      translation: positionDiff,
      scale: { x: 1, y: 1, z: 1 },
      confidence,
    };
  }

  static alignToSharedOrigin(
    localPosition: Vector3,
    alignmentData: AlignmentTransform
  ): Vector3 {
    const { translation, rotation, scale } = alignmentData;

    const scaled: Vector3 = {
      x: localPosition.x * scale.x,
      y: localPosition.y * scale.y,
      z: localPosition.z * scale.z,
    };

    const rotated = this.rotateVector(scaled, rotation);

    return {
      x: rotated.x + translation.x,
      y: rotated.y + translation.y,
      z: rotated.z + translation.z,
    };
  }

  static transformBetweenSpaces(
    position: Vector3,
    fromTransform: AlignmentTransform,
    toTransform: AlignmentTransform
  ): Vector3 {
    const tempPos = this.alignToSharedOrigin(
      position,
      fromTransform
    );

    const inverseTo: AlignmentTransform = {
      rotation: this.invertMatrix(toTransform.rotation),
      translation: {
        x: -toTransform.translation.x,
        y: -toTransform.translation.y,
        z: -toTransform.translation.z,
      },
      scale: {
        x: 1 / toTransform.scale.x,
        y: 1 / toTransform.scale.y,
        z: 1 / toTransform.scale.z,
      },
      confidence: toTransform.confidence,
    };

    return this.alignToSharedOrigin(tempPos, inverseTo);
  }

  private static createTranslationMatrix(
    translation: Vector3
  ): Matrix4 {
    return {
      m11: 1,
      m12: 0,
      m13: 0,
      m14: translation.x,
      m21: 0,
      m22: 1,
      m23: 0,
      m24: translation.y,
      m31: 0,
      m32: 0,
      m33: 1,
      m34: translation.z,
      m41: 0,
      m42: 0,
      m43: 0,
      m44: 1,
    };
  }

  private static createRotationMatrix(rotation: Vector3): Matrix4 {
    const { x, y, z } = rotation;
    const cosX = Math.cos(x),
      sinX = Math.sin(x);
    const cosY = Math.cos(y),
      sinY = Math.sin(y);
    const cosZ = Math.cos(z),
      sinZ = Math.sin(z);

    return {
      m11: cosY * cosZ,
      m12: cosY * sinZ,
      m13: -sinY,
      m14: 0,
      m21: sinX * sinY * cosZ - cosX * sinZ,
      m22: sinX * sinY * sinZ + cosX * cosZ,
      m23: sinX * cosY,
      m24: 0,
      m31: cosX * sinY * cosZ + sinX * sinZ,
      m32: cosX * sinY * sinZ - sinX * cosZ,
      m33: cosX * cosY,
      m34: 0,
      m41: 0,
      m42: 0,
      m43: 0,
      m44: 1,
    };
  }

  private static multiplyMatrices(a: Matrix4, b: Matrix4): Matrix4 {
    return {
      m11:
        a.m11 * b.m11 + a.m12 * b.m21 + a.m13 * b.m31 + a.m14 * b.m41,
      m12:
        a.m11 * b.m12 + a.m12 * b.m22 + a.m13 * b.m32 + a.m14 * b.m42,
      m13:
        a.m11 * b.m13 + a.m12 * b.m23 + a.m13 * b.m33 + a.m14 * b.m43,
      m14:
        a.m11 * b.m14 + a.m12 * b.m24 + a.m13 * b.m34 + a.m14 * b.m44,
      m21:
        a.m21 * b.m11 + a.m22 * b.m21 + a.m23 * b.m31 + a.m24 * b.m41,
      m22:
        a.m21 * b.m12 + a.m22 * b.m22 + a.m23 * b.m32 + a.m24 * b.m42,
      m23:
        a.m21 * b.m13 + a.m22 * b.m23 + a.m23 * b.m33 + a.m24 * b.m43,
      m24:
        a.m21 * b.m14 + a.m22 * b.m24 + a.m23 * b.m34 + a.m24 * b.m44,
      m31:
        a.m31 * b.m11 + a.m32 * b.m21 + a.m33 * b.m31 + a.m34 * b.m41,
      m32:
        a.m31 * b.m12 + a.m32 * b.m22 + a.m33 * b.m32 + a.m34 * b.m42,
      m33:
        a.m31 * b.m13 + a.m32 * b.m23 + a.m33 * b.m33 + a.m34 * b.m43,
      m34:
        a.m31 * b.m14 + a.m32 * b.m24 + a.m33 * b.m34 + a.m34 * b.m44,
      m41:
        a.m41 * b.m11 + a.m42 * b.m21 + a.m43 * b.m31 + a.m44 * b.m41,
      m42:
        a.m41 * b.m12 + a.m42 * b.m22 + a.m43 * b.m32 + a.m44 * b.m42,
      m43:
        a.m41 * b.m13 + a.m42 * b.m23 + a.m43 * b.m33 + a.m44 * b.m43,
      m44:
        a.m41 * b.m14 + a.m42 * b.m24 + a.m43 * b.m34 + a.m44 * b.m44,
    };
  }

  private static invertMatrix(m: Matrix4): Matrix4 {
    const det =
      m.m11 *
        (m.m22 * m.m33 * m.m44 +
          m.m23 * m.m34 * m.m42 +
          m.m24 * m.m32 * m.m43 -
          m.m24 * m.m33 * m.m42 -
          m.m23 * m.m32 * m.m44 -
          m.m22 * m.m34 * m.m43) -
      m.m12 *
        (m.m21 * m.m33 * m.m44 +
          m.m23 * m.m34 * m.m41 +
          m.m24 * m.m31 * m.m43 -
          m.m24 * m.m33 * m.m41 -
          m.m23 * m.m31 * m.m44 -
          m.m21 * m.m34 * m.m43) +
      m.m13 *
        (m.m21 * m.m32 * m.m44 +
          m.m22 * m.m34 * m.m41 +
          m.m24 * m.m31 * m.m42 -
          m.m24 * m.m32 * m.m41 -
          m.m22 * m.m31 * m.m44 -
          m.m21 * m.m34 * m.m42) -
      m.m14 *
        (m.m21 * m.m32 * m.m43 +
          m.m22 * m.m33 * m.m41 +
          m.m23 * m.m31 * m.m42 -
          m.m23 * m.m32 * m.m41 -
          m.m22 * m.m31 * m.m43 -
          m.m21 * m.m33 * m.m42);

    if (Math.abs(det) < 1e-10) {
      return m;
    }

    const invDet = 1 / det;

    return {
      m11:
        (m.m22 * m.m33 * m.m44 +
          m.m23 * m.m34 * m.m42 +
          m.m24 * m.m32 * m.m43 -
          m.m24 * m.m33 * m.m42 -
          m.m23 * m.m32 * m.m44 -
          m.m22 * m.m34 * m.m43) *
        invDet,
      m12:
        -(m.m12 * m.m33 * m.m44 +
          m.m13 * m.m34 * m.m42 +
          m.m14 * m.m32 * m.m43 -
          m.m14 * m.m33 * m.m42 -
          m.m13 * m.m32 * m.m44 -
          m.m12 * m.m34 * m.m43) *
        invDet,
      m13:
        (m.m12 * m.m23 * m.m44 +
          m.m13 * m.m24 * m.m42 +
          m.m14 * m.m22 * m.m43 -
          m.m14 * m.m23 * m.m42 -
          m.m13 * m.m22 * m.m44 -
          m.m12 * m.m24 * m.m43) *
        invDet,
      m14:
        -(m.m12 * m.m23 * m.m34 +
          m.m13 * m.m24 * m.m32 +
          m.m14 * m.m22 * m.m33 -
          m.m14 * m.m23 * m.m32 -
          m.m13 * m.m22 * m.m34 -
          m.m12 * m.m24 * m.m33) *
        invDet,
      m21:
        -(m.m21 * m.m33 * m.m44 +
          m.m23 * m.m34 * m.m41 +
          m.m24 * m.m31 * m.m43 -
          m.m24 * m.m33 * m.m41 -
          m.m23 * m.m31 * m.m44 -
          m.m21 * m.m34 * m.m43) *
        invDet,
      m22:
        (m.m11 * m.m33 * m.m44 +
          m.m13 * m.m34 * m.m41 +
          m.m14 * m.m31 * m.m43 -
          m.m14 * m.m33 * m.m41 -
          m.m13 * m.m31 * m.m44 -
          m.m11 * m.m34 * m.m43) *
        invDet,
      m23:
        -(m.m11 * m.m23 * m.m44 +
          m.m13 * m.m24 * m.m41 +
          m.m14 * m.m21 * m.m43 -
          m.m14 * m.m23 * m.m41 -
          m.m13 * m.m21 * m.m44 -
          m.m11 * m.m24 * m.m43) *
        invDet,
      m24:
        (m.m11 * m.m23 * m.m34 +
          m.m13 * m.m24 * m.m31 +
          m.m14 * m.m21 * m.m33 -
          m.m14 * m.m23 * m.m31 -
          m.m13 * m.m21 * m.m34 -
          m.m11 * m.m24 * m.m33) *
        invDet,
      m31:
        (m.m21 * m.m32 * m.m44 +
          m.m22 * m.m34 * m.m41 +
          m.m24 * m.m31 * m.m42 -
          m.m24 * m.m32 * m.m41 -
          m.m22 * m.m31 * m.m44 -
          m.m21 * m.m34 * m.m42) *
        invDet,
      m32:
        -(m.m11 * m.m32 * m.m44 +
          m.m12 * m.m34 * m.m41 +
          m.m14 * m.m31 * m.m42 -
          m.m14 * m.m32 * m.m41 -
          m.m12 * m.m31 * m.m44 -
          m.m11 * m.m34 * m.m42) *
        invDet,
      m33:
        (m.m11 * m.m22 * m.m44 +
          m.m12 * m.m24 * m.m41 +
          m.m14 * m.m21 * m.m42 -
          m.m14 * m.m22 * m.m41 -
          m.m12 * m.m21 * m.m44 -
          m.m11 * m.m24 * m.m42) *
        invDet,
      m34:
        -(m.m11 * m.m22 * m.m34 +
          m.m12 * m.m24 * m.m31 +
          m.m14 * m.m21 * m.m32 -
          m.m14 * m.m22 * m.m31 -
          m.m12 * m.m21 * m.m34 -
          m.m11 * m.m24 * m.m32) *
        invDet,
      m41:
        -(m.m21 * m.m32 * m.m43 +
          m.m22 * m.m33 * m.m41 +
          m.m23 * m.m31 * m.m42 -
          m.m23 * m.m32 * m.m41 -
          m.m22 * m.m31 * m.m43 -
          m.m21 * m.m33 * m.m42) *
        invDet,
      m42:
        (m.m11 * m.m32 * m.m43 +
          m.m12 * m.m33 * m.m41 +
          m.m13 * m.m31 * m.m42 -
          m.m13 * m.m32 * m.m41 -
          m.m12 * m.m31 * m.m43 -
          m.m11 * m.m33 * m.m42) *
        invDet,
      m43:
        -(m.m11 * m.m22 * m.m43 +
          m.m12 * m.m23 * m.m41 +
          m.m13 * m.m21 * m.m42 -
          m.m13 * m.m22 * m.m41 -
          m.m12 * m.m21 * m.m43 -
          m.m11 * m.m23 * m.m42) *
        invDet,
      m44:
        (m.m11 * m.m22 * m.m33 +
          m.m12 * m.m23 * m.m31 +
          m.m13 * m.m21 * m.m32 -
          m.m13 * m.m22 * m.m31 -
          m.m12 * m.m21 * m.m33 -
          m.m11 * m.m23 * m.m32) *
        invDet,
    };
  }

  private static rotateVector(v: Vector3, m: Matrix4): Vector3 {
    return {
      x: m.m11 * v.x + m.m12 * v.y + m.m13 * v.z,
      y: m.m21 * v.x + m.m22 * v.y + m.m23 * v.z,
      z: m.m31 * v.x + m.m32 * v.y + m.m33 * v.z,
    };
  }

  static distance(a: Vector3, b: Vector3): number {
    return Math.sqrt(
      (a.x - b.x) ** 2 + (a.y - b.y) ** 2 + (a.z - b.z) ** 2
    );
  }

  static lerp(a: Vector3, b: Vector3, t: number): Vector3 {
    return {
      x: a.x + (b.x - a.x) * t,
      y: a.y + (b.y - a.y) * t,
      z: a.z + (b.z - a.z) * t,
    };
  }

  static slerp(a: Vector3, b: Vector3, t: number): Vector3 {
    const dot =
      a.x * b.x + a.y * b.y + a.z * b.z;
    const clampedDot = Math.max(-1, Math.min(1, dot));
    const theta = Math.acos(clampedDot);

    if (Math.abs(theta) < 1e-6) {
      return this.lerp(a, b, t);
    }

    const sinTheta = Math.sin(theta);
    const factorA = Math.sin((1 - t) * theta) / sinTheta;
    const factorB = Math.sin(t * theta) / sinTheta;

    return {
      x: factorA * a.x + factorB * b.x,
      y: factorA * a.y + factorB * b.y,
      z: factorA * a.z + factorB * b.z,
    };
  }
}

export function explainAlignmentStrategy(): string {
  return (
    'Spatial alignment uses a multi-step process: ' +
    '1) User A generates a QR code containing room ID and timestamp. ' +
    '2) User B scans the QR code, which establishes a shared reference point. ' +
    '3) The system calculates relative position and orientation differences between devices. ' +
    '4) A 4x4 transformation matrix aligns both users to a common coordinate origin. ' +
    '5) All subsequent object positions are transformed through this alignment, ' +
    'ensuring objects appear at consistent locations across devices. ' +
    'The alignment is continuously refined using device sensor data and ' +
    'supports re-alignment if confidence drops below threshold.'
  );
}
