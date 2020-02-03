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
