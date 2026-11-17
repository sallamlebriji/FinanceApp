import { Redirect } from 'expo-router';

/** Signed-out entry point: the protected-route guard lands here; send people to Sign In. */
export default function AuthIndex() {
  return <Redirect href="/sign-in" />;
}
