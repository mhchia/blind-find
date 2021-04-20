import {
  adminAddressFactory,
  hubConnectionRegistryFactory,
  hubRegistryTreeFactory,
  signedJoinMsgFactory
} from "./factories";
import {
  HubServer,
  sendJoinHubReq,
  sendSearchReq,
  UserStore,
  THubRateLimit, HubConnectionRegistryStore
} from "../src/hub";
import { genKeypair, Signature } from "maci-crypto";
import { LEVELS, TIMEOUT, TIMEOUT_LARGE } from "../src/configs";
import WebSocket from "ws";
import { TimeoutError } from "../src/exceptions";
import { connect } from "../src/websocket";
import { Short, TLV } from "../src/smp/serialization";
import { MemoryDB } from "../src/db";

import chai from "chai";
import chaiAsPromised from "chai-as-promised";
import { HubConnectionRegistry } from "../src";

chai.use(chaiAsPromised);
const expect = chai.expect;

const timeoutBeginAndEnd = TIMEOUT + TIMEOUT;
// Timeout for running SMP against one peer (including time generating/verifying proofs).
const timeoutOneSMP = TIMEOUT + TIMEOUT + TIMEOUT + TIMEOUT_LARGE + TIMEOUT;
const expectedNumSMPs = 4;
const timeoutTotal = timeoutBeginAndEnd + expectedNumSMPs * timeoutOneSMP;

type TRegistry = { userSig: Signature; hubSig: Signature };
const isRegistrySignedMsgMatch = (
  registry: TRegistry,
  signedMsg: TRegistry
) => {
  expect(registry.userSig).to.eql(signedMsg.userSig);
  expect(registry.hubSig).to.eql(signedMsg.hubSig);
};

describe("UserStore", () => {
  const db = new MemoryDB();
  const userStore = new UserStore(db);
  const msgs = [signedJoinMsgFactory(), signedJoinMsgFactory()];

  it("set, get, and size succeed when adding reigstry", async () => {
    await userStore.set(msgs[0].userPubkey, {
      userSig: msgs[0].userSig,
      hubSig: msgs[0].hubSig
    });
    expect(await userStore.getLength()).to.eql(1);
    const registry = await userStore.get(msgs[0].userPubkey);
    if (!registry) {
      throw new Error("should not be undefined");
    }
    isRegistrySignedMsgMatch(registry, msgs[0]);
    await userStore.set(msgs[1].userPubkey, {
      userSig: msgs[1].userSig,
      hubSig: msgs[1].hubSig
    });
    expect(await userStore.getLength()).to.eql(2);
    const registryAnother = await userStore.get(msgs[1].userPubkey);
    if (!registryAnother) {
      throw new Error("should not be undefined");
    }
    isRegistrySignedMsgMatch(registryAnother, msgs[1]);
  });

  it("userStore is an Iterable", async () => {
    const a: any[] = [];
    for await (const item of userStore) {
      a.push(item);
    }
    expect(a.length).to.eql(await userStore.getLength());
  });

  it("get fails when no matched entry", async () => {
    const anotherUser = genKeypair();
    expect(await userStore.get(anotherUser.pubKey)).to.be.undefined;
  });
});

describe("HubConnectionRegistryStore", () => {
  const db = new MemoryDB();
  const hubConnectionStore = new HubConnectionRegistryStore(db);
  const hub0 = genKeypair();
  const hub1 = genKeypair();
  const hub2 = genKeypair();
  const hubConnections = [
    hubConnectionRegistryFactory(hub0, hub1).toObj(),
    hubConnectionRegistryFactory(hub0, hub2).toObj(),
  ];

  it("set, get, and size succeed when adding reigstry", async () => {
    await hubConnectionStore.set(hub1.pubKey, hubConnections[0]);
    expect(await hubConnectionStore.getLength()).to.eql(1);
    const registry = await hubConnectionStore.get(hub1.pubKey);
    if (!registry) {
      throw new Error("should not be undefined");
    }
    await hubConnectionStore.set(hub2.pubKey, hubConnections[1]);
    expect(await hubConnectionStore.getLength()).to.eql(2);
    const registryAnother = await hubConnectionStore.get(hub2.pubKey);
    if (!registryAnother) {
      throw new Error("should not be undefined");
    }
  });

  it("HubConnectionRegistryStore is an Iterable", async () => {
    const a: any[] = [];
    for await (const item of hubConnectionStore) {
      a.push(item);
    }
    expect(a.length).to.eql(await hubConnectionStore.getLength());
  });

  it("get fails when no matched entry", async () => {
    const anotherUser = genKeypair();
    expect(await hubConnectionStore.get(anotherUser.pubKey)).to.be.undefined;
  });
});

describe("HubServer", function() {
  this.timeout(timeoutTotal);

  // NOTE: We only have **one** hub server in our tests. This means the order of the
  //  following tests matters. The server should be alive until the end of the final
  //  test (which should be closed in `after`).
  let hub: HubServer;
  let ip: string;
  let port: number;
  const hubKeypair = genKeypair();
  const adminAddress = adminAddressFactory();
  const user1 = genKeypair();
  const user2 = genKeypair();
  const tree = hubRegistryTreeFactory([hubKeypair], LEVELS, adminAddress);
  expect(tree.length).to.eql(1);
  const hubRegistry = tree.leaves[0];
  const merkleProof = tree.tree.genMerklePath(0);

  before(async () => {
    const rateLimit = {
      numAccess: 1000,
      refreshPeriod: 100000
    };
    const hubRateLimit = {
      join: rateLimit,
      search: rateLimit,
      global: rateLimit,
    }
    const db = new MemoryDB();
    await HubServer.setHubRegistryToDB(db, {
      hubRegistry: hubRegistry.toObj(),
      merkleProof: merkleProof
    });
    hub = new HubServer(
      hubKeypair,
      adminAddress,
      hubRateLimit,
      db
    );
    await hub.start();

    const addr = hub.address as WebSocket.AddressInfo;
    ip = "localhost";
    port = addr.port;
  });

  after(() => {
    hub.close();
  });

  it("request fails when message has unsupported RPC type", async () => {
    // Invalid registry because of the wrong pubkey
    const expectedUnsupportedType = 5566;
    const c = await connect(ip, port);
    const tlv = new TLV(new Short(expectedUnsupportedType), new Uint8Array());
    c.write(tlv.serialize());
    await expect(c.read()).to.be.rejected;
  });

  it("`Join` request should succeed with correct request data", async () => {
    const signedMsg = signedJoinMsgFactory(user1, hubKeypair);
    await sendJoinHubReq(
      ip,
      port,
      signedMsg.userPubkey,
      signedMsg.userSig,
      signedMsg.hubPubkey
    );
    expect(await hub.userStore.getLength()).to.eql(1);
    expect(hub.userStore.get(signedMsg.userPubkey)).not.to.be.undefined;

    // Another request

    const signedMsgAnother = signedJoinMsgFactory(user2, hubKeypair);
    await sendJoinHubReq(
      ip,
      port,
      signedMsgAnother.userPubkey,
      signedMsgAnother.userSig,
      signedMsgAnother.hubPubkey
    );
    expect(await hub.userStore.getLength()).to.eql(2);
    expect(hub.userStore.get(signedMsgAnother.userPubkey)).not.to.be.undefined;
  });

  it("search succeeds", async () => {
    const searchRes = await sendSearchReq(ip, port, user1.pubKey);
    expect(searchRes).not.to.be.null;
  });

  it("search fails when target is not found", async () => {
    const anotherUser = genKeypair();
    const searchRes = await sendSearchReq(ip, port, anotherUser.pubKey);
    expect(searchRes).to.be.null;
  });

  it("request fails when timeout", async () => {
    // NOTE: Server still possibly adds the registry in `userStore` because
    //  the request is indeed valid. We can let the server revert if timeout happens.
    //  However, it requires additional designs.
    // Invalid registry because of the wrong pubkey
    const signedMsg = signedJoinMsgFactory(undefined, hubKeypair);
    const timeoutExpectedToFail = 10;
    await expect(
      sendJoinHubReq(
        ip,
        port,
        signedMsg.userPubkey,
        signedMsg.userSig,
        signedMsg.hubPubkey,
        timeoutExpectedToFail
      )
    ).to.be.rejectedWith(TimeoutError);
  });

  it("requests fail when rate limit is reached", async () => {
    const hubKeypair = genKeypair();
    const adminAddress = adminAddressFactory();
    const tree = hubRegistryTreeFactory([hubKeypair], LEVELS, adminAddress);
    expect(tree.length).to.eql(1);
    const hubRegistry = tree.leaves[0];
    const merkleProof = tree.tree.genMerklePath(0);

    const createHub = async (rateLimit: THubRateLimit) => {
      const db = new MemoryDB();
      await HubServer.setHubRegistryToDB(db, {
        hubRegistry: hubRegistry.toObj(),
        merkleProof: merkleProof
      });
      const hub = new HubServer(
        hubKeypair,
        adminAddress,
        rateLimit,
        db
      );
      await hub.start();
      const port = hub.address.port;
      return { hub, port };
    };

    const zeroRateLimit = { numAccess: 0, refreshPeriod: 100000 };
    const normalRateLimit = { numAccess: 1000, refreshPeriod: 100000 };

    // Put zero rate limit on join requests, thus only join requests fail.
    await (async () => {
      const { hub, port } = await createHub({
        join: zeroRateLimit,
        search: normalRateLimit,
        global: normalRateLimit,
      });
      const signedMsg = signedJoinMsgFactory(user1, hubKeypair);
      await expect(
        sendJoinHubReq(
          ip,
          port,
          signedMsg.userPubkey,
          signedMsg.userSig,
          signedMsg.hubPubkey
        )
      ).to.be.rejected;
      // Search succeeds: temporarily comment it out since it's too slow.
      // await sendSearchReq(ip, port, user1.pubKey);
      hub.close();
    })();

    // Put zero rate limit on search requests, thus only search requests fail.
    await (async () => {
      const { hub, port } = await createHub({
        join: normalRateLimit,
        search: zeroRateLimit,
        global: normalRateLimit,
      });
      await expect(sendSearchReq(ip, port, user1.pubKey)).to.be.rejected;
      hub.close();
    })();

    // Put zero rate limit on global, thus any request fails.
    await (async () => {
      const { hub, port } = await createHub({
        join: normalRateLimit,
        search: normalRateLimit,
        global: zeroRateLimit,
      });
      const signedMsg = signedJoinMsgFactory(user1, hubKeypair);
      await expect(
        sendJoinHubReq(
          ip,
          port,
          signedMsg.userPubkey,
          signedMsg.userSig,
          signedMsg.hubPubkey
        )
      ).to.be.rejected;
      await expect(sendSearchReq(ip, port, user1.pubKey)).to.be.rejected;
      hub.close();
    })();
  });

  it('Hub.signHubConnectionRegistry', async () => {
    const hubKeypair1 = genKeypair();
    const sig0 = hub.signHubConnectionRegistry(hubKeypair1.pubKey);
    const sig1 = HubConnectionRegistry.partialSign(hubKeypair1, hubKeypair.pubKey);
    const hubConnectionRegistry = new HubConnectionRegistry({
      hubPubkey0: hubKeypair.pubKey,
      hubPubkey1: hubKeypair1.pubKey,
      hubSig0: sig0,
      hubSig1: sig1,
    });
    expect(hubConnectionRegistry.verify()).to.be.true;
  });

});
