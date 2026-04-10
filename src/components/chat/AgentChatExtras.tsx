import React, {useEffect, useState, useMemo, useCallback} from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  ActivityIndicator,
  TouchableOpacity,
  ScrollView,
  Platform,
} from 'react-native';
import type {
  AgentChatMessageResponse,
  PendingApprovalPayload,
} from '../../api';
import {getToken, getAuthenticatedCameraSnapshotUrl} from '../../api';
import {useTheme} from '../../context/ThemeContext';
import PendingApprovalCard from './PendingApprovalCard';
import ZoneEditorModal, {type ZoneEditorMode} from './ZoneEditorModal';

interface Props {
  envelope: AgentChatMessageResponse;
  onApprovalDecision: (decision: 'approve' | 'reject') => void;
  onZoneSave: (zoneData: unknown) => Promise<void> | void;
  resumeBusy?: boolean;
}

function withAuthToken(url: string): Promise<string> {
  return (async () => {
    const t = await getToken();
    if (!t) {
      return url;
    }
    const sep = url.includes('?') ? '&' : '?';
    return `${url}${sep}token=${encodeURIComponent(t)}`;
  })();
}

/**
 * Agent-only UI below the assistant bubble — mirrors `layout/chatbot-core.js` + zone editor:
 * approval card, zone drawing (modal canvas), flow JSON preview.
 */
export default function AgentChatExtras({
  envelope,
  onApprovalDecision,
  onZoneSave,
  resumeBusy,
}: Props) {
  const {colors, isDark} = useTheme();

  const [snapUri, setSnapUri] = useState<string | null>(null);
  const [snapLoading, setSnapLoading] = useState(false);
  const [zoneModal, setZoneModal] = useState(false);
  const [zoneBusy, setZoneBusy] = useState(false);

  const pendingZ = envelope.pending_zone_input as
    | {camera_id?: string; frame_snapshot_url?: string; zone_type?: string}
    | null
    | undefined;

  const cameraId =
    envelope.camera_id ?? pendingZ?.camera_id ?? null;

  const rawZoneType =
    envelope.zone_type ?? pendingZ?.zone_type ?? 'polygon';

  const zoneMode: ZoneEditorMode = useMemo(() => {
    const z = String(rawZoneType).toLowerCase();
    if (z === 'line') {
      return 'line';
    }
    if (z === 'motion_rois' || z === 'motion_roi') {
      return 'motion_rois';
    }
    return 'polygon';
  }, [rawZoneType]);

  const needsZone =
    envelope.zone_required ||
    envelope.awaiting_zone_input ||
    !!envelope.pending_zone_input;

  const hasApproval = envelope.pending_approval != null;
  const hasFlow = envelope.flow_diagram_data != null;

  useEffect(() => {
    if (!needsZone) {
      setSnapUri(null);
      setSnapLoading(false);
      return;
    }
    let alive = true;
    setSnapLoading(true);
    (async () => {
      try {
        if (envelope.frame_snapshot_url) {
          const u = await withAuthToken(envelope.frame_snapshot_url);
          if (alive) {
            setSnapUri(u);
          }
          return;
        }
        if (pendingZ?.frame_snapshot_url) {
          const u = await withAuthToken(pendingZ.frame_snapshot_url);
          if (alive) {
            setSnapUri(u);
          }
          return;
        }
        if (cameraId) {
          const u = await getAuthenticatedCameraSnapshotUrl(cameraId);
          if (alive) {
            setSnapUri(u);
          }
          return;
        }
        if (alive) {
          setSnapUri(null);
        }
      } catch {
        if (alive) {
          setSnapUri(null);
        }
      } finally {
        if (alive) {
          setSnapLoading(false);
        }
      }
    })();
    return () => {
      alive = false;
    };
  }, [
    needsZone,
    envelope.frame_snapshot_url,
    pendingZ?.frame_snapshot_url,
    cameraId,
    envelope,
  ]);

  const canDrawZone = needsZone && !!cameraId && !!snapUri && !snapLoading;

  const handleZoneSave = useCallback(
    async (zoneData: unknown) => {
      setZoneBusy(true);
      try {
        await onZoneSave(zoneData);
      } finally {
        setZoneBusy(false);
      }
    },
    [onZoneSave],
  );

  if (!needsZone && !hasApproval && !hasFlow) {
    return null;
  }

  const border = isDark ? '#3e3e52' : '#dde1f0';
  const cardBg = isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)';

  return (
    <View style={styles.wrap}>
      {hasApproval ? (
        <PendingApprovalCard
          approval={envelope.pending_approval as PendingApprovalPayload}
          onApprove={() => onApprovalDecision('approve')}
          onReject={() => onApprovalDecision('reject')}
          busy={resumeBusy}
        />
      ) : null}

      {needsZone ? (
        <View style={[styles.zoneCard, {borderColor: border, backgroundColor: cardBg}]}>
          <Text style={[styles.zoneTitle, {color: colors.text}]}>Zone</Text>
          <Text style={[styles.zoneSub, {color: colors.subText}]}>
            {zoneMode === 'line'
              ? 'Draw a counting line on the snapshot.'
              : zoneMode === 'motion_rois'
                ? 'Draw one polygon per machine area, then Save.'
                : 'Draw a closed zone (3+ points) on the snapshot.'}
          </Text>
          {snapLoading ? (
            <View style={styles.snapLoading}>
              <ActivityIndicator color={colors.accent} />
              <Text style={[styles.zoneSub, {color: colors.subText, marginTop: 8}]}>
                Loading snapshot…
              </Text>
            </View>
          ) : !cameraId ? (
            <Text style={[styles.warn, {color: colors.danger}]}>
              Camera ID missing — cannot load snapshot.
            </Text>
          ) : !snapUri ? (
            <Text style={[styles.warn, {color: colors.danger}]}>
              Could not resolve snapshot URL.
            </Text>
          ) : (
            <View style={styles.previewBox}>
              <Image
                source={{uri: snapUri}}
                style={styles.previewImg}
                resizeMode="cover"
              />
              <TouchableOpacity
                style={[styles.drawBtn, {backgroundColor: colors.accent}]}
                onPress={() => setZoneModal(true)}
                disabled={!canDrawZone || resumeBusy}
                activeOpacity={0.85}>
                <Text style={styles.drawBtnText}>Draw zone</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      ) : null}

      {hasFlow && envelope.flow_diagram_data ? (
        <View style={[styles.flowCard, {borderColor: border, backgroundColor: cardBg}]}>
          <Text style={[styles.zoneTitle, {color: colors.text}]}>Flow diagram</Text>
          <ScrollView
            style={styles.flowScroll}
            nestedScrollEnabled
            showsVerticalScrollIndicator>
            <Text style={[styles.flowJson, {color: colors.subText}]}>
              {JSON.stringify(envelope.flow_diagram_data, null, 2)}
            </Text>
          </ScrollView>
        </View>
      ) : null}

      {snapUri && cameraId ? (
        <ZoneEditorModal
          visible={zoneModal}
          onClose={() => !zoneBusy && setZoneModal(false)}
          snapshotUri={snapUri}
          cameraId={cameraId}
          zoneMode={zoneMode}
          busy={zoneBusy || !!resumeBusy}
          onSave={handleZoneSave}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginTop: 10,
    gap: 10,
    width: '100%',
  },
  zoneCard: {
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 12,
  },
  zoneTitle: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 4,
  },
  zoneSub: {
    fontSize: 12,
    lineHeight: 18,
    marginBottom: 10,
  },
  snapLoading: {
    paddingVertical: 20,
    alignItems: 'center',
  },
  warn: {
    fontSize: 12,
    paddingVertical: 8,
  },
  previewBox: {
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: '#111',
  },
  previewImg: {
    width: '100%',
    height: 160,
    backgroundColor: '#111',
  },
  drawBtn: {
    paddingVertical: 12,
    alignItems: 'center',
  },
  drawBtnText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
  flowCard: {
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 12,
  },
  flowScroll: {
    maxHeight: 200,
  },
  flowJson: {
    fontFamily: Platform.select({ios: 'Menlo', android: 'monospace', default: 'monospace'}),
    fontSize: 10,
    lineHeight: 14,
  },
});
