// vcv-prototype-sequencer - Livecoding sequencer for VCV Prototype module
// Copyright (C) 2020  Andrii Polishchuk
//
// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.
//
// This program is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU General Public License for more details.
//
// You should have received a copy of the GNU General Public License
// along with this program.  If not, see <https://www.gnu.org/licenses/>.

function sequencer(
  {
    bpm,
    isLooped,
    isRunningByDefault,
    numGates,
    numVoltages,
    voltageInterpolation
  },
  phraseBuilder
) {
  const TYPES = {
    DELAY: "DELAY",
    GATE: "GATE",
    VOLTAGE: "VOLTAGE",
    START_CHECKPOINT: "START_CHECKPOINT",
    END_CHECKPOINT: "END_CHECKPOINT"
  };
  const ACTION_STATUSES = {
    NEW: "NEW",
    PROCESSING: "PROCESSING",
    PROCESSED: "PROCESSED"
  };
  const INTERPOLATION_MODES = {
    NONE: "NONE",
    LINEAR: "LINEAR"
  };
  const GATE_ON_VOLTAGE = 12;
  const GATE_OFF_VOLTAGE = 0;
  const DEFAULT_BPM = 120;
  const DEFAULT_GATE_DURATION = 1 / 512;
  const DEFAULT_NUM_GATES = 6;
  const DEFAULT_NUM_VOLTAGES = 6;
  const DEFAULT_VOLTAGE_INTERPOLATION_MODE = INTERPOLATION_MODES.NONE;
  bpm = bpm || DEFAULT_BPM;
  numGates = numGates || DEFAULT_NUM_GATES;
  numVoltages = numVoltages || DEFAULT_NUM_VOLTAGES;
  voltageInterpolation =
    voltageInterpolation || DEFAULT_VOLTAGE_INTERPOLATION_MODE;
  if (typeof voltageInterpolation === "string") {
    voltageInterpolation = Array.from(
      { length: numVoltages },
      () => voltageInterpolation
    );
  } else if (voltageInterpolation instanceof Array) {
    if (voltageInterpolation.length < numVoltages) {
      throw new Error(
        `Wrong voltageInterpolation array length = ${voltageInterpolation.length} when numVoltages = ${numVoltages}`
      );
    }
  } else if (typeof voltageInterpolation === "object") {
    voltageInterpolation = Array.from(
      { length: numVoltages },
      (_, i) => voltageInterpolation[i] || DEFAULT_VOLTAGE_INTERPOLATION_MODE
    );
  }
  const fill = (n, f) => Array.from({ length: n }, f);
  class Sequencer {
    constructor(phrase) {
      this.phrase = phrase;
      this.deltaTime = 0;
      this.bpm = bpm;
      this.isLooped = isLooped;
      this.isRunning = isRunningByDefault ? true : false;
      this.time = 0;
      this.currentActionIndex = 0;
      this.currentActionObject = this.phrase[0];
      this.currentActionStatus = ACTION_STATUSES.NEW;
      this.currentActionState = undefined;
      this.gates = fill(numGates, () => 0);
      this.gateDeactivationTimestamps = fill(numGates, () => 0);
      this.voltages = fill(numVoltages, () => 0);
      this.voltageInterpolationTimestamps = fill(numVoltages, () => []);
      this.voltageInterpolationCheckpoints = fill(numVoltages, () => []);
      this.voltageInterpolationIndexes = fill(numVoltages, () => 0);
      this.initVoltageInterpolationArrays();
      this.startCheckpointActionIndex = 0;
      this.endCheckpointActionIndex = 0;
      this.startCheckpointTimestamp = 0;
      this.endCheckpointTimestamp = 0;
      this.initCheckpointData();
    }
    initVoltageInterpolationArrays() {
      let time = 0;
      for (let i = 0; i < this.phrase.length; i++) {
        const action = this.phrase[i];
        if (action.type === TYPES.DELAY) {
          time += action.data.duration;
        } else if (
          action.type === TYPES.VOLTAGE &&
          voltageInterpolation[action.data.index] === INTERPOLATION_MODES.LINEAR
        ) {
          const outputIndex = action.data.index;
          const newVoltage = action.data.value;
          this.voltageInterpolationCheckpoints[outputIndex].push(newVoltage);
          this.voltageInterpolationTimestamps[outputIndex].push(time);
        }
      }
      for (let i = 0; i < numVoltages; i++) {
        if (voltageInterpolation[i] === INTERPOLATION_MODES.LINEAR) {
          const checkpoints = this.voltageInterpolationCheckpoints[i];
          const timestamps = this.voltageInterpolationTimestamps[i];
          checkpoints.push(checkpoints[checkpoints.length - 1]);
          timestamps.push(Infinity);
        }
      }
    }
    adjustVoltageInterpolationIndexes() {
      for (let i = 0; i < numVoltages; i++) {
        this.voltageInterpolationIndexes[i] = 0;
        const timestamps = this.voltageInterpolationTimestamps[i];
        while (
          this.time >
          this.beatTimeToRealTime(
            timestamps[this.voltageInterpolationIndexes[i] + 1]
          )
        ) {
          this.voltageInterpolationIndexes[i] += 1;
        }
      }
    }
    initCheckpointData() {
      let time = 0;
      for (let i = 0; i < this.phrase.length; i++) {
        const action = this.phrase[i];
        if (action.type === TYPES.DELAY) {
          time += action.data.duration;
        } else if (action.type === TYPES.START_CHECKPOINT) {
          this.startCheckpointActionIndex = i;
          this.startCheckpointTimestamp = time;
        } else if (action.type === TYPES.END_CHECKPOINT) {
          this.endCheckpointActionIndex = i;
          this.endCheckpointTimestamp = time;
          return;
        }
      }
    }
    init(block) {
      this.deltaTime = 1000 / (block.sampleRate / config.frameDivider);
      this.restart();
    }
    restart() {
      this.time = this.beatTimeToRealTime(this.startCheckpointTimestamp);
      this.currentActionIndex = this.startCheckpointActionIndex;
      this.currentActionObject = this.phrase[this.currentActionIndex];
      this.currentActionStatus = ACTION_STATUSES.NEW;
      this.currentActionState = undefined;
      this.gates = [0, 0, 0, 0, 0, 0];
      this.gateDeactivationTimestamps = [0, 0, 0, 0, 0, 0];
      this.voltages = [0, 0, 0, 0, 0, 0];
      this.voltageInterpolationIndexes = fill(numVoltages, () => 0);
      this.adjustVoltageInterpolationIndexes();
    }
    toggle() {
      this.isRunning = !this.isRunning;
    }
    beatTimeToRealTime(beatTime) {
      return (60000 * beatTime) / (this.bpm / 4);
    }
    processActions() {
      if (!this.phrase) return;
      while (true) {
        if (this.currentActionIndex >= this.phrase.length) {
          if (this.isLooped) {
            this.restart();
            continue;
          } else {
            return;
          }
        }
        const action = this.currentActionObject;
        switch (this.currentActionStatus) {
          case ACTION_STATUSES.NEW:
            switch (action.type) {
              case TYPES.GATE:
                this.gates[action.data.index] = GATE_ON_VOLTAGE;
                this.gateDeactivationTimestamps[action.data.index] =
                  this.time + this.beatTimeToRealTime(action.data.duration);
                this.currentActionStatus = ACTION_STATUSES.PROCESSED;
                break;
              case TYPES.VOLTAGE:
                this.voltages[action.data.index] = action.data.value;
                this.currentActionStatus = ACTION_STATUSES.PROCESSED;
                break;
              case TYPES.DELAY:
                this.currentActionState =
                  this.time + this.beatTimeToRealTime(action.data.duration);
                this.currentActionStatus = ACTION_STATUSES.PROCESSING;
                break;
              case TYPES.START_CHECKPOINT:
                this.currentActionStatus = ACTION_STATUSES.PROCESSED;
                break;
              case TYPES.END_CHECKPOINT:
                if (this.isLooped) {
                  this.restart();
                  continue;
                } else {
                  return;
                }
              default:
                throw new Error(
                  `processActions: Invalid action type '${action.type}' in status '${this.currentActionStatus}'`
                );
            }
            break;
          case ACTION_STATUSES.PROCESSING:
            switch (action.type) {
              case TYPES.DELAY:
                if (this.time > this.currentActionState) {
                  this.currentActionStatus = ACTION_STATUSES.PROCESSED;
                }
                break;
              default:
                throw new Error(
                  `processActions: Invalid action type '${action.type}' in status '${this.currentActionStatus}'`
                );
            }
            break;
          default:
            throw new Error(
              `processActions: Invalid action type '${action.type}' in status '${this.currentActionStatus}'`
            );
        }
        switch (this.currentActionStatus) {
          case ACTION_STATUSES.PROCESSING:
            return;
          case ACTION_STATUSES.PROCESSED:
            this.currentActionIndex += 1;
            this.currentActionObject = this.phrase[this.currentActionIndex];
            this.currentActionStatus = ACTION_STATUSES.NEW;
            break;
          default:
            throw new Error(
              `processActions: Invalid action status '${this.currentActionStatus}' at post-processing stage`
            );
        }
      }
    }
    processGates() {
      for (let i = 0; i < numGates; i++) {
        if (this.time > this.gateDeactivationTimestamps[i]) {
          this.gates[i] = GATE_OFF_VOLTAGE;
        }
      }
    }
    processInterpolatedVoltages() {
      const indexes = this.voltageInterpolationIndexes;
      for (let i = 0; i < numVoltages; i++) {
        if (voltageInterpolation[i] === INTERPOLATION_MODES.LINEAR) {
          const timestamps = this.voltageInterpolationTimestamps[i];
          const checkpoints = this.voltageInterpolationCheckpoints[i];
          const startSegmentIndex = indexes[i];
          const endSegmentIndex = startSegmentIndex + 1;
          const startSegmentTimestamp = this.beatTimeToRealTime(
            timestamps[startSegmentIndex]
          );
          if (this.time < startSegmentTimestamp) continue;
          const endSegmentTimestamp = this.beatTimeToRealTime(
            timestamps[endSegmentIndex]
          );
          const startSegmentVoltage = checkpoints[startSegmentIndex];
          const endSegmentVoltage = checkpoints[endSegmentIndex];
          const progress =
            (this.time - startSegmentTimestamp) /
            (endSegmentTimestamp - startSegmentTimestamp);
          this.voltages[i] =
            startSegmentVoltage +
            progress * (endSegmentVoltage - startSegmentVoltage);
          if (this.time >= endSegmentTimestamp) {
            indexes[i] += 1;
          }
        }
      }
    }
    tick() {
      if (!this.isRunning) return;
      this.processActions();
      this.processGates();
      this.processInterpolatedVoltages();
      this.time += this.deltaTime;
    }
  }
  class Phrase extends Array {
    constructor(...args) {
      super(...args);
    }
    cycleToBars(n) {
      if (!this.some(action => action.type === TYPES.DELAY)) {
        throw new Error(
          "Can't cycle phrase without delays (this would cause infinite loop)!"
        );
      }
      let time = 0;
      const newPhrase = new Phrase();
      while (true) {
        for (const action of this) {
          if (action.type === TYPES.DELAY) {
            const newTime = time + action.data.duration;
            if (newTime > n || Math.abs(n - newTime) < Number.EPSILON) {
              newPhrase.push({
                ...action,
                data: {
                  ...action.data,
                  duration: n - time
                }
              });
              return newPhrase;
            }
            newPhrase.push(action);
            time = newTime;
          } else {
            newPhrase.push(action);
          }
        }
      }
    }
    mapGates(f) {
      let gateIterationIndex = 0;
      return this.map(action =>
        action.type === TYPES.GATE
          ? {
              ...action,
              data: {
                ...action.data,
                index:
                  typeof f === "function"
                    ? f(action.data.index, gateIterationIndex++)
                    : f
              }
            }
          : action
      );
    }
  }
  function evalDuration(syntax) {
    if (syntax.indexOf("/") !== -1) {
      const [q, d] = syntax.split("/").map(s => Number(s.trim()));
      return Number(q) / Number(d);
    } else {
      return Number(syntax);
    }
  }
  function $(phrase) {
    return [
      { type: TYPES.START_CHECKPOINT },
      ...phrase,
      { type: TYPES.END_CHECKPOINT }
    ];
  }
  function g(index, duration) {
    return {
      type: TYPES.GATE,
      data: {
        index: index || 0,
        duration: duration ? evalDuration(duration) : DEFAULT_GATE_DURATION
      }
    };
  }
  const v = (voltage, index) => ({
    type: TYPES.VOLTAGE,
    data: {
      index: index || 0,
      value: voltage || 0
    }
  });
  function reify(syntax) {
    if (syntax === $) {
      return {
        type: TYPES.START_CHECKPOINT
      };
    } else if (syntax === g) {
      return g(0);
    } else if (typeof syntax === "string") {
      return {
        type: TYPES.DELAY,
        data: {
          duration: evalDuration(syntax)
        }
      };
    } else if (typeof syntax === "number") {
      return {
        type: TYPES.VOLTAGE,
        data: {
          index: 0,
          value: Number(syntax)
        }
      };
    } else if (!syntax || !syntax.type || !TYPES[syntax.type]) {
      throw new Error(`Unknown syntax: ${syntax}`);
    } else {
      return syntax;
    }
  }
  function phrase(...args) {
    return new Phrase(...args.map(reify));
  }
  function concat(...args) {
    return new Phrase(...[].concat(...args));
  }
  function interleave(...phrasesArgs) {
    const result = new Phrase();
    let phrases = phrasesArgs.map(p => [...p]);
    while (true) {
      for (const phrase of phrases) {
        while (phrase.length > 0 && phrase[0].type !== TYPES.DELAY) {
          result.push(phrase.shift());
        }
      }
      phrases = phrases.filter(p => p.length > 0);
      if (phrases.length === 0) return result;
      let minDelayDuration = phrases[0][0].data.duration;
      for (const phrase of phrases) {
        if (phrase[0].data.duration < minDelayDuration) {
          minDelayDuration = phrase[0].data.duration;
        }
      }
      result.push({
        type: TYPES.DELAY,
        data: {
          duration: minDelayDuration
        }
      });
      for (const phrase of phrases) {
        if (
          Math.abs(phrase[0].data.duration - minDelayDuration) < Number.EPSILON
        ) {
          phrase.shift();
        } else {
          phrase[0] = {
            type: TYPES.DELAY,
            data: {
              duration: phrase[0].data.duration - minDelayDuration
            }
          };
        }
      }
    }
  }
  const strHashCode = str =>
    [].reduce.call(str, (p, c, i, a) => (p << 5) - p + a.charCodeAt(i), 0);
  const lcgRng01 = intSeed => () =>
    ((2 ** 31 - 1) & (intSeed = Math.imul(48271, intSeed))) / 2 ** 31;
  const mkrand = strSeed => {
    const g = lcgRng01(strHashCode(strSeed));
    const randf = (...args) =>
      args.length === 0
        ? g()
        : args.length === 1
        ? g() * args[0]
        : args[0] + g() * (args[1] - args[0]);
    const randi = (...args) =>
      args.length === 0
        ? Math.floor(g() * 2)
        : args.length === 1
        ? Math.floor(g() * (args[0] + 1))
        : args[0] + Math.floor(g() * (args[1] - args[0] + 1));
    const randg = (...args) => ({
      type: TYPES.GATE,
      data: {
        index:
          args.length === 0
            ? randi(0, numGates - 1)
            : args.length === 1
            ? randi(0, args[0])
            : randi(args[0], args[1]),
        duration: DEFAULT_GATE_DURATION
      }
    });
    const randv = (...args) => ({
      type: TYPES.VOLTAGE,
      data: {
        index:
          args.length <= 2
            ? randi(0, numVoltages - 1)
            : args.length === 3
            ? randi(0, args[2])
            : randi(args[2], args[3]),
        value:
          args.length === 0
            ? randf(0, 10)
            : args.length === 1
            ? randf(0, args[0])
            : randf(args[0], args[1])
      }
    });
    return { randf, randi, randg, randv };
  };
  const { randf, randi, randg, randv } = mkrand("vcv-prototype-sequencer");
  return new Sequencer(
    phraseBuilder({
      phrase,
      concat,
      interleave,
      mkrand,
      randf,
      randi,
      randg,
      randv,
      g,
      v,
      $
    })
  );
}
