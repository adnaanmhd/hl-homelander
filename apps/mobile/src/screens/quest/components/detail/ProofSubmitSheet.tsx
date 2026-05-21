import React, { useState } from 'react';
import { Alert, Image, StyleSheet, TextInput, View } from 'react-native';
import { launchImageLibrary, type Asset } from 'react-native-image-picker';
import { Sheet } from '../../../../ui/primitives/Sheet';
import { Pressable } from '../../../../ui/primitives/Pressable';
import { Text } from '../../../../ui/primitives/Text';
import { colors, radii, spacing } from '../../../../ui/tokens';

interface Props {
  visible: boolean;
  stageTitle: string;
  needsProof: boolean;
  submissionType: string;
  maxScreenshots: number;
  onDismiss: () => void;
  onSubmit: (payload: {
    proofValue: string;
    images: { uri: string; fileName?: string }[];
  }) => Promise<void>;
  isSubmitting: boolean;
}

export default function ProofSubmitSheet({
  visible,
  stageTitle,
  needsProof,
  submissionType,
  maxScreenshots,
  onDismiss,
  onSubmit,
  isSubmitting,
}: Props) {
  const [proofValue, setProofValue] = useState('');
  const [images, setImages] = useState<Asset[]>([]);

  const isScreenshot = submissionType === 'SCREENSHOT' || needsProof;

  const pickImages = () => {
    launchImageLibrary(
      {
        mediaType: 'photo',
        selectionLimit: maxScreenshots || 3,
        quality: 0.8,
      },
      (res) => {
        if (res.didCancel || res.errorMessage) return;
        if (res.assets?.length) {
          setImages(res.assets);
        }
      },
    );
  };

  const handleSubmit = async () => {
    if (isScreenshot && images.length === 0) {
      Alert.alert('Proof required', 'Please add at least one screenshot.');
      return;
    }
    if (!isScreenshot && !proofValue.trim()) {
      Alert.alert('Proof required', 'Please enter your proof link or ID.');
      return;
    }
    await onSubmit({
      proofValue: proofValue.trim(),
      images: images
        .filter((a) => a.uri)
        .map((a) => {
          const entry: { uri: string; fileName?: string } = { uri: a.uri! };
          if (a.fileName) entry.fileName = a.fileName;
          return entry;
        }),
    });
    setProofValue('');
    setImages([]);
    onDismiss();
  };

  return (
    <Sheet visible={visible} onDismiss={onDismiss} accessibilityLabel="Submit proof">
      <Text variant="sheetTitle" style={{ color: colors.text, marginBottom: spacing.s }}>
        Submit proof
      </Text>
      <Text variant="body" tone="secondary" style={{ marginBottom: spacing.l }}>
        {stageTitle}
      </Text>

      {isScreenshot ? (
        <>
          <Pressable onPress={pickImages} style={styles.pickBtn}>
            <Text variant="pillLabel" style={{ color: colors.accent }}>
              {images.length ? `CHANGE PHOTOS (${images.length})` : 'ADD SCREENSHOTS'}
            </Text>
          </Pressable>
          <View style={styles.thumbRow}>
            {images.map((img, i) =>
              img.uri ? <Image key={i} source={{ uri: img.uri }} style={styles.thumb} /> : null,
            )}
          </View>
        </>
      ) : (
        <TextInput
          value={proofValue}
          onChangeText={setProofValue}
          placeholder={`Enter ${submissionType.toLowerCase()} proof`}
          placeholderTextColor={colors.text3}
          style={styles.input}
          autoCapitalize="none"
        />
      )}

      <Pressable
        onPress={handleSubmit}
        disabled={isSubmitting}
        style={[styles.btn, isSubmitting && styles.btnDisabled]}
      >
        <Text variant="pillLabel" style={{ color: colors.surface }}>
          {isSubmitting ? 'SUBMITTING…' : 'SUBMIT PROOF'}
        </Text>
      </Pressable>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  pickBtn: {
    borderWidth: 1,
    borderColor: colors.accent,
    borderRadius: radii.chip,
    paddingVertical: spacing.ms,
    alignItems: 'center',
    marginBottom: spacing.m,
  },
  thumbRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.s, marginBottom: spacing.l },
  thumb: { width: 72, height: 72, borderRadius: radii.chip },
  input: {
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radii.chip,
    padding: spacing.m,
    color: colors.text,
    marginBottom: spacing.l,
    fontSize: 16,
  },
  btn: {
    backgroundColor: colors.accent,
    borderRadius: radii.chip,
    paddingVertical: spacing.ms,
    alignItems: 'center',
  },
  btnDisabled: { opacity: 0.5 },
});
