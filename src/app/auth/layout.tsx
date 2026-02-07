import { Target } from "lucide-react";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background p-4">
       <div className="absolute inset-0 -z-10 h-full w-full bg-[linear-gradient(to_right,#8080800a_1px,transparent_1px),linear-gradient(to_bottom,#8080800a_1px,transparent_1px)] bg-[size:14px_24px]"></div>
       <div className="mb-8 flex items-center gap-2 text-2xl font-bold text-primary">
          <Target className="h-8 w-8" />
          <h1 className="font-headline">GoalMind</h1>
        </div>
      {children}
    </div>
  );
}
