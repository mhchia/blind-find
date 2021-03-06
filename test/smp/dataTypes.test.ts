import { concatUint8Array } from "../../src/smp/utils";
import { Byte, Short, Int, MPI } from "../../src/smp/serialization";
import { Scalar, Point } from "../../src/smp/v4/serialization";
import { ValueError } from "../../src/smp/exceptions";
import { expect } from "chai";

describe("Fixed types", () => {
  const types = [Byte, Short, Int, Scalar];
  const expectedSize = [1, 2, 4, 32];
  const expectedValue = [
    // 2**(8*x) - 1
    BigInt("255"),
    BigInt("65535"),
    BigInt("4294967295"),
    BigInt(
      "115792089237316195423570985008687907853269984665640564039457584007913129639935"
    )
  ];
  const expectedSerialized = [
    new Uint8Array([255]),
    new Uint8Array([255, 255]),
    new Uint8Array([255, 255, 255, 255]),
    new Uint8Array([
      255,
      255,
      255,
      255,
      255,
      255,
      255,
      255,
      255,
      255,
      255,
      255,
      255,
      255,
      255,
      255,
      255,
      255,
      255,
      255,
      255,
      255,
      255,
      255,
      255,
      255,
      255,
      255,
      255,
      255,
      255,
      255
    ])
  ];
  const expectedInvalidValue = [
    // 2**(8*x)
    BigInt("256"),
    BigInt("65536"),
    BigInt("4294967296"),
    BigInt(
      "115792089237316195423570985008687907853269984665640564039457584007913129639936"
    )
  ];

  it("succeeds", () => {
    for (const index in types) {
      const Type = types[index];
      const b = new Type(expectedValue[index]);
      expect(Type.size).to.eql(expectedSize[index]);
      expect(b.value).to.eql(expectedValue[index]);
      expect(b.serialize()).to.eql(expectedSerialized[index]);
      expect(b.value).to.eql(Type.deserialize(expectedSerialized[index]).value);
    }
  });
  it("constructor fails", () => {
    // Too large
    for (const index in types) {
      const Type = types[index];
      expect(() => {
        new Type(expectedInvalidValue[index]);
      }).to.throw(ValueError);
    }
    // Negative
    const neg = BigInt(-1);
    for (const Type of types) {
      expect(() => {
        new Type(neg);
      }).to.throw(ValueError);
    }
  });
});

describe("MPI(variable-length integer)", () => {
  it("succeeds", () => {
    const values = [
      BigInt(0),
      BigInt(256),
      BigInt(2) ** BigInt(64) - BigInt(1) // 2**64 - 1
    ];
    const expectedSerialized = [
      new Uint8Array([0, 0, 0, 1, 0]),
      new Uint8Array([0, 0, 0, 2, 1, 0]),
      new Uint8Array([0, 0, 0, 8, 255, 255, 255, 255, 255, 255, 255, 255])
    ];
    for (const index in values) {
      const mpi = new MPI(values[index]);
      const expected = expectedSerialized[index];
      expect(mpi.serialize()).to.eql(expected);
      expect(MPI.deserialize(expected).value === mpi.value);
    }
  });
  it("consume", () => {
    const bytes = concatUint8Array(
      new Uint8Array([0, 0, 0, 1, 0]),
      new Uint8Array([0, 0, 0, 2, 1, 0])
    );
    const [mpi1, bytesRemaining] = MPI.consume(bytes);
    expect(mpi1.value === BigInt(0)).to.be.true;
    const [mpi2, bytesRemaining2] = MPI.consume(bytesRemaining);
    expect(mpi2.value === BigInt(256)).to.be.true;
    expect(() => {
      MPI.consume(bytesRemaining2);
    }).to.throw(ValueError);
    // We can consume only the prefix, i.e. [0, 0, 0, 1, 1].
    const b = new Uint8Array([0, 0, 0, 1, 1, 1]);
    const [mpi3, bRemaining] = MPI.consume(b);
    expect(() => {
      expect(mpi3.value === BigInt(1)).to.be.true;
      expect(bRemaining).to.eql(new Uint8Array([1]));
    });
  });
  it("constructor fails", () => {
    // Negative
    expect(() => {
      new MPI(BigInt(-1));
    }).to.throw(ValueError);
  });
  it("deserialize fails", () => {
    // Empty
    expect(() => {
      MPI.deserialize(new Uint8Array([]));
    }).to.throw(ValueError);
    // Length too short
    expect(() => {
      MPI.deserialize(new Uint8Array([0, 0, 0, 1, 1, 1]));
    }).to.throw(ValueError);
    // Length too long
    expect(() => {
      MPI.deserialize(new Uint8Array([0, 0, 0, 2, 0]));
    }).to.throw(ValueError);
  });
});

describe("Point", () => {
  it("succeeds", () => {
    const points = [
      [BigInt(0), BigInt(1)],
      [
        BigInt(
          "17777552123799933955779906779655732241715742912184938656739573121738514868268"
        ),
        BigInt(
          "2626589144620713026669568689430873010625803728049924121243784502389097019475"
        )
      ],
      [
        BigInt(
          "16540640123574156134436876038791482806971768689494387082833631921987005038935"
        ),
        BigInt(
          "20819045374670962167435360035096875258406992893633759881276124905556507972311"
        )
      ]
    ];
    const expectedSerialized = [
      new Uint8Array([
        1,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0
      ]),
      new Uint8Array([
        83,
        184,
        30,
        213,
        191,
        254,
        149,
        69,
        181,
        64,
        22,
        35,
        70,
        130,
        231,
        178,
        246,
        153,
        189,
        66,
        165,
        233,
        234,
        226,
        127,
        244,
        5,
        27,
        198,
        152,
        206,
        133
      ]),
      new Uint8Array([
        215,
        82,
        145,
        249,
        247,
        216,
        141,
        52,
        209,
        193,
        176,
        12,
        237,
        212,
        169,
        249,
        131,
        85,
        195,
        36,
        253,
        221,
        219,
        24,
        120,
        61,
        60,
        141,
        127,
        41,
        7,
        174
      ])
    ];
    for (const index in points) {
      const point = points[index];
      const p = new Point(point);
      expect(p.serialize()).to.eql(expectedSerialized[index]);
      expect(Point.deserialize(p.serialize())).to.eql(p);
    }
  });

  it("deserialize fails", () => {
    // Length too short
    expect(() => {
      Point.deserialize(new Uint8Array([0, 0, 0, 2, 0]));
    }).to.throw(ValueError);
    // Length too long
    expect(() => {
      Point.deserialize(
        new Uint8Array([
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0
        ])
      );
    }).to.throw(ValueError);
  });
});
