import { redirect } from 'next/navigation';
import Link from 'next/link';
import { auth } from '@/server/auth';
import { db } from '@/server/db';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Plus, Folder, Image, Settings } from 'lucide-react';

export default async function DashboardPage() {
  const session = await auth();

  if (!session?.user) {
    redirect('/auth/signin');
  }

  // Fetch user's projects
  const projects = await db.project.findMany({
    where: { userId: session.user.id },
    orderBy: { updatedAt: 'desc' },
    take: 6,
    select: {
      id: true,
      name: true,
      thumbnail: true,
      updatedAt: true,
    },
  });

  // Fetch user's stickers count
  const stickersCount = await db.sticker.count({
    where: { userId: session.user.id },
  });

  return (
    <div className="min-h-screen bg-muted/30">
      {/* Header */}
      <header className="border-b bg-background">
        <div className="container flex h-16 items-center justify-between">
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <div className="flex items-center gap-4">
            <Link href="/settings">
              <Button variant="ghost" size="icon">
                <Settings className="h-5 w-5" />
              </Button>
            </Link>
            <Link href="/editor">
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                New Project
              </Button>
            </Link>
          </div>
        </div>
      </header>

      <main className="container py-8">
        {/* Stats */}
        <div className="mb-8 grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Total Projects</CardTitle>
              <Folder className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{projects.length}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">My Stickers</CardTitle>
              <Image className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stickersCount}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Welcome</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-lg font-medium">{session.user.name || session.user.email}</div>
            </CardContent>
          </Card>
        </div>

        {/* Recent Projects */}
        <div>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-xl font-semibold">Recent Projects</h2>
            <Link href="/projects" className="text-sm text-primary hover:underline">
              View all
            </Link>
          </div>

          {projects.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Folder className="mb-4 h-12 w-12 text-muted-foreground" />
                <CardDescription className="mb-4 text-center">
                  You haven&apos;t created any projects yet.
                  <br />
                  Start creating your first sticker art!
                </CardDescription>
                <Link href="/editor">
                  <Button>
                    <Plus className="mr-2 h-4 w-4" />
                    Create Project
                  </Button>
                </Link>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {projects.map((project) => (
                <Link key={project.id} href={`/editor/${project.id}`}>
                  <Card className="cursor-pointer transition-shadow hover:shadow-md">
                    <div className="aspect-video bg-muted">
                      {project.thumbnail ? (
                        <img
                          src={project.thumbnail}
                          alt={project.name}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="flex h-full items-center justify-center">
                          <Folder className="h-8 w-8 text-muted-foreground" />
                        </div>
                      )}
                    </div>
                    <CardHeader className="p-4">
                      <CardTitle className="text-base">{project.name}</CardTitle>
                      <CardDescription className="text-xs">
                        Updated {new Date(project.updatedAt).toLocaleDateString()}
                      </CardDescription>
                    </CardHeader>
                  </Card>
                </Link>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
