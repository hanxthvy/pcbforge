// [xihanzu-NR]
// Shim untuk `import "math" as math` di sumber .hys.
//
// Hydra memetakan `import math` ke `import * as math from 'math'`, dan 'math' bukan
// modul Node. Seluruh mesin inti memakai Math bawaan JavaScript lewat shim ini, jadi
// sumber bisa menulis `math.sqrt` tanpa memikirkan asal-usulnya.
export default Math
export const sqrt = Math.sqrt
export const abs = Math.abs
export const min = Math.min
export const max = Math.max
export const round = Math.round
export const floor = Math.floor
export const ceil = Math.ceil
export const cos = Math.cos
export const sin = Math.sin
export const atan2 = Math.atan2
export const hypot = Math.hypot
export const PI = Math.PI
