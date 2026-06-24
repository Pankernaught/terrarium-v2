/**
 * Substrate step — drainage/substrate **depths** + the opt-in component **mixer**.
 *
 * Substrate depth is a direct stepper. Drainage and charcoal are **optional** layers
 * (null = off) — tapping an off row turns it on at a default depth; tapping an on
 * row turns it off.
 */
import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { CollapsibleCard, Chip, haptics, Meter, Text } from '@/components/ui';
import { Radii, Spacing } from '@/constants/theme';
import { useTokens } from '@/hooks/use-tokens';
import { usePreferences } from '@/hooks/use-preferences';
import { cmToIn, fmtLength, inToCm, lengthUnit } from '@/logic/units';
import { SUBSTRATE_COMPONENTS, componentLabel } from '@/data/substrate-components';
import { defaultLayerDepths } from '@/logic/containers';
import { PROPERTY_LABELS, SUBSTRATE_PROPERTIES } from '@/logic/substrate-matrix';
import {
  activeComponents,
  describeMix,
  mixSubstrate,
  type SubstrateMix,
} from '@/logic/substrateMixer';

import type { StepProps } from './step';

const STEP_CM = 0.5;
const SUBSTRATE_MAX_CM = 20;
const DRAINAGE_MAX_CM = 10;
const CHARCOAL_MAX_CM = 5;
const MIN_PARTS = 1;
const MAX_PARTS = 9;
const CHARCOAL_DEFAULT_CM = 1.5;
const DRAINAGE_DEFAULT_CM = 3;

export function SubstrateStep({ draft, plants, update }: StepProps) {
  const { c } = useTokens();
  const { units } = usePreferences();
  const { containerVolumeL, substrateDepth, drainageDepth, charcoalDepth, substrateMix } = draft;

  // Prevents the seeding effect from immediately re-enabling drainage after the
  // owner explicitly toggles it off (null ≠ "not yet seeded" in that case).
  const drainageExplicitlyOff = useRef(false);

  useEffect(() => {
    if (containerVolumeL == null) return;
    if (substrateDepth != null && (drainageDepth != null || drainageExplicitlyOff.current)) return;
    const [seededSubstrate, seededDrainage] = defaultLayerDepths(plants, containerVolumeL);
    update({
      substrateDepth: substrateDepth ?? seededSubstrate,
      drainageDepth: drainageExplicitlyOff.current ? null : (drainageDepth ?? seededDrainage),
    });
  }, [containerVolumeL, substrateDepth, drainageDepth, plants, update]);

  // --- Custom-mix recipe editing (opt-in; persisted to draft.substrateMix) -----
  const mix: SubstrateMix = substrateMix ?? {};
  const added = activeComponents(mix);
  const addedIds = new Set(added);
  const remaining = SUBSTRATE_COMPONENTS.filter((comp) => !addedIds.has(comp.id));
  const stats = mixSubstrate(mix);

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

  const substrate = substrateDepth ?? 0;
  const drainage = drainageDepth ?? 0;
  const drainageOn = drainageDepth != null;
  const charcoalOn = charcoalDepth != null;
  const charcoal = charcoalDepth ?? 0;

  // The depth stepper works in the display unit so it steps by a clean 0.5 cm / 0.5
  // in (snapped to that grid), then converts back to the cm we store.
  const imperial = units === 'imperial';
  const snapHalf = (x: number) => Math.round(x / 0.5) * 0.5;
  const substrateDisp = imperial ? snapHalf(cmToIn(substrate)) : substrate;
  const substrateMaxDisp = imperial ? Math.floor(cmToIn(SUBSTRATE_MAX_CM) / 0.5) * 0.5 : SUBSTRATE_MAX_CM;

  function toggleDrainage() {
    haptics.select();
    if (drainageOn) {
      drainageExplicitlyOff.current = true;
      update({ drainageDepth: null });
    } else {
      drainageExplicitlyOff.current = false;
      update({ drainageDepth: DRAINAGE_DEFAULT_CM });
    }
  }

  function toggleCharcoal() {
    haptics.select();
    update({ charcoalDepth: charcoalOn ? null : CHARCOAL_DEFAULT_CM });
  }

  const [open, setOpenState] = useState({
    layerDepths: true,
    customMix: true,
    mixCharacter: false,
  });
  function toggle(key: keyof typeof open) {
    setOpenState((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  const layerDepthsSummary = [
    `${fmtLength(substrate, units)} substrate`,
    drainageOn ? `${fmtLength(drainage, units)} drainage` : null,
    charcoalOn ? `${fmtLength(charcoal, units)} charcoal` : null,
  ]
    .filter(Boolean)
    .join(' · ');

  const customMixSummary =
    added.length === 0
      ? 'None built'
      : `${added.length} ingredient${added.length !== 1 ? 's' : ''}`;
  const mixCharacterSummary = stats ? describeMix(stats) : 'No mix built';

  return (
    <View style={styles.group}>
      {containerVolumeL == null ? (
        <CollapsibleCard
          title="Layer depths"
          isOpen={open.layerDepths}
          onToggle={() => toggle('layerDepths')}>
          <Text variant="body" role="textMuted">
            Set the container in the previous step to size the layers.
          </Text>
        </CollapsibleCard>
      ) : (
        <CollapsibleCard
          title="Layer depths"
          summary={layerDepthsSummary}
          isOpen={open.layerDepths}
          onToggle={() => toggle('layerDepths')}>
          <Text variant="overline" role="textMuted">
            Substrate depth
          </Text>
          <Stepper
            c={c}
            value={substrateDisp}
            max={substrateMaxDisp}
            step={STEP_CM}
            unit={lengthUnit(units)}
            format={String}
            decLabel="Decrease depth"
            incLabel="Increase depth"
            onChange={(n) => update({ substrateDepth: imperial ? Number(inToCm(n).toFixed(2)) : n })}
          />

          <View style={styles.divider} />

          <Text variant="overline" role="textMuted">
            Drainage
          </Text>
          <OptionalLayerRow
            c={c}
            on={drainageOn}
            onLabel={`Included · ${fmtLength(drainage, units)}`}
            offLabel="Not included"
            description="A drainage layer at the base keeps roots out of standing water."
            accessibilityLabel={drainageOn ? 'Edit drainage layer depth' : 'Add a drainage layer'}
            onPress={toggleDrainage}
          />

          <View style={styles.divider} />

          <Text variant="overline" role="textMuted">
            Charcoal layer
          </Text>
          <OptionalLayerRow
            c={c}
            on={charcoalOn}
            onLabel={`Included · ${fmtLength(charcoal, units)}`}
            offLabel="Not included"
            description="A thin charcoal layer between drainage and substrate keeps a closed build from souring."
            accessibilityLabel={
              charcoalOn ? 'Edit charcoal layer depth' : 'Add a charcoal filtration layer'
            }
            onPress={toggleCharcoal}
          />
        </CollapsibleCard>
      )}

      {/* Custom mix — opt-in, add-then-tune. Starts open. */}
      <CollapsibleCard
        title="Custom mix (optional)"
        summary={customMixSummary}
        isOpen={open.customMix}
        onToggle={() => toggle('customMix')}>
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
      </CollapsibleCard>

      {/* Mix character — only shown once the recipe has any parts */}
      {stats && (
        <CollapsibleCard
          title="Mix character"
          summary={mixCharacterSummary}
          isOpen={open.mixCharacter}
          onToggle={() => toggle('mixCharacter')}>
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
        </CollapsibleCard>
      )}

    </View>
  );
}

// --- OptionalLayerRow --------------------------------------------------------

function OptionalLayerRow({
  c,
  on,
  onLabel,
  offLabel,
  description,
  accessibilityLabel,
  onPress,
}: {
  c: ReturnType<typeof useTokens>['c'];
  on: boolean;
  onLabel: string;
  offLabel: string;
  description: string;
  accessibilityLabel: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={[styles.toggleRow, { borderColor: c.border }]}>
      <View style={styles.flex}>
        <Text variant="body" style={styles.semibold}>
          {on ? onLabel : offLabel}
        </Text>
        <Text variant="caption" role="textMuted">
          {description}
        </Text>
      </View>
      <View
        style={[
          styles.switch,
          {
            backgroundColor: on ? c.primary : c.surfaceSunken,
            borderColor: on ? c.primary : c.border,
          },
        ]}>
        <View
          style={[
            styles.knob,
            { backgroundColor: on ? c.onPrimary : c.background },
            on ? styles.knobOn : styles.knobOff,
          ]}
        />
      </View>
    </Pressable>
  );
}

// --- Stepper -----------------------------------------------------------------

/**
 * A −/＋ stepper around a numeric value, clamped to [min, max] in `step` increments.
 * Shared by the cm depths (step 0.5) and the integer parts steppers (step 1).
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
      <StepperButton
        c={c}
        glyph="−"
        label={decLabel}
        disabled={value <= min}
        onPress={() => bump(-step)}
      />
      <View style={styles.stepperValue}>
        <Text variant="title">{format(value)}</Text>
        <Text variant="caption" role="textMuted">
          {unit}
        </Text>
      </View>
      <StepperButton
        c={c}
        glyph="＋"
        label={incLabel}
        disabled={value >= max}
        onPress={() => bump(step)}
      />
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
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderWidth: 1,
    borderRadius: Radii.md,
  },
  switch: {
    width: 48,
    height: 28,
    borderRadius: Radii.pill,
    borderWidth: 1,
    justifyContent: 'center',
    padding: 2,
  },
  knob: { width: 22, height: 22, borderRadius: Radii.pill },
  knobOn: { alignSelf: 'flex-end' },
  knobOff: { alignSelf: 'flex-start' },
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
