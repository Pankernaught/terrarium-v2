/**
 * Substrate step — drainage/substrate **depths** + the opt-in component **mixer**
 * (decisions 10 & 12).
 *
 * Two layer depths, each seeded from the pure {@link defaultLayerDepths} (plant
 * `maxHeightCm` + moisture + volume) and owner-overridable. Below them, the Phase-8
 * **custom mix**: add-then-tune and entirely opt-in — the owner adds ingredients,
 * tunes their *parts*, and sees the four derived bars update live. The recipe is
 * persisted to `draft.substrateMix` and feeds the build-guide line; it is
 * deliberately **separate from the Eco meter** (it does not move the compatibility
 * score) and is never seeded from the plants — the mix stays `null` until the owner
 * builds one.
 *
 * The property values behind the bars are **authored + provisional** (not science),
 * so the bars and the one-line read-out are kept soft.
 */
import { useEffect } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Card, Chip, haptics, Meter, SectionLabel, StatStrip, Text } from '@/components/ui';
import { Radii, Spacing } from '@/constants/theme';
import { useTokens } from '@/hooks/use-tokens';
import { SUBSTRATE_COMPONENTS, componentLabel } from '@/data/substrate-components';
import { defaultLayerDepths } from '@/logic/containers';
import { PROPERTY_LABELS, SUBSTRATE_PROPERTIES } from '@/logic/substrate-matrix';
import {
  activeComponents,
  describeMix,
  mixSubstrate,
  type SubstrateMix,
} from '@/logic/substrateMixer';

import { DEFAULT_DRAINAGE_MATERIAL } from './draft';
import type { StepProps } from './step';

const STEP_CM = 0.5;
const SUBSTRATE_MAX_CM = 20;
const DRAINAGE_MAX_CM = 10;
const MIN_PARTS = 1;
const MAX_PARTS = 9;

/** Round a cm value to one decimal and stringify without a trailing `.0`. */
function fmtCm(value: number): string {
  return String(Number(value.toFixed(1)));
}

export function SubstrateStep({ draft, plants, update }: StepProps) {
  const { c } = useTokens();
  const { containerVolumeL, substrateDepth, drainageDepth, substrateMix } = draft;

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

  // --- Custom-mix recipe editing (opt-in; persisted to draft.substrateMix) -----
  const mix: SubstrateMix = substrateMix ?? {};
  const added = activeComponents(mix); // ids with parts, in canonical matrix order
  const addedIds = new Set(added);
  const remaining = SUBSTRATE_COMPONENTS.filter((comp) => !addedIds.has(comp.id));
  const stats = mixSubstrate(mix);

  /** Persist a recipe, collapsing an emptied recipe back to null (no custom mix). */
  function setMix(next: SubstrateMix) {
    update({ substrateMix: Object.keys(next).length > 0 ? next : null });
  }
  function addIngredient(id: string) {
    haptics.select();
    setMix({ ...mix, [id]: MIN_PARTS });
  }
  function setParts(id: string, parts: number) {
    setMix({ ...mix, [id]: parts });
  }
  function removeIngredient(id: string) {
    haptics.select();
    const next = { ...mix };
    delete next[id];
    setMix(next);
  }

  const drainageNote = (
    <Card style={styles.card}>
      <View style={styles.line}>
        <Text variant="body">Drainage: </Text>
        <Text variant="body" role="sage" style={styles.semibold}>
          {DEFAULT_DRAINAGE_MATERIAL}
        </Text>
      </View>
      <Text variant="caption" role="textMuted">
        A sensible drainage layer is assumed — the custom mix below tunes the planting
        substrate itself.
      </Text>
    </Card>
  );

  const substrate = substrateDepth ?? 0;
  const drainage = drainageDepth ?? 0;
  const total = substrate + drainage;

  return (
    <View style={styles.group}>
      {containerVolumeL == null ? (
        <Card style={styles.card}>
          <Text variant="body" role="textMuted">
            Set the container in the previous step to size the layers.
          </Text>
        </Card>
      ) : (
        <>
          <Card style={styles.card}>
            <SectionLabel>Substrate depth</SectionLabel>
            <Stepper
              c={c}
              value={substrate}
              max={SUBSTRATE_MAX_CM}
              step={STEP_CM}
              unit="cm"
              format={fmtCm}
              decLabel="Decrease by half a centimetre"
              incLabel="Increase by half a centimetre"
              onChange={(n) => update({ substrateDepth: n })}
            />

            <View style={styles.divider} />

            <SectionLabel>Drainage depth</SectionLabel>
            <Stepper
              c={c}
              value={drainage}
              max={DRAINAGE_MAX_CM}
              step={STEP_CM}
              unit="cm"
              format={fmtCm}
              decLabel="Decrease by half a centimetre"
              incLabel="Increase by half a centimetre"
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
        </>
      )}

      {/* Custom mix — opt-in, add-then-tune (Phase 8). */}
      <Card style={styles.card}>
        <SectionLabel>Build a custom mix (optional)</SectionLabel>

        {added.length === 0 ? (
          <Text variant="caption" role="textMuted">
            Add ingredients to blend your own substrate. Skip this for a standard mix.
          </Text>
        ) : (
          <View style={styles.ingredients}>
            {added.map((id, i) => (
              <View
                key={id}
                style={[
                  styles.ingredient,
                  i > 0 && {
                    borderTopWidth: StyleSheet.hairlineWidth,
                    borderTopColor: c.border,
                    paddingTop: Spacing.sm,
                  },
                ]}>
                <View style={styles.line}>
                  <Text variant="body" style={[styles.semibold, styles.flex]}>
                    {componentLabel(id)}
                  </Text>
                  <Pressable
                    onPress={() => removeIngredient(id)}
                    accessibilityRole="button"
                    accessibilityLabel={`Remove ${componentLabel(id)}`}
                    hitSlop={8}>
                    <Text variant="caption" role="textMuted">
                      Remove
                    </Text>
                  </Pressable>
                </View>
                <Stepper
                  c={c}
                  value={mix[id] ?? MIN_PARTS}
                  min={MIN_PARTS}
                  max={MAX_PARTS}
                  step={1}
                  unit={(mix[id] ?? MIN_PARTS) === 1 ? 'part' : 'parts'}
                  format={String}
                  decLabel={`Fewer parts of ${componentLabel(id)}`}
                  incLabel={`More parts of ${componentLabel(id)}`}
                  onChange={(n) => setParts(id, n)}
                />
              </View>
            ))}
          </View>
        )}

        {remaining.length > 0 && (
          <View style={styles.addBlock}>
            <Text variant="caption" role="textMuted">
              {added.length === 0 ? 'Add ingredient' : 'Add another'}
            </Text>
            <View style={styles.chipRow}>
              {remaining.map((comp) => (
                <Chip
                  key={comp.id}
                  label={`+ ${comp.label}`}
                  tone="sage"
                  onPress={() => addIngredient(comp.id)}
                />
              ))}
            </View>
          </View>
        )}
      </Card>

      {/* Live derived bars — appear once the recipe has any parts. */}
      {stats && (
        <Card style={styles.card}>
          <SectionLabel>Mix character</SectionLabel>
          {SUBSTRATE_PROPERTIES.map((prop) => (
            <View key={prop} style={styles.barRow}>
              <Text variant="caption" role="textMuted" style={styles.barLabel}>
                {PROPERTY_LABELS[prop]}
              </Text>
              <View style={styles.flex}>
                <Meter value={stats[prop]} color={c.sage} />
              </View>
            </View>
          ))}
          <Text variant="caption" role="sage" style={styles.semibold}>
            Reads as {describeMix(stats)}.
          </Text>
          <Text variant="caption" role="textMuted">
            A rough guide to how the blend behaves — provisional, not lab values.
          </Text>
        </Card>
      )}

      {drainageNote}
    </View>
  );
}

/**
 * A −/＋ stepper around a numeric value, clamped to [min, max] in `step` increments.
 * Shared by the cm depths (step 0.5) and the integer parts steppers (step 1) — the
 * unit, value formatter, and a11y labels are injected so one control serves both.
 */
function Stepper({
  c,
  value,
  min = 0,
  max,
  step,
  unit,
  format,
  decLabel,
  incLabel,
  onChange,
}: {
  c: ReturnType<typeof useTokens>['c'];
  value: number;
  min?: number;
  max: number;
  step: number;
  unit: string;
  format: (n: number) => string;
  decLabel: string;
  incLabel: string;
  onChange: (next: number) => void;
}) {
  function bump(delta: number) {
    const next = Math.min(max, Math.max(min, Number((value + delta).toFixed(1))));
    if (next === value) return;
    haptics.select();
    onChange(next);
  }

  return (
    <View style={styles.stepperRow}>
      <StepperButton c={c} glyph="−" label={decLabel} disabled={value <= min} onPress={() => bump(-step)} />
      <View style={styles.stepperValue}>
        <Text variant="title">{format(value)}</Text>
        <Text variant="caption" role="textMuted">
          {unit}
        </Text>
      </View>
      <StepperButton c={c} glyph="＋" label={incLabel} disabled={value >= max} onPress={() => bump(step)} />
    </View>
  );
}

function StepperButton({
  c,
  glyph,
  label,
  onPress,
  disabled,
}: {
  c: ReturnType<typeof useTokens>['c'];
  glyph: string;
  label: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!disabled }}
      style={[
        styles.stepperBtn,
        { backgroundColor: c.surfaceSunken, borderColor: c.border },
        disabled && styles.stepperBtnDisabled,
      ]}>
      <Text variant="title" style={{ color: c.text }}>
        {glyph}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  group: { gap: Spacing.md },
  card: { padding: Spacing.lg, gap: Spacing.sm },
  line: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap' },
  flex: { flex: 1 },
  semibold: { fontWeight: '600' },
  divider: { height: Spacing.xs },
  ingredients: { gap: Spacing.sm },
  ingredient: { gap: Spacing.sm },
  addBlock: { gap: Spacing.sm, marginTop: Spacing.xs },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  barRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  barLabel: { width: 96 },
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
