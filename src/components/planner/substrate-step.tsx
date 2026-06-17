/**
 * Substrate step — drainage depth + substrate depth only (decisions 10 & 12).
 *
 * v2.0 scope is deliberately small: two layer depths, each seeded from the pure
 * {@link defaultLayerDepths} (driven by plant `maxHeightCm` + moisture + volume)
 * and then owner-overridable. The rich substrate *mixer* (ratios / components /
 * material choice) is the v2.1 fast-follow — so drainage material is shown here
 * only as a read-only default label, not a control.
 */
import { useEffect } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Card, haptics, SectionLabel, StatStrip, Text } from '@/components/ui';
import { Radii, Spacing } from '@/constants/theme';
import { useTokens } from '@/hooks/use-tokens';
import { defaultLayerDepths } from '@/logic/containers';

import { DEFAULT_DRAINAGE_MATERIAL } from './draft';
import type { StepProps } from './step';

const STEP_CM = 0.5;
const SUBSTRATE_MAX_CM = 20;
const DRAINAGE_MAX_CM = 10;

/** Round a cm value to one decimal and stringify without a trailing `.0`. */
function fmtCm(value: number): string {
  return String(Number(value.toFixed(1)));
}

export function SubstrateStep({ draft, plants, update }: StepProps) {
  const { c } = useTokens();
  const { containerVolumeL, substrateDepth, drainageDepth } = draft;

  // Seed both depths from the pure default once a volume is known and a value is
  // still unset. Effect-only (never during render) so it can't loop, and guarded
  // so an owner who deliberately set a depth is never overwritten.
  useEffect(() => {
    if (containerVolumeL == null) return;
    if (substrateDepth != null && drainageDepth != null) return;
    const [seededSubstrate, seededDrainage] = defaultLayerDepths(plants, containerVolumeL);
    update({
      substrateDepth: substrateDepth ?? seededSubstrate,
      drainageDepth: drainageDepth ?? seededDrainage,
    });
  }, [containerVolumeL, substrateDepth, drainageDepth, plants, update]);

  const drainageNote = (
    <Card style={styles.card}>
      <View style={styles.line}>
        <Text variant="body">Drainage: </Text>
        <Text variant="body" role="sage" style={styles.semibold}>
          {DEFAULT_DRAINAGE_MATERIAL}
        </Text>
      </View>
      <Text variant="caption" role="textMuted">
        The v2.1 substrate mixer will own material and component choice — for now a
        sensible drainage layer is assumed.
      </Text>
    </Card>
  );

  // No volume yet — can't size layers. Hint gently, still show the material note.
  if (containerVolumeL == null) {
    return (
      <View style={styles.group}>
        <Card style={styles.card}>
          <Text variant="body" role="textMuted">
            Set the container in the previous step to size the layers.
          </Text>
        </Card>
        {drainageNote}
      </View>
    );
  }

  const substrate = substrateDepth ?? 0;
  const drainage = drainageDepth ?? 0;
  const total = substrate + drainage;

  return (
    <View style={styles.group}>
      <Card style={styles.card}>
        <SectionLabel>Substrate depth</SectionLabel>
        <Stepper
          c={c}
          value={substrate}
          max={SUBSTRATE_MAX_CM}
          onChange={(n) => update({ substrateDepth: n })}
        />

        <View style={styles.divider} />

        <SectionLabel>Drainage depth</SectionLabel>
        <Stepper
          c={c}
          value={drainage}
          max={DRAINAGE_MAX_CM}
          onChange={(n) => update({ drainageDepth: n })}
        />
      </Card>

      <Card style={styles.card}>
        <SectionLabel>Layers</SectionLabel>
        <StatStrip
          items={[
            { label: 'Drainage', value: `${fmtCm(drainage)} cm` },
            { label: 'Substrate', value: `${fmtCm(substrate)} cm` },
            { label: 'Total', value: `${fmtCm(total)} cm` },
          ]}
        />
      </Card>

      {drainageNote}
    </View>
  );
}

/** A −/＋ stepper around a cm value: 0.5 cm steps, clamped to [0, max]. */
function Stepper({
  c,
  value,
  max,
  onChange,
}: {
  c: ReturnType<typeof useTokens>['c'];
  value: number;
  max: number;
  onChange: (next: number) => void;
}) {
  function step(delta: number) {
    const next = Math.min(max, Math.max(0, Number((value + delta).toFixed(1))));
    if (next === value) return;
    haptics.select();
    onChange(next);
  }

  return (
    <View style={styles.stepperRow}>
      <StepperButton c={c} label="−" disabled={value <= 0} onPress={() => step(-STEP_CM)} />
      <View style={styles.stepperValue}>
        <Text variant="title">{fmtCm(value)}</Text>
        <Text variant="caption" role="textMuted">
          cm
        </Text>
      </View>
      <StepperButton c={c} label="＋" disabled={value >= max} onPress={() => step(STEP_CM)} />
    </View>
  );
}

function StepperButton({
  c,
  label,
  onPress,
  disabled,
}: {
  c: ReturnType<typeof useTokens>['c'];
  label: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label === '−' ? 'Decrease by half a centimetre' : 'Increase by half a centimetre'}
      accessibilityState={{ disabled: !!disabled }}
      style={[
        styles.stepperBtn,
        { backgroundColor: c.surfaceSunken, borderColor: c.border },
        disabled && styles.stepperBtnDisabled,
      ]}>
      <Text variant="title" style={{ color: c.text }}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  group: { gap: Spacing.md },
  card: { padding: Spacing.lg, gap: Spacing.sm },
  line: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap' },
  semibold: { fontWeight: '600' },
  divider: { height: Spacing.xs },
  stepperRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  stepperValue: { flex: 1, alignItems: 'center' },
  stepperBtn: {
    width: 44,
    height: 44,
    borderRadius: Radii.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperBtnDisabled: { opacity: 0.4 },
});
