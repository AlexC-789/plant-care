import type { ReactNode } from "react";
import { StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { space, useTheme } from "@/theme";

/** The screen's primary action(s), pinned under the scrolling content and above the bottom safe area. */
export function BottomBar({ children }: { children: ReactNode }) {
  const { colors } = useTheme();
  const { bottom } = useSafeAreaInsets();
  return (
    <View
      testID="bottom-bar"
      style={[
        styles.bar,
        { backgroundColor: colors.background, paddingBottom: space.m + bottom },
      ]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { paddingHorizontal: space.l, paddingTop: space.m, gap: space.s },
});
