import BN from "bn.js";

/**
 * Concatenate two `Uint8Array` into one.
 */
export const concatUint8Array = (a: Uint8Array, b: Uint8Array): Uint8Array => {
  let c = new Uint8Array(a.length + b.length);
  c.set(a);
  c.set(b, a.length);
  return c;
};

/**
 * Modular operation for `BigInt`.
 * @param a Number to be reduced
 * @param modulus Modulus
 */
export const bigIntMod = (a: BigInt, modulus: BigInt): BigInt => {
  return BigInt(
    new BN(a.toString()).umod(new BN(modulus.toString())).toString()
  );
};
