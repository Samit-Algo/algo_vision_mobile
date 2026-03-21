import React from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Image,
  StyleSheet,
} from 'react-native';
import {Attachment} from '../../types/chat';
import {useTheme} from '../../context/ThemeContext';

interface Props {
  attachments: Attachment[];
  onRemove: (id: string) => void;
}

function AttachmentItem({
  attachment,
  onRemove,
}: {
  attachment: Attachment;
  onRemove: () => void;
}) {
  const isImage = attachment.type === 'image';
  const fileIcon = attachment.type === 'video' ? 'VID' : 'DOC';
  // Attachment chip text should remain readable in both themes.
  const {colors, isDark} = useTheme();

  return (
    <View style={styles.item}>
      {isImage ? (
        <Image
          source={{uri: attachment.uri}}
          style={styles.imageThumb}
          resizeMode="cover"
        />
      ) : (
        <View style={styles.fileThumb}>
          <Text style={styles.fileIcon}>{fileIcon}</Text>
        </View>
      )}
      <Text
        style={[styles.fileName, {color: isDark ? colors.subText : '#666'}]}
        numberOfLines={1}>
        {attachment.name}
      </Text>
      <TouchableOpacity style={styles.removeBtn} onPress={onRemove}>
        <Text style={styles.removeIcon}>✕</Text>
      </TouchableOpacity>
    </View>
  );
}

export default function AttachmentPreview({attachments, onRemove}: Props) {
  const {colors, isDark} = useTheme();
  if (attachments.length === 0) {
    return null;
  }

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: isDark ? colors.inputBg : '#ffffff',
          borderTopColor: colors.divider,
        },
      ]}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scroll}>
        {attachments.map(att => (
          <AttachmentItem
            key={att.id}
            attachment={att}
            onRemove={() => onRemove(att.id)}
          />
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#f8f9ff',
    borderTopWidth: 1,
    borderTopColor: '#eef1ff',
    paddingVertical: 10,
  },
  scroll: {
    paddingHorizontal: 12,
    gap: 10,
  },
  item: {
    alignItems: 'center',
    width: 72,
    position: 'relative',
  },
  imageThumb: {
    width: 64,
    height: 64,
    borderRadius: 10,
    backgroundColor: '#ddd',
  },
  fileThumb: {
    width: 64,
    height: 64,
    borderRadius: 10,
    backgroundColor: '#eef1ff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  fileIcon: {
    fontSize: 20,
    fontWeight: '900',
  },
  fileName: {
    fontSize: 10,
    color: '#666',
    marginTop: 4,
    textAlign: 'center',
    width: 68,
  },
  removeBtn: {
    position: 'absolute',
    top: -4,
    right: -4,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#e74c3c',
    alignItems: 'center',
    justifyContent: 'center',
  },
  removeIcon: {
    color: '#fff',
    fontSize: 9,
    fontWeight: '800',
  },
});
