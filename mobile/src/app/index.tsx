import { Redirect } from 'expo-router';

/** The launcher opens "/" — send it to the tabs, whose auth gate then decides
 * between the sign-in screen and the dashboard. */
export default function Index() {
  return <Redirect href="/(tabs)/home" />;
}
