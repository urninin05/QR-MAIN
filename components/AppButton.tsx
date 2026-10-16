
import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, StyleSheet, Text } from 'react-native';

import { COLORS } from '@/constants/colors';

type Props = {
  title: string;
  icon: keyof typeof Ionicons.glyphMap;
  theme?: 'primary';
  onPress: () => void;
};

export default function AppButton({ title, icon, theme, onPress }: Props) {
  const isPrimary = theme === 'primary';

  return (
    <Pressable
      style={({ pressed }) => [
        styles.button,
        {
          backgroundColor: isPrimary ? COLORS.primary : COLORS.card,
          borderColor: isPrimary ? COLORS.primary : COLORS.border,
          opacity: pressed ? 0.8 : 1,
        },
      ]}
      onPress={onPress}
    >
      <Ionicons
        name={icon}
        size={22}
        color={isPrimary ? COLORS.textOnPrimary : COLORS.primary}
        style={styles.icon}
      />

      <Text
        style={[
          styles.label,
          {
            color: isPrimary ? COLORS.textOnPrimary : COLORS.primary,
          },
        ]}
      >
        {title}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    width: '100%',
    marginBottom: 14,
    borderWidth: 1,
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 5,
    elevation: 2,
  },

  icon: {
    marginRight: 10,
  },

  label: {
    fontSize: 16,
    fontWeight: '600',
  },
});
