import React, {useEffect, useRef} from 'react';
import {View, Text, StyleSheet, Animated, Easing, TouchableOpacity} from 'react-native';
import {useTheme} from '../../context/ThemeContext';

// ─── Smooth gradient orb ──────────────────────────────────────────────────────

const ORB = 110;
const NUM_LAYERS = 22;

// Color stops: t=0 is outermost edge, t=1 is center
// Each stop: [t, r, g, b, alpha]
const STOPS: [number, number, number, number, number][] = [
  [0.00,   6,  18,  70, 0.00],
  [0.12,  10,  38, 130, 0.28],
  [0.28,  18,  72, 210, 0.58],
  [0.45,  42, 118, 248, 0.76],
  [0.60,  80, 158, 255, 0.86],
  [0.74, 130, 192, 255, 0.91],
  [0.86, 175, 218, 255, 0.94],
  [1.00, 215, 237, 255, 0.97],
];

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

function colorAt(t: number): string {
  let lo = STOPS[0];
  let hi = STOPS[STOPS.length - 1];
  for (let i = 0; i < STOPS.length - 1; i++) {
    if (t >= STOPS[i][0] && t <= STOPS[i + 1][0]) {
      lo = STOPS[i];
      hi = STOPS[i + 1];
      break;
    }
  }
  const span = hi[0] - lo[0];
  const lt = span === 0 ? 0 : (t - lo[0]) / span;
  const r = Math.round(lerp(lo[1], hi[1], lt));
  const g = Math.round(lerp(lo[2], hi[2], lt));
  const b = Math.round(lerp(lo[3], hi[3], lt));
  const a = lerp(lo[4], hi[4], lt);
  return `rgba(${r},${g},${b},${a.toFixed(3)})`;
}

// Pre-compute layers: i=0 → outermost/largest, i=NUM_LAYERS-1 → innermost/smallest
const LAYERS = Array.from({length: NUM_LAYERS}, (_, i) => {
  const t = i / (NUM_LAYERS - 1);      // 0=edge, 1=center
  const size = ORB * (1 - t * 0.86);   // ORB → ORB*0.14
  return {size, color: colorAt(t)};
});

// ─── Orb component ────────────────────────────────────────────────────────────

function VoiceOrb() {
  const breathe = useRef(new Animated.Value(0)).current;
  const glow    = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const breatheLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(breathe, {toValue: 1, duration: 2200, easing: Easing.inOut(Easing.sin), useNativeDriver: true}),
        Animated.timing(breathe, {toValue: 0, duration: 2200, easing: Easing.inOut(Easing.sin), useNativeDriver: true}),
      ]),
    );
    // inner glow pulses slightly out of phase
    const glowLoop = Animated.loop(
      Animated.sequence([
        Animated.delay(600),
        Animated.timing(glow, {toValue: 1, duration: 1800, easing: Easing.inOut(Easing.sin), useNativeDriver: true}),
        Animated.timing(glow, {toValue: 0, duration: 1800, easing: Easing.inOut(Easing.sin), useNativeDriver: true}),
      ]),
    );
    breatheLoop.start();
    glowLoop.start();
    return () => { breatheLoop.stop(); glowLoop.stop(); };
  }, [breathe, glow]);

  const scale = breathe.interpolate({inputRange: [0, 1], outputRange: [1, 1.09]});

  // Inner layers (brighter) fade up slightly with glow
  const innerOpacity = glow.interpolate({inputRange: [0, 1], outputRange: [0.85, 1.0]});

  const INNER_CUTOFF = Math.floor(NUM_LAYERS * 0.55); // bottom 55% are "inner"

  return (
    <Animated.View style={[orb.root, {width: ORB, height: ORB, transform: [{scale}]}]}>
      {LAYERS.map((layer, i) => {
        const isInner = i >= INNER_CUTOFF;
        return isInner ? (
          <Animated.View
            key={i}
            style={[
              orb.layer,
              {
                width: layer.size,
                height: layer.size,
                borderRadius: layer.size / 2,
                backgroundColor: layer.color,
                opacity: innerOpacity,
              },
            ]}
          />
        ) : (
          <View
            key={i}
            style={[
              orb.layer,
              {
                width: layer.size,
                height: layer.size,
                borderRadius: layer.size / 2,
                backgroundColor: layer.color,
              },
            ]}
          />
        );
      })}
    </Animated.View>
  );
}

const orb = StyleSheet.create({
  root:      {alignItems: 'center', justifyContent: 'center'},
  layer:     {position: 'absolute'},
});

// ─── Inline panel (rendered above the input row, not a modal) ─────────────────

interface Props {
  visible: boolean;
  status?: 'listening' | 'processing' | 'speaking';
  /** Mic is muted for assistant output — show explicit interrupt affordance */
  showInterruptButton?: boolean;
  onInterrupt?: () => void;
}

export default function VoiceModePanel({
  visible,
  status = 'listening',
  showInterruptButton = false,
  onInterrupt,
}: Props) {
  const {isDark} = useTheme();
  const fade  = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.75)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(fade,  {toValue: 1, duration: 280, useNativeDriver: true}),
        Animated.spring(scale, {toValue: 1, tension: 130, friction: 8, useNativeDriver: true}),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(fade,  {toValue: 0, duration: 180, useNativeDriver: true}),
        Animated.timing(scale, {toValue: 0.75, duration: 180, useNativeDriver: true}),
      ]).start();
    }
  }, [visible, fade, scale]);

  if (!visible) {return null;}

  return (
    <Animated.View style={[s.panel, {opacity: fade, transform: [{scale}]}]}>
      <VoiceOrb />
      <Text style={s.status}>
        {status === 'processing' ? 'Processing…' : status === 'speaking' ? 'Speaking…' : 'Listening…'}
      </Text>
      {showInterruptButton && onInterrupt ? (
        <TouchableOpacity
          style={[
            s.interruptBtn,
            isDark
              ? {borderColor: 'rgba(255,255,255,0.45)', backgroundColor: 'rgba(255,255,255,0.12)'}
              : {borderColor: 'rgba(10,12,20,0.18)', backgroundColor: 'rgba(10,12,20,0.06)'},
          ]}
          onPress={onInterrupt}
          activeOpacity={0.85}
          accessibilityRole="button"
          accessibilityLabel="Tap to interrupt assistant">
          <Text style={[s.interruptLabel, isDark ? {color: 'rgba(255,255,255,0.92)'} : {color: 'rgba(10,12,20,0.88)'}]}>
            Tap to interrupt
          </Text>
        </TouchableOpacity>
      ) : null}
    </Animated.View>
  );
}

const s = StyleSheet.create({
  panel: {
    alignItems:    'center',
    paddingTop:    18,
    paddingBottom: 12,
    gap:           12,
  },
  status: {
    color:       'rgba(160,180,220,0.80)',
    fontSize:    13,
    fontWeight:  '500',
    letterSpacing: 0.3,
  },
  interruptBtn: {
    marginTop:         4,
    paddingVertical:   10,
    paddingHorizontal: 18,
    borderRadius:      20,
    borderWidth:       StyleSheet.hairlineWidth,
  },
  interruptLabel: {
    fontSize:       14,
    fontWeight:     '600',
    letterSpacing:  0.2,
  },
});
