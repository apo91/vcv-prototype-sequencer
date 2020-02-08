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

test("phrase.iterate is nice and works pretty well", () => {
  sequencer({ bpm: 128 }, ({ phrase, g }) => {
    const defaultGateDuration = g(0).data.duration;
    const p1_exemplar = phrase(g, "1/4").cycleToBars(1);
    const p1 = phrase.iterate(4, () => [g, "1/4"]);
    expect(p1).toEqual(p1_exemplar);
    const p2_exemplar = [
      { type: "GATE", data: { index: 0, duration: defaultGateDuration } },
      { type: "DELAY", data: { duration: 1 } },
      { type: "GATE", data: { index: 0, duration: defaultGateDuration } },
      { type: "DELAY", data: { duration: 1 / 2 } },
      { type: "GATE", data: { index: 0, duration: defaultGateDuration } },
      { type: "DELAY", data: { duration: 1 / 3 } }
    ];
    const p2 = phrase.iterate([1, 2, 3], i => [g, `1/${i}`]);
    expect(p2).toEqual(p2_exemplar);
    return p1;
  });
});

test("phrase can flatten its args", () => {
  sequencer({ bpm: 128 }, ({ phrase, g }) => {
    const tresillo_exemplar = phrase(g, "3/8", g, "3/8", g, "2/8");
    const tresillo1 = phrase([g, "3/8"], [g, "3/8"], [g, "2/8"]);
    const tresillo2 = phrase([
      [g, "3/8"],
      [g, "3/8"],
      [g, "2/8"]
    ]);
    const tresillo3 = phrase(g, "3/8", [g, "3/8"], g, "2/8");
    const tresillo4 = phrase(g, "3/8", [[g, "3/8"], [[[[g]]]], "2/8"]);
    expect(tresillo1).toEqual(tresillo_exemplar);
    expect(tresillo2).toEqual(tresillo_exemplar);
    expect(tresillo3).toEqual(tresillo_exemplar);
    expect(tresillo4).toEqual(tresillo_exemplar);
    return tresillo_exemplar;
  });
});

test("vbind is fine", () => {
  sequencer({ bpm: 128 }, ({ phrase, v, vbind }) => {
    const pan = vbind(0);
    const exemplar1 = phrase(v(-10), "1/2", v(10), "1/2");
    const exemplar2 = phrase(v(-10, 0), "1/2", v(10, 0), "1/2");
    const panning_phrase = phrase(pan(-10), "1/2", pan(10), "1/2");
    expect(panning_phrase).toEqual(exemplar1);
    expect(panning_phrase).toEqual(exemplar2);
    return panning_phrase;
  });
});

test("partially applied gbind can be reified", () => {
  sequencer({ bpm: 130 }, ({ phrase, g, gbind }) => {
    const defaultGateDuration = g(0).data.duration;
    const kick = gbind(1);
    const tresillo_exemplar = phrase(g(1), "3/8", g(1), "3/8", g(1), "2/8");
    const tresillo = phrase(
      [kick, "3/8"],
      [kick, "3/8"],
      [kick(defaultGateDuration), "2/8"]
    );
    expect(tresillo).toEqual(tresillo_exemplar);
    return tresillo_exemplar;
  });
});
