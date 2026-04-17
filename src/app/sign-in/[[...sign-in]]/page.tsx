import { SignIn } from '@clerk/nextjs';

export const dynamic = 'force-dynamic';

export default function SignInPage() {
  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <SignIn signUpUrl="/sign-up" forceRedirectUrl="/app" />
    </main>
  );
}
