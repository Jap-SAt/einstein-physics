/* EField — pure electrostatics maths for the 3D field simulation.
 * Units: positions in scene units (1 unit = 1 cm = 0.01 m), charges in µC, outputs SI (N/C, V).
 * Works as a browser classic script (global EField) and in Node (module.exports). */
var EField = (function () {
  var K = 9.0e9;
  var R_MIN = 0.3;
  var UNIT_M = 0.01;   // metres per scene unit
  var UC = 1e-6;       // coulombs per µC
  var KQ = K * UC / (UNIT_M * UNIT_M); // N/C per (µC / unit^2)

  // Writes E (N/C) at (px,py,pz) into out[0..2]; returns |E|.
  function fieldInto(charges, px, py, pz, out) {
    var ex = 0, ey = 0, ez = 0;
    for (var i = 0; i < charges.length; i++) {
      var c = charges[i];
      var dx = px - c.x, dy = py - c.y, dz = pz - c.z;
      var r2 = dx * dx + dy * dy + dz * dz;
      var r = Math.sqrt(r2);
      if (r < R_MIN) {
        if (r < 1e-12) { dx = 1; dy = 0; dz = 0; r = 1; } // direction undefined exactly at a charge
        // keep the direction, clamp the distance
        var s0 = R_MIN / r;
        dx *= s0; dy *= s0; dz *= s0;
        r = R_MIN; r2 = R_MIN * R_MIN;
      }
      var f = KQ * c.q / (r2 * r);
      ex += f * dx; ey += f * dy; ez += f * dz;
    }
    out[0] = ex; out[1] = ey; out[2] = ez;
    return Math.sqrt(ex * ex + ey * ey + ez * ez);
  }

  function field(charges, p) {
    var o = [0, 0, 0];
    var mag = fieldInto(charges, p.x, p.y, p.z, o);
    return { x: o[0], y: o[1], z: o[2], mag: mag };
  }

  function potential(charges, p) {
    var v = 0;
    for (var i = 0; i < charges.length; i++) {
      var c = charges[i];
      var dx = p.x - c.x, dy = p.y - c.y, dz = p.z - c.z;
      var r = Math.sqrt(dx * dx + dy * dy + dz * dz);
      if (r < R_MIN) r = R_MIN;
      v += c.q / r;
    }
    return K * UC / UNIT_M * v;
  }

  function isWithin(p, charges, r) {
    var r2 = r * r;
    for (var i = 0; i < charges.length; i++) {
      var c = charges[i];
      var dx = p.x - c.x, dy = p.y - c.y, dz = p.z - c.z;
      if (dx * dx + dy * dy + dz * dz <= r2) return true;
    }
    return false;
  }

  // Unit direction of sign*E at (x,y,z) into out; returns false if field vanishes.
  function dirInto(charges, x, y, z, sign, out) {
    var m = fieldInto(charges, x, y, z, out);
    if (!(m > 0) || !isFinite(m)) return false;
    var s = sign / m;
    out[0] *= s; out[1] *= s; out[2] *= s;
    return true;
  }

  function traceLines(charges, opts) {
    opts = opts || {};
    var perUnit = opts.perUnitCharge != null ? opts.perUnitCharge : 8;
    var maxSteps = opts.maxSteps != null ? opts.maxSteps : 600;
    var step = opts.step != null ? opts.step : 0.25;
    var bound = opts.bound != null ? opts.bound : 40;
    var lines = [];
    var n = charges.length;
    if (!n) return lines;

    var hasPos = false, i;
    for (i = 0; i < n; i++) if (charges[i].q > 0) { hasPos = true; break; }
    var sign = hasPos ? 1 : -1;      // follow +E from positives, else -E from negatives
    var seedR = R_MIN * 1.2;
    var bound2 = bound * bound;
    var buf = new Float32Array((maxSteps + 1) * 3);
    var k1 = [0, 0, 0], k2 = [0, 0, 0], k3 = [0, 0, 0], k4 = [0, 0, 0];
    var GA = Math.PI * (3 - Math.sqrt(5));

    for (i = 0; i < n; i++) {
      var c = charges[i];
      if (c.q * sign <= 0) continue;
      var count = Math.round(perUnit * Math.abs(c.q));
      for (var s = 0; s < count; s++) {
        // Fibonacci sphere seed
        var yy = count === 1 ? 0 : 1 - 2 * (s + 0.5) / count;
        var rr = Math.sqrt(Math.max(0, 1 - yy * yy));
        var th = GA * s;
        var x = c.x + seedR * rr * Math.cos(th);
        var y = c.y + seedR * yy;
        var z = c.z + seedR * rr * Math.sin(th);
        var np = 0, to = -1;
        buf[0] = x; buf[1] = y; buf[2] = z; np = 1;
        for (var st = 0; st < maxSteps; st++) {
          if (!dirInto(charges, x, y, z, sign, k1)) break;
          var h = step;
          if (!dirInto(charges, x + 0.5 * h * k1[0], y + 0.5 * h * k1[1], z + 0.5 * h * k1[2], sign, k2)) break;
          if (!dirInto(charges, x + 0.5 * h * k2[0], y + 0.5 * h * k2[1], z + 0.5 * h * k2[2], sign, k3)) break;
          if (!dirInto(charges, x + h * k3[0], y + h * k3[1], z + h * k3[2], sign, k4)) break;
          x += h / 6 * (k1[0] + 2 * k2[0] + 2 * k3[0] + k4[0]);
          y += h / 6 * (k1[1] + 2 * k2[1] + 2 * k3[1] + k4[1]);
          z += h / 6 * (k1[2] + 2 * k2[2] + 2 * k3[2] + k4[2]);
          buf[np * 3] = x; buf[np * 3 + 1] = y; buf[np * 3 + 2] = z; np++;
          // end on an opposite-sign charge
          var hit = -1;
          for (var j = 0; j < n; j++) {
            if (charges[j].q * sign >= 0) continue;
            var dx = x - charges[j].x, dy = y - charges[j].y, dz = z - charges[j].z;
            if (dx * dx + dy * dy + dz * dz <= R_MIN * R_MIN) { hit = j; break; }
          }
          if (hit >= 0) { to = hit; break; }
          if (x * x + y * y + z * z > bound2) break;
        }
        lines.push({ points: buf.slice(0, np * 3), from: i, to: to });
      }
    }
    return lines;
  }

  return { K: K, R_MIN: R_MIN, field: field, potential: potential, traceLines: traceLines, isWithin: isWithin };
})();
if (typeof module !== 'undefined' && module.exports) module.exports = EField;
