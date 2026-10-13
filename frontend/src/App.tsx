import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

export default function App() {
  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col justify-center gap-6 p-8">
      <div className="space-y-2">
        <div className="flex items-center gap-3">
          <h1 className="text-3xl font-semibold tracking-tight">
            Relay analytics
          </h1>
          <Badge variant="secondary">Phase 0 scaffold</Badge>
        </div>
        <p className="text-muted-foreground">
          &ldquo;Is this week normal for us?&rdquo; Tailwind CSS and shadcn/ui are
          wired up and rendering.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Scaffold verification</CardTitle>
          <CardDescription>
            If this card is styled and the button below is interactive, Tailwind
            and the shadcn/ui primitives are working.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <Button>Default</Button>
            <Button variant="secondary">Secondary</Button>
            <Button variant="outline">Outline</Button>
            <Button variant="ghost">Ghost</Button>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge>Default</Badge>
            <Badge variant="secondary">Secondary</Badge>
            <Badge variant="outline">Outline</Badge>
          </div>
        </CardContent>
      </Card>
    </main>
  );
}