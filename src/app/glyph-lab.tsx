/**
 * `/glyph-lab` — the **isolated design harness** for the stylized plant render
 * (ADR 0012, build-order step 2). Registered `href: null` in `_layout.tsx`, so it's
 * reachable at `localhost:8081/glyph-lab` on web and by deep link on device, but
 * **never shown in the tab bar**. It is a dev tool: plain controls, no copy-catalog,
 * no DB.
 *
 * It renders via the same `composePlant` + `<PlantArt>` the planner will import, so a
 * style approved here is literally what ships. Two modes:
 *   - **Gallery** — every `plantType` × the 3 posture families, to judge the whole
 *     kit at a glance (reseed, light/dark, "show old 3 px stick" before/after).
 *   - **Single** — one large specimen with live type/habit chips + height/spread
 *     steppers + a seed shuffle, to tune one glyph and the both-heights ghost.
 */
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { G, Rect } from 'react-native-svg';

import { PlantArt } from '@/components/planner/plant-art';
import { SOIL_BASE_FILL } from '@/components/planner/cross-section-patterns';
import { Colors } from '@/constants/theme';
import { useTokens } from '@/hooks/use-tokens';
import { composePlant, type PostureFamily } from '@/logic/plant-glyphs';
import { GROWTH_HABITS, PLANT_TYPES, type GrowthHabit, type PlantType } from '@/types';

/** Representative dims per posture so each column reads true in the gallery. */
const SAMPLE: Record<PostureFamily, { habit: GrowthHabit; typicalCm: number; maxCm: number; spreadCm: number }> = {
  erect: { habit: 'upright', typicalCm: 20, maxCm: 28, spreadCm: 14 },
  low: { habit: 'mounding', typicalCm: 6, maxCm: 9, spreadCm: 20 },
  trailing: { habit: 'trailing', typicalCm: 8, maxCm: 12, spreadCm: 18 },
};
const POSTURES = Object.keys(SAMPLE) as PostureFamily[];

/** Stable integer seed from a string (mirrors `idSeed`), shifted by the reseed counter. */
function hashStr(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (Math.imul(h, 31) + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

type Palette = ReturnType<typeof useTokens>['c'];

/** One plant base-anchored on a short substrate strip, fit into the cell. */
function Specimen({
  w,
  h,
  type,
  habit,
  typicalCm,
  maxCm,
  spreadCm,
  seed,
  c,
  showStick,
}: {
  w: number;
  h: number;
  type: PlantType;
  habit: GrowthHabit;
  typicalCm: number;
  maxCm: number;
  spreadCm: number;
  seed: number;
  c: Palette;
  showStick: boolean;
}) {
  const stripH = 14;
  const topPad = 10;
  const surfaceY = h - stripH;
  const availH = surfaceY - topPad;
  // One scale for both axes (mirrors the planner's vessel cmToPx), fit to the cell.
  const cmToPx = Math.min(availH / Math.max(1, maxCm), (w * 0.8) / Math.max(1, spreadCm));
  const layout = { widthPx: spreadCm * cmToPx, typicalPx: typicalCm * cmToPx, maxPx: maxCm * cmToPx, seed };
  const composed = composePlant({ plantType: type, growthHabit: habit }, layout);
  const cx = w / 2 + (showStick ? 12 : 0);

  return (
    <Svg width={w} height={h}>
      <Rect x={0} y={surfaceY} width={w} height={stripH} fill={SOIL_BASE_FILL} />
      {showStick ? (
        <Rect x={w / 2 - 14} y={surfaceY - layout.maxPx} width={3} height={layout.maxPx} rx={1.5} fill={c.sage} opacity={0.5} />
      ) : null}
      <G transform={`translate(${cx}, ${surfaceY})`}>
        <PlantArt composed={composed} seed={seed} c={c} />
      </G>
    </Svg>
  );
}

function Chip({ label, active, onPress, c }: { label: string; active: boolean; onPress: () => void; c: Palette }) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.chip, { borderColor: active ? c.primary : c.border, backgroundColor: active ? c.primary : c.surface }]}>
      <Text style={{ color: active ? c.onPrimary : c.text, fontSize: 12 }}>{label}</Text>
    </Pressable>
  );
}

function Stepper({ label, value, set, min, max, step, c }: { label: string; value: number; set: (n: number) => void; min: number; max: number; step: number; c: Palette }) {
  return (
    <View style={styles.stepRow}>
      <Text style={{ color: c.textMuted, fontSize: 13, width: 92 }}>{label}</Text>
      <Pressable onPress={() => set(Math.max(min, value - step))} style={[styles.stepBtn, { borderColor: c.border }]}>
        <Text style={{ color: c.text, fontSize: 16 }}>−</Text>
      </Pressable>
      <Text style={{ color: c.text, fontSize: 14, width: 56, textAlign: 'center' }}>{value} cm</Text>
      <Pressable onPress={() => set(Math.min(max, value + step))} style={[styles.stepBtn, { borderColor: c.border }]}>
        <Text style={{ color: c.text, fontSize: 16 }}>+</Text>
      </Pressable>
    </View>
  );
}

export default function GlyphLab() {
  const { vibe } = useTokens();
  const insets = useSafeAreaInsets();
  const [mode, setMode] = useState<'gallery' | 'single'>('gallery');
  const [dark, setDark] = useState(false);
  const [showStick, setShowStick] = useState(false);
  const [reseed, setReseed] = useState(0);

  // Single-mode state.
  const [type, setType] = useState<PlantType>('aroid');
  const [habit, setHabit] = useState<GrowthHabit>('upright');
  const [typicalCm, setTypicalCm] = useState(20);
  const [maxCm, setMaxCm] = useState(30);
  const [spreadCm, setSpreadCm] = useState(18);

  const c = Colors[vibe][dark ? 'dark' : 'light'];
  const cellW = 108;

  return (
    <ScrollView style={{ backgroundColor: c.background }} contentContainerStyle={{ padding: 16, paddingTop: insets.top + 12, gap: 12 }}>
      <Text style={[styles.title, { color: c.text }]}>Glyph Lab</Text>

      {/* Top controls — mode + lab toggles. */}
      <View style={styles.row}>
        <Chip label="Gallery" active={mode === 'gallery'} onPress={() => setMode('gallery')} c={c} />
        <Chip label="Single" active={mode === 'single'} onPress={() => setMode('single')} c={c} />
        <Chip label={dark ? 'Dark' : 'Light'} active={dark} onPress={() => setDark((v) => !v)} c={c} />
        <Chip label="Reseed" active={false} onPress={() => setReseed((n) => n + 1)} c={c} />
        {mode === 'gallery' ? <Chip label="vs. stick" active={showStick} onPress={() => setShowStick((v) => !v)} c={c} /> : null}
      </View>

      {mode === 'gallery' ? (
        <View style={{ gap: 10 }}>
          <View style={[styles.row, { paddingLeft: 96 }]}>
            {POSTURES.map((p) => (
              <Text key={p} style={{ color: c.textMuted, fontSize: 12, width: cellW, textAlign: 'center' }}>
                {p}
              </Text>
            ))}
          </View>
          {PLANT_TYPES.map((t) => (
            <View key={t} style={styles.galleryRow}>
              <Text style={{ color: c.text, fontSize: 12, width: 88 }}>{t}</Text>
              {POSTURES.map((p) => {
                const s = SAMPLE[p];
                return (
                  <Specimen
                    key={p}
                    w={cellW}
                    h={120}
                    type={t}
                    habit={s.habit}
                    typicalCm={s.typicalCm}
                    maxCm={s.maxCm}
                    spreadCm={s.spreadCm}
                    seed={hashStr(`${t}-${p}`) + reseed * 1000}
                    c={c}
                    showStick={showStick}
                  />
                );
              })}
            </View>
          ))}
        </View>
      ) : (
        <View style={{ gap: 14 }}>
          <View style={[styles.specimenStage, { backgroundColor: c.surfaceSunken, borderColor: c.border }]}>
            <Specimen
              w={300}
              h={300}
              type={type}
              habit={habit}
              typicalCm={typicalCm}
              maxCm={Math.max(typicalCm, maxCm)}
              spreadCm={spreadCm}
              seed={hashStr(`${type}-${habit}`) + reseed * 1000}
              c={c}
              showStick={showStick}
            />
          </View>

          <Text style={[styles.section, { color: c.textMuted }]}>plant type</Text>
          <View style={styles.wrap}>
            {PLANT_TYPES.map((t) => (
              <Chip key={t} label={t} active={t === type} onPress={() => setType(t)} c={c} />
            ))}
          </View>

          <Text style={[styles.section, { color: c.textMuted }]}>growth habit</Text>
          <View style={styles.wrap}>
            {GROWTH_HABITS.map((g) => (
              <Chip key={g} label={g} active={g === habit} onPress={() => setHabit(g)} c={c} />
            ))}
          </View>

          <View style={{ gap: 8, marginTop: 4 }}>
            <Stepper label="typical" value={typicalCm} set={setTypicalCm} min={2} max={120} step={2} c={c} />
            <Stepper label="max" value={maxCm} set={setMaxCm} min={2} max={160} step={2} c={c} />
            <Stepper label="spread" value={spreadCm} set={setSpreadCm} min={3} max={120} step={2} c={c} />
            <View style={styles.row}>
              <Chip label="Shuffle seed" active={false} onPress={() => setReseed((n) => n + 1)} c={c} />
              <Chip label={showStick ? 'Hide stick' : 'vs. stick'} active={showStick} onPress={() => setShowStick((v) => !v)} c={c} />
            </View>
          </View>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 22, fontWeight: '700' },
  section: { fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 4 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  galleryRow: { flexDirection: 'row', alignItems: 'center' },
  chip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, borderWidth: 1 },
  specimenStage: { alignItems: 'center', borderRadius: 12, borderWidth: 1, paddingVertical: 8 },
  stepRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  stepBtn: { width: 34, height: 34, borderRadius: 8, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
});
