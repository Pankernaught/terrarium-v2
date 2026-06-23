/**
 * Container step — the build's first form step. The owner picks a **shape**
 * (rectangular | cylindrical), enters **dimensions** in cm, and chooses an
 * **opening** (sealed | lidded | open). The interior **volume** is read live off
 * the pure `computeVolumeL` and shown as a stat; every edit shallow-merges back
 * into the shared {@link PlannerDraft} via `update`. A hand-edit to geometry drops
 * `containerSlug` (it's now a custom container, not a preset).
 *
 * "Size from plants" applies `recommendContainerDimensions` (pure) when plants are
 * already chosen — its rationale lines render as muted captions. With no plants
 * (a brand-new build) that path is disabled.
 *
 * Pure & presentational: data in via props, geometry via `@/logic/containers`.
 * Nothing from `@/db` / `@/data`. All `update` calls happen in event handlers /
 * effects — never during render.
 */
import { useState } from 'react';
import { InputAccessoryView, Keyboard, Platform, Pressable, StyleSheet, TextInput, View } from 'react-native';

import { CollapsibleCard, Chip, haptics, StatStrip, Text } from '@/components/ui';
import { Radii, Spacing } from '@/constants/theme';
import { useTokens } from '@/hooks/use-tokens';
import {
  type Dimensions,
  computeVolumeL,
  recommendContainerDimensions,
} from '@/logic/containers';
import type { ContainerOpening, ContainerShape } from '@/types';

import type { StepProps } from './step';

const SHAPES: ContainerShape[] = ['rectangular', 'cylindrical'];
const OPENINGS: ContainerOpening[] = ['sealed', 'lidded', 'open'];

// iOS number pads have no return/Done key, so the decimal dimension fields share a
// "Done" accessory bar above the keyboard to dismiss it (no-op id on Android).
const DIM_ACCESSORY_ID = 'container-dimensions';

const SHAPE_LABEL: Record<ContainerShape, string> = {
  rectangular: 'Rectangular',
  cylindrical: 'Cylindrical',
};
const OPENING_LABEL: Record<ContainerOpening, string> = {
  sealed: 'Sealed',
  lidded: 'Lidded',
  open: 'Open',
};

/** The dimension keys each shape collects (drives which inputs render). */
const FIELDS: Record<ContainerShape, (keyof Dimensions)[]> = {
  rectangular: ['length', 'width', 'height'],
  cylindrical: ['diameter', 'height'],
};

/** Starter dimensions (cm) pre-filled when a shape is selected on a blank draft. */
const DEFAULT_DIMS: Record<ContainerShape, Dimensions> = {
  rectangular: { length: 30, width: 20, height: 25 },
  cylindrical: { diameter: 20, height: 30 },
};

const DEFAULT_OPENING: ContainerOpening = 'lidded';
const FIELD_LABEL: Record<keyof Dimensions, string> = {
  length: 'Length',
  width: 'Width',
  height: 'Height',
  diameter: 'Diameter',
};

/** Mirror a dimension bag into the controlled string state used by the inputs. */
function toStrings(dims: Dimensions | null): Record<string, string> {
  if (!dims) return {};
  const out: Record<string, string> = {};
  for (const k of Object.keys(dims) as (keyof Dimensions)[]) {
    const v = dims[k];
    if (typeof v === 'number' && Number.isFinite(v)) out[k] = String(v);
  }
  return out;
}

/** Parse the string state into a numeric bag, dropping empty/invalid entries. */
function toDimensions(strings: Record<string, string>): Dimensions {
  const out: Dimensions = {};
  for (const k of Object.keys(strings) as (keyof Dimensions)[]) {
    const n = Number(strings[k]);
    if (strings[k].trim() !== '' && Number.isFinite(n)) out[k] = n;
  }
  return out;
}

/** Volume in litres for a shape + dims, or `null` while the geometry is incomplete. */
function safeVolume(shape: ContainerShape | null, dims: Dimensions): number | null {
  if (!shape) return null;
  try {
    return computeVolumeL(shape, dims);
  } catch {
    return null;
  }
}

export function ContainerStep({ draft, plants, update }: StepProps) {
  const { c } = useTokens();

  const [shape, setShape] = useState<ContainerShape | null>(draft.containerShape);
  const [opening, setOpening] = useState<ContainerOpening | null>(draft.containerOpening);
  // Dimensions live as strings so a partial entry like "1" never crashes the parse.
  const [dimStr, setDimStr] = useState<Record<string, string>>(() => toStrings(draft.containerDimensions));
  const [rationale, setRationale] = useState<string[]>([]);

  // Step-level collapse state: primary cards start open, secondary starts collapsed.
  const [open, setOpen] = useState({ shape: true, dimensions: true, opening: true, sizeFromPlants: false });
  function toggle(key: keyof typeof open) {
    setOpen((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  const dims = toDimensions(dimStr);
  const volumeL = safeVolume(shape, dims);
  const fields = shape ? FIELDS[shape] : [];
  const canSizeFromPlants = plants.length > 0;

  // --- Collapse summary strings ---
  const shapeSummary = shape ? SHAPE_LABEL[shape] : 'Not set';
  const dimSummary =
    shape && fields.every((k) => dimStr[k])
      ? fields.map((k) => dimStr[k]).join(' × ') + ' cm'
      : 'Not set';
  const openingSummary = opening ? OPENING_LABEL[opening] : 'Not set';
  const sizeFromPlantsSummary = canSizeFromPlants
    ? `${plants.length} plant${plants.length !== 1 ? 's' : ''}`
    : 'Add plants first';

  function pickShape(next: ContainerShape) {
    if (next === shape) return;
    haptics.select();

    // Map dimensions to the new shape so the cross-section never goes blank.
    // rect → cyl: carry length as diameter; cyl → rect: carry diameter as length.
    // Height is always preserved. When nothing exists yet, seed the defaults.
    const hasAny = Object.values(dimStr).some((v) => v !== '');
    let nextDimStr: Record<string, string>;
    if (!hasAny) {
      nextDimStr = toStrings(DEFAULT_DIMS[next]);
    } else if (next === 'cylindrical') {
      nextDimStr = {};
      const d = dimStr.diameter ?? dimStr.length;
      if (d) nextDimStr.diameter = d;
      if (dimStr.height) nextDimStr.height = dimStr.height;
    } else {
      nextDimStr = {};
      const l = dimStr.length ?? dimStr.diameter;
      if (l) nextDimStr.length = l;
      if (dimStr.width) nextDimStr.width = dimStr.width;
      if (dimStr.height) nextDimStr.height = dimStr.height;
    }

    const nextDims = toDimensions(nextDimStr);
    const nextOpening = opening ?? DEFAULT_OPENING;
    setDimStr(nextDimStr);
    setShape(next);
    if (!opening) setOpening(nextOpening);
    update({
      containerShape: next,
      containerDimensions: Object.keys(nextDims).length > 0 ? nextDims : null,
      containerVolumeL: safeVolume(next, nextDims),
      containerOpening: nextOpening,
      containerSlug: null,
    });
  }

  function pickOpening(next: ContainerOpening) {
    if (next === opening) return;
    haptics.select();
    setOpening(next);
    update({ containerOpening: next, containerSlug: null });
  }

  function editDim(key: keyof Dimensions, text: string) {
    // Keep only digits and a single decimal point; tolerate empty/partial input.
    const cleaned = text.replace(/[^0-9.]/g, '');
    // Compute next dims synchronously from the current dimStr so the draft and
    // the cross-section update in the same render cycle (no effect lag).
    const nextDimStr = { ...dimStr, [key]: cleaned };
    setDimStr(nextDimStr);
    const nextDims = toDimensions(nextDimStr);
    update({
      containerSlug: null,
      containerDimensions: Object.keys(nextDims).length > 0 ? nextDims : null,
      containerVolumeL: safeVolume(shape, nextDims),
    });
  }

  function sizeFromPlants() {
    if (plants.length === 0) return;
    haptics.select();
    const rec = recommendContainerDimensions(plants);
    setShape(rec.shape);
    setOpening(rec.opening);
    setDimStr(toStrings(rec.dimensions));
    setRationale(rec.rationale);
    // Reflect the recommendation into the draft immediately (the effect also runs,
    // but this carries slug + volume in one merge).
    update({
      containerShape: rec.shape,
      containerDimensions: rec.dimensions,
      containerOpening: rec.opening,
      containerVolumeL: rec.volumeL,
      containerSlug: null,
    });
  }

  return (
    <View style={styles.root}>
      {/* Shape */}
      <CollapsibleCard
        title="Shape"
        summary={shapeSummary}
        isOpen={open.shape}
        onToggle={() => toggle('shape')}>
        <View style={styles.chipRow}>
          {SHAPES.map((s) => (
            <Chip
              key={s}
              label={SHAPE_LABEL[s]}
              tone="primary"
              selected={shape === s}
              onPress={() => pickShape(s)}
            />
          ))}
        </View>
      </CollapsibleCard>

      {/* Dimensions */}
      <CollapsibleCard
        title="Dimensions (cm)"
        summary={dimSummary}
        isOpen={open.dimensions}
        onToggle={() => toggle('dimensions')}>
        {shape ? (
          <View style={styles.dimRow}>
            {fields.map((key) => (
              <View key={key} style={styles.dimField}>
                <Text variant="overline" role="textMuted">
                  {FIELD_LABEL[key]}
                </Text>
                <TextInput
                  value={dimStr[key] ?? ''}
                  onChangeText={(t) => editDim(key, t)}
                  inputMode="decimal"
                  inputAccessoryViewID={Platform.OS === 'ios' ? DIM_ACCESSORY_ID : undefined}
                  placeholder="0"
                  placeholderTextColor={c.textMuted}
                  accessibilityLabel={`${FIELD_LABEL[key]} in centimetres`}
                  style={[
                    styles.input,
                    { backgroundColor: c.surfaceSunken, borderColor: c.border, color: c.text },
                  ]}
                />
              </View>
            ))}
          </View>
        ) : (
          <Text variant="caption" role="textMuted">
            Pick a shape to set its dimensions.
          </Text>
        )}
        <StatStrip
          items={[{ label: 'Volume', value: volumeL != null ? `${volumeL} L` : '—' }]}
        />
      </CollapsibleCard>

      {/* Opening */}
      <CollapsibleCard
        title="Opening"
        summary={openingSummary}
        isOpen={open.opening}
        onToggle={() => toggle('opening')}>
        <View style={styles.chipRow}>
          {OPENINGS.map((o) => (
            <Chip
              key={o}
              label={OPENING_LABEL[o]}
              tone="sage"
              selected={opening === o}
              onPress={() => pickOpening(o)}
            />
          ))}
        </View>
      </CollapsibleCard>

      {/* Size from plants */}
      <CollapsibleCard
        title="Size from plants"
        summary={sizeFromPlantsSummary}
        isOpen={open.sizeFromPlants}
        onToggle={() => toggle('sizeFromPlants')}>
        <Pressable
          onPress={sizeFromPlants}
          disabled={!canSizeFromPlants}
          accessibilityRole="button"
          accessibilityState={{ disabled: !canSizeFromPlants }}
          style={[
            styles.sizeBtn,
            canSizeFromPlants
              ? { backgroundColor: c.primary }
              : { backgroundColor: c.surfaceSunken, borderWidth: 1, borderColor: c.border },
          ]}>
          <Text
            variant="body"
            style={{ color: canSizeFromPlants ? c.onPrimary : c.textMuted, fontWeight: '600' }}>
            Size from plants
          </Text>
        </Pressable>

        {canSizeFromPlants ? (
          rationale.length > 0 ? (
            <View style={styles.rationale}>
              {rationale.map((line) => (
                <Text key={line} variant="caption" role="textMuted">
                  • {line}
                </Text>
              ))}
            </View>
          ) : (
            <Text variant="caption" role="textMuted">
              Suggests a shape, size, and opening from your {plants.length} selected plant
              {plants.length !== 1 ? 's' : ''}.
            </Text>
          )
        ) : (
          <Text variant="caption" role="textMuted">
            Pick plants first to size the container from them.
          </Text>
        )}
      </CollapsibleCard>

      {/* Shared "Done" bar for the decimal dimension fields (iOS number pad has no
          return key); also dismissible by dragging the planner scroll. */}
      {Platform.OS === 'ios' ? (
        <InputAccessoryView nativeID={DIM_ACCESSORY_ID}>
          <View style={[styles.accessory, { backgroundColor: c.surface, borderTopColor: c.border }]}>
            <Pressable onPress={Keyboard.dismiss} accessibilityRole="button" hitSlop={8}>
              <Text variant="body" role="primary" style={styles.accessoryDone}>
                Done
              </Text>
            </Pressable>
          </View>
        </InputAccessoryView>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: Spacing.md },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  dimRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.md },
  dimField: { gap: Spacing.xs, flexGrow: 1, minWidth: 88 },
  input: {
    borderWidth: 1,
    borderRadius: Radii.md,
    paddingHorizontal: Spacing.md,
    minHeight: 44,
    fontSize: 16,
  },
  sizeBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
    paddingHorizontal: Spacing.md,
    borderRadius: Radii.md,
    alignSelf: 'flex-start',
  },
  rationale: { gap: Spacing.xs },
  accessory: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  accessoryDone: { fontWeight: '600' },
});
