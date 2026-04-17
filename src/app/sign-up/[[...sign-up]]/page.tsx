import { SignUp } from '@clerk/nextjs';

export const dynamic = 'force-dynamic';

export default function SignUpPage() {
  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <SignUp signInUrl="/sign-in" forceRedirectUrl="/app" />
    </main>
  );
}
