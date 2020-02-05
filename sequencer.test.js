const { sequencer } = require("./sequencer");

test("padToBars can cut phrase similarly to cycleToBars", () => {
  sequencer({ bpm: 120 }, ({ phrase, g }) => {
    const fourToFloor = phrase(g, "1/4").cycleToBars(1);
    const fourToFloor4Bars = fourToFloor.repeat(4);
    const fourToFloorCutByPadToBars = fourToFloor4Bars.padToBars(1);
    const fourToFloorCutByCycleToBars = fourToFloor4Bars.cycleToBars(1);
    expect(fourToFloor).toEqual(fourToFloorCutByPadToBars);
    expect(fourToFloor).toEqual(fourToFloorCutByCycleToBars);
    return fourToFloorCutByPadToBars;
  });
});

test("mapActions & shortcuts do actually work", () => {
  sequencer({ bpm: 120 }, ({ phrase, g }) => {
    const defaultGateDuration = g(0).data.duration;
    const tresillo = phrase(g, "3/8", g, "3/8", g, "2/8");
    const rightAnswer = [
      { type: "GATE", data: { index: 1, duration: defaultGateDuration } },
      { type: "DELAY", data: { duration: 0.375 } },
      { type: "GATE", data: { index: 1, duration: defaultGateDuration } },
      { type: "DELAY", data: { duration: 0.375 } },
      { type: "GATE", data: { index: 1, duration: defaultGateDuration } },
      { type: "DELAY", data: { duration: 0.25 } }
    ];
    expect(tresillo.mapActions("GATE", "index", () => 1)).toEqual(rightAnswer);
    expect(tresillo.mapGi(() => 1)).toEqual(rightAnswer);
    expect(tresillo.mapGi(1)).toEqual(rightAnswer);
    return tresillo;
  });
});
