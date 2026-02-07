import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { PlusCircle } from "lucide-react";
import { PlayerTable } from "@/components/players/PlayerTable";
import { players } from "@/lib/mock-data";

export default function PlayersPage() {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between space-y-2">
        <h1 className="text-3xl font-bold tracking-tight font-headline">Players</h1>
        <div className="flex items-center space-x-2">
          <Button>
            <PlusCircle className="mr-2 h-4 w-4" />
            Add Player
          </Button>
        </div>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Player Roster</CardTitle>
          <CardDescription>Manage your club's players and view their profiles.</CardDescription>
        </CardHeader>
        <CardContent>
          <PlayerTable players={players} />
        </CardContent>
      </Card>
    </div>
  );
}
