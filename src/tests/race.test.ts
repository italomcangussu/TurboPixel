import { advanceOverRevAccumulator, classifyShiftTiming } from '../core/race';

describe('race timing', () => {
  it('classifies perfect, good and miss boundaries', () => {
    expect(classifyShiftTiming(0, 120)).toBe('perfect');
    expect(classifyShiftTiming(120, 120)).toBe('perfect');
    expect(classifyShiftTiming(121, 120)).toBe('good');
    expect(classifyShiftTiming(-300, 120)).toBe('good');
    expect(classifyShiftTiming(301, 120)).toBe('miss');
  });

  it('triggers over-rev debuff after threshold and decays when below redline', () => {
    const stepA = advanceOverRevAccumulator({
      accumMs: 0,
      rpm: 7000,
      redlineRpm: 7000,
      deltaMs: 250,
    });
    expect(stepA.triggered).toBe(false);
    expect(stepA.accumMs).toBe(250);

    const stepB = advanceOverRevAccumulator({
      accumMs: stepA.accumMs,
      rpm: 7000,
      redlineRpm: 7000,
      deltaMs: 260,
    });
    expect(stepB.triggered).toBe(true);
    expect(stepB.accumMs).toBe(0);

    const decay = advanceOverRevAccumulator({
      accumMs: 300,
      rpm: 2000,
      redlineRpm: 7000,
      deltaMs: 100,
    });
    expect(decay.triggered).toBe(false);
    expect(decay.accumMs).toBeCloseTo(240);
  });
});
