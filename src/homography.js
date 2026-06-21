const MATRIX_SIZE = 3;

export function computeHomography(srcPts, dstPts) {
  if (!Array.isArray(srcPts) || !Array.isArray(dstPts) || srcPts.length !== 4 || dstPts.length !== 4) {
    throw new Error("computeHomography requires four source and four destination points");
  }

  const a = [];
  const b = [];

  for (let index = 0; index < 4; index += 1) {
    const { x, y } = srcPts[index];
    const { x: X, y: Y } = dstPts[index];

    a.push([x, y, 1, 0, 0, 0, -X * x, -X * y]);
    b.push(X);
    a.push([0, 0, 0, x, y, 1, -Y * x, -Y * y]);
    b.push(Y);
  }

  const h = solveLinearSystem(a, b);
  return [...h, 1];
}

export function applyHomography(matrix, point) {
  assertHomography(matrix);
  const { x, y } = point;
  const denominator = matrix[6] * x + matrix[7] * y + matrix[8];
  if (Math.abs(denominator) < 1e-12) {
    throw new Error("Cannot project point with near-zero homogeneous denominator");
  }

  return {
    x: (matrix[0] * x + matrix[1] * y + matrix[2]) / denominator,
    y: (matrix[3] * x + matrix[4] * y + matrix[5]) / denominator,
  };
}

export function invertHomography(matrix) {
  assertHomography(matrix);

  const [
    a, b, c,
    d, e, f,
    g, h, i,
  ] = matrix;

  const determinant =
    a * (e * i - f * h) -
    b * (d * i - f * g) +
    c * (d * h - e * g);

  if (Math.abs(determinant) < 1e-12) {
    throw new Error("Homography matrix is singular");
  }

  const inverse = [
    e * i - f * h,
    c * h - b * i,
    b * f - c * e,
    f * g - d * i,
    a * i - c * g,
    c * d - a * f,
    d * h - e * g,
    b * g - a * h,
    a * e - b * d,
  ].map((value) => value / determinant);

  return inverse;
}

function assertHomography(matrix) {
  if (!Array.isArray(matrix) || matrix.length !== MATRIX_SIZE * MATRIX_SIZE) {
    throw new Error("Expected a 3x3 homography matrix represented by 9 numbers");
  }
}

function solveLinearSystem(a, b) {
  const n = b.length;
  const augmented = a.map((row, index) => [...row, b[index]]);

  for (let pivot = 0; pivot < n; pivot += 1) {
    let maxRow = pivot;
    for (let row = pivot + 1; row < n; row += 1) {
      if (Math.abs(augmented[row][pivot]) > Math.abs(augmented[maxRow][pivot])) {
        maxRow = row;
      }
    }

    if (Math.abs(augmented[maxRow][pivot]) < 1e-12) {
      throw new Error("Cannot solve singular calibration system");
    }

    [augmented[pivot], augmented[maxRow]] = [augmented[maxRow], augmented[pivot]];

    const pivotValue = augmented[pivot][pivot];
    for (let column = pivot; column <= n; column += 1) {
      augmented[pivot][column] /= pivotValue;
    }

    for (let row = 0; row < n; row += 1) {
      if (row === pivot) continue;
      const factor = augmented[row][pivot];
      for (let column = pivot; column <= n; column += 1) {
        augmented[row][column] -= factor * augmented[pivot][column];
      }
    }
  }

  return augmented.map((row) => row[n]);
}
