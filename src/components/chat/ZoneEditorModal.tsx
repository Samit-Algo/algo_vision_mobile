import React, {useCallback, useEffect, useState} from 'react';
import {
  Modal,
  View,
  Text,
  Pressable,
  Image,
  StyleSheet,
  ActivityIndicator,
  Dimensions,
  ScrollView,
} from 'react-native';
import Svg, {Polygon, Line, Circle} from 'react-native-svg';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {useTheme} from '../../context/ThemeContext';

const SCREEN_W = Dimensions.get('window').width;

export type ZoneEditorMode = 'line' | 'polygon' | 'motion_rois';

export interface ZoneEditorModalProps {
  visible: boolean;
  onClose: () => void;
  snapshotUri: string;
  cameraId: string;
  zoneMode: ZoneEditorMode;
  onSave: (zoneData: unknown) => Promise<void> | void;
  busy?: boolean;
}

type Pt = {x: number; y: number};

function toNorm(pts: Pt[], w: number, h: number): [number, number][] {
  return pts.map(p => [
    Math.max(0, Math.min(1, p.x / w)),
    Math.max(0, Math.min(1, p.y / h)),
  ]);
}

function polygonToBoundingBox(pts: Pt[]) {
  let x1 = pts[0].x;
  let y1 = pts[0].y;
  let x2 = pts[0].x;
  let y2 = pts[0].y;
  for (const p of pts) {
    x1 = Math.min(x1, p.x);
    x2 = Math.max(x2, p.x);
    y1 = Math.min(y1, p.y);
    y2 = Math.max(y2, p.y);
  }
  return {x1, y1, x2, y2};
}

/**
 * Zone drawing — same data model as `layout/chatbot-zone-editor.js` (normalized coords for
 * line/polygon; motion_rois → image-pixel bboxes per loom).
 */
export default function ZoneEditorModal({
  visible,
  onClose,
  snapshotUri,
  cameraId,
  zoneMode,
  onSave,
  busy,
}: ZoneEditorModalProps) {
  const {colors, isDark} = useTheme();
  const insets = useSafeAreaInsets();

  const [iw, setIw] = useState(0);
  const [ih, setIh] = useState(0);
  const [dispW, setDispW] = useState(0);
  const [dispH, setDispH] = useState(0);
  const [loadErr, setLoadErr] = useState<string | null>(null);

  const [linePts, setLinePts] = useState<Pt[]>([]);
  const [polyPts, setPolyPts] = useState<Pt[]>([]);
  const [motionDone, setMotionDone] = useState<Pt[][]>([]);
  const [motionCur, setMotionCur] = useState<Pt[]>([]);

  useEffect(() => {
    if (!visible || !snapshotUri) {
      return;
    }
    setLoadErr(null);
    Image.getSize(
      snapshotUri,
      (w, h) => {
        setIw(w);
        setIh(h);
        const maxW = Math.min(360, SCREEN_W - 32);
        const dw = maxW;
        const dh = (maxW / w) * h;
        setDispW(dw);
        setDispH(dh);
      },
      () => setLoadErr('Could not read image size'),
    );
    setLinePts([]);
    setPolyPts([]);
    setMotionDone([]);
    setMotionCur([]);
  }, [visible, snapshotUri]);

  const layoutW = dispW;
  const layoutH = dispH;

  const onCanvasPress = useCallback(
    (lx: number, ly: number) => {
      if (busy || layoutW <= 0) {
        return;
      }
      const x = Math.max(0, Math.min(layoutW, lx));
      const y = Math.max(0, Math.min(layoutH, ly));
      const p = {x, y};

      if (zoneMode === 'line') {
        setLinePts(prev => {
          if (prev.length < 2) {
            return [...prev, p];
          }
          return [prev[0], p];
        });
      } else if (zoneMode === 'polygon') {
        setPolyPts(prev => [...prev, p]);
      } else {
        setMotionCur(prev => [...prev, p]);
      }
    },
    [busy, layoutH, layoutW, zoneMode],
  );

  const undo = () => {
    if (zoneMode === 'line') {
      setLinePts(prev => prev.slice(0, -1));
    } else if (zoneMode === 'polygon') {
      setPolyPts(prev => prev.slice(0, -1));
    } else {
      setMotionCur(prev => prev.slice(0, -1));
    }
  };

  const clear = () => {
    setLinePts([]);
    setPolyPts([]);
    setMotionDone([]);
    setMotionCur([]);
  };

  const completeRoi = () => {
    if (motionCur.length < 3) {
      return;
    }
    setMotionDone(d => [...d, [...motionCur]]);
    setMotionCur([]);
  };

  const save = async () => {
    if (!iw || !ih || layoutW <= 0 || busy) {
      return;
    }

    try {
      if (zoneMode === 'line') {
        if (linePts.length !== 2) {
          return;
        }
        const coords = toNorm(linePts, layoutW, layoutH);
        await onSave({
          zone: {type: 'line', coordinates: coords},
          image: {width: iw, height: ih},
          camera_id: cameraId,
        });
        onClose();
        return;
      }

      if (zoneMode === 'polygon') {
        if (polyPts.length < 3) {
          return;
        }
        const coords = toNorm(polyPts, layoutW, layoutH);
        await onSave({
          zone: {type: 'polygon', coordinates: coords},
          image: {width: iw, height: ih},
          camera_id: cameraId,
        });
        onClose();
        return;
      }

      const allPolygons = [...motionDone];
      if (motionCur.length >= 3) {
        allPolygons.push([...motionCur]);
      }
      if (allPolygons.length < 1) {
        return;
      }

      const cw = layoutW;
      const ch = layoutH;
      const looms = allPolygons.map((pts, i) => {
        const box = polygonToBoundingBox(pts);
        let ix1 = Math.round((box.x1 / cw) * iw);
        let iy1 = Math.round((box.y1 / ch) * ih);
        let ix2 = Math.round((box.x2 / cw) * iw);
        let iy2 = Math.round((box.y2 / ch) * ih);
        ix1 = Math.max(0, Math.min(iw, ix1));
        iy1 = Math.max(0, Math.min(ih, iy1));
        ix2 = Math.max(0, Math.min(iw, ix2));
        iy2 = Math.max(0, Math.min(ih, iy2));
        if (ix2 <= ix1) {
          ix2 = ix1 + 1;
        }
        if (iy2 <= iy1) {
          iy2 = iy1 + 1;
        }
        return {
          loom_id: `loom-${String(i + 1).padStart(2, '0')}`,
          name: `Machine ${i + 1}`,
          motion_roi: [ix1, iy1, ix2, iy2],
        };
      });

      await onSave({
        zone: {type: 'motion_rois', looms},
        image: {width: iw, height: ih},
        camera_id: cameraId,
      });
      onClose();
    } catch {
      /* parent handles */
    }
  };

  const title =
    zoneMode === 'line'
      ? 'Draw counting line'
      : zoneMode === 'motion_rois'
        ? 'Draw motion ROIs'
        : 'Draw monitoring zone';

  const panelBg = isDark ? '#1a1d28' : '#f6f7fb';
  const border = isDark ? '#3a3f52' : '#dde1ec';
  const sub = colors.subText;

  const renderMotionPolygons = () => {
    const all = [...motionDone];
    if (motionCur.length) {
      all.push(motionCur);
    }
    return all;
  };

  const polyString = (pts: Pt[]) => pts.map(p => `${p.x},${p.y}`).join(' ');

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={[styles.overlay, {paddingTop: insets.top + 8, paddingBottom: insets.bottom + 8}]}>
        <Pressable style={styles.backdrop} onPress={onClose} disabled={busy} />
        <View style={[styles.sheet, {backgroundColor: panelBg, borderColor: border}]}>
          <View style={styles.sheetHeader}>
            <Text style={[styles.sheetTitle, {color: colors.text}]}>{title}</Text>
            <Text style={[styles.sheetSub, {color: sub}]}>
              Tap to place points. {zoneMode === 'line' ? 'Two points for a line.' : zoneMode === 'polygon' ? 'At least 3 points.' : 'Complete each ROI (3+ points), then Save.'}
            </Text>
          </View>

          {loadErr ? (
            <Text style={[styles.err, {color: colors.danger}]}>{loadErr}</Text>
          ) : !layoutW ? (
            <ActivityIndicator style={{marginVertical: 24}} color={colors.accent} />
          ) : (
            <ScrollView showsVerticalScrollIndicator={false} bounces={false}>
              <View style={[styles.canvasWrap, {width: layoutW, height: layoutH}]}>
                <Image
                  source={{uri: snapshotUri}}
                  style={{width: layoutW, height: layoutH}}
                  resizeMode="stretch"
                />
                <Svg width={layoutW} height={layoutH} style={StyleSheet.absoluteFill}>
                  {zoneMode === 'motion_rois'
                    ? renderMotionPolygons().map((pts, idx) => {
                        if (pts.length < 2) {
                          return null;
                        }
                        if (pts.length === 2) {
                          return (
                            <Line
                              key={`m-${idx}`}
                              x1={pts[0].x}
                              y1={pts[0].y}
                              x2={pts[1].x}
                              y2={pts[1].y}
                              stroke="rgba(42,123,228,0.95)"
                              strokeWidth={2}
                            />
                          );
                        }
                        return (
                          <Polygon
                            key={`m-${idx}`}
                            points={polyString(pts)}
                            fill="rgba(42,123,228,0.18)"
                            stroke="rgba(42,123,228,0.95)"
                            strokeWidth={2}
                          />
                        );
                      })
                    : null}
                  {zoneMode === 'polygon' && polyPts.length === 2 ? (
                    <Line
                      x1={polyPts[0].x}
                      y1={polyPts[0].y}
                      x2={polyPts[1].x}
                      y2={polyPts[1].y}
                      stroke="rgba(42,123,228,0.95)"
                      strokeWidth={2}
                    />
                  ) : null}
                  {zoneMode === 'polygon' && polyPts.length >= 3 ? (
                    <Polygon
                      points={polyString(polyPts)}
                      fill="rgba(42,123,228,0.18)"
                      stroke="rgba(42,123,228,0.95)"
                      strokeWidth={2}
                    />
                  ) : null}
                  {zoneMode === 'line' && linePts.length === 2 ? (
                    <Line
                      x1={linePts[0].x}
                      y1={linePts[0].y}
                      x2={linePts[1].x}
                      y2={linePts[1].y}
                      stroke="rgba(42,123,228,0.95)"
                      strokeWidth={3}
                    />
                  ) : null}
                  {zoneMode === 'line' && linePts.length === 1 ? (
                    <Circle cx={linePts[0].x} cy={linePts[0].y} r={5} fill="rgba(42,123,228,1)" stroke="#fff" strokeWidth={2} />
                  ) : null}
                  {zoneMode === 'motion_rois'
                    ? motionDone.flatMap((poly, pi) =>
                        poly.map((p, i) => (
                          <Circle
                            key={`md-${pi}-${i}`}
                            cx={p.x}
                            cy={p.y}
                            r={5}
                            fill="rgba(42,123,228,1)"
                            stroke="#fff"
                            strokeWidth={2}
                          />
                        )),
                      )
                    : null}
                  {zoneMode === 'motion_rois'
                    ? motionCur.map((p, i) => (
                        <Circle key={`mc-${i}`} cx={p.x} cy={p.y} r={5} fill="rgba(42,123,228,1)" stroke="#fff" strokeWidth={2} />
                      ))
                    : null}
                  {zoneMode === 'polygon'
                    ? polyPts.map((p, i) => (
                        <Circle
                          key={`p-${i}`}
                          cx={p.x}
                          cy={p.y}
                          r={5}
                          fill="rgba(42,123,228,1)"
                          stroke="#fff"
                          strokeWidth={2}
                        />
                      ))
                    : null}
                </Svg>
                <Pressable
                  style={[StyleSheet.absoluteFill, {zIndex: 4}]}
                  onPress={e => {
                    const {locationX, locationY} = e.nativeEvent;
                    onCanvasPress(locationX, locationY);
                  }}
                />
              </View>
            </ScrollView>
          )}

          <View style={styles.toolbar}>
            {zoneMode === 'motion_rois' ? (
              <Pressable
                style={[styles.tbBtn, {borderColor: border}]}
                onPress={completeRoi}
                disabled={busy || motionCur.length < 3}>
                <Text style={[styles.tbBtnText, {color: colors.text}]}>Complete ROI</Text>
              </Pressable>
            ) : null}
            <Pressable style={[styles.tbBtn, {borderColor: border}]} onPress={undo} disabled={busy}>
              <Text style={[styles.tbBtnText, {color: colors.text}]}>Undo</Text>
            </Pressable>
            <Pressable style={[styles.tbBtn, {borderColor: border}]} onPress={clear} disabled={busy}>
              <Text style={[styles.tbBtnText, {color: colors.text}]}>Clear</Text>
            </Pressable>
          </View>

          <View style={styles.footer}>
            <Pressable
              style={[styles.secondaryBtn, {borderColor: border}]}
              onPress={onClose}
              disabled={busy}>
              <Text style={[styles.secondaryBtnText, {color: colors.text}]}>Cancel</Text>
            </Pressable>
            <Pressable
              style={[styles.primaryBtn, {backgroundColor: colors.accent}]}
              onPress={save}
              disabled={busy || !layoutW}>
              {busy ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.primaryBtnText}>Save & send</Text>
              )}
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  sheet: {
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    maxHeight: Dimensions.get('window').height * 0.88,
    overflow: 'hidden',
  },
  sheetHeader: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
  },
  sheetTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  sheetSub: {
    fontSize: 12,
    marginTop: 6,
    lineHeight: 17,
  },
  err: {
    padding: 16,
    fontSize: 14,
  },
  canvasWrap: {
    alignSelf: 'center',
    backgroundColor: '#111',
    borderRadius: 12,
    overflow: 'hidden',
  },
  toolbar: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    paddingHorizontal: 12,
    paddingTop: 12,
  },
  tbBtn: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
  },
  tbBtnText: {
    fontSize: 13,
    fontWeight: '600',
  },
  footer: {
    flexDirection: 'row',
    gap: 10,
    padding: 16,
    paddingTop: 8,
  },
  secondaryBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
  },
  secondaryBtnText: {
    fontSize: 15,
    fontWeight: '600',
  },
  primaryBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
  },
  primaryBtnText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },
});
