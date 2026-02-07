import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ArrowUpRight, Calendar, HeartPulse, PlusCircle, Users } from "lucide-react";
import Link from "next/link";
import { players, sessions } from "@/lib/mock-data";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

export default function DashboardPage() {
  const activePlayers = players.filter(p => p.status === 'active').length;
  const injuredPlayers = players.filter(p => p.status === 'injured');
  const upcomingSession = sessions[0];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between space-y-2">
        <h1 className="text-3xl font-bold tracking-tight font-headline">Dashboard</h1>
        <div className="flex items-center space-x-2">
          <Button>
            <PlusCircle className="mr-2 h-4 w-4" />
            New Evaluation
          </Button>
        </div>
      </div>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Players</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{activePlayers}</div>
            <p className="text-xs text-muted-foreground">
              +2 from last month
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Injured Players</CardTitle>
            <HeartPulse className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{injuredPlayers.length}</div>
            <p className="text-xs text-muted-foreground">
              1 recovery pending
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Upcoming Session</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{upcomingSession.type}</div>
            <p className="text-xs text-muted-foreground">
              {upcomingSession.date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Compliance</CardTitle>
            <CardTitle className="text-sm font-medium text-accent">92%</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">Goals</div>
            <p className="text-xs text-muted-foreground">
              Player objectives on track
            </p>
          </CardContent>
        </Card>
      </div>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
        <Card className="col-span-4">
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
            <CardDescription>
              Overview of recent evaluations and updates.
            </CardDescription>
          </CardHeader>
          <CardContent className="pl-2">
            {/* This would be a list of recent activities */}
            <p className="text-sm text-muted-foreground p-4">No recent activity to show.</p>
          </CardContent>
        </Card>
        <Card className="col-span-3">
          <CardHeader>
            <CardTitle>Players on Watchlist</CardTitle>
            <CardDescription>
              Players requiring attention or follow-up.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {players.slice(0, 4).map((player) => (
                <div key={player.id} className="flex items-center">
                  <Avatar className="h-9 w-9">
                    <AvatarImage src={player.avatarUrl} alt="Avatar" data-ai-hint="person portrait" />
                    <AvatarFallback>{player.firstName[0]}{player.lastName[0]}</AvatarFallback>
                  </Avatar>
                  <div className="ml-4 space-y-1">
                    <p className="text-sm font-medium leading-none">{player.firstName} {player.lastName}</p>
                    <p className="text-sm text-muted-foreground">{player.primaryPosition}</p>
                  </div>
                  <Link href={`/dashboard/players/${player.id}`} className="ml-auto">
                    <Button variant="ghost" size="sm">
                       View <ArrowUpRight className="h-4 w-4 ml-2" />
                    </Button>
                  </Link>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
