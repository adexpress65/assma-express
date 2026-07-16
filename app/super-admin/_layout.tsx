import { Stack } from "expo-router";

/**
 * Navigation super-admin : pas d’en-tête natif par défaut (les écrans gèrent leur header).
 */
export default function SuperAdminLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: "slide_from_right",
      }}
    />
  );
}
